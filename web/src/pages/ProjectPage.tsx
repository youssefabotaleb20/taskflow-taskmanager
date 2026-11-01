import { useDeferredValue, useState, type FormEvent } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useAddMember, useCreateTask, useProject, useTasks, useUpdateTask, type TaskFilters } from "../lib/queries";
import { useAuth } from "../lib/auth";
import { STATUS_LABELS, type Project, type Task, type TaskStatus } from "../lib/types";
import { formatDate, isOverdue } from "../lib/format";
import { Alert, Avatar, Button, Loading, PriorityBadge, TextField } from "../components/ui";
import { cx } from "../lib/cx";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const { data, isPending, error } = useProject(projectId);
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<TaskFilters["priority"]>("");
  const q = useDeferredValue(search.trim());

  if (isPending) return <Loading label="Loading project" />;
  if (error) return <Alert>{error.status === 404 ? "This project doesn't exist or you're not a member." : error.message}</Alert>;

  const { project, taskCounts } = data;
  const total = taskCounts.todo + taskCounts.in_progress + taskCounts.done;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm">
        <Link to="/" className="text-slate-500 hover:text-slate-800">
          Projects
        </Link>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-slate-600">{project.description}</p>}
          <p className="mt-2 text-sm text-slate-500">
            {taskCounts.done} of {total} tasks done
          </p>
        </div>
        <Members project={project} />
      </div>

      <div className="mb-5 flex flex-wrap gap-3" role="search">
        <label className="sr-only" htmlFor="task-search">
          Search tasks
        </label>
        <input
          id="task-search"
          type="search"
          placeholder="Search tasks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-64"
        />
        <label className="sr-only" htmlFor="filter-assignee">
          Filter by assignee
        </label>
        <select
          id="filter-assignee"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Everyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
        </select>
        <label className="sr-only" htmlFor="filter-priority">
          Filter by priority
        </label>
        <select
          id="filter-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskFilters["priority"])}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <Board projectId={project.id} filters={{ q, assignee, priority }} />
      <Outlet context={{ project }} />
    </div>
  );
}

function Board({ projectId, filters }: { projectId: string; filters: TaskFilters }) {
  const { data, isPending, error } = useTasks(projectId, filters);
  if (isPending) return <Loading label="Loading tasks" />;
  if (error) return <Alert>{error.message}</Alert>;

  const byStatus = Object.fromEntries(COLUMNS.map((s) => [s, data.data.filter((t) => t.status === s)])) as Record<
    TaskStatus,
    Task[]
  >;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((status) => (
        <section
          key={status}
          aria-labelledby={`col-${status}`}
          className="flex min-h-40 flex-col rounded-2xl bg-slate-100/80 p-3"
        >
          <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-slate-700">
            {STATUS_LABELS[status]}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
              {byStatus[status].length}
            </span>
          </h2>
          {status === "todo" && <QuickAdd projectId={projectId} />}
          <ul className="space-y-2">
            {byStatus[status].map((task) => (
              <TaskCard key={task.id} task={task} projectId={projectId} />
            ))}
          </ul>
          {byStatus[status].length === 0 && <p className="px-1 py-4 text-center text-sm text-slate-400">No tasks</p>}
        </section>
      ))}
    </div>
  );
}

function QuickAdd({ projectId }: { projectId: string }) {
  const create = useCreateTask(projectId);
  const [title, setTitle] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim() });
    setTitle("");
  }

  return (
    <form onSubmit={(e) => void onSubmit(e).catch(() => undefined)} className="mb-3 flex gap-2" aria-label="Add task">
      <label htmlFor="new-task" className="sr-only">
        New task title
      </label>
      <input
        id="new-task"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
        Add
      </Button>
    </form>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const update = useUpdateTask(projectId);
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
      <Link
        to={`tasks/${task.id}`}
        className={cx("block text-sm font-medium hover:text-brand-700", task.status === "done" && "text-slate-500 line-through")}
      >
        {task.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cx(overdue && "font-medium text-red-600")}>
            {overdue ? "Overdue · " : "Due "}
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.commentCount > 0 && (
          <span aria-label={`${task.commentCount} comments`}>💬 {task.commentCount}</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {task.assignee && <Avatar user={task.assignee} />}
          <label className="sr-only" htmlFor={`status-${task.id}`}>
            Status of {task.title}
          </label>
          <select
            id={`status-${task.id}`}
            value={task.status}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: task.id, status: e.target.value as TaskStatus })}
            className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs"
          >
            {COLUMNS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </span>
      </div>
    </li>
  );
}

function Members({ project }: { project: Project }) {
  const { user } = useAuth();
  const addMember = useAddMember(project.id);
  const [open, setOpen] = useState(false);
  const isOwner = user?.id === project.owner.id;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email")).trim();
    if (!email) return;
    await addMember.mutateAsync(email);
    form.reset();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <ul className="flex -space-x-1.5" aria-label="Members">
          {project.members.map((m) => (
            <li key={m.id} className="rounded-full ring-2 ring-slate-50">
              <Avatar user={m} size="md" />
              <span className="sr-only">{m.name}</span>
            </li>
          ))}
        </ul>
        {isOwner && (
          <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            Invite
          </Button>
        )}
      </div>
      {open && isOwner && (
        <form
          onSubmit={(e) => void onSubmit(e).catch(() => undefined)}
          className="flex w-full max-w-sm items-start gap-2"
          aria-label="Invite member"
        >
          <TextField
            label="Member email"
            name="email"
            type="email"
            placeholder="teammate@example.com"
            className="flex-1"
            error={addMember.error?.message}
          />
          <Button type="submit" className="mt-6" loading={addMember.isPending}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
