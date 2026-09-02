import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import {
  FinancialTransaction,
  FinancialSummary,
  CreateTransactionInput,
  ReverseTransactionInput,
  QueryTransactionsParams,
  FinancialSummaryQueryParams,
  PaginatedTransactionsResponse,
} from '../types/accounting';

export const TRANSACTIONS_KEY = ['accounting', 'transactions'];
export const FINANCIAL_SUMMARY_KEY = ['accounting', 'summary'];

// -----------------------------------------------------------------------------
// GET TRANSACTIONS (PAGINATED & FILTERED)
// -----------------------------------------------------------------------------

export function useTransactions(query: QueryTransactionsParams = {}) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.search) params.append('search', query.search);
      if (query.type) params.append('type', query.type);
      if (query.category) params.append('category', query.category);
      if (query.paymentMethod) params.append('paymentMethod', query.paymentMethod);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.includeReversed !== undefined)
        params.append('includeReversed', query.includeReversed.toString());
      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', query.limit.toString());

      const res = await apiClient.get<PaginatedTransactionsResponse>(
        `/api/v1/accounting/transactions?${params.toString()}`,
      );
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// GET FINANCIAL SUMMARY & ANALYTICS
// -----------------------------------------------------------------------------

export function useFinancialSummary(query: FinancialSummaryQueryParams = {}) {
  return useQuery({
    queryKey: [...FINANCIAL_SUMMARY_KEY, query],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.year) params.append('year', query.year.toString());
      if (query.month) params.append('month', query.month.toString());
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);

      const res = await apiClient.get<FinancialSummary>(
        `/api/v1/accounting/summary?${params.toString()}`,
      );
      return res.data;
    },
  });
}

// -----------------------------------------------------------------------------
// GET SINGLE TRANSACTION BY ID
// -----------------------------------------------------------------------------

export function useTransaction(id?: string | null) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get<FinancialTransaction>(
        `/api/v1/accounting/transactions/${id}`,
      );
      return res.data;
    },
    enabled: !!id,
  });
}

// -----------------------------------------------------------------------------
// CREATE TRANSACTION MUTATION
// -----------------------------------------------------------------------------

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTransactionInput) => {
      const res = await apiClient.post<FinancialTransaction>(
        '/api/v1/accounting/transactions',
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: FINANCIAL_SUMMARY_KEY });
    },
  });
}

// -----------------------------------------------------------------------------
// REVERSE TRANSACTION MUTATION (قيد عكسي)
// -----------------------------------------------------------------------------

export function useReverseTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ReverseTransactionInput;
    }) => {
      const res = await apiClient.post<FinancialTransaction>(
        `/api/v1/accounting/transactions/${id}/reverse`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: FINANCIAL_SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: [...TRANSACTIONS_KEY, data.id] });
    },
  });
}
