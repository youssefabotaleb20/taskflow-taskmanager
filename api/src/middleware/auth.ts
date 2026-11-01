import type { RequestHandler } from "express";
import { verifyAccessToken } from "../services/tokens.js";
import { HttpError } from "../utils/httpError.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw HttpError.unauthorized();
  req.userId = verifyAccessToken(header.slice("Bearer ".length));
  next();
};
