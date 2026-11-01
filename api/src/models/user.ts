import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { cleanJSON } from "../utils/toJSON.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

cleanJSON(userSchema, ["passwordHash"]);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model("User", userSchema);
