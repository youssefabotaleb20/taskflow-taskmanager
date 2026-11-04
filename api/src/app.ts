import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import { openapi } from "./docs/openapi.js";
import { swaggerCsp, swaggerPage } from "./docs/swaggerPage.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // Render and most hosts sit behind one proxy.
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: false }));
  app.use(express.json({ limit: "100kb" }));
  if (!env.isTest) app.use(pinoHttp({ level: env.isProd ? "info" : "debug" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "up" : "down" });
  });

  app.get("/docs/openapi.json", (_req, res) => {
    res.json(openapi);
  });
  app.get(["/docs", "/docs/"], (_req, res) => {
    res.setHeader("Content-Security-Policy", swaggerCsp);
    res.type("html").send(swaggerPage);
  });

  const v1 = express.Router();
  v1.use("/auth", authRoutes);
  v1.use("/projects", requireAuth, projectRoutes);
  v1.use("/", requireAuth, taskRoutes);
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
