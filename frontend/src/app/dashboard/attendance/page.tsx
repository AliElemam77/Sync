'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FiClock,
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiPlay,
  FiSquare,
  FiAlertCircle,
  FiSend,
  FiPlus,
  FiFilter,
  FiUser,
  FiUsers,
  FiCheck,
  FiX,
  FiFileText,
  FiShield,
  FiLayers,
  FiBell,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
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
import { PublicHolidaysPanel } from '../../../components/attendance/public-holidays-panel';
import { ManualAttendanceModal } from '../../../components/attendance/manual-attendance-modal';
import { Card } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/empty-state';
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
    // No unpaid leave in the company (the backend rejects it too)
    type: z.enum(['ANNUAL', 'SICK', 'MATERNITY']),
    startDate: z.string().min(1, 'تاريخ البداية مطلوب'),
    endDate: z.string().min(1, 'تاريخ النهاية مطلوب'),
    reason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    {
      message: 'تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية',
      path: ['endDate'],
    },
  );

type CreateLeaveFormData = z.infer<typeof createLeaveSchema>;

const createPermissionSchema = z
  .object({
    date: z.string().min(1, 'تاريخ الإذن مطلوب'),
    startTime: z.string().min(1, 'وقت البداية مطلوب (من الساعة)'),
    endTime: z.string().min(1, 'وقت النهاية مطلوب (إلى الساعة)'),
    hoursRequested: z
      .number()
      .int('الإذن بالساعات الكاملة فقط (مثال: من 10:00 إلى 12:00)')
      .min(1, 'ساعة واحدة على الأقل')
      .max(4, 'الحد الأقصى 4 ساعات (الأربع ساعات تُحسب نصف يوم)'),
    reason: z.string().min(3, 'يرجى كتابة سبب واضح لطلب الإذن'),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return data.startTime < data.endTime;
    },
    {
      message: 'وقت البداية يجب أن يسبق وقت النهاية',
      path: ['endTime'],
    },
  );

type CreatePermissionFormData = z.infer<typeof createPermissionSchema>;

const rejectSchema = z.object({
  rejectionReason: z.string().min(3, 'سبب الرفض يجب أن يكون 3 أحرف على الأقل'),
});

type RejectFormData = z.infer<typeof rejectSchema>;

// Today's date (YYYY-MM-DD) in the user's local time; toISOString() would give the UTC date
function localDateInputValue(): string {
  return new Date().toLocaleDateString('en-CA');
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-bold text-rose-500 dark:text-rose-400">{message}</p>;
}

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

/** Missing minutes a day that are not deducted (same as the backend payroll rule) */
const LATE_GRACE_MINUTES = 15;

function calculateMorningDelay(checkInTimeStr: string | null | undefined): { delayMinutes: number; isLate: boolean; label: string } {
  if (!checkInTimeStr) return { delayMinutes: 0, isLate: false, label: '—' };
  const d = new Date(checkInTimeStr);
  const checkInMinutes = d.getHours() * 60 + d.getMinutes();
  const shiftStartMinutes = 9 * 60; // 09:00 AM
  const graceEndMinutes = shiftStartMinutes + LATE_GRACE_MINUTES; // 09:15 AM

  if (checkInMinutes > graceEndMinutes) {
    const delayMins = checkInMinutes - shiftStartMinutes;
    return {
      delayMinutes: delayMins,
      isLate: true,
      label: `تأخير صباحي: ${formatDurationDetailed(delayMins)}`,
    };
  }

  return {
    delayMinutes: 0,
    isLate: false,
    label: 'في الموعد (ضمن فترة السماح)',
  };
}

