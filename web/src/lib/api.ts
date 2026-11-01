import type { Tokens } from "./types";

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;
const STORAGE_KEY = "taskflow.tokens";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get(): Tokens | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  set(tokens: Tokens) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

type Listener = () => void;
let onSessionExpired: Listener = () => {};
export function setSessionExpiredHandler(fn: Listener) {
  onSessionExpired = fn;
}

// Several requests can fail with 401 at once; they all wait on one refresh.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = tokenStore.get();
  if (!tokens) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return false;
    tokenStore.set((await res.json()) as Tokens);
    return true;
  } catch {
    return false;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const tokens = tokenStore.get();
  if (auth && tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && auth && tokens && !retried) {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null;
    });
    if (await refreshing) return api<T>(path, options, true);
    tokenStore.clear();
    onSessionExpired();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "error", err.message ?? "Something went wrong", err.details);
  }
  return data as T;
}
