import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  Employee,
  CreateEmployeeInput,
  QueryEmployeesInput,
  PaginatedEmployeesResponse,
} from '../types/employees';

export const EMPLOYEES_KEY = ['employees'];
export const NEXT_CODE_KEY = ['next-employee-code'];

export function useEmployees(query: QueryEmployeesInput = {}) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.append('search', query.search);
      if (query.departmentId) params.append('departmentId', query.departmentId);
      if (query.positionId) params.append('positionId', query.positionId);
      if (query.status) params.append('status', query.status);
      if (query.shiftType) params.append('shiftType', query.shiftType);
      if (query.page) params.append('page', String(query.page));
      if (query.limit) params.append('limit', String(query.limit));

      const response = await apiClient.get<PaginatedEmployeesResponse>(
        `/api/v1/employees?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get<Employee>(`/api/v1/employees/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useNextEmployeeCode() {
  return useQuery({
    queryKey: NEXT_CODE_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ nextCode: string }>(
        '/api/v1/employees/next-code',
      );
      return response.data.nextCode;
    },
    staleTime: 0, // Always fresh
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEmployeeInput) => {
      const response = await apiClient.post<Employee>(
        '/api/v1/employees',
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      queryClient.invalidateQueries({ queryKey: NEXT_CODE_KEY });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/v1/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      queryClient.invalidateQueries({ queryKey: NEXT_CODE_KEY });
    },
  });
}
