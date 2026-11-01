import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();
export const api = () => request(app);

let counter = 0;

export async function signUp(name = "Test User") {
  counter += 1;
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${counter}@example.com`;
  const res = await api().post("/api/v1/auth/register").send({ name, email, password: "password123" });
  if (res.status !== 201) throw new Error(`signUp failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    user: res.body.user as { id: string; name: string; email: string },
    email,
    token: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
}

export async function createProject(auth: Record<string, string>, name = "Project") {
  const res = await api().post("/api/v1/projects").set(auth).send({ name });
  if (res.status !== 201) throw new Error(`createProject failed: ${res.status}`);
  return res.body.project as { id: string; name: string };
}

export async function createTask(auth: Record<string, string>, projectId: string, body: Record<string, unknown> = {}) {
  const res = await api()
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set(auth)
    .send({ title: "A task", ...body });
  if (res.status !== 201) throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.task as { id: string; title: string; status: string };
}
