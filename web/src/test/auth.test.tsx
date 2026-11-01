import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderApp } from "./render";
import { tokenStore } from "../lib/api";

describe("authentication", () => {
  it("sends signed-out visitors to the login page", async () => {
    renderApp("/", { signedIn: false });
    expect(await screen.findByRole("heading", { name: /log in to taskflow/i })).toBeInTheDocument();
  });

  it("shows the server's message when the password is wrong", async () => {
    const { user } = renderApp("/login", { signedIn: false });
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
    expect(tokenStore.get()).toBeNull();
  });

  it("logs in and lands on the projects page", async () => {
    const { user } = renderApp("/login", { signedIn: false });
    await user.type(await screen.findByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(tokenStore.get()?.refreshToken).toBe("refresh:u1");
  });

  it("validates the sign-up form before calling the API", async () => {
    const { user } = renderApp("/register", { signedIn: false });
    await user.type(await screen.findByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText("Enter your name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveAccessibleDescription("Password must be at least 8 characters");
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("creates an account and signs the new user in", async () => {
    const { user } = renderApp("/register", { signedIn: false });
    await user.type(await screen.findByLabelText(/name/i), "Youssef");
    await user.type(screen.getByLabelText(/email/i), "youssef@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Youssef")).toBeInTheDocument();
  });

  it("logs out and returns to the login page", async () => {
    const { user } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: /log out/i }));
    expect(await screen.findByRole("heading", { name: /log in to taskflow/i })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});
