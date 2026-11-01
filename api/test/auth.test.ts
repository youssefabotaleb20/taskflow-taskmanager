import { describe, expect, it } from "vitest";
import { api, signUp } from "./helpers.js";

describe("auth", () => {
  it("registers a user and never returns the password hash", async () => {
    const res = await api()
      .post("/api/v1/auth/register")
      .send({ name: "Youssef", email: "Youssef@Example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Youssef", email: "youssef@example.com" });
    expect(res.body.user.id).toBeTypeOf("string");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("_id");
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
  });

  it("rejects invalid input with field errors", async () => {
    const res = await api().post("/api/v1/auth/register").send({ name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("bad_request");
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("rejects a duplicate email", async () => {
    const { email } = await signUp();
    const res = await api().post("/api/v1/auth/register").send({ name: "Again", email, password: "password123" });
    expect(res.status).toBe(409);
  });

  it("logs in with the right password only", async () => {
    const { email } = await signUp();
    const ok = await api().post("/api/v1/auth/login").send({ email, password: "password123" });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTypeOf("string");

    const bad = await api().post("/api/v1/auth/login").send({ email, password: "wrong-password" });
    expect(bad.status).toBe(401);
  });

  it("protects /me and returns the user for a valid token", async () => {
    expect((await api().get("/api/v1/auth/me")).status).toBe(401);
    expect((await api().get("/api/v1/auth/me").set("Authorization", "Bearer garbage")).status).toBe(401);

    const { auth, user } = await signUp("Me");
    const res = await api().get("/api/v1/auth/me").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it("rotates refresh tokens: each one works once", async () => {
    const { refreshToken } = await signUp();
    const first = await api().post("/api/v1/auth/refresh").send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    const reused = await api().post("/api/v1/auth/refresh").send({ refreshToken });
    expect(reused.status).toBe(401);

    const me = await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${first.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it("logout revokes the refresh token", async () => {
    const { refreshToken } = await signUp();
    expect((await api().post("/api/v1/auth/logout").send({ refreshToken })).status).toBe(204);
    expect((await api().post("/api/v1/auth/refresh").send({ refreshToken })).status).toBe(401);
  });
});
