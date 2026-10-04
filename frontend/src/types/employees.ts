export type ShiftType = 'RS' | 'LS';
export type Gender = 'MALE' | 'FEMALE';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'TRAINING';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'ENDED';
export type EmergencyRelationship =
  | 'FATHER'
  | 'MOTHER'
  | 'BROTHER'
  | 'SISTER'
  | 'SPOUSE'
  | 'OTHER';
export type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'CV'
  | 'CONTRACT'
  | 'OTHER';

export interface EmergencyContact {
  id?: string;
  name: string;
  relationship: EmergencyRelationship;
  phone: string;
}

export interface BankInfo {
  id?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  branch?: string;
  basicSalary?: number;
  isMasked?: boolean;
  message?: string;
}

export interface EmployeeDocument {
  id?: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
}

export interface Employee {
  id: string;
  /**
   * Set when the viewer may only see a colleague card: then only id, employeeCode, fullName,
   * avatarUrl, department, position and user.email are present.
   */
  isLimitedView?: boolean;
  userId: string;
  user: {
    id: string;
    email: string;
    isActive: boolean;
  };
  employeeCode: string;
  fullName: string;
  phone: string;
  dob?: string | null;
  gender: Gender;
  avatarUrl?: string | null;
  shiftType: ShiftType;
  monthlyPermissionHours: number;
  annualLeaveDays: number;
  company: string;
  branch: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  positionId: string;
  position: {
    id: string;
    name: string;
  };
  levelId?: string | null;
  level?: {
    id: string;
    name: string;
    rank: number;
  } | null;
  joiningDate: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  address?: string | null;
  altPhone?: string | null;
  emergencyContact?: EmergencyContact | null;
  /** Present only for viewers with employees.manage_salary */
  salaryProfile?: { baseSalary: string | number; paymentMethod: SalaryPaymentMethod } | null;
  bankInfo?: BankInfo | null;
  documents?: EmployeeDocument[];
  managedDepartments?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type SalaryPaymentMethod = 'CASH' | 'BANK_TRANSFER';

export interface SalaryInput {
  baseSalary: number;
  paymentMethod: SalaryPaymentMethod;
}

export interface CreateEmployeeInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  dob?: string;
  gender?: Gender;
  shiftType?: ShiftType;
  avatarUrl?: string;
  company?: string;
  branch?: string;
  departmentId: string;
  positionId: string;
  levelId?: string;
  managedDepartmentIds?: string[];
  joiningDate?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  address?: string;
  altPhone?: string;
  emergencyContact?: {
    name: string;
    relationship?: EmergencyRelationship;
    phone: string;
  };
  bankInfo?: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    iban?: string;
    swift?: string;
    branch?: string;
    basicSalary?: number;
  };
  /** Fixed monthly salary and payout method (requires employees.manage_salary) */
  salary?: SalaryInput;
}

export interface UpdateEmployeeInput {
  fullName?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  roleId?: string;
  phone?: string;
  dob?: string;
  gender?: Gender;
  shiftType?: ShiftType;
  avatarUrl?: string;
  company?: string;
  branch?: string;
  departmentId?: string;
  positionId?: string;
  levelId?: string;
  managedDepartmentIds?: string[];
  joiningDate?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
  annualLeaveDays?: number;
  monthlyPermissionHours?: number;
  address?: string;
  altPhone?: string;
  emergencyContact?: {
    name: string;
    relationship?: EmergencyRelationship;
    phone: string;
  };
  bankInfo?: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    iban?: string;
    swift?: string;
    branch?: string;
    basicSalary?: number;
  };
  /** Fixed monthly salary and payout method (requires employees.manage_salary) */
  salary?: SalaryInput;
}

export interface QueryEmployeesInput {
  search?: string;
  departmentId?: string;
  positionId?: string;
  status?: EmployeeStatus;
  shiftType?: ShiftType;
  page?: number;
  limit?: number;
}

export interface PaginatedEmployeesResponse {
  data: Employee[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
