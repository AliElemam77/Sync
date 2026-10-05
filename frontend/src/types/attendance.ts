export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HOLIDAY';
export type LeaveType = 'ANNUAL' | 'SICK' | 'UNPAID' | 'MATERNITY';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string | null;
  status: AttendanceStatus;
  delayMinutes: number;
  overtimeMinutes: number;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    shiftType: 'RS' | 'LS';
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface TodayAttendanceStatus {
  isSuperAdmin?: boolean;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    shiftType: 'RS' | 'LS';
    annualLeaveDays: number;
    /** Monthly allowance */
    monthlyPermissionHours: number;
    /** Allowance left in the current month */
    remainingPermissionHours?: number;
  } | null;
  approvedPermissionHours?: number;
  approvedPermissions?: PermissionRequest[];
  /** Today is the shift's weekly day off: check-in is not allowed */
  isWeeklyDayOff?: boolean;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  record?: AttendanceRecord | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  totalDaysRequested: number;
  type: LeaveType;
  status: RequestStatus;
  reason?: string | null;
  rejectionReason?: string | null;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    annualLeaveDays: number;
    avatarUrl?: string | null;
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRequest {
  id: string;
  employeeId: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  hoursRequested: number;
  status: RequestStatus;
  reason: string;
  rejectionReason?: string | null;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    monthlyPermissionHours: number;
    avatarUrl?: string | null;
    department?: {
      id: string;
      name: string;
      code: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveInput {
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason?: string;
}

export interface CreatePermissionInput {
  date: string;
  startTime?: string;
  endTime?: string;
  hoursRequested: number;
  reason: string;
}

export interface AttendanceMonthlySummary {
  year: number;
  month: number;
  totalDaysPresent: number;
  totalDelayMinutes: number;
  totalOvertimeMinutes: number;
  recordsCount: number;
}

/** Company-wide day off (feast, national holiday): never counted as absence */
export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export interface CreatePublicHolidayInput {
  startDate: string;
  /** Last day of a holiday spanning several days; defaults to startDate */
  endDate?: string;
  name: string;
}

/** HR correction of one employee's day; times are HH:mm in company time */
export interface RecordAttendanceInput {
  employeeId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
}
