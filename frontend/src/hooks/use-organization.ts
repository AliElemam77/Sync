import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  Department,
  CreateDepartmentInput,
  CreatePositionInput,
  CreateLevelInput,
} from '../types/organization';

export const ORG_QUERY_KEY = ['organization-tree'];

export function useOrganizationTree() {
  return useQuery({
    queryKey: ORG_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<Department[]>('/api/v1/organization/tree');
      return response.data;
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDepartmentInput) => {
      const response = await apiClient.post<Department>(
        '/api/v1/organization/departments',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/organization/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePositionInput) => {
      const response = await apiClient.post(
        '/api/v1/organization/positions',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/organization/positions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}

export function useCreateLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateLevelInput) => {
      const response = await apiClient.post('/api/v1/organization/levels', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}

export function useDeleteLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/organization/levels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}
