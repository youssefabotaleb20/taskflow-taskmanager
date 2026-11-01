import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "./render";
import { bob, db, seedComment, seedProject, seedTask } from "./server";

describe("task panel", () => {
  it("opens from the board and closes with Escape", async () => {
    const project = seedProject();
    seedTask(project.id, { title: "Design pricing page", description: "Monthly and yearly" });
    const { user } = renderApp(`/projects/${project.id}`);

    await user.click(await screen.findByRole("link", { name: "Design pricing page" }));
    const dialog = await screen.findByRole("dialog", { name: /task details/i });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Design pricing page");
    expect(within(dialog).getByLabelText(/description/i)).toHaveValue("Monthly and yearly");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows comments and posts a new one", async () => {
    const project = seedProject();
    const task = seedTask(project.id, { title: "Pricing" });
    seedComment(task.id, bob, "Yearly by default?");
    const { user } = renderApp(`/projects/${project.id}/tasks/${task.id}`);

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Yearly by default?")).toBeInTheDocument();
    expect(within(within(dialog).getByRole("region", { name: "Comments" })).getByText("Bob Jones")).toBeInTheDocument();

    const submit = within(dialog).getByRole("button", { name: "Comment" });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/write a comment/i), "Yes, with a toggle");
    await user.click(submit);

    expect(await within(dialog).findByText("Yes, with a toggle")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/write a comment/i)).toHaveValue("");
    expect(db.comments).toHaveLength(2);
  });

  it("assigns the task and changes its priority", async () => {
    const project = seedProject();
    const task = seedTask(project.id, { title: "Pricing" });
    const { user } = renderApp(`/projects/${project.id}/tasks/${task.id}`);
    const dialog = await screen.findByRole("dialog");

    await user.selectOptions(await within(dialog).findByLabelText("Assignee"), bob.id);
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "high");

    await waitFor(() => expect(db.tasks[0]).toMatchObject({ priority: "high", assignee: { id: bob.id } }));
    expect(within(dialog).getByLabelText("Assignee")).toHaveValue(bob.id);
  });

  it("saves a renamed title when the field loses focus", async () => {
    const project = seedProject();
    const task = seedTask(project.id, { title: "Old name" });
    const { user } = renderApp(`/projects/${project.id}/tasks/${task.id}`);
    const title = await screen.findByLabelText("Title");

    await user.clear(title);
    await user.type(title, "New name");
    await user.tab();

    await waitFor(() => expect(db.tasks[0].title).toBe("New name"));
  });

  it("deletes a task after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const project = seedProject();
    const task = seedTask(project.id, { title: "Remove me" });
    const { user } = renderApp(`/projects/${project.id}/tasks/${task.id}`);

    await user.click(await screen.findByRole("button", { name: /delete task/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(db.tasks).toHaveLength(0);
    expect(screen.queryByText("Remove me")).not.toBeInTheDocument();
  });
});
