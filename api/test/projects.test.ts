import { describe, expect, it } from "vitest";
import { api, createProject, createTask, signUp } from "./helpers.js";

describe("projects", () => {
  it("creates a project owned by the creator and lists only your projects", async () => {
    const alice = await signUp("Alice");
    const bob = await signUp("Bob");
    const project = await createProject(alice.auth, "Launch");

    const mine = await api().get("/api/v1/projects").set(alice.auth);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0]).toMatchObject({ id: project.id, name: "Launch", owner: { name: "Alice" } });
    expect(mine.body).toMatchObject({ page: 1, total: 1, totalPages: 1 });

    const theirs = await api().get("/api/v1/projects").set(bob.auth);
    expect(theirs.body.data).toHaveLength(0);
  });

  it("hides projects from non-members with a 404", async () => {
    const alice = await signUp("Alice");
    const bob = await signUp("Bob");
    const project = await createProject(alice.auth);
    expect((await api().get(`/api/v1/projects/${project.id}`).set(bob.auth)).status).toBe(404);
    expect((await api().get(`/api/v1/projects/not-an-id`).set(bob.auth)).status).toBe(404);
  });

  it("returns task counts by status", async () => {
    const alice = await signUp("Alice");
    const project = await createProject(alice.auth);
    await createTask(alice.auth, project.id, { status: "todo" });
    await createTask(alice.auth, project.id, { status: "done" });
    await createTask(alice.auth, project.id, { status: "done" });

    const res = await api().get(`/api/v1/projects/${project.id}`).set(alice.auth);
    expect(res.body.taskCounts).toEqual({ todo: 1, in_progress: 0, done: 2 });
  });

  it("lets the owner add members by email, and members can then see it", async () => {
    const alice = await signUp("Alice");
    const bob = await signUp("Bob");
    const project = await createProject(alice.auth);

    const add = await api().post(`/api/v1/projects/${project.id}/members`).set(alice.auth).send({ email: bob.email });
    expect(add.status).toBe(201);
    expect(add.body.project.members.map((m: { id: string }) => m.id)).toContain(bob.user.id);

    expect((await api().get(`/api/v1/projects/${project.id}`).set(bob.auth)).status).toBe(200);

    const again = await api().post(`/api/v1/projects/${project.id}/members`).set(alice.auth).send({ email: bob.email });
    expect(again.status).toBe(409);
    const unknown = await api()
      .post(`/api/v1/projects/${project.id}/members`)
      .set(alice.auth)
      .send({ email: "ghost@example.com" });
    expect(unknown.status).toBe(404);
  });

  it("only the owner can rename, delete or add members", async () => {
    const alice = await signUp("Alice");
    const bob = await signUp("Bob");
    const carol = await signUp("Carol");
    const project = await createProject(alice.auth);
    await api().post(`/api/v1/projects/${project.id}/members`).set(alice.auth).send({ email: bob.email });

    expect((await api().patch(`/api/v1/projects/${project.id}`).set(bob.auth).send({ name: "Mine" })).status).toBe(403);
    expect((await api().delete(`/api/v1/projects/${project.id}`).set(bob.auth)).status).toBe(403);
    expect(
      (await api().post(`/api/v1/projects/${project.id}/members`).set(bob.auth).send({ email: carol.email })).status,
    ).toBe(403);

    const rename = await api().patch(`/api/v1/projects/${project.id}`).set(alice.auth).send({ name: "Renamed" });
    expect(rename.status).toBe(200);
    expect(rename.body.project.name).toBe("Renamed");
  });

  it("removing a member unassigns their tasks; members can leave; owner can't be removed", async () => {
    const alice = await signUp("Alice");
    const bob = await signUp("Bob");
    const project = await createProject(alice.auth);
    await api().post(`/api/v1/projects/${project.id}/members`).set(alice.auth).send({ email: bob.email });
    const task = await createTask(alice.auth, project.id, { assignee: bob.user.id });

    expect((await api().delete(`/api/v1/projects/${project.id}/members/${alice.user.id}`).set(bob.auth)).status).toBe(403);
    expect((await api().delete(`/api/v1/projects/${project.id}/members/${alice.user.id}`).set(alice.auth)).status).toBe(400);

    expect((await api().delete(`/api/v1/projects/${project.id}/members/${bob.user.id}`).set(bob.auth)).status).toBe(204);
    expect((await api().get(`/api/v1/projects/${project.id}`).set(bob.auth)).status).toBe(404);

    const after = await api().get(`/api/v1/tasks/${task.id}`).set(alice.auth);
    expect(after.body.task.assignee).toBeNull();
  });

  it("deleting a project removes its tasks", async () => {
    const alice = await signUp("Alice");
    const project = await createProject(alice.auth);
    const task = await createTask(alice.auth, project.id);
    expect((await api().delete(`/api/v1/projects/${project.id}`).set(alice.auth)).status).toBe(204);
    expect((await api().get(`/api/v1/tasks/${task.id}`).set(alice.auth)).status).toBe(404);
  });
});
