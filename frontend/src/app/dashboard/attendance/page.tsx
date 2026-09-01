'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock,
  Calendar,
  CalendarDays,
  CheckCircle2,
  XCircle,
  PlayCircle,
  StopCircle,
  AlertTriangle,
  Send,
  Plus,
  Filter,
  User,
  Users,
  Building2,
  History,
  Check,
  X,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Shield,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
import {
  useTodayAttendance,
  useCheckIn,
  useCheckOut,
  useAttendanceRecords,
  useLeaves,
  useCreateLeave,
  useApproveLeave,
  useRejectLeave,
  useWorkPermissions,
  useCreateWorkPermission,
  useApproveWorkPermission,
  useRejectWorkPermission,
} from '../../../hooks/use-attendance';
import { useEmployees } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import {
  LeaveType,
  RequestStatus,
  LeaveRequest,
  PermissionRequest,
} from '../../../types/attendance';

// -----------------------------------------------------------------------------
// ZOD VALIDATION SCHEMAS
// -----------------------------------------------------------------------------

const createLeaveSchema = z
  .object({
    type: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'MATERNITY']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    totalDaysRequested: z.number().min(1, 'At least 1 day is required'),
    reason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    {
      message: 'Start date cannot be after end date',
      path: ['endDate'],
    },
  );

type CreateLeaveFormData = z.infer<typeof createLeaveSchema>;

const createPermissionSchema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required (من الساعة)'),
    endTime: z.string().min(1, 'End time is required (إلى الساعة)'),
    hoursRequested: z.number().min(1, 'Minimum 1 hour').max(8, 'Maximum 8 hours'),
    reason: z.string().min(3, 'Please provide a clear reason for the permission'),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return data.startTime < data.endTime;
    },
    {
      message: 'Start time must be before end time',
      path: ['endTime'],
    },
  );

type CreatePermissionFormData = z.infer<typeof createPermissionSchema>;

const rejectSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
});

type RejectFormData = z.infer<typeof rejectSchema>;

// -----------------------------------------------------------------------------
// DURATION & PENALTY FORMATTING HELPERS (HR POLICY)
// -----------------------------------------------------------------------------

function formatDurationDetailed(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 دقيقة';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    if (mins === 15) return '15 دقيقة (ربع ساعة)';
    if (mins === 30) return '30 دقيقة (نصف ساعة)';
    if (mins === 45) return '45 دقيقة (إلا ربع)';
    return `${mins} دقيقة`;
  }

  let fraction = '';
  if (mins === 15) fraction = ' وربع';
  else if (mins === 30) fraction = ' ونصف';
  else if (mins === 45) fraction = ' إلا ربع';
  else if (mins > 0) fraction = ` و ${mins} دقيقة`;

  const hourName = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  return `${hourName}${fraction} (${hours}h${mins > 0 ? ` ${mins}m` : ''})`;
}

function getDelayPenalty(delayMinutes: number, hasCheckOut: boolean = true) {
  if (!hasCheckOut) {
    return {
      penaltyLabel: 'خصم يوم كامل (نسيان بصمة الخروج)',
      deductionDays: 1.0,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
    };
  }

  if (delayMinutes <= 15) {
    return {
      penaltyLabel: 'فترة سماح (بدون خصم)',
      deductionDays: 0,
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-medium',
    };
  } else if (delayMinutes <= 30) {
    return {
      penaltyLabel: 'خصم ربع يوم (-0.25d)',
      deductionDays: 0.25,
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-medium',
    };
  } else if (delayMinutes <= 60) {
    return {
      penaltyLabel: 'خصم نصف يوم (-0.50d)',
      deductionDays: 0.5,
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30 font-medium',
    };
  } else {
    return {
      penaltyLabel: 'خصم يوم عمل كامل (-1.00d)',
      badgeColor: 'bg-rose-600/20 text-rose-300 border-rose-500/40 font-bold',
    };
  }
}

// -----------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -----------------------------------------------------------------------------

