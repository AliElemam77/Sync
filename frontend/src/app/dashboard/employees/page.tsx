'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useEmployees, useDeleteEmployee } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import { useAuth } from '../../../hooks/use-auth';
import { Card } from '../../../components/ui/card';
import { TableSkeleton } from '../../../components/ui/table-skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  FiUsers,
  FiUserPlus,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiUserX,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiPhone,
  FiMail,
  FiMessageSquare,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
import { getUserDirectoryScope } from '../../../lib/permissions';

export default function EmployeesListPage() {
  const { user, hasPermission } = useAuth();
  const dirScope = getUserDirectoryScope(user);

  const canCreate = hasPermission('employees.create') || dirScope.canManage;
  const canUpdate = hasPermission('employees.update') || dirScope.canManage;
  const canDelete = hasPermission('employees.delete') || dirScope.canManage;

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  const { data: orgTree } = useOrganizationTree();
  const { data: response, isLoading, isError } = useEmployees({
    search: search.trim() || undefined,
    departmentId: departmentId || undefined,
    page,
    limit: 10,
  });

  const deleteMutation = useDeleteEmployee();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل تريد إنهاء خدمة الموظف '${name}'؟ سيتم إيقاف دخوله للنظام مع الاحتفاظ بكل سجلاته.`)) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'فشل إنهاء خدمة الموظف');
    }
  };

  const totalEmployees = response?.meta?.total ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/30 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>{dirScope.scopeBadge}</span>
            <span>/</span>
            <span className="text-foreground font-medium">{dirScope.scopeLabel}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <span>
              {dirScope.isCompanyWide
                ? 'دليل الكوادر البشرية العام'
                : dirScope.isHead
                ? 'فريق العمل والأقسام التابعة'
                : dirScope.isTeamLeader
                ? 'أعضاء فريق العمل'
                : 'دليل زملاء الفريق'}
            </span>
            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              {totalEmployees} عضو
            </span>
          </h1>
        </div>

        {canCreate && (
          <Link
            href="/dashboard/employees/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md active:scale-95 transition-all self-start sm:self-auto"
          >
            <FiUserPlus className="h-4 w-4" />
            <span>إضافة موظف جديد</span>
          </Link>
        )}
      </div>

      {/* Scope Explanation Banner */}
      <div className="rounded-2xl bg-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-border/20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-[10px] font-black shrink-0">
            {dirScope.scopeBadge}
          </span>
          <span className="text-foreground-muted leading-relaxed">
            {dirScope.isCompanyWide
              ? 'تستعرض حالياً الدليل الشامل لجميع كوادر وموظفي الشركة عبر كافة الأقسام.'
              : dirScope.isHead
              ? 'تستعرض حالياً كوادر وموظفي الأقسام والوحدات التابعة لإشرافك في القطاع.'
              : dirScope.isTeamLeader
              ? `تستعرض حالياً أعضاء الفريق التابعين لك في قسم (${user?.employee?.department?.name || 'فريقك'}).`
              : `تستعرض حالياً زملاءك وأعضاء فريق العمل في قسم (${user?.employee?.department?.name || 'قسمك'}).`}
          </span>
        </div>
        <div className="text-[11px] font-mono text-primary font-bold shrink-0">
          إجمالي النتائج: {totalEmployees}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 glass-card p-4 rounded-3xl">
        <div className="sm:col-span-2 relative">
          <FiSearch className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="بحث بالاسم، كود الموظف (TAR...)، البريد، أو الهاتف..."
            className="w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/30 ps-10 pe-4 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
          />
        </div>

        <div className="relative">
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/30 px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="">جميع الأقسام والوحدات</option>
            {orgTree?.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
          <FiFilter className="absolute end-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle pointer-events-none" />
        </div>
      </div>

      {/* Error Alert */}
      {deleteError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
          <FiAlertCircle className="h-4 w-4 shrink-0" />
          <span>{deleteError}</span>
        </div>
      )}

      {/* Employees Table Card */}
      <div className="rounded-3xl glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-foreground-muted">
            <thead className="border-b border-border/30 bg-surface-raised/40 text-[11px] font-bold text-foreground">
              <tr>
                <th className="px-5 py-3.5 text-start">كود الموظف</th>
                <th className="px-5 py-3.5 text-start">الموظف والاتصال</th>
                <th className="px-5 py-3.5 text-start">القسم والمسمى الوظيفي</th>
                <th className="px-5 py-3.5 text-start">الوردية والرصيد</th>
                <th className="px-5 py-3.5 text-start">الحالة</th>
                <th className="px-5 py-3.5 text-end">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <TableSkeleton rows={5} cols={6} />
                  </td>
                </tr>
              ) : response?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <EmptyState
                      icon={FiUsers}
                      title="لم يتم العثور على موظفين"
                      description="لا توجد نتائج مطابقة لمعايير البحث الحالية."
                    />
                  </td>
                </tr>
              ) : (
                response?.data.map((emp) => (
                  <tr key={emp.id} className="hover:bg-surface/50 transition-colors group">
                    <td className="px-5 py-4 font-mono font-bold text-primary">
                      {emp.employeeCode}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                          {emp.fullName?.slice(0, 1) || 'E'}
                        </div>
                        <div>
                          <div className="font-extrabold text-foreground">{emp.fullName}</div>
                          <div className="text-[11px] text-foreground-subtle flex items-center gap-1 font-mono">
                            <FiMail className="h-3 w-3" />
                            <span>{emp.user?.email}</span>
                          </div>
                          <div className="text-[10px] text-foreground-subtle flex items-center gap-1 font-mono">
                            <FiPhone className="h-3 w-3" />
                            <span>{emp.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-foreground font-bold">{emp.position?.name}</div>
                      <div className="text-[11px] text-foreground-muted flex items-center gap-1">
                        <BiBuildingHouse className="h-3.5 w-3.5 text-primary" />
                        <span>{emp.department?.name}</span>
                        <span className="font-mono text-[10px] text-primary">({emp.department?.code})</span>
                      </div>
                      {emp.level && (
                        <span className="inline-block mt-1 rounded-md bg-surface-raised border border-border px-1.5 py-0.5 text-[9px] font-mono font-bold text-foreground-muted">
                          {emp.level.name}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 space-y-1">
                      <div>
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold border ${
                            emp.shiftType === 'RS'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {emp.shiftType === 'RS' ? 'RS: 6 أيام (8س)' : 'LS: 5 أيام (9س)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-foreground-muted font-mono">
                        سنوي: <span className="text-foreground font-bold">{emp.annualLeaveDays}ي</span> | إذن:{' '}
                        <span className="text-foreground font-bold">{emp.monthlyPermissionHours}س/شهر</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : emp.status === 'PROBATION'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {emp.status === 'ACTIVE'
                          ? 'نشط'
                          : emp.status === 'PROBATION'
                          ? 'تحت الاختبار'
                          : emp.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-end space-x-2 whitespace-nowrap">
                      <Link
                        href="/dashboard/chat"
                        title="بدء محادثة فورية"
                        className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-foreground-muted hover:text-foreground bg-surface hover:bg-surface-hover border border-border/40 transition-colors ml-2"
                      >
                        <FiMessageSquare className="h-3 w-3 text-primary" />
                        <span>محادثة</span>
                      </Link>
                      {canUpdate && (
                        <Link
                          href={`/dashboard/employees/${emp.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors ml-2"
                        >
                          <FiEdit2 className="h-3 w-3" />
                          <span>تعديل</span>
                        </Link>
                      )}
                      {canDelete && emp.status !== 'ENDED' && (
                        <button
                          onClick={() => handleDelete(emp.id, emp.fullName)}
                          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                        >
                          <FiUserX className="h-3 w-3" />
                          <span>إنهاء الخدمة</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {response && response.meta.totalPages > 1 && (
          <div className="border-t border-border px-5 py-3.5 flex items-center justify-between text-xs text-foreground-muted bg-surface-raised/40">
            <div>
              عرض الصفحة <span className="text-foreground font-black font-mono">{response.meta.page}</span> من{' '}
              <span className="text-foreground font-black font-mono">{response.meta.totalPages}</span> ({response.meta.total} موظف إجمالي)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-surface-hover transition-colors"
              >
                <FiChevronRight className="h-3.5 w-3.5" />
                <span>السابق</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.min(response.meta.totalPages, p + 1))}
                disabled={page === response.meta.totalPages}
                className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-surface-hover transition-colors"
              >
                <span>التالي</span>
                <FiChevronLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

