import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Loading } from "./ui";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading label="Signing you in" />;
  if (status === "signedOut") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnly() {
  const { status } = useAuth();
  if (status === "loading") return <Loading />;
  if (status === "signedIn") return <Navigate to="/" replace />;
  return <Outlet />;
}
