import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { HttpError } from "../utils/httpError.js";

export const notFound: RequestHandler = (req) => {
  throw new HttpError(404, "not_found", `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, [v.message]]));
    res.status(400).json({ error: { code: "bad_request", message: "Validation failed", details } });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "bad_request", message: "Malformed JSON body" } });
    return;
  }
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
};
