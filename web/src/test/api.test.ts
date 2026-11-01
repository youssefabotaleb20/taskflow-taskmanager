import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { api, ApiError, setSessionExpiredHandler, tokenStore } from "../lib/api";
import { API_BASE, server } from "./server";

describe("api client", () => {
  it("refreshes an expired access token once and retries the request", async () => {
    tokenStore.set({ accessToken: "expired", refreshToken: "refresh:u1" });
    const { user } = await api<{ user: { name: string } }>("/auth/me");
    expect(user.name).toBe("Alice Smith");
    expect(tokenStore.get()?.accessToken).not.toBe("expired");
  });

  it("shares one refresh between parallel requests", async () => {
    tokenStore.set({ accessToken: "expired", refreshToken: "refresh:u1" });
    let refreshCalls = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.url.endsWith("/auth/refresh")) refreshCalls += 1;
    });
    await Promise.all([api("/auth/me"), api("/auth/me"), api("/auth/me")]);
    expect(refreshCalls).toBe(1);
    server.events.removeAllListeners();
  });

  it("signs out when the refresh token is rejected", async () => {
    tokenStore.set({ accessToken: "expired", refreshToken: "bogus" });
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
  });

  it("turns API errors into ApiError with field details", async () => {
    server.use(
      http.post(`${API_BASE}/projects`, () =>
        HttpResponse.json(
          { error: { code: "bad_request", message: "Validation failed", details: { name: ["Required"] } } },
          { status: 400 },
        ),
      ),
    );
    const err = await api("/projects", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "bad_request", details: { name: ["Required"] } });
  });

  it("reports network failures clearly", async () => {
    server.use(http.get(`${API_BASE}/projects`, () => HttpResponse.error()));
    await expect(api("/projects")).rejects.toMatchObject({ code: "network" });
  });

  it("skips empty query params", async () => {
    let seen = "";
    server.use(
      http.get(`${API_BASE}/projects/p1/tasks`, ({ request }) => {
        seen = new URL(request.url).search;
        return HttpResponse.json({ data: [] });
      }),
    );
    tokenStore.set({ accessToken: "alice-token", refreshToken: "refresh:u1" });
    await api("/projects/p1/tasks", { query: { q: "", status: "todo", assignee: undefined } });
    expect(seen).toBe("?status=todo");
  });
});
