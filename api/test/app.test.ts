import { describe, expect, it } from "vitest";
import { api } from "./helpers.js";

describe("app", () => {
  it("reports health", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "up" });
  });

  it("serves the OpenAPI document and Swagger UI", async () => {
    const spec = await api().get("/docs/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.0.3");
    expect(Object.keys(spec.body.paths)).toContain("/projects/{projectId}/tasks");

    const ui = await api().get("/docs");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("swagger-ui");
  });

  it("returns JSON errors for unknown routes and bad JSON", async () => {
    const missing = await api().get("/nope");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("not_found");

    const bad = await api().post("/api/v1/auth/login").set("Content-Type", "application/json").send("{oops");
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toBe("Malformed JSON body");
  });
});
