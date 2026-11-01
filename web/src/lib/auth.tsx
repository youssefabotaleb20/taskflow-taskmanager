import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setSessionExpiredHandler, tokenStore } from "./api";
import type { Tokens, User } from "./types";

interface AuthState {
  user: User | null;
  status: "loading" | "signedIn" | "signedOut";
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>(() => (tokenStore.get() ? "loading" : "signedOut"));

  const signOutLocally = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setUser(null);
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(signOutLocally);
    if (!tokenStore.get()) return;
    api<{ user: User }>("/auth/me")
      .then(({ user }) => {
        setUser(user);
        setStatus("signedIn");
      })
      .catch(signOutLocally);
  }, [signOutLocally]);

  const startSession = useCallback((result: { user: User } & Tokens) => {
    tokenStore.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setUser(result.user);
    setStatus("signedIn");
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      status,
      login: async (email, password) => {
        startSession(await api("/auth/login", { method: "POST", body: { email, password }, auth: false }));
      },
      register: async (name, email, password) => {
        startSession(await api("/auth/register", { method: "POST", body: { name, email, password }, auth: false }));
      },
      logout: async () => {
        const tokens = tokenStore.get();
        if (tokens) {
          await api("/auth/logout", { method: "POST", body: { refreshToken: tokens.refreshToken }, auth: false }).catch(
            () => undefined,
          );
        }
        signOutLocally();
      },
    }),
    [user, status, startSession, signOutLocally],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
