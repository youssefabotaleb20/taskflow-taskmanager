/** OpenAPI 3.0 description of the TaskFlow API, served at /docs and /docs/openapi.json. */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const idParam = (name: string, what: string) => ({
  name,
  in: "path",
  required: true,
  description: `${what} id`,
  schema: { type: "string", example: "665f1c2e8b3e4a0012ab34cd" },
});
const pageParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
];
const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((c) => [
      c,
      {
        description:
          { 400: "Validation failed", 401: "Not authenticated", 403: "Not allowed", 404: "Not found", 409: "Conflict" }[c] ??
          "Error",
        ...json(ref("Error")),
      },
    ]),
  );
const paged = (item: string) => ({
  type: "object",
  properties: {
    data: { type: "array", items: ref(item) },
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    totalPages: { type: "integer" },
  },
});

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "TaskFlow API",
    version: "1.0.0",
    description:
      "REST API for TaskFlow, a team task manager. Used by the TaskFlow web app and the TaskFlow mobile app.\n\n" +
      "**Auth:** call `POST /auth/login` or `/auth/register`, then send `Authorization: Bearer <accessToken>`. " +
      "Access tokens last 15 minutes; exchange the refresh token at `POST /auth/refresh` for a new pair. " +
      "Refresh tokens rotate: each one works once.\n\n" +
      "**Offline sync:** `GET /projects/{projectId}/tasks?updatedSince=<serverTime>` returns every task changed since " +
      "that time, including deleted ones (`deletedAt` set). Store the response's `serverTime` for the next sync.",
  },
  servers: [{ url: "/api/v1" }],
  tags: [{ name: "Auth" }, { name: "Projects" }, { name: "Members" }, { name: "Tasks" }, { name: "Comments" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "bad_request" },
              message: { type: "string" },
              details: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UserSummary: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" } },
      },
      Tokens: {
        type: "object",
        properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } },
      },
      AuthResponse: {
        allOf: [{ type: "object", properties: { user: ref("User") } }, ref("Tokens")],
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          owner: ref("UserSummary"),
          members: { type: "array", items: ref("UserSummary") },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "string" },
          project: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          assignee: { allOf: [ref("UserSummary")], nullable: true },
          dueDate: { type: "string", format: "date-time", nullable: true },
          createdBy: ref("UserSummary"),
          commentCount: { type: "integer" },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      TaskInput: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          assignee: { type: "string", nullable: true, description: "User id of a project member" },
          dueDate: { type: "string", format: "date-time", nullable: true },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "string" },
          task: { type: "string" },
          author: ref("UserSummary"),
          body: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        security: [],
        requestBody: json({
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "Youssef" },
            email: { type: "string", format: "email", example: "youssef@example.com" },
            password: { type: "string", minLength: 8, example: "supersecret" },
          },
        }),
        responses: { 201: { description: "Created", ...json(ref("AuthResponse")) }, ...errors(400, 409) },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        security: [],
        requestBody: json({
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
        }),
        responses: { 200: { description: "OK", ...json(ref("AuthResponse")) }, ...errors(400, 401) },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new token pair",
        security: [],
        requestBody: json({ type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } }),
        responses: { 200: { description: "OK", ...json(ref("Tokens")) }, ...errors(400, 401) },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        security: [],
        requestBody: json({ type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } }),
        responses: { 204: { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "The signed-in user",
        responses: { 200: { description: "OK", ...json({ type: "object", properties: { user: ref("User") } }) }, ...errors(401) },
      },
    },
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "Projects you are a member of",
        parameters: pageParams,
        responses: { 200: { description: "OK", ...json(paged("Project")) }, ...errors(401) },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project (you become its owner)",
        requestBody: json({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" }, description: { type: "string" } },
        }),
        responses: {
          201: { description: "Created", ...json({ type: "object", properties: { project: ref("Project") } }) },
          ...errors(400, 401),
        },
      },
    },
    "/projects/{projectId}": {
      parameters: [idParam("projectId", "Project")],
      get: {
        tags: ["Projects"],
        summary: "Project details with task counts by status",
        responses: {
          200: {
            description: "OK",
            ...json({
              type: "object",
              properties: {
                project: ref("Project"),
                taskCounts: {
                  type: "object",
                  properties: { todo: { type: "integer" }, in_progress: { type: "integer" }, done: { type: "integer" } },
                },
              },
            }),
          },
          ...errors(401, 404),
        },
      },
      patch: {
        tags: ["Projects"],
        summary: "Rename or describe a project (owner only)",
        requestBody: json({ type: "object", properties: { name: { type: "string" }, description: { type: "string" } } }),
        responses: {
          200: { description: "OK", ...json({ type: "object", properties: { project: ref("Project") } }) },
          ...errors(400, 401, 403, 404),
        },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project with its tasks and comments (owner only)",
        responses: { 204: { description: "Deleted" }, ...errors(401, 403, 404) },
      },
    },
    "/projects/{projectId}/members": {
      parameters: [idParam("projectId", "Project")],
      post: {
        tags: ["Members"],
        summary: "Add a member by email (owner only)",
        requestBody: json({ type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } }),
        responses: {
          201: { description: "Added", ...json({ type: "object", properties: { project: ref("Project") } }) },
          ...errors(400, 401, 403, 404, 409),
        },
      },
    },
    "/projects/{projectId}/members/{userId}": {
      parameters: [idParam("projectId", "Project"), idParam("userId", "User")],
      delete: {
        tags: ["Members"],
        summary: "Remove a member (owner), or leave the project (yourself)",
        responses: { 204: { description: "Removed" }, ...errors(400, 401, 403, 404) },
      },
    },
    "/projects/{projectId}/tasks": {
      parameters: [idParam("projectId", "Project")],
      get: {
        tags: ["Tasks"],
        summary: "List and filter a project's tasks",
        parameters: [
          ...pageParams,
          { name: "status", in: "query", schema: { type: "string", enum: ["todo", "in_progress", "done"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["low", "medium", "high"] } },
          { name: "assignee", in: "query", description: "`me`, `none` or a user id", schema: { type: "string" } },
          { name: "q", in: "query", description: "Search in titles", schema: { type: "string" } },
          {
            name: "updatedSince",
            in: "query",
            description: "Sync mode: tasks changed after this time, deleted tasks included",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["createdAt", "-createdAt", "dueDate", "-dueDate", "priority", "updatedAt"],
              default: "-createdAt",
            },
          },
        ],
        responses: {
          200: {
            description: "OK",
            ...json({
              allOf: [paged("Task"), { type: "object", properties: { serverTime: { type: "string", format: "date-time" } } }],
            }),
          },
          ...errors(400, 401, 404),
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a task",
        requestBody: json({ allOf: [ref("TaskInput")], required: ["title"] }),
        responses: {
          201: { description: "Created", ...json({ type: "object", properties: { task: ref("Task") } }) },
          ...errors(400, 401, 404),
        },
      },
    },
    "/tasks/{taskId}": {
      parameters: [idParam("taskId", "Task")],
      get: {
        tags: ["Tasks"],
        summary: "Get a task",
        responses: { 200: { description: "OK", ...json({ type: "object", properties: { task: ref("Task") } }) }, ...errors(401, 404) },
      },
      patch: {
        tags: ["Tasks"],
        summary: "Update a task (any project member)",
        requestBody: json(ref("TaskInput")),
        responses: {
          200: { description: "OK", ...json({ type: "object", properties: { task: ref("Task") } }) },
          ...errors(400, 401, 404),
        },
      },
      delete: {
        tags: ["Tasks"],
        summary: "Delete a task (creator or project owner)",
        responses: { 204: { description: "Deleted" }, ...errors(401, 403, 404) },
      },
    },
    "/tasks/{taskId}/comments": {
      parameters: [idParam("taskId", "Task")],
      get: {
        tags: ["Comments"],
        summary: "A task's comments, oldest first",
        parameters: pageParams,
        responses: { 200: { description: "OK", ...json(paged("Comment")) }, ...errors(401, 404) },
      },
      post: {
        tags: ["Comments"],
        summary: "Comment on a task",
        requestBody: json({ type: "object", required: ["body"], properties: { body: { type: "string", maxLength: 2000 } } }),
        responses: {
          201: { description: "Created", ...json({ type: "object", properties: { comment: ref("Comment") } }) },
          ...errors(400, 401, 404),
        },
      },
    },
    "/comments/{commentId}": {
      parameters: [idParam("commentId", "Comment")],
      delete: {
        tags: ["Comments"],
        summary: "Delete a comment (author or project owner)",
        responses: { 204: { description: "Deleted" }, ...errors(401, 403, 404) },
      },
    },
  },
};
