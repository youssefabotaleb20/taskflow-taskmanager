import { Router } from "express";
import { z } from "zod";
import { ProjectModel } from "../models/project.js";
import { TaskModel } from "../models/task.js";
import { CommentModel } from "../models/comment.js";
import { UserModel } from "../models/user.js";
import { getProjectForMember, getProjectForOwner } from "../services/access.js";
import { HttpError } from "../utils/httpError.js";
import { parse, parseId } from "../utils/validate.js";
import { pageMeta, paginationSchema } from "../utils/pagination.js";

const router = Router();

const MEMBER_FIELDS = "name email";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});
const updateSchema = createSchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");
const addMemberSchema = z.object({ email: z.string().trim().toLowerCase().email() });

router.get("/", async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const filter = { members: req.userId };
  const [data, total] = await Promise.all([
    ProjectModel.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("owner", MEMBER_FIELDS),
    ProjectModel.countDocuments(filter),
  ]);
  res.json({ data, ...pageMeta(page, limit, total) });
});

router.post("/", async (req, res) => {
  const body = parse(createSchema, req.body);
  const project = await ProjectModel.create({ ...body, owner: req.userId, members: [req.userId] });
  await project.populate([{ path: "owner", select: MEMBER_FIELDS }, { path: "members", select: MEMBER_FIELDS }]);
  res.status(201).json({ project });
});

router.get("/:projectId", async (req, res) => {
  const project = await getProjectForMember(req.params.projectId, req.userId!);
  await project.populate([{ path: "owner", select: MEMBER_FIELDS }, { path: "members", select: MEMBER_FIELDS }]);
  const counts = await TaskModel.aggregate<{ _id: string; count: number }>([
    { $match: { project: project._id, deletedAt: null } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const taskCounts = { todo: 0, in_progress: 0, done: 0, ...Object.fromEntries(counts.map((c) => [c._id, c.count])) };
  res.json({ project, taskCounts });
});

router.patch("/:projectId", async (req, res) => {
  const project = await getProjectForOwner(req.params.projectId, req.userId!);
  project.set(parse(updateSchema, req.body));
  await project.save();
  res.json({ project });
});

router.delete("/:projectId", async (req, res) => {
  const project = await getProjectForOwner(req.params.projectId, req.userId!);
  const taskIds = await TaskModel.find({ project: project._id }).distinct("_id");
  await Promise.all([
    CommentModel.deleteMany({ task: { $in: taskIds } }),
    TaskModel.deleteMany({ project: project._id }),
    project.deleteOne(),
  ]);
  res.status(204).end();
});

router.post("/:projectId/members", async (req, res) => {
  const project = await getProjectForOwner(req.params.projectId, req.userId!);
  const { email } = parse(addMemberSchema, req.body);
  const user = await UserModel.findOne({ email });
  if (!user) throw HttpError.notFound("User with that email");
  if (project.members.some((m) => m.toString() === user.id)) throw HttpError.conflict("Already a member");
  project.members.push(user._id);
  await project.save();
  await project.populate([{ path: "owner", select: MEMBER_FIELDS }, { path: "members", select: MEMBER_FIELDS }]);
  res.status(201).json({ project });
});

router.delete("/:projectId/members/:userId", async (req, res) => {
  const project = await getProjectForMember(req.params.projectId, req.userId!);
  const targetId = parseId(req.params.userId, "Member");
  const isOwner = project.owner.toString() === req.userId;
  // Owners can remove anyone else; members can only remove themselves (leave the project).
  if (!isOwner && targetId !== req.userId) throw HttpError.forbidden("Only the project owner can remove members");
  if (targetId === project.owner.toString()) throw HttpError.badRequest("The owner can't be removed from the project");
  if (!project.members.some((m) => m.toString() === targetId)) throw HttpError.notFound("Member");
  project.members = project.members.filter((m) => m.toString() !== targetId);
  await project.save();
  // Unassign their open tasks in this project.
  await TaskModel.updateMany({ project: project._id, assignee: targetId }, { assignee: null });
  res.status(204).end();
});

export default router;
