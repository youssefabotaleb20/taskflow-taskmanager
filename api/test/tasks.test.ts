import { describe, expect, it } from "vitest";
import { api, createProject, createTask, signUp } from "./helpers.js";

async function teamProject() {
  const alice = await signUp("Alice");
  const bob = await signUp("Bob");
  const project = await createProject(alice.auth);
  await api().post(`/api/v1/projects/${project.id}/members`).set(alice.auth).send({ email: bob.email });
  return { alice, bob, project };
}

describe("tasks", () => {
  it("creates a task with defaults and populated people", async () => {
    const { alice, project } = await teamProject();
    const res = await api()
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set(alice.auth)
      .send({ title: "Write tests", dueDate: "2026-12-01" });

    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({
      title: "Write tests",
      status: "todo",
      priority: "medium",
      assignee: null,
      commentCount: 0,
      createdBy: { name: "Alice" },
    });
    expect(res.body.task.dueDate).toBe("2026-12-01T00:00:00.000Z");
  });

  it("requires a title and a valid status", async () => {
    const { alice, project } = await teamProject();
    const res = await api().post(`/api/v1/projects/${project.id}/tasks`).set(alice.auth).send({ status: "later" });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty("title");
    expect(res.body.error.details).toHaveProperty("status");
  });

  it("only allows project members as assignees", async () => {
    const { alice, bob, project } = await teamProject();
    const outsider = await signUp("Outsider");
    const bad = await api()
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set(alice.auth)
      .send({ title: "x", assignee: outsider.user.id });
    expect(bad.status).toBe(400);

    const ok = await createTask(alice.auth, project.id, { assignee: bob.user.id });
    expect(ok).toHaveProperty("id");
  });

  it("filters by status, assignee and search, with pagination", async () => {
    const { alice, bob, project } = await teamProject();
    await createTask(alice.auth, project.id, { title: "Design logo", status: "in_progress", assignee: bob.user.id });
    await createTask(alice.auth, project.id, { title: "Design banner", status: "todo", assignee: alice.user.id });
    await createTask(alice.auth, project.id, { title: "Ship it", status: "todo" });

    const url = `/api/v1/projects/${project.id}/tasks`;
    const todo = await api().get(url).query({ status: "todo" }).set(alice.auth);
    expect(todo.body.data.map((t: { title: string }) => t.title).sort()).toEqual(["Design banner", "Ship it"]);

    const bobs = await api().get(url).query({ assignee: "me" }).set(bob.auth);
    expect(bobs.body.data).toHaveLength(1);
    expect(bobs.body.data[0].title).toBe("Design logo");

    const unassigned = await api().get(url).query({ assignee: "none" }).set(alice.auth);
    expect(unassigned.body.data.map((t: { title: string }) => t.title)).toEqual(["Ship it"]);

    const search = await api().get(url).query({ q: "design" }).set(alice.auth);
    expect(search.body.total).toBe(2);

    const page = await api().get(url).query({ limit: 2, page: 2 }).set(alice.auth);
    expect(page.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.data).toHaveLength(1);
  });

  it("treats regex characters in search as plain text", async () => {
    const { alice, project } = await teamProject();
    await createTask(alice.auth, project.id, { title: "Fix (urgent) bug" });
    const res = await api().get(`/api/v1/projects/${project.id}/tasks`).query({ q: "(urgent" }).set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it("any member can update a task", async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice.auth, project.id);
    const res = await api().patch(`/api/v1/tasks/${task.id}`).set(bob.auth).send({ status: "done", priority: "high" });
    expect(res.status).toBe(200);
    expect(res.body.task).toMatchObject({ status: "done", priority: "high" });
  });

  it("outsiders can't read or change tasks", async () => {
    const { alice, project } = await teamProject();
    const outsider = await signUp("Outsider");
    const task = await createTask(alice.auth, project.id);
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(outsider.auth)).status).toBe(404);
    expect((await api().patch(`/api/v1/tasks/${task.id}`).set(outsider.auth).send({ title: "hi" })).status).toBe(404);
    expect((await api().get(`/api/v1/projects/${project.id}/tasks`).set(outsider.auth)).status).toBe(404);
  });

  it("only the creator or owner can delete, and deletes show up in sync", async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice.auth, project.id);
    const before = new Date(Date.now() - 1000).toISOString();

    expect((await api().delete(`/api/v1/tasks/${task.id}`).set(bob.auth)).status).toBe(403);
    expect((await api().delete(`/api/v1/tasks/${task.id}`).set(alice.auth)).status).toBe(204);
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(alice.auth)).status).toBe(404);

    const list = await api().get(`/api/v1/projects/${project.id}/tasks`).set(alice.auth);
    expect(list.body.total).toBe(0);

    const sync = await api().get(`/api/v1/projects/${project.id}/tasks`).query({ updatedSince: before }).set(alice.auth);
    expect(sync.body.data).toHaveLength(1);
    expect(sync.body.data[0].deletedAt).toBeTypeOf("string");
    expect(sync.body.serverTime).toBeTypeOf("string");
  });

  it("sync only returns tasks changed after the timestamp", async () => {
    const { alice, project } = await teamProject();
    const old = await createTask(alice.auth, project.id, { title: "Old" });
    const first = await api().get(`/api/v1/projects/${project.id}/tasks`).set(alice.auth);
    await new Promise((r) => setTimeout(r, 10));
    await api().patch(`/api/v1/tasks/${old.id}`).set(alice.auth).send({ title: "Old, edited" });
    await createTask(alice.auth, project.id, { title: "New" });

    const sync = await api()
      .get(`/api/v1/projects/${project.id}/tasks`)
      .query({ updatedSince: first.body.serverTime })
      .set(alice.auth);
    expect(sync.body.data.map((t: { title: string }) => t.title).sort()).toEqual(["New", "Old, edited"]);
  });
});

describe("comments", () => {
  it("members comment on tasks and the count stays in sync", async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice.auth, project.id);

    const c1 = await api().post(`/api/v1/tasks/${task.id}/comments`).set(bob.auth).send({ body: "On it" });
    expect(c1.status).toBe(201);
    expect(c1.body.comment).toMatchObject({ body: "On it", author: { name: "Bob" } });
    await api().post(`/api/v1/tasks/${task.id}/comments`).set(alice.auth).send({ body: "Thanks" });

    const list = await api().get(`/api/v1/tasks/${task.id}/comments`).set(alice.auth);
    expect(list.body.data.map((c: { body: string }) => c.body)).toEqual(["On it", "Thanks"]);
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(alice.auth)).body.task.commentCount).toBe(2);
  });

  it("rejects empty comments", async () => {
    const { alice, project } = await teamProject();
    const task = await createTask(alice.auth, project.id);
    expect((await api().post(`/api/v1/tasks/${task.id}/comments`).set(alice.auth).send({ body: "   " })).status).toBe(400);
  });

  it("only the author or project owner can delete a comment", async () => {
    const { alice, bob, project } = await teamProject();
    const task = await createTask(alice.auth, project.id);
    const mine = await api().post(`/api/v1/tasks/${task.id}/comments`).set(alice.auth).send({ body: "owner note" });
    const bobs = await api().post(`/api/v1/tasks/${task.id}/comments`).set(bob.auth).send({ body: "bob note" });

    expect((await api().delete(`/api/v1/comments/${mine.body.comment.id}`).set(bob.auth)).status).toBe(403);
    expect((await api().delete(`/api/v1/comments/${bobs.body.comment.id}`).set(alice.auth)).status).toBe(204);
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(alice.auth)).body.task.commentCount).toBe(1);
  });
});
