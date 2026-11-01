/**
 * A small in-memory fake of the TaskFlow API for tests, built with MSW.
 * It mirrors the real API's response shapes so components are tested against realistic data.
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Comment, Project, Task, User } from "../lib/types";

const BASE = "http://localhost:4000/api/v1";

export const alice: User = { id: "u1", name: "Alice Smith", email: "alice@example.com" };
export const bob: User = { id: "u2", name: "Bob Jones", email: "bob@example.com" };

let seq = 100;
const nextId = () => `id${++seq}`;
const now = () => new Date().toISOString();

export const db = {
  users: [] as (User & { password: string })[],
  projects: [] as Project[],
  tasks: [] as Task[],
  comments: [] as Comment[],
  validAccessTokens: new Set<string>(),
  reset() {
    this.users = [
      { ...alice, password: "password123" },
      { ...bob, password: "password123" },
    ];
    this.projects = [];
    this.tasks = [];
    this.comments = [];
    this.validAccessTokens = new Set(["alice-token"]);
  },
};
db.reset();

export function seedProject(overrides: Partial<Project> = {}): Project {
  const project: Project = {
    id: nextId(),
    name: "Website relaunch",
    description: "Ship the new site",
    owner: alice,
    members: [alice, bob],
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
  db.projects.push(project);
  return project;
}

export function seedTask(projectId: string, overrides: Partial<Task> = {}): Task {
  const task: Task = {
    id: nextId(),
    project: projectId,
    title: "A task",
    description: "",
    status: "todo",
    priority: "medium",
    assignee: null,
    dueDate: null,
    createdBy: alice,
    commentCount: 0,
    deletedAt: null,
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
  db.tasks.push(task);
  return task;
}

export function seedComment(taskId: string, author: User, body: string): Comment {
  const comment: Comment = { id: nextId(), task: taskId, author, body, createdAt: now() };
  db.comments.push(comment);
  const task = db.tasks.find((t) => t.id === taskId);
  if (task) task.commentCount += 1;
  return comment;
}

const error = (status: number, code: string, message: string, details?: Record<string, string[]>) =>
  HttpResponse.json({ error: { code, message, details } }, { status });

const page = <T,>(data: T[]) => ({ data, page: 1, limit: 100, total: data.length, totalPages: 1 });

function currentUser(request: Request): User | null {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !db.validAccessTokens.has(token)) return null;
  const id = token === "alice-token" ? alice.id : token.split(":")[1];
  const u = db.users.find((x) => x.id === id);
  return u ? { id: u.id, name: u.name, email: u.email } : null;
}

function issue(user: User) {
  const accessToken = `access:${user.id}:${nextId()}`;
  db.validAccessTokens.add(accessToken);
  return { user, accessToken, refreshToken: `refresh:${user.id}` };
}

export const handlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) return error(401, "unauthorized", "Email or password is incorrect");
    return HttpResponse.json(issue({ id: user.id, name: user.name, email: user.email }));
  }),

  http.post(`${BASE}/auth/register`, async ({ request }) => {
    const { name, email, password } = (await request.json()) as { name: string; email: string; password: string };
    if (db.users.some((u) => u.email === email)) {
      return error(409, "conflict", "An account with this email already exists");
    }
    const user = { id: nextId(), name, email, password };
    db.users.push(user);
    return HttpResponse.json(issue({ id: user.id, name, email }), { status: 201 });
  }),

  http.post(`${BASE}/auth/refresh`, async ({ request }) => {
    const { refreshToken } = (await request.json()) as { refreshToken: string };
    const [, userId] = refreshToken.split(":");
    const user = db.users.find((u) => u.id === userId);
    if (!refreshToken.startsWith("refresh:") || !user) return error(401, "unauthorized", "Invalid refresh token");
    const { accessToken } = issue(user);
    return HttpResponse.json({ accessToken, refreshToken });
  }),

  http.post(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${BASE}/auth/me`, ({ request }) => {
    const user = currentUser(request);
    return user ? HttpResponse.json({ user }) : error(401, "unauthorized", "Authentication required");
  }),

  http.get(`${BASE}/projects`, ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, "unauthorized", "Authentication required");
    return HttpResponse.json(page(db.projects.filter((p) => p.members.some((m) => m.id === user.id))));
  }),

  http.post(`${BASE}/projects`, async ({ request }) => {
    const user = currentUser(request);
    if (!user) return error(401, "unauthorized", "Authentication required");
    const body = (await request.json()) as { name: string; description?: string };
    const project = seedProject({ name: body.name, description: body.description ?? "", owner: user, members: [user] });
    return HttpResponse.json({ project }, { status: 201 });
  }),

  http.get(`${BASE}/projects/:id`, ({ request, params }) => {
    if (!currentUser(request)) return error(401, "unauthorized", "Authentication required");
    const project = db.projects.find((p) => p.id === params.id);
    if (!project) return error(404, "not_found", "Project not found");
    const live = db.tasks.filter((t) => t.project === project.id);
    const count = (s: string) => live.filter((t) => t.status === s).length;
    return HttpResponse.json({
      project,
      taskCounts: { todo: count("todo"), in_progress: count("in_progress"), done: count("done") },
    });
  }),

  http.post(`${BASE}/projects/:id/members`, async ({ request, params }) => {
    const project = db.projects.find((p) => p.id === params.id)!;
    const { email } = (await request.json()) as { email: string };
    const user = db.users.find((u) => u.email === email);
    if (!user) return error(404, "not_found", "User with that email not found");
    project.members.push({ id: user.id, name: user.name, email: user.email });
    return HttpResponse.json({ project }, { status: 201 });
  }),

  http.get(`${BASE}/projects/:id/tasks`, ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return error(401, "unauthorized", "Authentication required");
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();
    const assignee = url.searchParams.get("assignee");
    const priority = url.searchParams.get("priority");
    let tasks = db.tasks.filter((t) => t.project === params.id);
    if (q) tasks = tasks.filter((t) => t.title.toLowerCase().includes(q));
    if (priority) tasks = tasks.filter((t) => t.priority === priority);
    if (assignee === "me") tasks = tasks.filter((t) => t.assignee?.id === user.id);
    if (assignee === "none") tasks = tasks.filter((t) => !t.assignee);
    return HttpResponse.json({ ...page(tasks), serverTime: now() });
  }),

  http.post(`${BASE}/projects/:id/tasks`, async ({ request, params }) => {
    const user = currentUser(request)!;
    const body = (await request.json()) as Partial<Task>;
    const task = seedTask(String(params.id), { title: body.title, createdBy: user });
    return HttpResponse.json({ task }, { status: 201 });
  }),

  http.get(`${BASE}/tasks/:id`, ({ params }) => {
    const task = db.tasks.find((t) => t.id === params.id);
    return task ? HttpResponse.json({ task }) : error(404, "not_found", "Task not found");
  }),

  http.patch(`${BASE}/tasks/:id`, async ({ request, params }) => {
    const task = db.tasks.find((t) => t.id === params.id);
    if (!task) return error(404, "not_found", "Task not found");
    const body = (await request.json()) as Record<string, unknown>;
    const { assignee, ...rest } = body;
    Object.assign(task, rest, { updatedAt: now() });
    if ("assignee" in body) {
      const member = db.users.find((u) => u.id === assignee);
      task.assignee = member ? { id: member.id, name: member.name, email: member.email } : null;
    }
    return HttpResponse.json({ task });
  }),

  http.delete(`${BASE}/tasks/:id`, ({ params }) => {
    db.tasks = db.tasks.filter((t) => t.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/tasks/:id/comments`, ({ params }) =>
    HttpResponse.json(page(db.comments.filter((c) => c.task === params.id))),
  ),

  http.post(`${BASE}/tasks/:id/comments`, async ({ request, params }) => {
    const user = currentUser(request)!;
    const { body } = (await request.json()) as { body: string };
    const comment = seedComment(String(params.id), user, body);
    return HttpResponse.json({ comment }, { status: 201 });
  }),
];

export const server = setupServer(...handlers);
export { BASE as API_BASE };
