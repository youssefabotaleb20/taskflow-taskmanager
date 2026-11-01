import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderApp } from "./render";
import { seedProject } from "./server";

describe("projects page", () => {
  it("shows an empty state when there are no projects", async () => {
    renderApp("/");
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });

  it("lists the projects you belong to", async () => {
    seedProject({ name: "Website relaunch" });
    seedProject({ name: "Mobile app" });
    renderApp("/");

    const list = await screen.findByRole("list");
    const links = within(list).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Website relaunch"),
      expect.stringContaining("Mobile app"),
    ]);
  });

  it("creates a project and shows it in the list", async () => {
    const { user } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: /new project/i }));

    const form = screen.getByRole("form", { name: /new project/i });
    await user.click(within(form).getByRole("button", { name: /create/i }));
    expect(within(form).getByText("Give the project a name")).toBeInTheDocument();

    await user.type(within(form).getByLabelText(/project name/i), "Q4 launch");
    await user.click(within(form).getByRole("button", { name: /create/i }));

    expect(await screen.findByRole("link", { name: /q4 launch/i })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: /new project/i })).not.toBeInTheDocument();
  });

  it("opens a project from the list", async () => {
    const project = seedProject({ name: "Website relaunch" });
    const { user } = renderApp("/");
    await user.click(await screen.findByRole("link", { name: /website relaunch/i }));
    expect(await screen.findByRole("heading", { level: 1, name: "Website relaunch" })).toBeInTheDocument();
    expect(project.id).toBeTruthy();
  });
});
