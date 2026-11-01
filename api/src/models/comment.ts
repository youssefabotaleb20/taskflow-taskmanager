import { Schema, model } from "mongoose";
import { cleanJSON } from "../utils/toJSON.js";

const commentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

commentSchema.index({ task: 1, createdAt: 1 });
cleanJSON(commentSchema);

export const CommentModel = model("Comment", commentSchema);
