import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { PublicOnly, RequireAuth } from "./components/RouteGuards";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectPage } from "./pages/ProjectPage";
import { TaskPanel } from "./pages/TaskPanel";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />}>
            <Route path="tasks/:taskId" element={<TaskPanel />} />
          </Route>
          <Route path="*" element={<p className="py-12 text-center text-slate-500">Page not found.</p>} />
        </Route>
      </Route>
    </Routes>
  );
}