function getDelayPenalty(
  delayMinutes: number,
  hasCheckOut: boolean = true,
  recordDateStr?: string,
  shiftType: string = 'RS',
) {
  if (!hasCheckOut) {
    const isToday = recordDateStr
      ? new Date(recordDateStr).toDateString() === new Date().toDateString()
      : true;

    if (isToday) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      // Shift end is 17:00 (5:00 PM for RS) or 18:00 (6:00 PM for LS)
      // Grace period after shift ends before applying missing checkout penalty is 1 HOUR (18:00 for RS, 19:00 for LS)
      const shiftEndMinutes = shiftType === 'LS' ? 18 * 60 : 17 * 60;
      const cutoffMinutes = shiftEndMinutes + 60; // +1 hour grace

      if (currentMinutes < cutoffMinutes) {
        return {
          penaltyLabel: 'الوردية جارية (بانتظار الانصراف)',
          badgeColor: 'bg-primary/10 text-primary border-primary/20 font-bold',
        };
      }

      return {
        penaltyLabel: 'لم يُسجَّل الانصراف: يُخصم اليوم كاملًا إن لم يُسجَّل اليوم',
        badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
      };
    }

    return {
      penaltyLabel: 'خصم يوم كامل (نسيان بصمة الانصراف)',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
    };
  }

  // Same tiers as payroll: up to 15 minutes forgiven, over 15 a quarter day, over 30 half, over 60 a full day
  if (delayMinutes <= LATE_GRACE_MINUTES) {
    return {
      penaltyLabel: delayMinutes > 0 ? 'فترة سماح (بدون خصم)' : 'بدون خصم',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold',
    };
  } else if (delayMinutes <= 30) {
    return {
      penaltyLabel: 'خصم ربع يوم',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold',
    };
  } else if (delayMinutes <= 60) {
    return {
      penaltyLabel: 'خصم نصف يوم',
      badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 font-bold',
    };
  }

  return {
    penaltyLabel: 'خصم يوم كامل',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold',
  };
}

// -----------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -----------------------------------------------------------------------------

