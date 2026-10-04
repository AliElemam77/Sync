export type PayrollCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
export type AdjustmentType = 'BONUS' | 'PENALTY' | 'OVERTIME' | 'COMMISSION';

export interface FinancialAdjustment {
  id: string;
  payslipId: string;
  type: AdjustmentType;
  amount: number | string;
  reason: string;
  date?: string | null;
  createdAt: string;
}

export interface Payslip {
  id: string;
  employeeId: string;
  payrollCycleId: string;
  baseSalary: number | string;
  grossPay: number | string;
  netPay: number | string;
  totalAllowances: number | string;
  totalDeductions: number | string;
  attendancePenalties: number | string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    department?: { id: string; name: string };
    position?: { id: string; name: string };
  };
  payrollCycle?: PayrollCycle;
  adjustments?: FinancialAdjustment[];
}

export interface PayrollCycle {
  id: string;
  month: number;
  year: number;
  status: PayrollCycleStatus;
  totalGross: number | string;
  totalNet: number | string;
  approvedAt?: string | null;
  approvedById?: string | null;
  approvedBy?: { id: string; email: string };
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payslips?: Payslip[];
  _count?: { payslips: number };
}

export interface GeneratePayrollDto {
  month: number;
  year: number;
}

export interface QueryPayrollCyclesDto {
  year?: number;
  month?: number;
  status?: PayrollCycleStatus;
}
