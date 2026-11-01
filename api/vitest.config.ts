import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/globalSetup.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    env: { NODE_ENV: "test", JWT_SECRET: "test-secret-that-is-long-enough" },
  },
});
