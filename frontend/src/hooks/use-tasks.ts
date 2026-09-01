import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  Task,
  TaskComment,
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  CreateTaskCommentInput,
  QueryTasksInput,
} from '../types/tasks';

export const TASKS_KEY = ['tasks'];
export const DEPT_BACKLOG_KEY = ['tasks', 'department-backlog'];

export function useTasks(query: QueryTasksInput = {}) {
  return useQuery({
    queryKey: [...TASKS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.assigneeId) params.append('assigneeId', query.assigneeId);
      if (query.targetDepartmentId) params.append('targetDepartmentId', query.targetDepartmentId);
      if (query.creatorId) params.append('creatorId', query.creatorId);
      if (query.status) params.append('status', query.status);
      if (query.priority) params.append('priority', query.priority);
      if (query.assignmentType) params.append('assignmentType', query.assignmentType);
      if (query.search) params.append('search', query.search);

      const response = await apiClient.get<Task[]>(
        `/api/v1/tasks?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useDepartmentBacklog() {
  return useQuery({
    queryKey: DEPT_BACKLOG_KEY,
    queryFn: async () => {
      const response = await apiClient.get<Task[]>('/api/v1/tasks/department-backlog');
      return response.data;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [...TASKS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<Task>(`/api/v1/tasks/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const response = await apiClient.post<Task>('/api/v1/tasks', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPT_BACKLOG_KEY });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskInput }) => {
      const response = await apiClient.patch<Task>(`/api/v1/tasks/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPT_BACKLOG_KEY });
      queryClient.invalidateQueries({ queryKey: [...TASKS_KEY, variables.id] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateTaskStatusInput;
    }) => {
      const response = await apiClient.patch<Task>(
        `/api/v1/tasks/${id}/status`,
        data,
      );
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });

      const queryCache = queryClient.getQueryCache();
      const taskQueries = queryCache.findAll({ queryKey: TASKS_KEY });
      const previousData = taskQueries.map((q) => ({
        queryKey: q.queryKey,
        data: q.state.data,
      }));

      taskQueries.forEach((q) => {
        if (Array.isArray(q.state.data)) {
          queryClient.setQueryData(q.queryKey, (old: Task[] | undefined) => {
            if (!old) return [];
            return old.map((task) =>
              task.id === id
                ? {
                    ...task,
                    status: data.status,
                    ...(data.order !== undefined && { order: data.order }),
                  }
                : task,
            );
          });
        }
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPT_BACKLOG_KEY });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      data,
    }: {
      taskId: string;
      data: CreateTaskCommentInput;
    }) => {
      const response = await apiClient.post<TaskComment>(
        `/api/v1/tasks/${taskId}/comments`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: [...TASKS_KEY, variables.taskId] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: DEPT_BACKLOG_KEY });
    },
  });
}
