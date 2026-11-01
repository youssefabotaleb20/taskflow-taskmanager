import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useProjects } from "../lib/queries";
import { Alert, Avatar, Button, Loading, TextField } from "../components/ui";

export function ProjectsPage() {
  const { data, isPending, error } = useProjects();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-slate-600">Everything you and your team are working on.</p>
        </div>
        {!creating && <Button onClick={() => setCreating(true)}>New project</Button>}
      </div>

      {creating && <NewProjectForm onDone={() => setCreating(false)} />}

      {isPending ? (
        <Loading label="Loading projects" />
      ) : error ? (
        <Alert>{error.message}</Alert>
      ) : data.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="font-medium">No projects yet</h2>
          <p className="mt-1 text-sm text-slate-600">Create your first project to start adding tasks.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${project.id}`}
                className="block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-brand-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <h2 className="font-semibold">{project.name}</h2>
                {project.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{project.description}</p>}
                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <Avatar user={project.owner} />
                  Owned by {project.owner.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const create = useCreateProject();
  const [nameError, setNameError] = useState<string>();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) {
      setNameError("Give the project a name");
      return;
    }
    await create.mutateAsync({ name, description: String(form.get("description")).trim() || undefined });
    onDone();
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e).catch(() => undefined)}
      aria-label="New project"
      className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_2fr_auto] sm:items-start"
    >
      <TextField label="Project name" name="name" autoFocus error={nameError} />
      <TextField label="Description" name="description" placeholder="Optional" />
      <div className="flex gap-2 sm:pt-6">
        <Button type="submit" loading={create.isPending}>
          Create
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {create.error && (
        <div className="sm:col-span-3">
          <Alert>{create.error.message}</Alert>
        </div>
      )}
    </form>
  );
}
