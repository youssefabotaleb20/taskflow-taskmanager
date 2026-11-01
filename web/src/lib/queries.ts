import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Comment, Page, Project, Task, TaskPriority, TaskStatus } from "./types";

export const keys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  tasks: (projectId: string, filters: TaskFilters) => ["projects", projectId, "tasks", filters] as const,
  allTasks: (projectId: string) => ["projects", projectId, "tasks"] as const,
  task: (id: string) => ["tasks", id] as const,
  comments: (taskId: string) => ["tasks", taskId, "comments"] as const,
};

export interface TaskFilters {
  q?: string;
  assignee?: string;
  priority?: TaskPriority | "";
}

export interface TaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
  dueDate?: string | null;
}

export function useProjects() {
  return useQuery({ queryKey: keys.projects, queryFn: () => api<Page<Project>>("/projects", { query: { limit: 100 } }) });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn: () =>
      api<{ project: Project; taskCounts: Record<TaskStatus, number> }>(`/projects/${id}`),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<{ project: Project }>("/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useAddMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      api<{ project: Project }>(`/projects/${projectId}/members`, { method: "POST", body: { email } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.project(projectId) }),
  });
}

export function useTasks(projectId: string, filters: TaskFilters) {
  return useQuery({
    queryKey: keys.tasks(projectId, filters),
    queryFn: () =>
      api<Page<Task>>(`/projects/${projectId}/tasks`, {
        query: { limit: 100, sort: "-createdAt", q: filters.q, assignee: filters.assignee, priority: filters.priority },
      }),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => api<{ task: Task }>(`/projects/${projectId}/tasks`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.allTasks(projectId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId), exact: true });
    },
  });
}

export function useTask(id: string) {
  return useQuery({ queryKey: keys.task(id), queryFn: () => api<{ task: Task }>(`/tasks/${id}`) });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TaskInput & { id: string }) =>
      api<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", body }),
    onSuccess: ({ task }) => {
      qc.setQueryData(keys.task(task.id), { task });
      qc.invalidateQueries({ queryKey: keys.allTasks(projectId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId), exact: true });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.allTasks(projectId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId), exact: true });
    },
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: keys.comments(taskId),
    queryFn: () => api<Page<Comment>>(`/tasks/${taskId}/comments`, { query: { limit: 100 } }),
  });
}

export function useAddComment(taskId: string, projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ comment: Comment }>(`/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.comments(taskId) });
      qc.invalidateQueries({ queryKey: keys.task(taskId) });
      qc.invalidateQueries({ queryKey: keys.allTasks(projectId) });
    },
  });
}
