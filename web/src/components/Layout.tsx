import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Avatar, Button } from "./ui";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
      <img src="/favicon.svg" alt="" className="size-7" />
      TaskFlow
    </span>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" aria-label="TaskFlow home">
            <Logo />
          </Link>
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
                <Avatar user={user} />
                {user.name}
              </span>
              <Button variant="ghost" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
