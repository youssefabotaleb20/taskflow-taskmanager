import type { Schema } from "mongoose";

/** Expose `id` instead of `_id`, drop `__v` and any field listed in `hidden`. */
export function cleanJSON(schema: Schema, hidden: string[] = []): void {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      for (const key of hidden) delete ret[key];
      return ret;
    },
  });
}
