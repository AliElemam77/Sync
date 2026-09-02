export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT';

export interface AuditLogUser {
  id: string;
  email: string;
  employeeProfile?: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    position?: {
      id: string;
      name: string;
    } | null;
    department?: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: AuditLogUser | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type ActionableCategory = 'LEAVE' | 'PERMISSION' | 'TASK_REVIEW';

export interface ActionableItem {
  id: string;
  category: ActionableCategory;
  title: string;
  description: string | null;
  status: string;
  priority?: string | null;
  createdAt: string;
  requester: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    positionName?: string;
    departmentName?: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  meta: Record<string, any>;
}

export interface PendingRequestsResponse {
  data: ActionableItem[];
  counts: {
    leaves: number;
    permissions: number;
    tasks: number;
    total: number;
  };
}

export interface ManagementStats {
  activeEmployeesCount: number;
  todayPresentCount: number;
  totalDepartmentsCount: number;
  openTasksCount: number;
  pendingApprovalsTotal: number;
  pendingBreakdown: {
    leaves: number;
    permissions: number;
    tasks: number;
  };
  financialSummary: {
    monthlyIncome: number;
    monthlyExpense: number;
    monthlyNetProfit: number;
  };
}

export interface QueryAuditLogsInput {
  action?: AuditAction;
  entity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface QueryPendingRequestsInput {
  type?: 'ALL' | 'LEAVE' | 'PERMISSION' | 'TASK_REVIEW';
  departmentId?: string;
  limit?: number;
}

export interface ManagementOverrideInput {
  id: string;
  category: 'LEAVE' | 'PERMISSION' | 'TASK';
  action: 'APPROVE' | 'REJECT' | 'COMPLETE';
  reason?: string;
}
