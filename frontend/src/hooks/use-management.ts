import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  ManagementStats,
  PendingRequestsResponse,
  PaginatedAuditLogsResponse,
  QueryAuditLogsInput,
  QueryPendingRequestsInput,
  ManagementOverrideInput,
} from '../types/management';

export const MANAGEMENT_STATS_KEY = ['management-stats'];
export const PENDING_REQUESTS_KEY = ['management-pending-requests'];
export const AUDIT_LOGS_KEY = ['audit-logs'];

export function useManagementStats() {
  return useQuery({
    queryKey: MANAGEMENT_STATS_KEY,
    queryFn: async () => {
      const response = await apiClient.get<ManagementStats>(
        '/api/v1/management/stats',
      );
      return response.data;
    },
    refetchInterval: 10000, // Live poll every 10s
    staleTime: 5000,
  });
}

export function usePendingRequests(query: QueryPendingRequestsInput = {}) {
  return useQuery({
    queryKey: [...PENDING_REQUESTS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.type) params.append('type', query.type);
      if (query.departmentId) params.append('departmentId', query.departmentId);
      if (query.limit) params.append('limit', String(query.limit));

      const response = await apiClient.get<PendingRequestsResponse>(
        `/api/v1/management/pending-requests?${params.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 10000, // Live poll every 10s
    staleTime: 5000,
  });
}

export function useInfiniteAuditLogs(
  query: Omit<QueryAuditLogsInput, 'page'> = {},
) {
  return useInfiniteQuery({
    queryKey: [...AUDIT_LOGS_KEY, query],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.append('page', String(pageParam));
      params.append('limit', String(query.limit || 30));

      if (query.action) params.append('action', query.action);
      if (query.entity) params.append('entity', query.entity);
      if (query.userId) params.append('userId', query.userId);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.search) params.append('search', query.search);

      const response = await apiClient.get<PaginatedAuditLogsResponse>(
        `/api/v1/management/audit-logs?${params.toString()}`,
      );
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    refetchInterval: 10000, // 10s live pulse polling
    staleTime: 5000,
  });
}

export function useManagementOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ManagementOverrideInput) => {
      const response = await apiClient.post(
        '/api/v1/management/override-action',
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: MANAGEMENT_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_KEY });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['work-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
