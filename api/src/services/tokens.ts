import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { RefreshTokenModel } from "../models/refreshToken.js";
import { HttpError } from "../utils/httpError.js";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) throw new Error("bad payload");
    return payload.sub;
  } catch {
    throw HttpError.unauthorized("Invalid or expired access token");
  }
}

/** Refresh tokens are opaque random strings; only their hash is stored. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("base64url");
  await RefreshTokenModel.create({
    user: userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

/** Exchanges a refresh token for a new pair. The old refresh token stops working (rotation). */
export async function rotateRefreshToken(token: string) {
  const existing = await RefreshTokenModel.findOneAndDelete({ tokenHash: sha256(token) });
  if (!existing || existing.expiresAt < new Date()) {
    throw HttpError.unauthorized("Invalid or expired refresh token");
  }
  const userId = existing.user.toString();
  return issueTokenPair(userId);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshTokenModel.deleteOne({ tokenHash: sha256(token) });
}

export async function issueTokenPair(userId: string) {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: await issueRefreshToken(userId),
  };
}
