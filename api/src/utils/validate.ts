import { z, type ZodTypeAny } from "zod";
import { Types } from "mongoose";
import { HttpError } from "./httpError.js";

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw HttpError.badRequest("Validation failed", result.error.flatten().fieldErrors);
  }
  return result.data;
}

export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: "Invalid id" });

export function parseId(value: unknown, what = "Resource"): string {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) throw HttpError.notFound(what);
  return value;
}
