'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import {
  usePayrollCycles,
  usePayrollCycle,
  useGeneratePayroll,
  useApprovePayrollCycle,
  useMyPayslips,
} from '../../../hooks/use-payroll';
import { Card } from '../../../components/ui/card';
import { OvertimeSettingsCard } from '../../../components/payroll/overtime-settings-card';
import {
  PayrollCycle,
  Payslip,
  PayrollCycleStatus,
  FinancialAdjustment,
} from '../../../types/payroll';
import {
  FiCreditCard,
  FiDollarSign,
  FiTrendingUp,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCalendar,
  FiSearch,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiLock,
  FiChevronDown,
  FiX,
  FiEye,
  FiUser,
  FiLayers,
  FiShield,
  FiCheck,
  FiTrendingDown,
  FiArrowUpRight,
  FiRefreshCw,
} from 'react-icons/fi';

export default function PayrollCommandCenterPage() {
  const { user, hasPermission } = useAuth();

  // Role permissions
  const canManage =
    hasPermission('payroll.manage') ||
    user?.role?.name === 'SUPER_ADMIN' ||
    user?.role?.name === 'HR_MANAGER';

  const canViewCompanyPayroll =
    hasPermission('payroll.view') || canManage;

  // Payroll options such as overtime are set by Management (or the Super Admin)
  const canEditPayrollSettings = !!user?.isManagement || user?.role?.name === 'SUPER_ADMIN';

  // Active view tab: 'MANAGER' (Finance Manager) or 'SELF_SERVICE' (My Payslips)
  const [activeTab, setActiveTab] = useState<'MANAGER' | 'SELF_SERVICE'>(
    canViewCompanyPayroll ? 'MANAGER' : 'SELF_SERVICE',
  );

  // Month & Year selector for Generation & Inspection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentDate.getMonth() + 1, // 1-12
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    currentDate.getFullYear(),
  );

  // Selected Cycle ID for inspection
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // Search & Filter state for payslips table
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modals state
  const [activePayslipDetails, setActivePayslipDetails] =
    useState<Payslip | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // QUERIES & MUTATIONS
  // ---------------------------------------------------------------------------

  const { data: cycles, isLoading: isCyclesLoading } = usePayrollCycles({
    year: selectedYear,
  });

  // Auto-select latest cycle if none is selected
  const activeCycleId = useMemo(() => {
    if (selectedCycleId) return selectedCycleId;
    if (cycles && cycles.length > 0) {
      // Find matching current month/year or fallback to latest
      const match = cycles.find(
        (c) => c.month === selectedMonth && c.year === selectedYear,
      );
      return match ? match.id : cycles[0].id;
    }
    return null;
  }, [selectedCycleId, cycles, selectedMonth, selectedYear]);

  const { data: activeCycle, isLoading: isCycleLoading } =
    usePayrollCycle(activeCycleId);

  const { data: myPayslips, isLoading: isMyPayslipsLoading } = useMyPayslips();

  const generatePayrollMutation = useGeneratePayroll();
  const approveCycleMutation = useApprovePayrollCycle();

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleGeneratePayroll = async () => {
    try {
      const generated = await generatePayrollMutation.mutateAsync({
        month: selectedMonth,
        year: selectedYear,
      });
      if (generated?.id) {
        setSelectedCycleId(generated.id);
      }
    } catch (err: any) {
      console.error('Failed to generate payroll:', err);
    }
  };

  const handleApproveCycle = async () => {
    if (!activeCycleId) return;
    try {
      await approveCycleMutation.mutateAsync(activeCycleId);
      setIsApproveModalOpen(false);
    } catch (err: any) {
      console.error('Failed to approve cycle:', err);
    }
  };

  // Filter payslips in the manager view
  const filteredPayslips = useMemo(() => {
    if (!activeCycle?.payslips) return [];
    return activeCycle.payslips.filter((slip) => {
      const empName = slip.employee?.fullName || '';
      const empCode = slip.employee?.employeeCode || '';
      const deptName = slip.employee?.department?.name || '';

      const matchesSearch =
        empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        empCode.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept =
        !departmentFilter || deptName === departmentFilter;

      return matchesSearch && matchesDept;
    });
  }, [activeCycle?.payslips, searchTerm, departmentFilter]);

  // Unique departments in the active cycle
  const availableDepartments = useMemo(() => {
    if (!activeCycle?.payslips) return [];
    const depts = new Set<string>();
    activeCycle.payslips.forEach((s) => {
      if (s.employee?.department?.name) {
        depts.add(s.employee.department.name);
      }
    });
    return Array.from(depts);
  }, [activeCycle?.payslips]);

  // Aggregated cycle stats
  const cycleStats = useMemo(() => {
    if (!activeCycle?.payslips) {
      return {
        gross: Number(activeCycle?.totalGross || 0),
        net: Number(activeCycle?.totalNet || 0),
        penalties: 0,
        deductions: 0,
        count: 0,
      };
    }

    let totalPenalties = 0;
    let totalDeductions = 0;
    activeCycle.payslips.forEach((p) => {
      totalPenalties += Number(p.attendancePenalties || 0);
      totalDeductions += Number(p.totalDeductions || 0);
    });

    return {
      gross: Number(activeCycle.totalGross || 0),
      net: Number(activeCycle.totalNet || 0),
      penalties: totalPenalties,
      deductions: totalDeductions,
      count: activeCycle.payslips.length,
    };
  }, [activeCycle]);

  // Helper for status badge
  const getCycleStatusBadge = (status: PayrollCycleStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
            <FiClock className="h-3 w-3" />
            <span>مسودة (Draft)</span>
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs">
            <FiAlertCircle className="h-3 w-3" />
            <span>بانتظار الاعتماد</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs">
            <FiCheckCircle className="h-3 w-3" />
            <span>معتمد ومقفل (Approved)</span>
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-2xs">
            <FiLock className="h-3 w-3" />
            <span>مدفوع (Paid)</span>
          </span>
        );
      default:
        return null;
    }
  };

  const monthNames = [
    'يناير (1)',
    'فبراير (2)',
    'مارس (3)',
    'أبريل (4)',
    'مايو (5)',
    'يونيو (6)',
    'يوليو (7)',
    'أغسطس (8)',
    'سبتمبر (9)',
    'أكتوبر (10)',
    'نوفمبر (11)',
    'ديسمبر (12)',
  ];

  return (
    <div className="space-y-8 w-full max-w-[1680px] mx-auto px-2 sm:px-4 pb-16 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* 1. HEADER & TOP VIEW SWITCHER                                         */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>المالية وشؤون الموظفين</span>
            <span>/</span>
            <span className="text-foreground font-medium">
              محرك مسير الرواتب والاستقطاعات
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shadow-xs">
              <FiCreditCard className="h-4 w-4" />
            </div>
            <span>مسير الرواتب وخصومات الحضور (Payroll Engine)</span>
          </h1>
        </div>

        {/* View Switcher: Manager vs Self-Service */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-border/60 shadow-inner self-start sm:self-auto">
          {canViewCompanyPayroll && (
            <button
              onClick={() => setActiveTab('MANAGER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'MANAGER'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              <FiShield className="h-3.5 w-3.5" />
              <span>إدارة المسير العام</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('SELF_SERVICE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'SELF_SERVICE'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
            }`}
          >
            <FiUser className="h-3.5 w-3.5" />
            <span>قسائم رواتبي (My Payslips)</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. PERSPECTIVE A: FINANCE MANAGER COMMAND CENTER                      */}
      {/* ===================================================================== */}
      {activeTab === 'MANAGER' && (
        <div className="space-y-6">
          {/* Overtime option: changed by Management only (enforced by the backend) */}
          <OvertimeSettingsCard canEdit={canEditPayrollSettings} />

          {/* Generation & Period Selector Bar */}
          <div className="rounded-3xl glass-card p-5 border border-border/40 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/20 pb-4">
              <div className="space-y-1">
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <FiClock className="h-4 w-4 text-primary" />
                  <span>مركز احتساب وتوليد الرواتب الشهري</span>
                </h2>
                <p className="text-[11px] text-foreground-muted leading-relaxed">
                  يقوم المحرك بالربط مع سجلات الحضور لاحتساب خصومات التأخير والغياب ونسيان بصمة الانصراف، والوقت الإضافي إذا فعّلته الإدارة.
                </p>
              </div>

              {/* Controls: Month/Year & Generate Button */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Year Select */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-2xl border border-border/60 bg-surface px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>

                {/* Month Select */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-2xl border border-border/60 bg-surface px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>

                {/* Generate Payroll Action */}
                {canManage && (
                  <button
                    onClick={handleGeneratePayroll}
                    disabled={generatePayrollMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    {generatePayrollMutation.isPending ? (
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <FiRefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {generatePayrollMutation.isPending
                        ? 'جاري الاحتساب...'
                        : 'احتساب وتوليد المسير'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Cycle Selector Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black text-foreground-muted whitespace-nowrap">
                المسيرات المتاحة:
              </span>
              {isCyclesLoading ? (
                <span className="text-xs text-foreground-subtle">
                  جاري تحميل المسيرات...
                </span>
              ) : !cycles || cycles.length === 0 ? (
                <span className="text-xs text-foreground-subtle">
                  لم يتم توليد أي مسير رواتب لعام {selectedYear} حتى الآن. اضغط على &quot;احتساب وتوليد المسير&quot;.
                </span>
              ) : (
                cycles.map((c) => {
                  const isCurrent = c.id === activeCycleId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCycleId(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-surface hover:bg-surface-hover text-foreground border border-border/40'
                      }`}
                    >
                      <FiCalendar className="h-3.5 w-3.5" />
                      <span>
                        {monthNames[c.month - 1]} / {c.year}
                      </span>
                      <span className="text-[10px] font-mono opacity-80">
                        ({c._count?.payslips ?? 0} موظف)
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Metric Summary Cards for Selected Cycle */}
          {activeCycle && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Gross */}
              <Card className="p-4 flex items-center justify-between glass-card border border-border/40 shadow-sm">
                <div>
                  <span className="text-xs font-bold text-foreground-muted block mb-1">
                    إجمالي المستحقات (Gross Pay)
                  </span>
                  <div className="text-xl font-black font-mono text-foreground">
                    {cycleStats.gross.toLocaleString('ar-EG', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    <span className="text-xs font-normal">ج.م</span>
                  </div>
                  <span className="text-[10px] text-foreground-subtle block mt-0.5">
                    إجمالي الرواتب الشهرية المعتمدة
                  </span>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <FiDollarSign className="h-5 w-5" />
                </div>
              </Card>

              {/* Card 2: Attendance Deductions (Highlighted Red) */}
              <Card className="p-4 flex items-center justify-between glass-card border border-rose-500/20 bg-rose-500/[0.03] shadow-sm">
                <div>
                  <span className="text-xs font-bold text-rose-500 block mb-1 flex items-center gap-1">
                    <FiAlertCircle className="h-3.5 w-3.5" />
                    <span>خصومات التأخير والحضور</span>
                  </span>
                  <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                    -{cycleStats.penalties.toLocaleString('ar-EG', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    <span className="text-xs font-normal">ج.م</span>
                  </div>
                  <span className="text-[10px] text-rose-500/80 block mt-0.5 font-bold">
                    مرتبطة بدقائق تأخير سجل البصمة
                  </span>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                  <FiTrendingDown className="h-5 w-5" />
                </div>
              </Card>

              {/* Card 3: Total Net Disbursement */}
              <Card className="p-4 flex items-center justify-between glass-card border border-emerald-500/20 bg-emerald-500/[0.03] shadow-sm">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                    صافي الرواتب القابلة للصرف
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {cycleStats.net.toLocaleString('ar-EG', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    <span className="text-xs font-normal">ج.م</span>
                  </div>
                  <span className="text-[10px] text-foreground-subtle block mt-0.5">
                    إجمالي المسير بعد كافة الخصومات
                  </span>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <FiArrowUpRight className="h-5 w-5" />
                </div>
              </Card>

              {/* Card 4: Cycle Status & Lock Action */}
              <Card className="p-4 flex items-center justify-between glass-card border border-border/40 shadow-sm">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground-muted block">
                    حالة المسير الإداري
                  </span>
                  <div>{getCycleStatusBadge(activeCycle.status)}</div>
                  {activeCycle.approvedAt && (
                    <span className="text-[10px] text-foreground-subtle block font-mono">
                      اعتمد بتاريخ:{' '}
                      {new Date(activeCycle.approvedAt).toLocaleDateString('ar-EG')}
                    </span>
                  )}
                </div>

                {canManage && activeCycle.status === 'DRAFT' && (
                  <button
                    onClick={() => setIsApproveModalOpen(true)}
                    className="px-3 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-xs active:scale-95 transition-all flex items-center gap-1"
                    title="قفل واعتماد المسير"
                  >
                    <FiCheck className="h-3.5 w-3.5" />
                    <span>اعتماد المسير</span>
                  </button>
                )}
              </Card>
            </div>
          )}

          {/* ================================================================= */}
          {/* COMPLEX DATA TABLE: ALL GENERATED SALARIES (FULL WIDTH)           */}
          {/* ================================================================= */}
          <div className="w-full space-y-4">
            <div className="rounded-3xl glass-card p-5 space-y-4 border border-border/40 shadow-sm">
              {/* Table Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
                <div>
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <FiLayers className="h-4 w-4 text-primary" />
                    <span>جدول الرواتب التفصيلي (Payroll DataTable)</span>
                    {activeCycle && (
                      <span className="text-xs text-foreground-muted font-mono font-normal">
                        — لشهر {monthNames[activeCycle.month - 1]} / {activeCycle.year}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-foreground-muted mt-0.5">
                    قائمة بكافة العاملين المحتسب لهم رواتب مع بيان تفصيلي للاستحقاقات واستقطاعات التأخير.
                  </p>
                </div>

                {/* Search & Department Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <FiSearch className="absolute right-3 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="بحث بالاسم أو الكود..."
                      className="rounded-2xl border border-border/60 bg-surface pr-8 pl-3 py-1.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:border-primary w-44 sm:w-56"
                    />
                  </div>

                  {availableDepartments.length > 0 && (
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="rounded-2xl border border-border/60 bg-surface px-3 py-1.5 text-xs text-foreground font-bold focus:outline-none focus:border-primary"
                    >
                      <option value="">كافة الأقسام</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Table Body */}
              {isCycleLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-foreground-muted space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold">
                    جاري تحميل سجلات الرواتب...
                  </span>
                </div>
              ) : !activeCycle || filteredPayslips.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-surface/40 border border-border/20 space-y-2">
                  <FiCreditCard className="h-8 w-8 mx-auto text-foreground-subtle" />
                  <h4 className="text-xs font-black text-foreground">
                    لا توجد قسائم رواتب مطابقة
                  </h4>
                  <p className="text-[11px] text-foreground-muted">
                    قم بتوليد مسير الرواتب للشهر المطلوب أو عدل معايير البحث.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-surface/40 shadow-xs">
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-start text-xs leading-relaxed">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-border/40 bg-surface/95 dark:bg-[#181814]/95 backdrop-blur-md text-[11px] font-black text-foreground-muted">
                          <th className="py-3 px-3.5 text-start whitespace-nowrap">
                            الموظف (Employee)
                          </th>
                          <th className="py-3 px-3.5 text-start whitespace-nowrap">
                            الراتب الشهري (Salary)
                          </th>
                          <th className="py-3 px-3.5 text-start whitespace-nowrap">
                            خصم التأخير (Attendance)
                          </th>
                          <th className="py-3 px-3.5 text-start whitespace-nowrap">
                            الصافي المستحق للصرف (Net Pay)
                          </th>
                          <th className="py-3 px-3.5 text-center whitespace-nowrap">
                            الإجراء
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {filteredPayslips.map((slip) => {
                          const penalties = Number(slip.attendancePenalties || 0);
                          const hasPenalties = penalties > 0;

                          return (
                            <tr
                              key={slip.id}
                              className="hover:bg-surface-hover/80 transition-colors group"
                            >
                              {/* 1. Employee Name & Metadata */}
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0 overflow-hidden">
                                    {slip.employee?.avatarUrl ? (
                                      <img
                                        src={slip.employee.avatarUrl}
                                        alt={slip.employee.fullName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      slip.employee?.fullName.charAt(0) || 'م'
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-black text-xs text-foreground">
                                      {slip.employee?.fullName}
                                    </div>
                                    <div className="text-[10px] text-foreground-muted flex items-center gap-1">
                                      <span className="font-mono">
                                        #{slip.employee?.employeeCode}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {slip.employee?.department?.name || 'القسم العام'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Monthly Salary */}
                              <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-foreground font-bold">
                                {Number(slip.baseSalary).toLocaleString('ar-EG', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                <span className="text-[10px] font-normal text-foreground-muted">ج.م</span>
                              </td>

                              {/* 3. Attendance Deductions (HIGHLIGHTED IN RED) */}
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                {hasPenalties ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-2xs">
                                    <FiTrendingDown className="h-3 w-3" />
                                    <span>
                                      -{penalties.toLocaleString('ar-EG', {
                                        minimumFractionDigits: 2,
                                      })}{' '}
                                      ج.م
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-foreground-subtle text-[11px] font-mono">
                                    0.00 ج.م
                                  </span>
                                )}
                              </td>

                              {/* 4. Net Pay */}
                              <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                {Number(slip.netPay).toLocaleString('ar-EG', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                <span className="text-[10px] font-normal text-foreground-muted">ج.م</span>
                              </td>

                              {/* 5. Action: View Details Modal */}
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setActivePayslipDetails(slip)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-surface hover:bg-surface-hover border border-border/40 text-primary transition-all shadow-2xs active:scale-95"
                                >
                                  <FiEye className="h-3 w-3" />
                                  <span>بيان القسيمة</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. PERSPECTIVE B: EMPLOYEE SELF-SERVICE (MY PAYSLIPS)                 */}
      {/* ===================================================================== */}
      {activeTab === 'SELF_SERVICE' && (
        <div className="space-y-6">
          <div className="rounded-3xl glass-card p-5 border border-border/40 shadow-sm space-y-1">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <FiUser className="h-4 w-4 text-primary" />
              <span>سجل قسائم رواتبي الذاتية وتفاصيل الاستقطاعات</span>
            </h2>
            <p className="text-[11px] text-foreground-muted leading-relaxed">
              استعراض شفاف ومفصل لكافة رواتبك الشهرية ومفردات المرتب، مع بيان توضيحي لأسباب وتواريخ أي خصومات (تأخيرات أو جزاءات).
            </p>
          </div>

          {isMyPayslipsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground-muted space-y-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs font-bold">جاري جلب قسائم الرواتب...</span>
            </div>
          ) : !myPayslips || myPayslips.length === 0 ? (
            <div className="p-16 text-center rounded-3xl glass-card border border-border/40 space-y-2">
              <FiCreditCard className="h-10 w-10 mx-auto text-foreground-subtle" />
              <h3 className="text-sm font-black text-foreground">
                لا توجد أي قسائم رواتب مصدرة لحسابك حتى الآن
              </h3>
              <p className="text-xs text-foreground-muted">
                تظهر قسيمة الراتب فور احتساب مسير الشهر، وقد تتغير قيمتها إلى أن يتم اعتماد المسير.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myPayslips.map((slip) => {
                const cycle = slip.payrollCycle;
                const penalties = Number(slip.attendancePenalties || 0);
                const hasPenalties = penalties > 0;

                return (
                  <div
                    key={slip.id}
                    className="rounded-3xl glass-card p-5 border border-border/40 shadow-sm hover:border-primary/40 transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Month & Year Header */}
                      <div className="flex items-center justify-between border-b border-border/20 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            <FiCalendar className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-foreground">
                              {cycle ? `${monthNames[cycle.month - 1]} / ${cycle.year}` : 'مسير الراتب'}
                            </h4>
                            <span className="text-[10px] text-foreground-muted">
                              تاريخ الاحتساب:{' '}
                              {new Date(slip.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                          </div>
                        </div>

                        {cycle && getCycleStatusBadge(cycle.status)}
                      </div>

                      {/* Net Pay Hero */}
                      <div className="p-3.5 rounded-2xl bg-surface/80 border border-border/30 text-center space-y-0.5">
                        <span className="text-[11px] text-foreground-muted font-bold block">
                          الصافي المستحق للصرف
                        </span>
                        <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {Number(slip.netPay).toLocaleString('ar-EG', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          <span className="text-xs font-normal">ج.م</span>
                        </div>
                      </div>

                      {/* Base Salary Row */}
                      <div className="p-2.5 rounded-xl bg-surface/40 border border-border/20 flex items-center justify-between text-xs font-mono">
                        <span className="text-[11px] text-foreground-muted">
                          الراتب الشهري:
                        </span>
                        <span className="font-bold text-foreground">
                          {Number(slip.baseSalary).toLocaleString('ar-EG', {
                            minimumFractionDigits: 2,
                          })} ج.م
                        </span>
                      </div>

                      {/* Attendance Penalties Section (Highlight) */}
                      {hasPenalties && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                            <span className="flex items-center gap-1">
                              <FiTrendingDown className="h-3 w-3" />
                              <span>استقطاعات تأخير الحضور</span>
                            </span>
                            <span className="font-mono font-black">
                              -{penalties.toLocaleString('ar-EG', {
                                minimumFractionDigits: 2,
                              })} ج.م
                            </span>
                          </div>

                          {/* Specific list of delay reasons */}
                          <div className="space-y-1 pt-1 border-t border-rose-500/15 text-[10px] text-rose-500/90 font-mono">
                            {slip.adjustments
                              ?.filter((a) => a.type === 'PENALTY' && a.reason.includes('تأخير'))
                              .map((adj) => (
                                <div key={adj.id} className="flex items-center justify-between">
                                  <span>{adj.reason}</span>
                                  <span className="font-black">
                                    -{Number(adj.amount).toFixed(2)} ج.م
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action */}
                    <button
                      onClick={() => setActivePayslipDetails(slip)}
                      className="w-full py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border/40 text-xs font-black text-primary transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs mt-2"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      <span>عرض قسيمة الراتب الرسمية</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. DETAILED PAYSLIP BREAKDOWN MODAL (PRINTABLE STANDARD)              */}
      {/* ===================================================================== */}
      {activePayslipDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/95 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiCreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    قسيمة الراتب الرسمية (Official Payslip)
                  </h3>
                  <p className="text-[11px] text-foreground-muted">
                    كشف حساب استحقاقات واستقطاعات الموظف الشهرية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePayslipDetails(null)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Printable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-xs" id="printable-payslip">
              {/* Company & Employee Identity Banner */}
              <div className="p-4 rounded-2xl bg-surface/80 border border-border/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider block">
                      Tawfeer ERP • Payroll Division
                    </span>
                    <h4 className="text-base font-black text-foreground">
                      {activePayslipDetails.employee?.fullName}
                    </h4>
                    <span className="text-[11px] text-foreground-muted font-mono">
                      كود الموظف: #{activePayslipDetails.employee?.employeeCode}
                    </span>
                  </div>
                  <div className="text-start text-xs font-mono text-foreground-muted">
                    <div>
                      القسم:{' '}
                      <span className="font-bold text-foreground">
                        {activePayslipDetails.employee?.department?.name || 'العام'}
                      </span>
                    </div>
                    {activePayslipDetails.employee?.position?.name && (
                      <div>
                        المسمى:{' '}
                        <span className="font-bold text-foreground">
                          {activePayslipDetails.employee.position.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. المستحقات (Earnings) */}
                <div className="rounded-2xl border border-border/40 p-3.5 bg-surface/40 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/20 pb-2">
                    <span className="font-black text-xs text-foreground flex items-center gap-1.5">
                      <FiTrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span>المستحقات (Earnings)</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      +{Number(activePayslipDetails.grossPay).toLocaleString('ar-EG', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      ج.م
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-muted">الراتب الشهري المعتمد:</span>
                      <span className="font-bold text-foreground">
                        {Number(activePayslipDetails.baseSalary).toFixed(2)} ج.م
                      </span>
                    </div>

                    {/* Additions: overtime, task commissions and bonuses */}
                    {activePayslipDetails.adjustments
                      ?.filter((a) => a.type === 'OVERTIME' || a.type === 'COMMISSION' || a.type === 'BONUS')
                      .map((adj) => (
                        <div
                          key={adj.id}
                          className="flex items-center justify-between text-emerald-600 dark:text-emerald-400"
                        >
                          <span className="text-[10px]">{adj.reason}</span>
                          <span className="font-bold">+{Number(adj.amount).toFixed(2)} ج.م</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* 2. الاستقطاعات (Deductions) */}
                <div className="rounded-2xl border border-rose-500/20 p-3.5 bg-rose-500/[0.02] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                    <span className="font-black text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <FiTrendingDown className="h-3.5 w-3.5" />
                      <span>الاستقطاعات (Deductions)</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                      -{Number(activePayslipDetails.totalDeductions).toLocaleString('ar-EG', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      ج.م
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    {/* Attendance Penalties Breakdown */}
                    {Number(activePayslipDetails.attendancePenalties) > 0 && (
                      <div className="flex items-center justify-between text-rose-500 font-bold">
                        <span>إجمالي خصم التأخير:</span>
                        <span>
                          -{Number(activePayslipDetails.attendancePenalties).toFixed(2)} ج.م
                        </span>
                      </div>
                    )}

                    {/* Itemized delay penalties */}
                    {activePayslipDetails.adjustments
                      ?.filter((a) => a.type === 'PENALTY')
                      .map((adj) => (
                        <div
                          key={adj.id}
                          className="flex items-center justify-between text-rose-600/90 dark:text-rose-400/90 text-[10px]"
                        >
                          <span>{adj.reason}</span>
                          <span className="font-bold">-{Number(adj.amount).toFixed(2)} ج.م</span>
                        </div>
                      ))}

                    {Number(activePayslipDetails.totalDeductions) === 0 && (
                      <div className="text-center text-foreground-subtle py-2">
                        لا توجد أي خصومات على هذا الراتب
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Net Pay Final Bar */}
              <div className="p-4 rounded-2xl bg-surface/90 border border-border/40 flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-xs font-bold text-foreground-muted block">
                    الصافي القابل للصرف (Net Payment)
                  </span>
                  <span className="text-[10px] text-foreground-subtle">
                    يودع بالحساب البنكي المعتمد للموظف
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {Number(activePayslipDetails.netPay).toLocaleString('ar-EG', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  <span className="text-sm font-normal text-foreground">ج.م</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border/40 text-xs font-bold text-foreground transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <FiPrinter className="h-3.5 w-3.5" />
                <span>طباعة القسيمة</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePayslipDetails(null)}
                className="px-4 py-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black shadow-xs transition-all active:scale-95"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. APPROVE & LOCK CONFIRMATION MODAL                                  */}
      {/* ===================================================================== */}
      {isApproveModalOpen && activeCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/95 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent z-10" />

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <FiCheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground">
                    تأكيد اعتماد وقفل مسير الرواتب
                  </h3>
                  <p className="text-[11px] text-foreground-muted">
                    شهر {monthNames[activeCycle.month - 1]} / {activeCycle.year}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface/80 border border-border/40 text-xs space-y-2 text-foreground-muted leading-relaxed">
                <p>
                  بمجرد اعتماد المسير، سيتم <span className="text-foreground font-bold">قفل كافة قسائم الرواتب نهائياً</span> ومنع أي تعديلات أو إعادة احتساب مستقبلية لهذا الشهر.
                </p>
                <div className="font-mono text-xs font-bold text-foreground border-t border-border/20 pt-2 flex items-center justify-between">
                  <span>إجمالي الصافي المعتمد:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {cycleStats.net.toLocaleString('ar-EG', {
                      minimumFractionDigits: 2,
                    })}{' '}
                    ج.م
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-surface hover:bg-surface-hover border border-border/40 text-xs font-bold text-foreground transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApproveCycle}
                  disabled={approveCycleMutation.isPending}
                  className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {approveCycleMutation.isPending ? 'جاري الاعتماد...' : 'نعم، اعتماد وقفل المسير'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
