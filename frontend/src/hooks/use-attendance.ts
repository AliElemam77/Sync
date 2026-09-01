import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  AttendanceRecord,
  TodayAttendanceStatus,
  LeaveRequest,
  PermissionRequest,
  CreateLeaveInput,
  CreatePermissionInput,
  AttendanceMonthlySummary,
  RequestStatus,
  LeaveType,
} from '../types/attendance';

export const ATTENDANCE_TODAY_KEY = ['attendance', 'today'];
export const ATTENDANCE_RECORDS_KEY = ['attendance', 'records'];
export const LEAVES_KEY = ['leaves'];
export const PERMISSIONS_KEY = ['work-permissions'];

// =============================================================================
// ATTENDANCE HOOKS
// =============================================================================

export function useTodayAttendance() {
  return useQuery({
    queryKey: ATTENDANCE_TODAY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<TodayAttendanceStatus>('/api/v1/attendance/today');
      return res.data;
    },
    refetchInterval: 30000, // Background poll every 30s as fallback to sockets
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<AttendanceRecord>('/api/v1/attendance/check-in');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_RECORDS_KEY });
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch<AttendanceRecord>('/api/v1/attendance/check-out');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_RECORDS_KEY });
    },
  });
}

export function useAttendanceRecords(query: {
  employeeId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  return useQuery({
    queryKey: [...ATTENDANCE_RECORDS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.employeeId) params.append('employeeId', query.employeeId);
      if (query.departmentId) params.append('departmentId', query.departmentId);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);

      const res = await apiClient.get<AttendanceRecord[]>(`/api/v1/attendance/records?${params.toString()}`);
      return res.data;
    },
  });
}

export function useAttendanceSummary(employeeId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', 'summary', employeeId, year, month],
    queryFn: async () => {
      const res = await apiClient.get<AttendanceMonthlySummary>(
        `/api/v1/attendance/summary/${employeeId}?year=${year}&month=${month}`,
      );
      return res.data;
    },
    enabled: !!employeeId,
  });
}

// =============================================================================
// LEAVES HOOKS
// =============================================================================

export function useLeaves(query: {
  employeeId?: string;
  departmentId?: string;
  status?: RequestStatus;
  type?: LeaveType;
} = {}) {
  return useQuery({
    queryKey: [...LEAVES_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.employeeId) params.append('employeeId', query.employeeId);
      if (query.departmentId) params.append('departmentId', query.departmentId);
      if (query.status) params.append('status', query.status);
      if (query.type) params.append('type', query.type);

      const res = await apiClient.get<LeaveRequest[]>(`/api/v1/leaves?${params.toString()}`);
      return res.data;
    },
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateLeaveInput) => {
      const res = await apiClient.post<LeaveRequest>('/api/v1/leaves', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
    },
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<LeaveRequest>(`/api/v1/leaves/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_RECORDS_KEY });
    },
  });
}

export function useRejectLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const res = await apiClient.patch<LeaveRequest>(`/api/v1/leaves/${id}/reject`, { rejectionReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVES_KEY });
    },
  });
}

// =============================================================================
// WORK PERMISSIONS HOOKS (الأذونات)
// =============================================================================

export function useWorkPermissions(query: {
  employeeId?: string;
  departmentId?: string;
  status?: RequestStatus;
} = {}) {
  return useQuery({
    queryKey: [...PERMISSIONS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.employeeId) params.append('employeeId', query.employeeId);
      if (query.departmentId) params.append('departmentId', query.departmentId);
      if (query.status) params.append('status', query.status);

      const res = await apiClient.get<PermissionRequest[]>(`/api/v1/work-permissions?${params.toString()}`);
      return res.data;
    },
  });
}

export function useCreateWorkPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePermissionInput) => {
      const res = await apiClient.post<PermissionRequest>('/api/v1/work-permissions', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
    },
  });
}

export function useApproveWorkPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<PermissionRequest>(`/api/v1/work-permissions/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_TODAY_KEY });
    },
  });
}

export function useRejectWorkPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const res = await apiClient.patch<PermissionRequest>(`/api/v1/work-permissions/${id}/reject`, { rejectionReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_KEY });
    },
  });
}
