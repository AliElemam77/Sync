export type PayrollCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
// EXTRA_DAY: a weekly day off that was worked (Saturday for LS), paid as a normal day
export type AdjustmentType = 'BONUS' | 'PENALTY' | 'OVERTIME' | 'COMMISSION' | 'EXTRA_DAY';

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

/** Payroll options set by Management */
export interface PayrollSettings {
  /** Overtime is paid only when enabled */
  overtimeEnabled: boolean;
  /** Regular hours paid per overtime hour (decimal as a string, e.g. "2") */
  overtimeMultiplier: string;
}

export interface UpdatePayrollSettingsInput {
  overtimeEnabled?: boolean;
  overtimeMultiplier?: number;
}

/** PAY: days of pay on the month's payslip. LEAVE: extra leave days beyond the yearly 21 */
export type BonusKind = 'PAY' | 'LEAVE';

interface BonusActor {
  id: string;
  email: string;
  employeeProfile?: { fullName: string } | null;
}

export interface Bonus {
  id: string;
  employeeId: string;
  kind: BonusKind;
  /** Decimal as a string, in half days */
  days: string;
  reason: string;
  /** First day of the payroll month (YYYY-MM-01) */
  payrollMonth: string;
  grantedById: string;
  cancelledAt?: string | null;
  createdAt: string;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    department?: { id: string; name: string } | null;
  };
  grantedBy?: BonusActor;
  cancelledBy?: BonusActor | null;
}

export interface GrantBonusInput {
  employeeId: string;
  kind?: BonusKind;
  days: number;
  reason: string;
}
