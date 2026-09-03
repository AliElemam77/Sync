'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/use-auth';
import {
  useManagementStats,
  usePendingRequests,
  useInfiniteAuditLogs,
  useManagementOverride,
} from '../../../hooks/use-management';
import { useOrganizationTree } from '../../../hooks/use-organization';
import {
  AuditAction,
  ActionableCategory,
  ActionableItem,
  AuditLog,
} from '../../../types/management';
import { Card } from '../../../components/ui/card';
import {
  FiCommand,
  FiActivity,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUsers,
  FiTrendingUp,
  FiDollarSign,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiLogIn,
  FiLogOut,
  FiDownload,
  FiShield,
  FiFilter,
  FiSearch,
  FiRefreshCw,
  FiAlertCircle,
  FiChevronDown,
  FiCheck,
  FiX,
  FiEye,
  FiCalendar,
  FiFileText,
  FiLayers,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';

export default function ManagementCommandCenterPage() {
  const { user, hasPermission } = useAuth();
  const canViewAudit = hasPermission('audit.view');

  // Stats & Inboxes
  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useManagementStats();

  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | 'LEAVE' | 'PERMISSION' | 'TASK_REVIEW'
  >('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const {
    data: pendingData,
    isLoading: isPendingLoading,
    isRefetching: isPendingRefetching,
    refetch: refetchPending,
  } = usePendingRequests({
    type: selectedCategory,
    departmentId: selectedDeptId || undefined,
  });

  // Audit Log Filters
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const {
    data: auditData,
    isLoading: isAuditLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchAudit,
  } = useInfiniteAuditLogs({
    action: actionFilter || undefined,
    entity: entityFilter || undefined,
    search: searchTerm || undefined,
    limit: 25,
  });

  const { data: orgTree } = useOrganizationTree();
  const overrideMutation = useManagementOverride();

  // Action Modal State
  const [selectedItemForAction, setSelectedItemForAction] =
    useState<ActionableItem | null>(null);
  const [overrideActionType, setOverrideActionType] = useState<
    'APPROVE' | 'REJECT' | null
  >(null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [detailsModalItem, setDetailsModalItem] =
    useState<ActionableItem | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Flattened audit logs from all pages
  const flattenedAuditLogs = useMemo(() => {
    return auditData?.pages.flatMap((page) => page.data) || [];
  }, [auditData]);

  // Execute direct approval / rejection
  const handleExecuteAction = async () => {
    if (!selectedItemForAction || !overrideActionType) return;

    const categoryMap: Record<ActionableCategory, 'LEAVE' | 'PERMISSION' | 'TASK'> =
      {
        LEAVE: 'LEAVE',
        PERMISSION: 'PERMISSION',
        TASK_REVIEW: 'TASK',
      };

    try {
      await overrideMutation.mutateAsync({
        id: selectedItemForAction.id,
        category: categoryMap[selectedItemForAction.category],
        action: overrideActionType,
        reason: overrideReason.trim() || undefined,
      });

      setSelectedItemForAction(null);
      setOverrideActionType(null);
      setOverrideReason('');
    } catch (err) {
      console.error('Failed to override action', err);
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchPending();
    refetchAudit();
  };

  if (!canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4 animate-in fade-in">
        <div className="h-16 w-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-inner">
          <FiShield className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">
          الوصول مقيد للإدارة العليا (Restricted Access)
        </h2>
        <p className="text-xs text-foreground-muted max-w-md leading-relaxed">
          عذراً، مركز القيادة والتحكم الإداري وسجلات التدقيق الشاملة مخصصة حصرياً
          لأعضاء الإدارة العليا (Top Management) والمدير العام (Super Admin).
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black shadow-md transition-all active:scale-95"
        >
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  // Sentence Builder for Timeline
  const formatAuditSentence = (log: AuditLog) => {
    const actorName =
      log.user?.employeeProfile?.fullName || log.user?.email || 'النظام التلقائي';
    const deptName =
      log.user?.employeeProfile?.department?.name || 'الإدارة العامة';

    let actionLabel = '';
    let actionColor = 'text-primary';

    switch (log.action) {
      case 'CREATE':
        actionLabel = 'أضاف / أنشأ';
        actionColor = 'text-emerald-500 font-extrabold';
        break;
      case 'UPDATE':
        actionLabel = 'قام بتحديث';
        actionColor = 'text-sky-500 font-extrabold';
        break;
      case 'DELETE':
        actionLabel = 'قام بحذف';
        actionColor = 'text-rose-500 font-extrabold';
        break;
      case 'LOGIN':
        actionLabel = 'سجل الدخول إلى النظام';
        actionColor = 'text-amber-500 font-extrabold';
        break;
      case 'LOGOUT':
        actionLabel = 'سجل الخروج من النظام';
        actionColor = 'text-zinc-500 font-extrabold';
        break;
      case 'EXPORT':
        actionLabel = 'قام بتصدير بيانات';
        actionColor = 'text-purple-500 font-extrabold';
        break;
      default:
        actionLabel = `نفذ إجراء ${log.action}`;
    }

    const entityLabel = log.entity
      .replace('Task', 'المهمة')
      .replace('EmployeeProfile', 'ملف الموظف')
      .replace('LeaveRequest', 'طلب الإجازة')
      .replace('PermissionRequest', 'طلب الإذن')
      .replace('FinancialTransaction', 'المعاملة المالية')
      .replace('Asset', 'الأصل / العهدة')
      .replace('Department', 'القسم الإداري')
      .replace('User', 'المستخدم');

    return (
      <div className="text-xs leading-relaxed text-foreground">
        <span className="font-extrabold text-foreground">{actorName}</span>{' '}
        <span className="text-[11px] text-foreground-muted font-mono">
          ({deptName})
        </span>{' '}
        <span className={actionColor}>{actionLabel}</span>{' '}
        <span className="font-bold text-foreground underline decoration-border underline-offset-2">
          {entityLabel}
        </span>
        {log.entityId && (
          <span className="text-[10px] font-mono text-foreground-subtle ml-1">
            #{log.entityId.slice(0, 8)}
          </span>
        )}
      </div>
    );
  };

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <div className="h-8 w-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiPlus className="h-4 w-4" />
          </div>
        );
      case 'UPDATE':
        return (
          <div className="h-8 w-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiEdit3 className="h-4 w-4" />
          </div>
        );
      case 'DELETE':
        return (
          <div className="h-8 w-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiTrash2 className="h-4 w-4" />
          </div>
        );
      case 'LOGIN':
        return (
          <div className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiLogIn className="h-4 w-4" />
          </div>
        );
      case 'LOGOUT':
        return (
          <div className="h-8 w-8 rounded-xl bg-zinc-500/15 border border-zinc-500/30 text-zinc-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiLogOut className="h-4 w-4" />
          </div>
        );
      case 'EXPORT':
        return (
          <div className="h-8 w-8 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-500 flex items-center justify-center shrink-0 shadow-xs">
            <FiDownload className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="h-8 w-8 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0">
            <FiActivity className="h-4 w-4" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* 1. TOP HEADER WITH LIVE PULSE INDICATOR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>الإدارة العليا</span>
            <span>/</span>
            <span className="text-foreground font-medium">
              غرفة العمليات المركزية
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center shadow-xs">
              <FiCommand className="h-4 w-4" />
            </div>
            <span>مركز القيادة وسجل التدقيق العام (Command Center)</span>
          </h1>
        </div>

        {/* Live Pulse & Refresh Controls */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>تحديث حي متزامن (10s Live Pulse)</span>
          </div>

          <button
            onClick={handleRefreshAll}
            className="p-2.5 rounded-2xl bg-surface hover:bg-surface-hover border border-border/40 text-foreground-muted hover:text-foreground transition-all shadow-xs active:scale-95"
            title="تحديث البيانات فوراً"
          >
            <FiRefreshCw
              className={`h-4 w-4 ${
                isPendingRefetching ? 'animate-spin text-primary' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. TOP KPI EXECUTIVE METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Workforce */}
        <Card className="p-5 flex items-center justify-between glass-card hover:border-primary/40 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">
              الكوادر البشرية النشطة
            </span>
            <div className="text-2xl font-black text-foreground font-mono">
              {stats?.activeEmployeesCount ?? '-'}
            </div>
            <span className="text-[10px] text-foreground-subtle block">
              عبر {stats?.totalDepartmentsCount ?? 0} أقسام معتمدة
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
            <FiUsers className="h-5 w-5" />
          </div>
        </Card>

        {/* Today Attendance */}
        <Card className="p-5 flex items-center justify-between glass-card hover:border-emerald-500/40 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">
              حضور اليوم الفعلي
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats?.todayPresentCount ?? '-'}
            </div>
            <span className="text-[10px] text-foreground-subtle block">
              موظف متواجد بالوردية الحالية
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
            <FiClock className="h-5 w-5" />
          </div>
        </Card>

        {/* Pending Approvals Inbox */}
        <Card className="p-5 flex items-center justify-between glass-card hover:border-amber-500/40 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">
              الموافقات المعلقة (Inbox)
            </span>
            <div className="text-2xl font-black text-amber-500 font-mono flex items-center gap-2">
              <span>{stats?.pendingApprovalsTotal ?? '-'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-sans font-extrabold">
                عاجل
              </span>
            </div>
            <span className="text-[10px] text-foreground-subtle block">
              إجازات: {stats?.pendingBreakdown.leaves || 0} • أذونات:{' '}
              {stats?.pendingBreakdown.permissions || 0} • مهام:{' '}
              {stats?.pendingBreakdown.tasks || 0}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
            <FiAlertCircle className="h-5 w-5" />
          </div>
        </Card>

        {/* Monthly Net Profit */}
        <Card className="p-5 flex items-center justify-between glass-card hover:border-brand-gold/40 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">
              صافي أرباح الشهر (Net Profit)
            </span>
            <div className="text-2xl font-black text-brand-gold dark:text-brand-champagne font-mono">
              {(stats?.financialSummary.monthlyNetProfit || 0).toLocaleString(
                'ar-EG',
              )}{' '}
              <span className="text-xs font-sans">ج.م</span>
            </div>
            <span className="text-[10px] text-foreground-subtle block">
              إيراد:{' '}
              {(stats?.financialSummary.monthlyIncome || 0).toLocaleString('ar-EG')}{' '}
              • مصروف:{' '}
              {(stats?.financialSummary.monthlyExpense || 0).toLocaleString(
                'ar-EG',
              )}
            </span>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold dark:text-brand-champagne flex items-center justify-center shadow-inner">
            <FiDollarSign className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* 3. MAIN SPLIT: UNIFIED INBOX & GLOBAL ACTIVITY TIMELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* SECTION A: THE UNIFIED INBOX (PENDING REQUESTS)                   */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-3xl glass-card p-5 space-y-4 border border-border/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
              <div>
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <FiClock className="h-4 w-4 text-amber-500" />
                  <span>صندوق الطلبات والموافقات المعلقة (Unified Inbox)</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-mono font-bold">
                    {pendingData?.counts.total || 0}
                  </span>
                </h2>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  تجميع متزامن للإجازات، الأذونات، والمهام الخاضعة لمراجعة الإدارة.
                </p>
              </div>

              {/* Department Selector Filter */}
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="rounded-xl border border-border/60 bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none font-bold"
              >
                <option value="">كافة الأقسام</option>
                {orgTree?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'ALL', label: 'الكل', count: pendingData?.counts.total || 0 },
                {
                  id: 'LEAVE',
                  label: 'الإجازات',
                  count: pendingData?.counts.leaves || 0,
                },
                {
                  id: 'PERMISSION',
                  label: 'الأذونات',
                  count: pendingData?.counts.permissions || 0,
                },
                {
                  id: 'TASK_REVIEW',
                  label: 'مراجعة المهام',
                  count: pendingData?.counts.tasks || 0,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === tab.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-surface/80 text-foreground-muted hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10 text-[10px] font-mono">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Pending Requests Cards List */}
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {isPendingLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-foreground-muted space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold">
                    جاري تجميع الطلبات المعلقة...
                  </span>
                </div>
              ) : pendingData?.data.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-surface/40 border border-border/20 space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <FiCheck className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-black text-foreground">
                    لا توجد أي طلبات معلقة حالياً
                  </h4>
                  <p className="text-[11px] text-foreground-subtle">
                    كافة الإجازات والأذونات وتاسكات المراجعة تم اعتمادها بالكامل.
                  </p>
                </div>
              ) : (
                pendingData?.data.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/40 bg-surface/80 hover:bg-surface p-4 transition-all space-y-3 group shadow-2xs hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0 overflow-hidden">
                          {item.requester.avatarUrl ? (
                            <img
                              src={item.requester.avatarUrl}
                              alt={item.requester.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            item.requester.fullName.charAt(0)
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground">
                              {item.requester.fullName}
                            </span>
                            <span className="font-mono text-[10px] text-foreground-muted">
                              #{item.requester.employeeCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-foreground-muted flex items-center gap-1.5 mt-0.5">
                            <span>
                              {item.requester.departmentName ||
                                item.department?.name ||
                                'القسم العام'}
                            </span>
                            {item.requester.positionName && (
                              <>
                                <span>•</span>
                                <span>{item.requester.positionName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Category Tag */}
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border shrink-0 ${
                          item.category === 'LEAVE'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : item.category === 'PERMISSION'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        }`}
                      >
                        {item.category === 'LEAVE'
                          ? 'إجازة'
                          : item.category === 'PERMISSION'
                          ? 'إذن خروج'
                          : 'مراجعة مهمة'}
                      </span>
                    </div>

                    {/* Title & Reason */}
                    <div className="space-y-1 bg-surface-raised/40 p-2.5 rounded-xl border border-border/20">
                      <div className="text-xs font-extrabold text-foreground">
                        {item.title}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-foreground-muted line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[11px] text-foreground-subtle">
                      <span className="font-mono flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailsModalItem(item)}
                          className="px-2.5 py-1 rounded-xl bg-surface hover:bg-surface-hover border border-border/40 text-foreground text-[11px] font-bold transition-all"
                        >
                          التفاصيل
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItemForAction(item);
                            setOverrideActionType('REJECT');
                          }}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 text-[11px] font-bold transition-all"
                        >
                          رفض
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItemForAction(item);
                            setOverrideActionType('APPROVE');
                          }}
                          className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black shadow-xs active:scale-95 transition-all"
                        >
                          اعتماد فوري
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION B: GLOBAL ACTIVITY TIMELINE (AUDIT FEED)                  */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-3xl glass-card p-5 space-y-4 border border-border/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
              <div>
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <FiActivity className="h-4 w-4 text-primary" />
                  <span>شريط الأنشطة والتدقيق الزمني (Global Timeline)</span>
                </h2>
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  رصد مباشر ولحظي لكافة حركات الإضافة والتعديل والحذف عبر المنظومة.
                </p>
              </div>

              {/* Action Filter */}
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="rounded-xl border border-border/60 bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none font-bold"
              >
                <option value="">كافة الإجراءات</option>
                <option value="CREATE">إضافة / إنشاء (CREATE)</option>
                <option value="UPDATE">تعديل / تحديث (UPDATE)</option>
                <option value="DELETE">حذف (DELETE)</option>
                <option value="LOGIN">تسجيل دخول (LOGIN)</option>
                <option value="LOGOUT">تسجيل خروج (LOGOUT)</option>
                <option value="EXPORT">تصدير بيانات (EXPORT)</option>
              </select>
            </div>

            {/* Timeline Search & Filter Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute right-3 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث باسم الموظف أو الكيان أو المعرف..."
                  className="w-full rounded-2xl border border-border/60 bg-surface pr-8 pl-3 py-2 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:border-primary"
                />
              </div>

              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="rounded-2xl border border-border/60 bg-surface px-3 py-2 text-xs text-foreground focus:outline-none font-bold"
              >
                <option value="">كافة الكيانات</option>
                <option value="Task">المهام (Task)</option>
                <option value="EmployeeProfile">الموظفين (Employee)</option>
                <option value="LeaveRequest">الإجازات (Leave)</option>
                <option value="PermissionRequest">الأذونات (Permission)</option>
                <option value="FinancialTransaction">المالية (Finance)</option>
                <option value="Asset">الأصول والعهد (Asset)</option>
                <option value="Department">الهيكل الإداري (Department)</option>
              </select>
            </div>

            {/* Timeline Stream */}
            <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1 relative">
              {isAuditLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-foreground-muted space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold">
                    جاري تحميل سجل التدقيق الحي...
                  </span>
                </div>
              ) : flattenedAuditLogs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-surface/40 border border-border/20 space-y-1 text-foreground-subtle text-xs">
                  لا توجد حركات مطابقة لمعايير البحث الحالية.
                </div>
              ) : (
                <div className="relative border-r-2 border-border/40 mr-4 space-y-4 pr-4">
                  {flattenedAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="relative rounded-2xl bg-surface/70 hover:bg-surface border border-border/30 p-3.5 transition-all space-y-2 group shadow-2xs"
                    >
                      {/* Timeline Node Icon Indicator */}
                      <div className="absolute -right-8.5 top-3">
                        {getActionIcon(log.action)}
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        {formatAuditSentence(log)}
                        <span className="font-mono text-[10px] text-foreground-subtle whitespace-nowrap shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Metadata Accordion Toggle */}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="pt-1">
                          <button
                            onClick={() =>
                              setExpandedLogId(
                                expandedLogId === log.id ? null : log.id,
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            <FiChevronDown
                              className={`h-3 w-3 transition-transform ${
                                expandedLogId === log.id ? 'rotate-180' : ''
                              }`}
                            />
                            <span>
                              {expandedLogId === log.id
                                ? 'إخفاء تفاصيل البيانات'
                                : 'عرض تفاصيل التغييرات (Metadata)'}
                            </span>
                          </button>

                          {expandedLogId === log.id && (
                            <pre className="mt-2 p-2.5 rounded-xl bg-black/90 text-emerald-400 font-mono text-[10px] overflow-x-auto max-h-40 border border-white/10 text-left dir-ltr">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-mono text-foreground-subtle pt-1 border-t border-border/20">
                        <span>
                          {new Date(log.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      </div>
                    </div>
                  ))}

                  {/* Load More Button for Infinite Scroll */}
                  {hasNextPage && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="px-4 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border/40 text-xs font-black text-foreground shadow-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isFetchingNextPage
                          ? 'جاري جلب المزيد...'
                          : 'تحميل المزيد من السجلات التاريخية'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. DIRECT ACTION CONFIRMATION MODAL                                    */}
      {/* ===================================================================== */}
      {selectedItemForAction && overrideActionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${overrideActionType === 'APPROVE' ? 'via-emerald-500/50' : 'via-rose-500/50'} to-transparent z-10`} />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-inner ${overrideActionType === 'APPROVE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
                  {overrideActionType === 'APPROVE' ? (
                    <FiCheckCircle className="h-5 w-5" />
                  ) : (
                    <FiXCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    {overrideActionType === 'APPROVE'
                      ? 'تأكيد الاعتماد الإداري الفوري'
                      : 'تأكيد الرفض الإداري للطلب'}
                  </h3>
                  <p className="text-[11px] text-foreground-muted">صلاحيات الإدارة التنفيذية المباشرة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemForAction(null);
                  setOverrideActionType(null);
                }}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div className="space-y-2 bg-surface/80 p-3.5 rounded-2xl border border-border/60 dark:border-white/5 text-xs">
                <div className="font-extrabold text-foreground">
                  {selectedItemForAction.title}
                </div>
                <div className="text-foreground-muted text-[11px]">
                  مقدم الطلب:{' '}
                  <span className="font-bold text-foreground">
                    {selectedItemForAction.requester.fullName}
                  </span>{' '}
                  ({selectedItemForAction.department?.name || 'القسم العام'})
                </div>
              </div>

              {overrideActionType === 'REJECT' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    سبب الرفض الإداري <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="اكتب توضيحاً لسبب الرفض ليظهر لمقدم الطلب..."
                    rows={3}
                    className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedItemForAction(null);
                  setOverrideActionType(null);
                }}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={overrideMutation.isPending || (overrideActionType === 'REJECT' && !overrideReason.trim())}
                className={`rounded-2xl px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all ${
                  overrideActionType === 'APPROVE'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                {overrideMutation.isPending
                  ? 'جاري التنفيذ...'
                  : overrideActionType === 'APPROVE'
                  ? 'تأكيد الاعتماد'
                  : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. ITEM DETAILS MODAL                                                 */}
      {/* ===================================================================== */}
      {detailsModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiFileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">تفاصيل الطلب المعلق</h3>
                  <p className="text-[11px] text-foreground-muted">مراجعة بيانات الطلب قبل اتخاذ القرار</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalItem(null)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-surface/80 border border-border/60 dark:border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-foreground-subtle block">
                  مقدم الطلب
                </span>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                    {detailsModalItem.requester.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-extrabold text-foreground">
                      {detailsModalItem.requester.fullName}
                    </div>
                    <div className="text-[11px] text-foreground-muted">
                      كود:{' '}
                      <span className="font-mono">
                        {detailsModalItem.requester.employeeCode}
                      </span>{' '}
                      •{' '}
                      {detailsModalItem.requester.departmentName ||
                        detailsModalItem.department?.name}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface/80 border border-border/60 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-foreground-subtle block">
                  موضوع الطلب
                </span>
                <div className="font-black text-foreground text-sm">
                  {detailsModalItem.title}
                </div>
                {detailsModalItem.description && (
                  <p className="text-foreground-muted text-[11px] leading-relaxed pt-1">
                    {detailsModalItem.description}
                  </p>
                )}
              </div>

              {/* Meta Payload breakdown */}
              {detailsModalItem.meta && (
                <div className="p-3.5 rounded-2xl bg-surface/60 border border-border/40 dark:border-white/5 space-y-1.5">
                  <span className="text-[10px] font-bold text-foreground-subtle block">
                    بيانات إضافية
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {Object.entries(detailsModalItem.meta).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-surface p-2.5 rounded-xl border border-border/40"
                      >
                        <span className="text-foreground-subtle block text-[9px]">
                          {key}
                        </span>
                        <span className="text-foreground font-bold font-sans">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setDetailsModalItem(null)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

