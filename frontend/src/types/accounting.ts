export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory =
  | 'PAYROLL'
  | 'ASSET_PURCHASE'
  | 'SUBSCRIPTION'
  | 'CLIENT_PAYMENT'
  | 'OPERATIONAL_EXPENSE'
  | 'TAX_AND_GOVERNMENT'
  | 'INVESTMENT'
  | 'MISC';

export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CREDIT_CARD'
  | 'CHEQUE'
  | 'ONLINE_GATEWAY'
  | 'OTHER';

export interface FinancialTransaction {
  id: string;
  transactionDate: string;
  amount: number | string;
  type: TransactionType;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  description: string;
  referenceId?: string | null;
  referenceType?: string | null;
  attachmentUrl?: string | null;
  isReversed: boolean;
  reversedAt?: string | null;
  reversalReason?: string | null;
  reversedById?: string | null;
  reversedBy?: {
    id: string;
    email: string;
    employeeProfile?: {
      fullName: string;
      employeeCode: string;
    } | null;
  } | null;
  recordedById: string;
  recordedBy?: {
    id: string;
    email: string;
    employeeProfile?: {
      fullName: string;
      employeeCode: string;
      avatarUrl?: string | null;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyTrendItem {
  month: string;
  monthIndex: number;
  income: number;
  expense: number;
  net: number;
}

export interface FinancialSummary {
  year: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  monthlyTrend: MonthlyTrendItem[];
}

export interface CreateTransactionInput {
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  paymentMethod?: PaymentMethod;
  description: string;
  transactionDate?: string;
  referenceId?: string;
  referenceType?: string;
  attachmentUrl?: string;
}

export interface ReverseTransactionInput {
  reason: string;
}

export interface QueryTransactionsParams {
  search?: string;
  type?: TransactionType;
  category?: TransactionCategory;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  includeReversed?: boolean;
  page?: number;
  limit?: number;
}

export interface FinancialSummaryQueryParams {
  year?: number;
  month?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedTransactionsResponse {
  data: FinancialTransaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
