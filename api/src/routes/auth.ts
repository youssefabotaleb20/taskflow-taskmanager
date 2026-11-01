import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { UserModel } from "../models/user.js";
import { requireAuth } from "../middleware/auth.js";
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "../services/tokens.js";
import { HttpError } from "../utils/httpError.js";
import { parse } from "../utils/validate.js";
import { env } from "../config/env.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts, try again later" } },
});

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post("/register", authLimiter, async (req, res) => {
  const { name, email, password } = parse(registerSchema, req.body);
  if (await UserModel.exists({ email })) throw HttpError.conflict("An account with this email already exists");
  const user = await UserModel.create({ name, email, passwordHash: await bcrypt.hash(password, env.isTest ? 4 : 12) });
  res.status(201).json({ user, ...(await issueTokenPair(user.id)) });
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await UserModel.findOne({ email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw HttpError.unauthorized("Email or password is incorrect");
  }
  res.json({ user, ...(await issueTokenPair(user.id)) });
});

router.post("/refresh", authLimiter, async (req, res) => {
  const { refreshToken } = parse(refreshSchema, req.body);
  res.json(await rotateRefreshToken(refreshToken));
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = parse(refreshSchema, req.body);
  await revokeRefreshToken(refreshToken);
  res.status(204).end();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await UserModel.findById(req.userId);
  if (!user) throw HttpError.unauthorized();
  res.json({ user });
});

export default router;
