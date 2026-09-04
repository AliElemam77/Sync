import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  PayrollCycle,
  Payslip,
  GeneratePayrollDto,
  QueryPayrollCyclesDto,
} from '../types/payroll';

export const PAYROLL_CYCLES_KEY = ['payroll', 'cycles'];
export const PAYROLL_CYCLE_KEY = ['payroll', 'cycle'];
export const MY_PAYSLIPS_KEY = ['payroll', 'my-payslips'];
export const PAYSLIP_KEY = ['payroll', 'payslip'];

// -----------------------------------------------------------------------------
// 1. GET ALL PAYROLL CYCLES
// -----------------------------------------------------------------------------

export function usePayrollCycles(query: QueryPayrollCyclesDto = {}) {
  return useQuery({
    queryKey: [...PAYROLL_CYCLES_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.year) params.append('year', query.year.toString());
      if (query.month) params.append('month', query.month.toString());
      if (query.status) params.append('status', query.status);

      const res = await apiClient.get<PayrollCycle[]>(
        `/api/v1/payroll/cycles?${params.toString()}`,
      );
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// 2. GET SINGLE PAYROLL CYCLE WITH ALL PAYSLIPS
// -----------------------------------------------------------------------------

export function usePayrollCycle(id: string | null) {
  return useQuery({
    queryKey: [...PAYROLL_CYCLE_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<PayrollCycle>(`/api/v1/payroll/cycles/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

// -----------------------------------------------------------------------------
// 3. GENERATE PAYROLL CYCLE MUTATION
// -----------------------------------------------------------------------------

export function useGeneratePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: GeneratePayrollDto) => {
      const res = await apiClient.post<PayrollCycle>('/api/v1/payroll/generate', dto);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PAYROLL_CYCLES_KEY });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: [...PAYROLL_CYCLE_KEY, data.id] });
      }
    },
  });
}

// -----------------------------------------------------------------------------
// 4. APPROVE & LOCK PAYROLL CYCLE MUTATION
// -----------------------------------------------------------------------------

export function useApprovePayrollCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cycleId: string) => {
      const res = await apiClient.patch<PayrollCycle>(
        `/api/v1/payroll/cycles/${cycleId}/approve`,
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PAYROLL_CYCLES_KEY });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: [...PAYROLL_CYCLE_KEY, data.id] });
      }
    },
  });
}

// -----------------------------------------------------------------------------
// 5. EMPLOYEE SELF-SERVICE: MY PAYSLIPS
// -----------------------------------------------------------------------------

export function useMyPayslips() {
  return useQuery({
    queryKey: MY_PAYSLIPS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<Payslip[]>('/api/v1/payroll/my-payslips');
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// 6. GET SINGLE PAYSLIP DETAILS
// -----------------------------------------------------------------------------

export function usePayslip(id: string | null) {
  return useQuery({
    queryKey: [...PAYSLIP_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<Payslip>(`/api/v1/payroll/payslips/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
