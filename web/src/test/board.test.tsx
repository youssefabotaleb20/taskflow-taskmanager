import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderApp } from "./render";
import { API_BASE, alice, bob, db, seedProject, seedTask, server } from "./server";

const column = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

describe("project board", () => {
  it("groups tasks into To do, In progress and Done columns", async () => {
    const project = seedProject();
    seedTask(project.id, { title: "Write copy", status: "done" });
    seedTask(project.id, { title: "Design pricing", status: "in_progress", priority: "high" });
    seedTask(project.id, { title: "Set up analytics", status: "todo" });
    renderApp(`/projects/${project.id}`);

    expect(await screen.findByText("Set up analytics")).toBeInTheDocument();
    expect(within(column("To do")).getByText("Set up analytics")).toBeInTheDocument();
    expect(within(column("In progress")).getByText("Design pricing")).toBeInTheDocument();
    expect(within(column("Done")).getByText("Write copy")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 tasks done")).toBeInTheDocument();
  });

  it("adds a task to the To do column", async () => {
    const project = seedProject();
    const { user } = renderApp(`/projects/${project.id}`);

    const input = await screen.findByLabelText(/new task title/i);
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(input, "Book venue{Enter}");

    expect(await within(column("To do")).findByText("Book venue")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("moves a task when its status changes", async () => {
    const project = seedProject();
    seedTask(project.id, { title: "Ship it" });
    const { user } = renderApp(`/projects/${project.id}`);

    await user.selectOptions(await screen.findByLabelText("Status of Ship it"), "done");

    await waitFor(() => expect(within(column("Done")).getByText("Ship it")).toBeInTheDocument());
    expect(within(column("To do")).queryByText("Ship it")).not.toBeInTheDocument();
    expect(db.tasks[0].status).toBe("done");
  });

  it("filters by search text and assignee", async () => {
    const project = seedProject();
    seedTask(project.id, { title: "Design logo", assignee: alice });
    seedTask(project.id, { title: "Design banner", assignee: bob });
    seedTask(project.id, { title: "Write blog post" });
    const { user } = renderApp(`/projects/${project.id}`);
    await screen.findByText("Write blog post");

    await user.type(screen.getByRole("searchbox", { name: /search tasks/i }), "design");
    await waitFor(() => expect(screen.queryByText("Write blog post")).not.toBeInTheDocument());
    expect(screen.getByText("Design banner")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filter by assignee/i), "me");
    await waitFor(() => expect(screen.queryByText("Design banner")).not.toBeInTheDocument());
    expect(screen.getByText("Design logo")).toBeInTheDocument();
  });

  it("flags overdue tasks that aren't done", async () => {
    const project = seedProject();
    seedTask(project.id, { title: "Late one", dueDate: "2020-01-15T00:00:00.000Z" });
    seedTask(project.id, { title: "Late but done", status: "done", dueDate: "2020-01-15T00:00:00.000Z" });
    renderApp(`/projects/${project.id}`);

    await screen.findByText("Late one");
    expect(within(column("To do")).getByText(/overdue/i)).toBeInTheDocument();
    expect(within(column("Done")).queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("lets the owner invite a member and shows errors from the API", async () => {
    const project = seedProject({ members: [alice] });
    const { user } = renderApp(`/projects/${project.id}`);
    await user.click(await screen.findByRole("button", { name: /invite/i }));

    const form = screen.getByRole("form", { name: /invite member/i });
    await user.type(within(form).getByLabelText(/member email/i), "ghost@example.com");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(await within(form).findByText(/not found/i)).toBeInTheDocument();

    await user.clear(within(form).getByLabelText(/member email/i));
    await user.type(within(form).getByLabelText(/member email/i), "bob@example.com");
    await user.click(within(form).getByRole("button", { name: "Add" }));
    expect(await within(screen.getByRole("list", { name: "Members" })).findByText("Bob Jones")).toBeInTheDocument();
  });

  it("hides the invite button from members who aren't the owner", async () => {
    const project = seedProject({ owner: bob, members: [bob, alice] });
    renderApp(`/projects/${project.id}`);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
  });

  it("explains when a project can't be found", async () => {
    server.use(
      http.get(`${API_BASE}/projects/:id`, () =>
        HttpResponse.json({ error: { code: "not_found", message: "Project not found" } }, { status: 404 }),
      ),
    );
    renderApp("/projects/missing");
    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't exist or you're not a member/i);
  });
});