export default function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const roleName = typeof (user?.role as any) === 'string' ? (user?.role as any) : user?.role?.name || '';
  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  // HR approves anyone; Team Leaders and heads approve their departments (computed by the backend)
  const canApprove = !!user?.canApproveRequests;
  // HR corrects attendance and maintains public holidays (enforced by the backend)
  const canManageAttendance = hasPermission('attendance.manage');

  // Active Tab View: 'APPROVALS' | 'LEAVES' | 'PERMISSIONS' | 'LOGS' | 'HOLIDAYS'
  const [activeTab, setActiveTab] = useState<'APPROVALS' | 'LEAVES' | 'PERMISSIONS' | 'LOGS' | 'HOLIDAYS'>(
    canApprove ? 'APPROVALS' : 'LEAVES',
  );

  // Modals state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isManualAttendanceOpen, setIsManualAttendanceOpen] = useState(false);
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

  const { data: employeesResponse } = useEmployees({ limit: 100 });
  const employees = employeesResponse?.data || [];
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
  // Requests awaiting this user's decision (never their own)
  const ownEmployeeId = user?.employee?.id;
  const pendingLeaves = useMemo(
    () => leaves.filter((l) => l.status === 'PENDING' && l.employeeId !== ownEmployeeId),
    [leaves, ownEmployeeId],
  );
  const pendingPermissions = useMemo(
    () => permissions.filter((p) => p.status === 'PENDING' && p.employeeId !== ownEmployeeId),
    [permissions, ownEmployeeId],
  );
  const totalPendingCount = pendingLeaves.length + pendingPermissions.length;

  // Handlers
  const handleCheckIn = async () => {
    try {
      setFeedback(null);
      await checkInMutation.mutateAsync();
      setFeedback({ type: 'SUCCESS', message: 'تم إثبات حضورك بنجاح! نتمنى لك يوماً موفقاً ومثمراً.' });
    } catch (err: any) {
      setFeedback({
        type: 'ERROR',
        message: err.response?.data?.message || 'فشل تسجيل الحضور. يرجى المحاولة مرة أخرى.',
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
        message: err.response?.data?.message || 'فشل تسجيل الانصراف.',
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>إدارة شؤون العاملين</span>
            <span>/</span>
            <span className="text-foreground font-medium">سجل الحضور والإجازات والأذونات</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>سجل الحضور الذكي والورديات</span>
            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              {todayStatus?.employee?.shiftType === 'LS' ? 'الوردية المسائية (LS)' : 'الوردية الصباحية (RS)'}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPermissionModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-surface border border-border hover:bg-surface-hover px-4 py-2.5 text-xs font-bold text-foreground active:scale-95 transition-all"
          >
            <FiClock className="h-4 w-4 text-primary" />
            <span>طلب إذن ساعي</span>
          </button>

          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-all"
          >
            <FiPlus className="h-4 w-4" />
            <span>طلب إجازة جديدة</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 text-xs flex items-center justify-between border ${
            feedback.type === 'SUCCESS'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'SUCCESS' ? (
              <FiCheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <FiAlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-bold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TODAY'S ATTENDANCE & PUNCH HERO CARD                                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Punch Timer & Interactive Card (2 Cols) */}
        <div className="lg:col-span-2 rounded-3xl border border-card-border bg-gradient-to-r from-card/90 via-card/70 to-surface-raised p-6 backdrop-blur-xl shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/20 pb-4">
            <div>
              <span className="text-xs font-bold text-foreground-muted">حالة حضورك اليوم</span>
              <h2 className="text-lg font-black text-foreground">
                {todayStatus?.record?.checkInTime && !todayStatus?.record?.checkOutTime ? (
                  <span className="text-emerald-500 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span>الوردية نشطة وقيد الاحتساب</span>
                  </span>
                ) : todayStatus?.record?.checkOutTime ? (
                  <span className="text-foreground-muted flex items-center gap-2">
                    <FiCheckCircle className="h-4 w-4 text-primary" />
                    <span>تم إنهاء وردية اليوم بنجاح</span>
                  </span>
                ) : todayStatus?.isWeeklyDayOff ? (
                  <span className="text-foreground-muted flex items-center gap-2">
                    <FiCalendar className="h-4 w-4 text-primary" />
                    <span>اليوم إجازتك الأسبوعية</span>
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-2">
                    <FiClock className="h-4 w-4" />
                    <span>لم يتم تسجيل الحضور بعد</span>
                  </span>
                )}
              </h2>
            </div>

            {/* Live Timer Clock */}
            {todayStatus?.record?.checkInTime && !todayStatus?.record?.checkOutTime && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface border border-border shadow-inner">
                <FiClock className="h-4 w-4 text-primary animate-spin [animation-duration:12s]" />
                <span className="font-mono text-base font-black text-foreground tracking-wider">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
            )}
          </div>

          {/* Shift End Alarm Banner */}
          {todayStatus?.record?.checkInTime && !todayStatus?.record?.checkOutTime && (() => {
            const shiftType = todayStatus?.employee?.shiftType || 'RS';
            const shiftEndHour = shiftType === 'LS' ? 18 : 17; // 18:00 (6 PM) or 17:00 (5 PM)
            const now = new Date();
            const currentHour = now.getHours();
            const isShiftEnded = currentHour >= shiftEndHour;

            if (isShiftEnded) {
              const shiftEndLabel = shiftType === 'LS' ? '06:00 م' : '05:00 م';
              const graceEndLabel = shiftType === 'LS' ? '07:00 م' : '06:00 م';

              return (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse shadow-md">
                  <div className="flex items-center gap-2.5">
                    <FiBell className="h-5 w-5 shrink-0 text-amber-500 animate-bounce" />
                    <div>
                      <span className="font-black text-sm block">⏰ حان الآن موعد انتهاء ورديتك الرسمية ({shiftEndLabel})!</span>
                      <span className="text-[11px] opacity-90 block pt-0.5">
                        يرجى تسجيل بصمة الانصراف قبل {graceEndLabel}. إذا لم تُسجَّل بصمة الانصراف اليوم يُخصم اليوم كاملًا.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md active:scale-95 transition-all shrink-0"
                  >
                    تسجيل الانصراف الآن
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Action Buttons: Check In / Check Out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleCheckIn}
              disabled={
                !!todayStatus?.record?.checkInTime ||
                !!todayStatus?.isWeeklyDayOff ||
                checkInMutation.isPending
              }
              className={`flex items-center justify-center gap-3 p-4 rounded-2xl text-xs font-black transition-all shadow-xs ${
                todayStatus?.record?.checkInTime || todayStatus?.isWeeklyDayOff
                  ? 'bg-surface-raised/40 text-foreground-muted cursor-not-allowed opacity-60'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md active:scale-95'
              }`}
            >
              <FiPlay className="h-5 w-5" />
              <div>
                <div className="text-sm">إثبات الحضور (Check In)</div>
                {todayStatus?.record?.checkInTime && (
                  <div className="text-[10px] font-mono font-normal">
                    تم التسجيل: {new Date(todayStatus.record.checkInTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </button>

            <button
              onClick={handleCheckOut}
              disabled={
                !todayStatus?.record?.checkInTime ||
                !!todayStatus?.record?.checkOutTime ||
                checkOutMutation.isPending
              }
              className={`flex items-center justify-center gap-3 p-4 rounded-2xl text-xs font-black transition-all shadow-xs ${
                !todayStatus?.record?.checkInTime || !!todayStatus?.record?.checkOutTime
                  ? 'bg-surface-raised/40 text-foreground-muted cursor-not-allowed opacity-60'
                  : 'bg-rose-500 hover:bg-rose-600 text-white shadow-md active:scale-95'
              }`}
            >
              <FiSquare className="h-5 w-5" />
              <div>
                <div className="text-sm">إثبات الانصراف (Check Out)</div>
                {todayStatus?.record?.checkOutTime && (
                  <div className="text-[10px] font-mono font-normal">
                    تم الخروج: {new Date(todayStatus.record.checkOutTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </button>
          </div>

          {/* Shift Details and Tolerance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px] text-foreground-muted border-t border-border/30">
            <div>
              <span className="block text-[10px] text-foreground-subtle font-bold">بداية الوردية</span>
              <span className="text-foreground font-mono font-bold">09:00 ص</span>
            </div>
            <div>
              <span className="block text-[10px] text-foreground-subtle font-bold">فترة السماح</span>
              <span className="text-emerald-500 font-bold">15 دقيقة (حتى 09:15)</span>
            </div>
            <div>
              <span className="block text-[10px] text-foreground-subtle font-bold">نهاية الوردية</span>
              <span className="text-foreground font-mono font-bold">
                {todayStatus?.employee?.shiftType === 'LS' ? '06:00 م' : '05:00 م'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-foreground-subtle font-bold">إجمالي الساعات</span>
              <span className="text-foreground font-mono font-bold">
                {todayStatus?.employee?.shiftType === 'LS' ? '9 ساعات (LS)' : '8 ساعات (RS)'}
              </span>
            </div>
          </div>
        </div>

        {/* Leave and Permission Balances (1 Col) */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2 border-b border-border/20 pb-3">
              <FiShield className="h-4 w-4 text-primary" />
              <span>الأرصدة المعتمدة للموظف</span>
            </h3>

            <div className="space-y-3 mt-4">
              <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground">رصيد الإجازات السنوية</span>
                  <p className="text-[10px] text-foreground-muted">المتبقي من رصيد الإجازات الاعتيادية</p>
                </div>
                <div className="text-xl font-black font-mono text-primary">
                  {todayStatus?.employee?.annualLeaveDays ?? 21} <span className="text-xs">يوم</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground">الأذونات الشهرية</span>
                  <p className="text-[10px] text-foreground-muted">
                    المتبقي هذا الشهر من {todayStatus?.employee?.monthlyPermissionHours ?? 4} ساعات (يتجدد أول كل شهر)
                  </p>
                </div>
                <div className="text-xl font-black font-mono text-amber-500">
                  {todayStatus?.employee?.remainingPermissionHours ??
                    todayStatus?.employee?.monthlyPermissionHours ??
                    4}{' '}
                  <span className="text-xs">ساعات</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-foreground-subtle text-center">
            تجدد الأرصدة تلقائياً وفقاً للائحة الموارد البشرية والسياسة المؤسسية.
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4 TABS NAVIGATION STRIP                                                */}
      {/* ===================================================================== */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
        {canApprove && (
          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all relative ${
              activeTab === 'APPROVALS'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <FiCheckCircle className="h-4 w-4" />
            <span>طلبات الاعتماد والموافقة</span>
            {totalPendingCount > 0 && (
              <span className="rounded-full bg-rose-500 text-white px-2 py-0.2 text-[10px] font-mono">
                {totalPendingCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('LEAVES')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'LEAVES'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          <FiCalendar className="h-4 w-4" />
          <span>سجل الإجازات</span>
        </button>

        <button
          onClick={() => setActiveTab('PERMISSIONS')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'PERMISSIONS'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          <FiClock className="h-4 w-4" />
          <span>سجل الأذونات</span>
        </button>

        <button
          onClick={() => setActiveTab('LOGS')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'LOGS'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          <FiFileText className="h-4 w-4" />
          <span>سجل البصمات اليومي</span>
        </button>

        <button
          onClick={() => setActiveTab('HOLIDAYS')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'HOLIDAYS'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
          }`}
        >
          <FiLayers className="h-4 w-4" />
          <span>الإجازات الرسمية</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: APPROVALS (FOR MANAGERS / HR)                                  */}
      {/* ===================================================================== */}
      {activeTab === 'APPROVALS' && canApprove && (
        <div className="space-y-6 animate-in fade-in">
          {/* Pending Leaves Table */}
          <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 backdrop-blur-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border bg-surface-raised/40 flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <FiCalendar className="h-4 w-4 text-primary" />
                <span>طلبات الإجازات المعلقة بانتظار الموافقة ({pendingLeaves.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs text-foreground-muted">
                <thead className="border-b border-border bg-surface text-[11px] font-bold text-foreground">
                  <tr>
                    <th className="px-5 py-3 text-start">الموظف</th>
                    <th className="px-5 py-3 text-start">النوع</th>
                    <th className="px-5 py-3 text-start">الفترة</th>
                    <th className="px-5 py-3 text-start">المدة</th>
                    <th className="px-5 py-3 text-start">السبب</th>
                    <th className="px-5 py-3 text-end">القرار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {pendingLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-foreground-subtle italic">
                        لا توجد طلبات إجازة معلقة حالياً.
                      </td>
                    </tr>
                  ) : (
                    pendingLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {leave.employee?.fullName}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {leave.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-foreground-muted">
                          {new Date(leave.startDate).toLocaleDateString('ar-EG')} → {new Date(leave.endDate).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {leave.totalDaysRequested} يوم
                        </td>
                        <td className="px-5 py-3.5 text-foreground-subtle max-w-xs truncate">
                          {leave.reason || 'بدون سبب مدون'}
                        </td>
                        <td className="px-5 py-3.5 text-end space-x-2">
                          <button
                            onClick={() => approveLeaveMutation.mutateAsync(leave.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 ml-2"
                          >
                            <FiCheck className="h-3.5 w-3.5" />
                            <span>موافقة</span>
                          </button>
                          <button
                            onClick={() =>
                              setRejectingItem({
                                id: leave.id,
                                kind: 'LEAVE',
                                title: `إجازة ${leave.employee?.fullName}`,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-[11px] font-black text-rose-500 hover:bg-rose-500/20"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            <span>رفض</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Permissions Table */}
          <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 backdrop-blur-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border bg-surface-raised/40 flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <FiClock className="h-4 w-4 text-primary" />
                <span>طلبات الأذونات المعلقة بانتظار الموافقة ({pendingPermissions.length})</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs text-foreground-muted">
                <thead className="border-b border-border bg-surface text-[11px] font-bold text-foreground">
                  <tr>
                    <th className="px-5 py-3 text-start">الموظف</th>
                    <th className="px-5 py-3 text-start">التاريخ</th>
                    <th className="px-5 py-3 text-start">الوقت</th>
                    <th className="px-5 py-3 text-start">الساعات</th>
                    <th className="px-5 py-3 text-start">السبب</th>
                    <th className="px-5 py-3 text-end">القرار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {pendingPermissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-foreground-subtle italic">
                        لا توجد طلبات أذونات معلقة حالياً.
                      </td>
                    </tr>
                  ) : (
                    pendingPermissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {perm.employee?.fullName}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-foreground-muted">
                          {new Date(perm.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-foreground-muted">
                          {perm.startTime} → {perm.endTime}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-foreground">
                          {perm.hoursRequested} ساعات
                        </td>
                        <td className="px-5 py-3.5 text-foreground-subtle max-w-xs truncate">
                          {perm.reason}
                        </td>
                        <td className="px-5 py-3.5 text-end space-x-2">
                          <button
                            onClick={() => approvePermissionMutation.mutateAsync(perm.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 ml-2"
                          >
                            <FiCheck className="h-3.5 w-3.5" />
                            <span>موافقة</span>
                          </button>
                          <button
                            onClick={() =>
                              setRejectingItem({
                                id: perm.id,
                                kind: 'PERMISSION',
                                title: `إذن ${perm.employee?.fullName}`,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-[11px] font-black text-rose-500 hover:bg-rose-500/20"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            <span>رفض</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LEAVES DIRECTORY                                               */}
      {/* ===================================================================== */}
      {activeTab === 'LEAVES' && (
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 backdrop-blur-xl overflow-hidden shadow-xs animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-foreground-muted">
              <thead className="border-b border-border bg-surface-raised/70 text-[11px] font-bold text-foreground">
                <tr>
                  <th className="px-5 py-3.5 text-start">الموظف</th>
                  <th className="px-5 py-3.5 text-start">النوع</th>
                  <th className="px-5 py-3.5 text-start">الفترة</th>
                  <th className="px-5 py-3.5 text-start">المدة</th>
                  <th className="px-5 py-3.5 text-start">الحالة</th>
                  <th className="px-5 py-3.5 text-start">السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-foreground-subtle italic">
                      لا توجد إجازات مسجلة.
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">{leave.employee?.fullName}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {leave.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-foreground-muted">
                        {new Date(leave.startDate).toLocaleDateString('ar-EG')} → {new Date(leave.endDate).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">{leave.totalDaysRequested} يوم</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            leave.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : leave.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {leave.status === 'APPROVED'
                            ? 'معتمدة'
                            : leave.status === 'REJECTED'
                            ? 'مرفوضة'
                            : 'قيد المراجعة'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-foreground-subtle max-w-xs truncate">{leave.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PERMISSIONS DIRECTORY                                          */}
      {/* ===================================================================== */}
      {activeTab === 'PERMISSIONS' && (
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 backdrop-blur-xl overflow-hidden shadow-xs animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-foreground-muted">
              <thead className="border-b border-border bg-surface-raised/70 text-[11px] font-bold text-foreground">
                <tr>
                  <th className="px-5 py-3.5 text-start">الموظف</th>
                  <th className="px-5 py-3.5 text-start">التاريخ</th>
                  <th className="px-5 py-3.5 text-start">الفترة الزمنية</th>
                  <th className="px-5 py-3.5 text-start">عدد الساعات</th>
                  <th className="px-5 py-3.5 text-start">الحالة</th>
                  <th className="px-5 py-3.5 text-start">السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-foreground-subtle italic">
                      لا توجد طلبات أذونات مسجلة.
                    </td>
                  </tr>
                ) : (
                  permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">{perm.employee?.fullName}</td>
                      <td className="px-5 py-4 font-mono text-foreground-muted">
                        {new Date(perm.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-5 py-4 font-mono text-foreground-muted">
                        {perm.startTime} → {perm.endTime}
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">{perm.hoursRequested} ساعات</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            perm.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : perm.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {perm.status === 'APPROVED'
                            ? 'معتمد'
                            : perm.status === 'REJECTED'
                            ? 'مرفوض'
                            : 'قيد المراجعة'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-foreground-subtle max-w-xs truncate">{perm.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ATTENDANCE LOGS & AUDIT                                        */}
      {/* ===================================================================== */}
      {activeTab === 'LOGS' && (
        <div className="rounded-3xl bg-card shadow-luxury dark:shadow-luxury-dark overflow-hidden animate-in fade-in">
          {canManageAttendance && (
            <div className="p-4 border-b border-border/30 bg-surface-raised/40 flex items-center justify-between gap-3">
              <p className="text-[11px] text-foreground-muted">
                يوم العمل بدون بصمة ولا إجازة أو إذن معتمد يُحسب غيابًا ويُخصم من الراتب. صحّح البصمة المنسية من هنا.
              </p>
              <button
                onClick={() => setIsManualAttendanceOpen(true)}
                className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-surface border border-border hover:bg-surface-hover px-4 py-2 text-xs font-bold text-foreground active:scale-95 transition-all"
              >
                <FiPlus className="h-4 w-4 text-primary" />
                <span>تسجيل حضور يدوي</span>
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-foreground-muted">
              <thead className="border-b border-border/30 bg-surface-raised/40 text-[11px] font-bold text-foreground">
                <tr>
                  <th className="px-5 py-3.5 text-start">الموظف</th>
                  <th className="px-5 py-3.5 text-start">التاريخ</th>
                  <th className="px-5 py-3.5 text-start">وقت الحضور</th>
                  <th className="px-5 py-3.5 text-start">وقت الانصراف</th>
                  <th className="px-5 py-3.5 text-start">حالة الحضور والتأخير</th>
                  <th className="px-5 py-3.5 text-start">موقف اللائحة والخصم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-foreground-subtle italic">
                      لا توجد سجلات حضور مسجلة.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((log) => {
                    const morningDelay = calculateMorningDelay(log.checkInTime);
                    // The server's figure already credits approved permissions
                    const penalty = getDelayPenalty(
                      log.delayMinutes,
                      !!log.checkOutTime,
                      log.date,
                      log.employee?.shiftType || 'RS',
                    );

                    return (
                      <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-foreground">{log.employee?.fullName}</td>
                        <td className="px-5 py-4 font-mono text-foreground-muted">
                          {new Date(log.date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="px-5 py-4 font-mono text-emerald-500 font-bold">
                          {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-4 font-mono text-foreground-muted">
                          {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          {morningDelay.isLate ? (
                            <span className="text-amber-500 dark:text-amber-400 font-bold font-mono">
                              {morningDelay.label}
                            </span>
                          ) : log.checkInTime ? (
                            <span className="text-emerald-500 font-bold">في الموعد (ضمن فترة السماح)</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] ${penalty.badgeColor}`}>
                            {penalty.penaltyLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: PUBLIC HOLIDAYS                                                */}
      {/* ===================================================================== */}
      {activeTab === 'HOLIDAYS' && <PublicHolidaysPanel canManage={canManageAttendance} />}

      {/* ===================================================================== */}
      {/* MODAL: MANUAL ATTENDANCE (HR)                                         */}
      {/* ===================================================================== */}
      {isManualAttendanceOpen && (
        <ManualAttendanceModal
          employees={employees}
          onClose={() => setIsManualAttendanceOpen(false)}
          onSuccess={() => {
            setIsManualAttendanceOpen(false);
            setFeedback({ type: 'SUCCESS', message: 'تم تسجيل الحضور اليدوي وإعادة احتساب التأخير.' });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE LEAVE REQUEST                                           */}
      {/* ===================================================================== */}
      {isLeaveModalOpen && (
        <CreateLeaveModal
          onClose={() => setIsLeaveModalOpen(false)}
          onSuccess={() => {
            setIsLeaveModalOpen(false);
            setFeedback({ type: 'SUCCESS', message: 'تم تقديم طلب الإجازة بنجاح وهو قيد مراجعة الإدارة.' });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE PERMISSION REQUEST                                      */}
      {/* ===================================================================== */}
      {isPermissionModalOpen && (
        <CreatePermissionModal
          onClose={() => setIsPermissionModalOpen(false)}
          onSuccess={() => {
            setIsPermissionModalOpen(false);
            setFeedback({ type: 'SUCCESS', message: 'تم تقديم طلب الإذن بنجاح وهو قيد المراجعة.' });
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: REJECT REQUEST                                                 */}
      {/* ===================================================================== */}
      {rejectingItem && (
        <RejectModal
          item={rejectingItem}
          onClose={() => setRejectingItem(null)}
          onConfirm={async (reason) => {
            if (rejectingItem.kind === 'LEAVE') {
              await rejectLeaveMutation.mutateAsync({ id: rejectingItem.id, rejectionReason: reason });
            } else {
              await rejectPermissionMutation.mutateAsync({ id: rejectingItem.id, rejectionReason: reason });
            }
            setRejectingItem(null);
            setFeedback({ type: 'SUCCESS', message: 'تم رفض الطلب وتوثيق السبب في السجل.' });
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE LEAVE MODAL COMPONENT
// -----------------------------------------------------------------------------

function CreateLeaveModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createMutation = useCreateLeave();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeaveFormData>({
    resolver: zodResolver(createLeaveSchema),
    defaultValues: {
      type: 'ANNUAL',
      startDate: localDateInputValue(),
      endDate: localDateInputValue(),
      reason: '',
    },
  });

  const onSubmit = async (data: CreateLeaveFormData) => {
    setErrorMsg(null);
    try {
      await createMutation.mutateAsync(data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل تقديم طلب الإجازة.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiCalendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">تقديم طلب إجازة رسمية</h2>
              <p className="text-[11px] text-foreground-muted">تسجيل رصيد وفترة الإجازة للاعتماد</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="إغلاق"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <form id="create-leave-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">نوع الإجازة <span className="text-rose-500">*</span></label>
            <select
              {...register('type')}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="ANNUAL">🏖️ إجازة اعتيادية سنوية (خصم من الرصيد)</option>
              <option value="SICK">🩺 إجازة مرضية (بتقرير طبي معتمد)</option>
              <option value="MATERNITY">👶 إجازة رعاية طفل / وضع</option>
            </select>
            <FieldError message={errors.type?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">من تاريخ</label>
              <input
                type="date"
                {...register('startDate')}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
              <FieldError message={errors.startDate?.message} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">إلى تاريخ</label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
              <FieldError message={errors.endDate?.message} />
            </div>
          </div>

          <p className="rounded-2xl bg-surface-raised px-4 py-2.5 text-[11px] text-foreground-muted leading-relaxed">
            يتم احتساب أيام العمل تلقائيًا بدون أيام الإجازة الأسبوعية. الحد الأقصى للإجازة السنوية 3 أيام عمل في الطلب الواحد.
          </p>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">السبب / الملاحظات (اختياري)</label>
            <textarea
              rows={2}
              {...register('reason')}
              placeholder="اكتب أسباب الإجازة أو الملاحظات إن وجدت..."
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            form="create-leave-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري التقديم...' : 'تقديم الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE PERMISSION MODAL COMPONENT
// -----------------------------------------------------------------------------

function CreatePermissionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createMutation = useCreateWorkPermission();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreatePermissionFormData>({
    resolver: zodResolver(createPermissionSchema),
    defaultValues: {
      date: localDateInputValue(),
      startTime: '10:00',
      endTime: '12:00',
      hoursRequested: 2,
      reason: '',
    },
  });

  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const hoursRequested = watch('hoursRequested');

  // Auto calculate hours (whole hours only; partial hours are flagged by validation)
  useEffect(() => {
    if (startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      const totalMins = (eh * 60 + em) - (sh * 60 + sm);
      if (totalMins > 0) {
        setValue('hoursRequested', totalMins / 60, { shouldValidate: true });
      }
    }
  }, [startTime, endTime, setValue]);

  const onSubmit = async (data: CreatePermissionFormData) => {
    setErrorMsg(null);
    try {
      await createMutation.mutateAsync(data);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل تقديم طلب الإذن.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">تقديم طلب إذن ساعي</h2>
              <p className="text-[11px] text-foreground-muted">طلب خروج أو تأخير لعدد محدد من الساعات</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="إغلاق"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <form id="create-permission-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">تاريخ الإذن <span className="text-rose-500">*</span></label>
            <input
              type="date"
              {...register('date')}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
            />
            <FieldError message={errors.date?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">من الساعة</label>
              <input
                type="time"
                {...register('startTime')}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
              <FieldError message={errors.startTime?.message} />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">إلى الساعة</label>
              <input
                type="time"
                {...register('endTime')}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
              <FieldError message={errors.endTime?.message} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">إجمالي الساعات المطلوبة</label>
            <input
              type="number"
              step="1"
              readOnly
              {...register('hoursRequested', { valueAsNumber: true })}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface-raised px-4 py-2.5 text-xs text-primary font-black font-mono focus:outline-none"
            />
            <FieldError message={errors.hoursRequested?.message} />
            {hoursRequested === 4 && (
              <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                إذن الأربع ساعات يُحسب نصف يوم ويُخصم من رصيد الإجازة السنوية بدلًا من ساعات الأذونات الشهرية.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">سبب الإذن</label>
            <textarea
              rows={2}
              {...register('reason')}
              placeholder="اكتب سبب طلب الإذن بوضوح..."
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <FieldError message={errors.reason?.message} />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            form="create-permission-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري التقديم...' : 'تقديم طلب الإذن'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// REJECT REQUEST MODAL COMPONENT
// -----------------------------------------------------------------------------

function RejectModal({
  item,
  onClose,
  onConfirm,
}: {
  item: { id: string; kind: 'LEAVE' | 'PERMISSION'; title: string };
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-inner">
              <FiAlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">رفض الطلب</h2>
              <p className="text-[11px] text-foreground-muted truncate max-w-[200px]">{item.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            title="إغلاق"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <form id="reject-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              سبب الرفض الإداري <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب أسباب رفض الطلب ليتم إبلاغ الموظف بها..."
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
            />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            form="reject-modal-form"
            type="submit"
            disabled={isSubmitting || !reason.trim()}
            className="rounded-2xl bg-rose-500 hover:bg-rose-600 px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري الرفض...' : 'تأكيد الرفض'}
          </button>
        </div>
      </div>
    </div>
  );
}
