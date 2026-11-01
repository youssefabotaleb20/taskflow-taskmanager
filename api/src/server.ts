import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db.js";
import { createApp } from "./app.js";

async function main() {
  await connectDb(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => {
    console.log(`TaskFlow API listening on :${env.PORT} (docs at /docs)`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});