export default function AttendancePage() {
  const { user } = useAuth();
  const roleName = typeof (user?.role as any) === 'string' ? (user?.role as any) : user?.role?.name || '';
  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isHR = ['SUPER_ADMIN', 'HR_MANAGER'].includes(roleName);

  // Active Tab View: 'APPROVALS' | 'LEAVES' | 'PERMISSIONS' | 'LOGS'
  const [activeTab, setActiveTab] = useState<'APPROVALS' | 'LEAVES' | 'PERMISSIONS' | 'LOGS'>(
    isHR ? 'APPROVALS' : 'LEAVES',
  );

  // Modals state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<{
    id: string;
    kind: 'LEAVE' | 'PERMISSION';
    title: string;
  } | null>(null);

  // Error / Toast Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'SUCCESS' | 'ERROR'; message: string } | null>(
    null,
  );

  // Filter states
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | ''>('');

  // Queries
  const {
    data: todayStatus,
    isLoading: isTodayLoading,
    refetch: refetchToday,
  } = useTodayAttendance();

  const { data: leaves = [], isLoading: isLeavesLoading } = useLeaves({
    departmentId: selectedDeptId || undefined,
    status: (selectedStatus as RequestStatus) || undefined,
  });

  const { data: permissions = [], isLoading: isPermissionsLoading } = useWorkPermissions({
    departmentId: selectedDeptId || undefined,
    status: (selectedStatus as RequestStatus) || undefined,
  });

  const { data: attendanceLogs = [], isLoading: isLogsLoading } = useAttendanceRecords({
    departmentId: selectedDeptId || undefined,
  });

  const { data: employees = [] } = useEmployees();
  const { data: departments = [] } = useOrganizationTree();

  // Mutations
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const approveLeaveMutation = useApproveLeave();
  const rejectLeaveMutation = useRejectLeave();
  const approvePermissionMutation = useApproveWorkPermission();
  const rejectPermissionMutation = useRejectWorkPermission();

  // Live timer tick for active shift
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!todayStatus?.record?.checkInTime || todayStatus?.record?.checkOutTime) {
      setElapsedSeconds(0);
      return;
    }

    const checkInTimeMs = new Date(todayStatus.record.checkInTime).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - checkInTimeMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [todayStatus]);

  // Format Elapsed Seconds as HH:MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Pending Approvals Count for Managers
  const pendingLeaves = useMemo(() => leaves.filter((l) => l.status === 'PENDING'), [leaves]);
  const pendingPermissions = useMemo(
    () => permissions.filter((p) => p.status === 'PENDING'),
    [permissions],
  );
  const totalPendingCount = pendingLeaves.length + pendingPermissions.length;

  // Handlers
  const handleCheckIn = async () => {
    try {
      setFeedback(null);
      await checkInMutation.mutateAsync();
      setFeedback({ type: 'SUCCESS', message: 'Checked in successfully! Have a productive day.' });
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err.response?.data?.message || 'Failed to check in. Please try again.',
      });
    }
  };

  const handleCheckOut = async () => {
    try {
      setFeedback(null);
      const res = await checkOutMutation.mutateAsync();
      const delay = res.delayMinutes || 0;
      const overtime = res.overtimeMinutes || 0;

      let msg = 'تم تسجيل بصمة الانصراف بنجاح!';
      if (overtime > 0) {
        msg += ` عمل رائع! تم احتساب ${formatDurationDetailed(overtime)} وقت إضافي.`;
      } else if (delay > 0) {
        const penalty = getDelayPenalty(delay, true);
        msg += ` انتهت الوردية بتأخير ${formatDurationDetailed(delay)} — [${penalty.penaltyLabel}].`;
      }

      setFeedback({ type: 'SUCCESS', message: msg });
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err.response?.data?.message || 'فشل تسجيل الانصراف. الرجاء المحاولة مرة أخرى.',
      });
    }
  };

  const handleApproveLeave = async (leave: LeaveRequest) => {
    try {
      setFeedback(null);
      await approveLeaveMutation.mutateAsync(leave.id);
      setFeedback({
        type: 'SUCCESS',
        message: `Approved leave for ${leave.employee?.fullName || 'employee'}. Balances safely updated.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err.response?.data?.message || 'Failed to approve leave.',
      });
    }
  };

  const handleApprovePermission = async (perm: PermissionRequest) => {
    try {
      setFeedback(null);
      await approvePermissionMutation.mutateAsync(perm.id);
      setFeedback({
        type: 'SUCCESS',
        message: `Approved ${perm.hoursRequested}h permission for ${perm.employee?.fullName || 'employee'}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err.response?.data?.message || 'Failed to approve permission request.',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* --------------------------------------------------------------------- */}
      {/* HEADER SECTION */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <span>Workforce Operations</span>
            <span>/</span>
            <span className="text-white font-medium">Time Tracking & Entitlements</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Attendance, Leaves & Permissions</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-mono">
              PHASE 05
            </span>
          </h1>
        </div>

        {!isSuperAdmin && (
          <div className="flex items-center space-x-3 self-start sm:self-auto">
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all shadow-sm"
            >
              <CalendarDays className="h-4 w-4 text-indigo-400" />
              <span>Request Leave</span>
            </button>

            <button
              onClick={() => setIsPermissionModalOpen(true)}
              className="inline-flex items-center space-x-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:text-white transition-all shadow-sm"
            >
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Request Permission</span>
            </button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* FEEDBACK BANNER */}
      {/* --------------------------------------------------------------------- */}
      {feedback && (
        <div
          className={`rounded-xl p-4 text-xs flex items-center justify-between border ${
            feedback.type === 'SUCCESS'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'SUCCESS' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TOP SECTION: EXECUTIVE METRICS (FOR SUPER ADMIN) VS SELF-SERVICE PUNCH (EMPLOYEES) */}
      {/* --------------------------------------------------------------------- */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Today's Active Attendance */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Users className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Live Today
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white">
                {attendanceLogs.filter((l) => l.status === 'PRESENT').length}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Employees On Duty / Present</p>
            </div>
          </div>

          {/* Card 2: Pending Leaves */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Pending
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white">{pendingLeaves.length}</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Pending Leave Requests</p>
            </div>
          </div>

          {/* Card 3: Pending Permissions */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Pending
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white">{pendingPermissions.length}</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Pending Permission Requests</p>
            </div>
          </div>

          {/* Card 4: Total Departments */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Organization
              </span>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-white">{departments.length}</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">Active Departments</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Check In / Out Live Timer Card */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-28 w-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Today&apos;s Live Shift</span>
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    todayStatus?.hasCheckedOut
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : todayStatus?.hasCheckedIn
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {todayStatus?.hasCheckedOut
                    ? 'Shift Completed'
                    : todayStatus?.hasCheckedIn
                    ? 'On Duty'
                    : 'Not Checked In'}
                </span>
              </div>

              {/* Digital Timer Display */}
              <div className="my-3 text-center py-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-widest">
                  {todayStatus?.hasCheckedOut
                    ? 'COMPLETED'
                    : todayStatus?.hasCheckedIn
                    ? formatTimer(elapsedSeconds)
                    : '00:00:00'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {todayStatus?.approvedPermissionHours ? (
                    <span className="text-cyan-300 font-semibold">
                      الهدف اليومي: {(todayStatus?.employee?.shiftType === 'LS' ? 9 : 8) - todayStatus.approvedPermissionHours} ساعات (مخصوم منها {todayStatus.approvedPermissionHours}h إذن معتمد)
                    </span>
                  ) : todayStatus?.employee?.shiftType === 'LS' ? (
                    'Long Shift (LS): 9 Hours Target'
                  ) : (
                    'Regular Shift (RS): 8 Hours Target'
                  )}
                </p>
              </div>

              {/* Approved Permission Notice Banner */}
              {!!todayStatus?.approvedPermissionHours && (
                <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2.5 flex items-center justify-between text-xs text-cyan-300 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span className="font-medium">لديك إذن رسمي معتمد اليوم</span>
                  </div>
                  <span className="font-bold font-mono text-white bg-cyan-500/20 px-2 py-0.5 rounded">
                    {todayStatus.approvedPermissionHours} ساعة
                  </span>
                </div>
              )}
            </div>

            {/* Action Punch Buttons */}
            <div className="mt-4 pt-4 border-t border-slate-800/80">
              {!todayStatus?.hasCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <PlayCircle className="h-5 w-5" />
                  <span>Check In Now</span>
                </button>
              ) : !todayStatus?.hasCheckedOut ? (
                <button
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending}
                  className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/30 hover:from-amber-500 hover:to-rose-500 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <StopCircle className="h-5 w-5" />
                  <span>Check Out & End Shift</span>
                </button>
              ) : (
                <div className="flex items-center justify-center space-x-2 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Punches Recorded for Today</span>
                </div>
              )}
            </div>
          </div>

          {/* Remaining Annual Leave Entitlement Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Annual Balance
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold text-white">
                  {todayStatus?.employee?.annualLeaveDays ?? 21}
                </span>
                <span className="text-sm font-semibold text-slate-400">Days Remaining</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Standard annual paid time off. Approving leaves automatically deducts from this safe atomic balance.
              </p>
            </div>

            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Submit Leave Request</span>
            </button>
          </div>

          {/* Remaining Monthly Permission Hours Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Monthly Balance
              </span>
            </div>

            <div className="my-4">
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold text-white">
                  {todayStatus?.employee?.monthlyPermissionHours ?? 4}
                </span>
                <span className="text-sm font-semibold text-slate-400">Hours Remaining</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Short-term monthly exit permissions. Fully calculated and deducted upon approval.
              </p>
            </div>

            <button
              onClick={() => setIsPermissionModalOpen(true)}
              className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <Plus className="h-3.5 w-3.5 text-cyan-400" />
              <span>Submit Permission Request</span>
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MAIN DATA TABLES & TABS (APPROVALS, LEAVES, PERMISSIONS, LOGS) */}
      {/* --------------------------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-xl overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {isHR && (
              <button
                onClick={() => setActiveTab('APPROVALS')}
                className={`inline-flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                  activeTab === 'APPROVALS'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Pending Approvals</span>
                {totalPendingCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-extrabold text-black">
                    {totalPendingCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('LEAVES')}
              className={`inline-flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'LEAVES'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Leaves Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('PERMISSIONS')}
              className={`inline-flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'PERMISSIONS'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Permissions Hub</span>
            </button>

            <button
              onClick={() => setActiveTab('LOGS')}
              className={`inline-flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                activeTab === 'LOGS'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Attendance History</span>
            </button>
          </div>

          {/* Department Filter (HR / Admin Only) */}
          {isHR && (
            <div className="flex items-center space-x-2 shrink-0">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: PENDING APPROVALS (MANAGER / HR VIEW) */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'APPROVALS' && (
          <div className="divide-y divide-slate-800">
            {totalPendingCount === 0 ? (
              <div className="py-20 text-center text-xs text-slate-500 italic space-y-2">
                <Sparkles className="h-8 w-8 text-indigo-400/50 mx-auto" />
                <p className="font-semibold text-slate-400">All caught up!</p>
                <p className="text-[11px] text-slate-600">No pending leave or permission requests in your queue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Requested Range / Hours</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4 text-right">Decision Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {/* Pending Leaves */}
                    {pendingLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                            <CalendarDays className="h-3 w-3" />
                            <span>{leave.type} LEAVE</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{leave.employee?.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {leave.employee?.employeeCode} • {leave.employee?.department?.code}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">
                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-indigo-400 font-mono">
                            {leave.totalDaysRequested} Day(s) requested (Bal: {leave.employee?.annualLeaveDays}d)
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-slate-300 italic truncate">
                          {leave.reason || 'No description provided.'}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleApproveLeave(leave)}
                            disabled={approveLeaveMutation.isPending}
                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() =>
                              setRejectingItem({
                                id: leave.id,
                                kind: 'LEAVE',
                                title: `${leave.type} Leave for ${leave.employee?.fullName}`,
                              })
                            }
                            className="inline-flex items-center space-x-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Pending Permissions */}
                    {pendingPermissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20">
                            <Clock className="h-3 w-3" />
                            <span>PERMISSION</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{perm.employee?.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {perm.employee?.employeeCode} • {perm.employee?.department?.code}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">
                            {new Date(perm.date).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-cyan-400 font-mono">
                            {perm.startTime && perm.endTime ? `من ${perm.startTime} إلى ${perm.endTime} • ` : ''}
                            {perm.hoursRequested} Hour(s) requested (Bal: {perm.employee?.monthlyPermissionHours}h)
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs text-slate-300 italic truncate">
                          {perm.reason}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleApprovePermission(perm)}
                            disabled={approvePermissionMutation.isPending}
                            className="inline-flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() =>
                              setRejectingItem({
                                id: perm.id,
                                kind: 'PERMISSION',
                                title: `Permission for ${perm.employee?.fullName}`,
                              })
                            }
                            className="inline-flex items-center space-x-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: LEAVES LIST */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'LEAVES' && (
          <div>
            {leaves.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500 italic">
                No leave requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Total Days</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{leave.employee?.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{leave.employee?.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-indigo-400">{leave.type}</td>
                        <td className="py-3 px-4">
                          {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{leave.totalDaysRequested} d</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              leave.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : leave.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {leave.status === 'APPROVED' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : leave.status === 'REJECTED' ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            <span>{leave.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">
                          {leave.status === 'REJECTED' && leave.rejectionReason
                            ? `Rejected: ${leave.rejectionReason}`
                            : leave.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: PERMISSIONS LIST */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'PERMISSIONS' && (
          <div>
            {permissions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500 italic">
                No permission requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {permissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{perm.employee?.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{perm.employee?.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-cyan-400">{perm.hoursRequested} Hour(s)</div>
                          {perm.startTime && perm.endTime && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              من {perm.startTime} إلى {perm.endTime}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                              perm.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : perm.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {perm.status === 'APPROVED' ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : perm.status === 'REJECTED' ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            <span>{perm.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">
                          {perm.status === 'REJECTED' && perm.rejectionReason
                            ? `Rejected: ${perm.rejectionReason}`
                            : perm.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 4: ATTENDANCE HISTORY LOGS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'LOGS' && (
          <div>
            {attendanceLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500 italic">
                No attendance logs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 bg-slate-900/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Shift Type</th>
                      <th className="py-3 px-4">Check In</th>
                      <th className="py-3 px-4">Check Out</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Metrics (Overtime / Delay)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {attendanceLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {new Date(log.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{log.employee?.fullName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{log.employee?.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[10px] text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                            {log.employee?.shiftType === 'LS' ? 'LS (9h)' : 'RS (8h)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400">
                          {new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {log.checkOutTime
                            ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'In Progress'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {log.overtimeMinutes > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="text-emerald-400 font-bold font-mono text-[11px]">
                                +{formatDurationDetailed(log.overtimeMinutes)} إضافي
                              </span>
                              <span className="text-[9px] text-emerald-500/80">وقت عمل إضافي</span>
                            </div>
                          ) : log.delayMinutes > 0 ? (
                            (() => {
                              const penalty = getDelayPenalty(log.delayMinutes, !!log.checkOutTime);
                              return (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-rose-400 font-semibold font-mono text-[11px]">
                                    {formatDurationDetailed(log.delayMinutes)} تأخير
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${penalty.badgeColor}`}>
                                    {penalty.penaltyLabel}
                                  </span>
                                </div>
                              );
                            })()
                          ) : !log.checkOutTime ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              الوردية قيد العمل
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              منضبط (فترة سماح)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: CREATE LEAVE REQUEST */}
      {/* --------------------------------------------------------------------- */}
      {isLeaveModalOpen && (
        <CreateLeaveModal
          annualBalance={todayStatus?.employee?.annualLeaveDays ?? 21}
          onClose={() => setIsLeaveModalOpen(false)}
          onSuccess={() => {
            setIsLeaveModalOpen(false);
            setActiveTab('LEAVES');
            setFeedback({ type: 'SUCCESS', message: 'Leave request submitted successfully!' });
          }}
        />
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: CREATE PERMISSION REQUEST */}
      {/* --------------------------------------------------------------------- */}
      {isPermissionModalOpen && (
        <CreatePermissionModal
          monthlyPermissionHours={todayStatus?.employee?.monthlyPermissionHours ?? 4}
          onClose={() => setIsPermissionModalOpen(false)}
          onSuccess={() => {
            setIsPermissionModalOpen(false);
            setActiveTab('PERMISSIONS');
            setFeedback({ type: 'SUCCESS', message: 'Permission request submitted successfully!' });
          }}
        />
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: REJECT REASON EXPLANATION */}
      {/* --------------------------------------------------------------------- */}
      {rejectingItem && (
        <RejectReasonModal
          item={rejectingItem}
          onClose={() => setRejectingItem(null)}
          onConfirm={async (reason) => {
            try {
              if (rejectingItem.kind === 'LEAVE') {
                await rejectLeaveMutation.mutateAsync({ id: rejectingItem.id, rejectionReason: reason });
              } else {
                await rejectPermissionMutation.mutateAsync({ id: rejectingItem.id, rejectionReason: reason });
              }
              setRejectingItem(null);
              setFeedback({ type: 'SUCCESS', message: 'Request rejected with feedback.' });
            } catch (err: any) {
              setFeedback({ type: 'ERROR', message: err.response?.data?.message || 'Failed to reject request.' });
            }
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL: CREATE LEAVE REQUEST FORM
// -----------------------------------------------------------------------------

function CreateLeaveModal({
  annualBalance,
  onClose,
  onSuccess,
}: {
  annualBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createLeaveMutation = useCreateLeave();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateLeaveFormData>({
    resolver: zodResolver(createLeaveSchema),
    defaultValues: {
      type: 'ANNUAL',
      totalDaysRequested: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedType = watch('type');
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Auto compute days difference when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e >= s) {
        const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setValue('totalDaysRequested', diff);
      }
    }
  }, [startDate, endDate, setValue]);

  const totalDays = watch('totalDaysRequested') || 1;

  const onSubmit = async (data: CreateLeaveFormData) => {
    try {
      setErrorMsg(null);
      await createLeaveMutation.mutateAsync(data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit leave request');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-400" />
            <span>Submit Leave Request</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Leave Type</label>
            <select
              {...register('type')}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="ANNUAL">Annual Leave (Paid PtO)</option>
              <option value="SICK">Sick Leave</option>
              <option value="UNPAID">Unpaid Leave</option>
              <option value="MATERNITY">Maternity / Paternity Leave</option>
            </select>
          </div>

          {/* Balance Preview Badge */}
          {selectedType === 'ANNUAL' && (
            <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-300">
              <span>Annual Balance Remaining:</span>
              <span className="font-bold text-white">{annualBalance} Days</span>
            </div>
          )}

          {/* Start and End Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                {...register('startDate')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              {errors.startDate && <p className="text-[10px] text-rose-400 mt-1">{errors.startDate.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              {errors.endDate && <p className="text-[10px] text-rose-400 mt-1">{errors.endDate.message}</p>}
            </div>
          </div>

          {/* Total Days Requested */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Total Days</label>
            <input
              type="number"
              min={1}
              {...register('totalDaysRequested', { valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reason / Details</label>
            <textarea
              rows={2}
              {...register('reason')}
              placeholder="e.g. Family vacation, personal business..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 p-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLeaveMutation.isPending}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {createLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL: CREATE PERMISSION REQUEST FORM
// -----------------------------------------------------------------------------

function CreatePermissionModal({
  monthlyPermissionHours,
  onClose,
  onSuccess,
}: {
  monthlyPermissionHours: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createPermissionMutation = useCreateWorkPermission();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePermissionFormData>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      hoursRequested: 2,
    },
  });

  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const hoursRequested = watch('hoursRequested');

  // Auto-calculate requested hours whenever start time or end time changes
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes > startMinutes) {
        const durationHours = Math.max(1, Math.ceil((endMinutes - startMinutes) / 60));
        setValue('hoursRequested', durationHours);
      }
    }
  }, [startTime, endTime, setValue]);

  const onSubmit = async (data: CreatePermissionFormData) => {
    try {
      setErrorMsg(null);
      await createPermissionMutation.mutateAsync(data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit permission request');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <span>تقديم طلب إذن عمل (Permission Request)</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Monthly Balance Hint */}
          <div className="flex items-center justify-between rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-300">
            <span>الرصيد الشهري المتبقي للأذونات:</span>
            <span className="font-bold font-mono text-white">{monthlyPermissionHours} ساعة</span>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">تاريخ الإذن (Date)</label>
            <input
              type="date"
              {...register('date')}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
            {errors.date && <p className="text-[10px] text-rose-400 mt-1">{errors.date.message}</p>}
          </div>

          {/* Time Interval: From Time - To Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">من الساعة (Start Time)</label>
              <input
                type="time"
                {...register('startTime')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
              {errors.startTime && <p className="text-[10px] text-rose-400 mt-1">{errors.startTime.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">إلى الساعة (End Time)</label>
              <input
                type="time"
                {...register('endTime')}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
              {errors.endTime && <p className="text-[10px] text-rose-400 mt-1">{errors.endTime.message}</p>}
            </div>
          </div>

          {/* Computed Duration Indicator Badge */}
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">إجمالي مدة الإذن المحسوبة:</span>
            <span className="font-bold font-mono text-cyan-300">
              {hoursRequested} ساعة {startTime && endTime ? `(من ${startTime} إلى ${endTime})` : ''}
            </span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reason</label>
            <textarea
              rows={2}
              {...register('reason')}
              placeholder="e.g. Medical appointment, university exam..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 p-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {errors.reason && <p className="text-[10px] text-rose-400 mt-1">{errors.reason.message}</p>}
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPermissionMutation.isPending}
              className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {createPermissionMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MODAL: REJECT REASON PROMPT FORM
// -----------------------------------------------------------------------------

function RejectReasonModal({
  item,
  onClose,
  onConfirm,
}: {
  item: { id: string; kind: 'LEAVE' | 'PERMISSION'; title: string };
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
  });

  const onSubmit = async (data: RejectFormData) => {
    await onConfirm(data.rejectionReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400" />
            <span>Reject Request</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Please state why you are rejecting <span className="font-bold text-white">{item.title}</span>.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <textarea
              rows={3}
              {...register('rejectionReason')}
              placeholder="e.g. Insufficient coverage for this shift, please reschedule..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800/90 p-3 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
            {errors.rejectionReason && (
              <p className="text-[10px] text-rose-400 mt-1">{errors.rejectionReason.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
