import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { cleanJSON } from "../utils/toJSON.js";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

const taskSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "todo" },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    commentCount: { type: Number, default: 0 },
    // Soft delete, so offline clients syncing with `updatedSince` learn about deletions.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Listing a project's tasks, and syncing changes since a timestamp (used by the mobile app).
taskSchema.index({ project: 1, status: 1, createdAt: -1 });
taskSchema.index({ project: 1, updatedAt: 1 });

cleanJSON(taskSchema);

export type Task = InferSchemaType<typeof taskSchema>;
export type TaskDoc = HydratedDocument<Task>;
export const TaskModel = model("Task", taskSchema);
