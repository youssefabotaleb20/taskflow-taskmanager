import { ProjectModel, type ProjectDoc } from "../models/project.js";
import { TaskModel, type TaskDoc } from "../models/task.js";
import { HttpError } from "../utils/httpError.js";
import { parseId } from "../utils/validate.js";

export const isMember = (project: ProjectDoc, userId: string) =>
  project.members.some((m) => m.toString() === userId);

/** Loads a project the user belongs to. Non-members get 404 so ids don't leak. */
export async function getProjectForMember(projectId: unknown, userId: string): Promise<ProjectDoc> {
  const project = await ProjectModel.findById(parseId(projectId, "Project"));
  if (!project || !isMember(project, userId)) throw HttpError.notFound("Project");
  return project;
}

export async function getProjectForOwner(projectId: unknown, userId: string): Promise<ProjectDoc> {
  const project = await getProjectForMember(projectId, userId);
  if (project.owner.toString() !== userId) throw HttpError.forbidden("Only the project owner can do that");
  return project;
}

export async function getTaskForMember(taskId: unknown, userId: string): Promise<{ task: TaskDoc; project: ProjectDoc }> {
  const task = await TaskModel.findById(parseId(taskId, "Task"));
  if (!task || task.deletedAt) throw HttpError.notFound("Task");
  const project = await ProjectModel.findById(task.project);
  if (!project || !isMember(project, userId)) throw HttpError.notFound("Task");
  return { task, project };
}
