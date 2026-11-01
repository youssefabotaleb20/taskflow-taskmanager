import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../lib/auth";
import { tokenStore } from "../lib/api";
import { AppRoutes } from "../App";

/** Renders the whole app at `route`. Signed in as Alice unless `signedIn: false`. */
export function renderApp(route = "/", { signedIn = true } = {}) {
  if (signedIn) tokenStore.set({ accessToken: "alice-token", refreshToken: "refresh:u1" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { user, queryClient, ...utils };
}
