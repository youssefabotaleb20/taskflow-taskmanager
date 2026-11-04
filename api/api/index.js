// Vercel serverless entry point. `npm run build` compiles src/ to dist/ first.
// The MongoDB connection is opened once per warm instance and reused across requests.
import { createApp } from "../dist/app.js";
import { connectDb } from "../dist/db.js";
import { env } from "../dist/config/env.js";

const app = createApp();
let ready = null;

export default async function handler(req, res) {
  try {
    ready ??= connectDb(env.MONGODB_URI);
    await ready;
  } catch (err) {
    ready = null; // try again on the next request
    console.error("MongoDB connection failed", err);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { code: "db_unavailable", message: "Database unavailable, try again shortly" } }));
    return;
  }
  return app(req, res);
}
