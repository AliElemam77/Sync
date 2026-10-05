import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Bonus, GrantBonusInput } from '../types/payroll';
import { EMPLOYEES_KEY } from './use-employees';

export const BONUSES_KEY = ['bonuses'];

/** Bonuses of a payroll month (YYYY-MM), scoped by the backend to what the user may see */
export function useBonuses(month: string) {
  return useQuery({
    queryKey: [...BONUSES_KEY, month],
    queryFn: async () => {
      const res = await apiClient.get<Bonus[]>(`/api/v1/bonuses?month=${month}`);
      return res.data;
    },
  });
}

export function useGrantBonus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GrantBonusInput) => {
      const res = await apiClient.post<Bonus>('/api/v1/bonuses', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BONUSES_KEY });
      // A leave bonus changes the employee's balance
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}

export function useCancelBonus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<Bonus>(`/api/v1/bonuses/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BONUSES_KEY });
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}
