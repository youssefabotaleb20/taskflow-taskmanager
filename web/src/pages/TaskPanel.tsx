import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useAddComment, useComments, useDeleteTask, useTask, useUpdateTask, type TaskInput } from "../lib/queries";
import { useAuth } from "../lib/auth";
import { PRIORITY_LABELS, STATUS_LABELS, type Project, type Task, type TaskPriority, type TaskStatus } from "../lib/types";
import { timeAgo, toDateInput } from "../lib/format";
import { Alert, Avatar, Button, Loading } from "../components/ui";

const selectClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function TaskPanel() {
  const { taskId = "" } = useParams();
  const { project } = useOutletContext<{ project: Project }>();
  const navigate = useNavigate();
  const { data, isPending, error } = useTask(taskId);
  const close = () => navigate(`/projects/${project.id}`);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && navigate(`/projects/${project.id}`);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, project.id]);

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-panel-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="task-panel-title" className="text-sm font-medium text-slate-500">
            Task details
          </h2>
          <Button variant="ghost" onClick={close} aria-label="Close task details">
            ✕
          </Button>
        </div>
        {isPending ? (
          <Loading label="Loading task" />
        ) : error ? (
          <div className="p-5">
            <Alert>{error.message}</Alert>
          </div>
        ) : (
          <TaskDetails key={data.task.id} task={data.task} project={project} onDeleted={close} />
        )}
      </div>
    </div>
  );
}

function TaskDetails({ task, project, onDeleted }: { task: Task; project: Project; onDeleted: () => void }) {
  const update = useUpdateTask(project.id);
  const remove = useDeleteTask(project.id);
  const { user } = useAuth();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const canDelete = user?.id === task.createdBy.id || user?.id === project.owner.id;

  const save = (changes: TaskInput) => update.mutate({ id: task.id, ...changes });

  async function onDelete() {
    if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    await remove.mutateAsync(task.id);
    onDeleted();
  }

  return (
    <div className="flex-1 space-y-5 p-5">
      {update.error && <Alert>{update.error.message}</Alert>}
      <div>
        <label htmlFor="task-title" className="sr-only">
          Title
        </label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
          className="w-full rounded-lg border border-transparent px-2 py-1 text-xl font-semibold hover:border-slate-200 focus:border-slate-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            className={selectClass}
            value={task.status}
            onChange={(e) => save({ status: e.target.value as TaskStatus })}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Priority
          <select
            className={selectClass}
            value={task.priority}
            onChange={(e) => save({ priority: e.target.value as TaskPriority })}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Assignee
          <select
            className={selectClass}
            value={task.assignee?.id ?? ""}
            onChange={(e) => save({ assignee: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {project.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Due date
          <input
            type="date"
            className={selectClass}
            value={toDateInput(task.dueDate)}
            onChange={(e) => save({ dueDate: e.target.value || null })}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Description
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== task.description && save({ description })}
          placeholder="Add more detail…"
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
        />
      </label>

      <p className="text-xs text-slate-500">
        Created by {task.createdBy.name} {timeAgo(task.createdAt)}
      </p>

      <Comments taskId={task.id} projectId={project.id} />

      {canDelete && (
        <div className="border-t border-slate-200 pt-4">
          <Button variant="danger" onClick={() => void onDelete().catch(() => undefined)} loading={remove.isPending}>
            Delete task
          </Button>
        </div>
      )}
    </div>
  );
}

function Comments({ taskId, projectId }: { taskId: string; projectId: string }) {
  const { data, isPending } = useComments(taskId);
  const add = useAddComment(taskId, projectId);
  const [body, setBody] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await add.mutateAsync(body.trim());
    setBody("");
  }

  return (
    <section aria-labelledby="comments-heading" className="border-t border-slate-200 pt-4">
      <h3 id="comments-heading" className="mb-3 text-sm font-semibold">
        Comments
      </h3>
      {isPending ? (
        <Loading label="Loading comments" />
      ) : data && data.data.length > 0 ? (
        <ul className="mb-4 space-y-3">
          {data.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar user={c.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-800">{c.author.name}</span> · {timeAgo(c.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-slate-500">No comments yet.</p>
      )}
      <form onSubmit={(e) => void onSubmit(e).catch(() => undefined)} className="space-y-2">
        <label htmlFor="new-comment" className="sr-only">
          Write a comment
        </label>
        <textarea
          id="new-comment"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {add.error && <Alert>{add.error.message}</Alert>}
        <Button type="submit" loading={add.isPending} disabled={!body.trim()}>
          Comment
        </Button>
      </form>
    </section>
  );
}
