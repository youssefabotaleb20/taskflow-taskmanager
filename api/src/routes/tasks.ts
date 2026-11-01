import { Router } from "express";
import { z } from "zod";
import type { FilterQuery } from "mongoose";
import { TaskModel, TASK_PRIORITIES, TASK_STATUSES, type Task } from "../models/task.js";
import { CommentModel } from "../models/comment.js";
import { getProjectForMember, getTaskForMember, isMember } from "../services/access.js";
import type { ProjectDoc } from "../models/project.js";
import { HttpError } from "../utils/httpError.js";
import { objectId, parse, parseId } from "../utils/validate.js";
import { pageMeta, paginationSchema } from "../utils/pagination.js";

const router = Router();

const PEOPLE = "name email";
const populateTask = [
  { path: "assignee", select: PEOPLE },
  { path: "createdBy", select: PEOPLE },
];

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assignee: objectId.nullable(),
  dueDate: z.coerce.date().nullable(),
};

const createSchema = z.object(taskFields).partial().required({ title: true });
const updateSchema = z
  .object(taskFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

const listSchema = paginationSchema.extend({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignee: z.union([z.literal("me"), z.literal("none"), objectId]).optional(),
  q: z.string().trim().max(100).optional(),
  updatedSince: z.coerce.date().optional(),
  sort: z.enum(["createdAt", "-createdAt", "dueDate", "-dueDate", "priority", "updatedAt"]).default("-createdAt"),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function assertAssignable(project: ProjectDoc, assignee: string | null | undefined) {
  if (assignee && !isMember(project, assignee)) {
    throw HttpError.badRequest("Assignee must be a member of the project", { assignee: ["Not a project member"] });
  }
}

router.get("/projects/:projectId/tasks", async (req, res) => {
  const project = await getProjectForMember(req.params.projectId, req.userId!);
  const query = parse(listSchema, req.query);

  const filter: FilterQuery<Task> = { project: project._id };
  if (query.updatedSince) {
    // Sync mode: return everything changed since the timestamp, deletions included.
    filter.updatedAt = { $gt: query.updatedSince };
  } else {
    filter.deletedAt = null;
  }
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.assignee === "me") filter.assignee = req.userId;
  else if (query.assignee === "none") filter.assignee = null;
  else if (query.assignee) filter.assignee = query.assignee;
  if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: "i" };

  const sortField = query.sort.replace("-", "");
  const sort = { [sortField]: query.sort.startsWith("-") ? -1 : 1, _id: 1 } as Record<string, 1 | -1>;

  const [data, total] = await Promise.all([
    TaskModel.find(filter)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate(populateTask),
    TaskModel.countDocuments(filter),
  ]);
  res.json({ data, ...pageMeta(query.page, query.limit, total), serverTime: new Date().toISOString() });
});

router.post("/projects/:projectId/tasks", async (req, res) => {
  const project = await getProjectForMember(req.params.projectId, req.userId!);
  const body = parse(createSchema, req.body);
  assertAssignable(project, body.assignee);
  const task = await TaskModel.create({ ...body, project: project._id, createdBy: req.userId });
  await task.populate(populateTask);
  res.status(201).json({ task });
});

router.get("/tasks/:taskId", async (req, res) => {
  const { task } = await getTaskForMember(req.params.taskId, req.userId!);
  await task.populate(populateTask);
  res.json({ task });
});

router.patch("/tasks/:taskId", async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.taskId, req.userId!);
  const body = parse(updateSchema, req.body);
  assertAssignable(project, body.assignee);
  task.set(body);
  await task.save();
  await task.populate(populateTask);
  res.json({ task });
});

router.delete("/tasks/:taskId", async (req, res) => {
  const { task, project } = await getTaskForMember(req.params.taskId, req.userId!);
  const canDelete = task.createdBy.toString() === req.userId || project.owner.toString() === req.userId;
  if (!canDelete) throw HttpError.forbidden("Only the task creator or project owner can delete a task");
  task.deletedAt = new Date();
  await task.save();
  await CommentModel.deleteMany({ task: task._id });
  res.status(204).end();
});

// Comments

const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

router.get("/tasks/:taskId/comments", async (req, res) => {
  const { task } = await getTaskForMember(req.params.taskId, req.userId!);
  const { page, limit } = parse(paginationSchema, req.query);
  const [data, total] = await Promise.all([
    CommentModel.find({ task: task._id })
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("author", PEOPLE),
    CommentModel.countDocuments({ task: task._id }),
  ]);
  res.json({ data, ...pageMeta(page, limit, total) });
});

router.post("/tasks/:taskId/comments", async (req, res) => {
  const { task } = await getTaskForMember(req.params.taskId, req.userId!);
  const { body } = parse(commentSchema, req.body);
  const comment = await CommentModel.create({ task: task._id, author: req.userId, body });
  await TaskModel.updateOne({ _id: task._id }, { $inc: { commentCount: 1 } });
  await comment.populate("author", PEOPLE);
  res.status(201).json({ comment });
});

router.delete("/comments/:commentId", async (req, res) => {
  const comment = await CommentModel.findById(parseId(req.params.commentId, "Comment"));
  if (!comment) throw HttpError.notFound("Comment");
  const { project } = await getTaskForMember(comment.task.toString(), req.userId!);
  const canDelete = comment.author.toString() === req.userId || project.owner.toString() === req.userId;
  if (!canDelete) throw HttpError.forbidden("Only the author or project owner can delete a comment");
  await comment.deleteOne();
  await TaskModel.updateOne({ _id: comment.task }, { $inc: { commentCount: -1 } });
  res.status(204).end();
});

export default router;
