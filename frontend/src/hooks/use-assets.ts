import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  Asset,
  AssetStats,
  AssetAssignmentHistory,
  CreateAssetInput,
  UpdateAssetInput,
  AssignAssetInput,
  ReturnAssetInput,
  QueryAssetsParams,
  PaginatedAssetsResponse,
} from '../types/asset';

export const ASSETS_KEY = ['assets'];
export const ASSET_STATS_KEY = ['assets', 'stats'];

// -----------------------------------------------------------------------------
// GET ASSETS (Paginated / Filtered)
// -----------------------------------------------------------------------------

export function useAssets(query: QueryAssetsParams = {}) {
  return useQuery({
    queryKey: [...ASSETS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.append('search', query.search);
      if (query.type) params.append('type', query.type);
      if (query.status) params.append('status', query.status);
      if (query.assigneeId) params.append('assigneeId', query.assigneeId);
      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', query.limit.toString());

      const res = await apiClient.get<PaginatedAssetsResponse>(
        `/api/v1/assets?${params.toString()}`,
      );
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// GET ASSET STATS
// -----------------------------------------------------------------------------

export function useAssetStats() {
  return useQuery({
    queryKey: ASSET_STATS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<AssetStats>('/api/v1/assets/stats');
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// GET SINGLE ASSET BY ID
// -----------------------------------------------------------------------------

export function useAsset(id?: string | null) {
  return useQuery({
    queryKey: [...ASSETS_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<Asset>(`/api/v1/assets/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

// -----------------------------------------------------------------------------
// GET EMPLOYEE ASSIGNED ASSETS & HISTORY
// -----------------------------------------------------------------------------

export function useEmployeeAssets(employeeId?: string | null) {
  return useQuery({
    queryKey: [...ASSETS_KEY, 'employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return { activeAssets: [], history: [] };
      const res = await apiClient.get<{
        activeAssets: Asset[];
        history: AssetAssignmentHistory[];
      }>(`/api/v1/assets/employee/${employeeId}`);
      return res.data;
    },
    enabled: !!employeeId,
  });
}

// -----------------------------------------------------------------------------
// CREATE ASSET MUTATION
// -----------------------------------------------------------------------------

export function useCreateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAssetInput) => {
      const res = await apiClient.post<Asset>('/api/v1/assets', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_KEY });
    },
  });
}

// -----------------------------------------------------------------------------
// UPDATE ASSET MUTATION
// -----------------------------------------------------------------------------

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAssetInput }) => {
      const res = await apiClient.patch<Asset>(`/api/v1/assets/${id}`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: [...ASSETS_KEY, data.id] });
    },
  });
}

// -----------------------------------------------------------------------------
// DELETE ASSET MUTATION
// -----------------------------------------------------------------------------

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<{ success: boolean; message: string }>(
        `/api/v1/assets/${id}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_KEY });
    },
  });
}

// -----------------------------------------------------------------------------
// ASSIGN ASSET MUTATION (تسليم عهدة)
// -----------------------------------------------------------------------------

export function useAssignAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssignAssetInput }) => {
      const res = await apiClient.post<Asset>(`/api/v1/assets/${id}/assign`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: [...ASSETS_KEY, data.id] });
      if (data.assigneeId) {
        queryClient.invalidateQueries({
          queryKey: [...ASSETS_KEY, 'employee', data.assigneeId],
        });
      }
    },
  });
}

// -----------------------------------------------------------------------------
// RETURN ASSET MUTATION (استرجاع عهدة)
// -----------------------------------------------------------------------------

export function useReturnAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReturnAssetInput }) => {
      const res = await apiClient.post<Asset>(`/api/v1/assets/${id}/return`, data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ASSETS_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_KEY });
      queryClient.invalidateQueries({ queryKey: [...ASSETS_KEY, data.id] });
    },
  });
}
