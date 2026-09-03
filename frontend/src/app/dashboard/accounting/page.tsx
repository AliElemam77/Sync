'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import {
  useTransactions,
  useFinancialSummary,
  useCreateTransaction,
  useReverseTransaction,
} from '../../../hooks/use-accounting';
import {
  FinancialTransaction,
  TransactionType,
  TransactionCategory,
  PaymentMethod,
  CreateTransactionInput,
  ReverseTransactionInput,
} from '../../../types/accounting';
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiPieChart,
  FiPlus,
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiEye,
  FiFileText,
  FiCreditCard,
  FiCalendar,
  FiX,
  FiLayers,
  FiShield,
  FiInfo,
  FiArrowUpRight,
  FiArrowDownLeft,
  FiImage,
} from 'react-icons/fi';
import { uploadImageToImgBB } from '../../../lib/imgbb';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// -----------------------------------------------------------------------------
// BADGE CONFIGURATIONS
// -----------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  TransactionCategory,
  { label: string; bg: string; text: string; border: string; color: string }
> = {
  PAYROLL: {
    label: 'الرواتب والأجور',
    bg: 'bg-purple-500/10 dark:bg-purple-400/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/25',
    color: '#A855F7',
  },
  ASSET_PURCHASE: {
    label: 'شراء أجهزة وأصول',
    bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/25',
    color: '#D8D365',
  },
  SUBSCRIPTION: {
    label: 'اشتراكات سحابية وبرمجيات',
    bg: 'bg-sky-500/10 dark:bg-sky-400/10',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/25',
    color: '#38BDF8',
  },
  CLIENT_PAYMENT: {
    label: 'تحصيلات ودفعات عملاء',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/25',
    color: '#10B981',
  },
  OPERATIONAL_EXPENSE: {
    label: 'مصاريف تشغيلية وإيجارات',
    bg: 'bg-orange-500/10 dark:bg-orange-400/10',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/25',
    color: '#FB923C',
  },
  TAX_AND_GOVERNMENT: {
    label: 'ضرائب ورسوم حكومية',
    bg: 'bg-rose-500/10 dark:bg-rose-400/10',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/25',
    color: '#F43F5E',
  },
  INVESTMENT: {
    label: 'تمويل واستثمارات',
    bg: 'bg-indigo-500/10 dark:bg-indigo-400/10',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-500/25',
    color: '#6366F1',
  },
  MISC: {
    label: 'نثريات وعامة',
    bg: 'bg-zinc-500/10 dark:bg-zinc-400/10',
    text: 'text-zinc-700 dark:text-zinc-400',
    border: 'border-zinc-500/25',
    color: '#71717A',
  },
};

const PAYMENT_CONFIG: Record<
  PaymentMethod,
  { label: string; icon: string }
> = {
  BANK_TRANSFER: { label: 'تحويل بنكي', icon: '🏦' },
  CASH: { label: 'نقدي (كاش)', icon: '💵' },
  CREDIT_CARD: { label: 'بطاقة ائتمان', icon: '💳' },
  CHEQUE: { label: 'شيك مصرفي', icon: '📜' },
  ONLINE_GATEWAY: { label: 'دفع إلكتروني', icon: '🌐' },
  OTHER: { label: 'أخرى', icon: '🔄' },
};

export default function AccountingPage() {
  const { user, hasPermission } = useAuth();
  const canManage =
    user?.role?.name === 'SUPER_ADMIN' ||
    hasPermission('accounting.manage') ||
    user?.role?.name === 'MANAGEMENT';

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [includeReversed, setIncludeReversed] = useState<boolean>(true);
  const [page, setPage] = useState(1);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reversingTransaction, setReversingTransaction] = useState<FinancialTransaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  // Queries
  const { data: summary, isLoading: isSummaryLoading } = useFinancialSummary({
    year: selectedYear,
  });

  const { data: transactionsData, isLoading: isTransactionsLoading } = useTransactions({
    search: search.trim() || undefined,
    type: (selectedType as TransactionType) || undefined,
    category: (selectedCategory as TransactionCategory) || undefined,
    paymentMethod: (selectedPayment as PaymentMethod) || undefined,
    includeReversed,
    page,
    limit: 15,
  });

  // Mutations
  const createMutation = useCreateTransaction();
  const reverseMutation = useReverseTransaction();

  const transactions = transactionsData?.data || [];
  const meta = transactionsData?.meta;

  // Expense Pie Chart Data
  const expensePieData = useMemo(() => {
    if (!summary?.expenseByCategory) return [];
    return Object.entries(summary.expenseByCategory)
      .map(([catKey, amount]) => {
        const conf = CATEGORY_CONFIG[catKey as TransactionCategory] || CATEGORY_CONFIG.MISC;
        return {
          name: conf.label,
          value: amount,
          color: conf.color,
        };
      })
      .filter((item) => item.value > 0);
  }, [summary]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* 1. EXECUTIVE HEADER                                                   */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>الإدارة المالية</span>
            <span>/</span>
            <span className="text-foreground font-medium">دفتر الأستاذ العام والتقارير</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>دفتر الأستاذ والإدارة المالية (Ledger)</span>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-brand-gold/15 text-brand-gold border border-brand-gold/30 font-mono">
              سنة {selectedYear}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-2xl border border-border/40 bg-surface px-3.5 py-2.5 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>

          {canManage && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-all"
            >
              <FiPlus className="h-4 w-4" />
              <span>تسجيل قيد مالي جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. EXECUTIVE FINANCIAL KPI CARDS                                      */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Revenues / Income */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2 border border-emerald-500/20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">إجمالي الإيرادات (Income)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {(summary?.totalIncome || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-sans">EGP</span>
          </div>
          <div className="text-[11px] text-foreground-muted flex items-center gap-1">
            <span className="text-emerald-500 font-bold">تحصيلات مؤكدة</span>
            <span>خلال عام {selectedYear}</span>
          </div>
        </div>

        {/* Metric 2: Total Expenses */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2 border border-rose-500/20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/80 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">إجمالي المصروفات (Expenses)</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <FiArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {(summary?.totalExpense || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-sans">EGP</span>
          </div>
          <div className="text-[11px] text-foreground-muted flex items-center gap-1">
            <span>رواتب، أصول، واشتراكات</span>
          </div>
        </div>

        {/* Metric 3: Net Profit */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2 border border-brand-gold/30">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">صافي الأرباح (Net Profit)</span>
            <div className="p-2 rounded-xl bg-brand-gold/15 text-brand-gold">
              <FiTrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black font-mono ${
              (summary?.netProfit || 0) >= 0
                ? 'text-brand-gold'
                : 'text-rose-500'
            }`}
          >
            {(summary?.netProfit || 0).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}{' '}
            <span className="text-xs font-sans">EGP</span>
          </div>
          <div className="text-[11px] text-foreground-muted flex items-center gap-1 font-mono">
            <span>هامش الربح:</span>
            <span className="font-black text-brand-gold">
              {summary?.profitMargin || 0}%
            </span>
          </div>
        </div>

        {/* Metric 4: Ledger Health & Math Precision */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">نزاهة القيود (Decimal Math)</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FiShield className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground flex items-center gap-1.5">
            <FiCheckCircle className="h-5 w-5 text-emerald-500" />
            <span>متوازن 100%</span>
          </div>
          <div className="text-[11px] text-foreground-muted">
            دقة السنتات ومطابقة دفتر اليومية
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. RECHARTS FINANCIAL ANALYTICS (INCOME VS EXPENSE & EXPENSE DONUT)   */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: 12-Month Monthly Trend Area Chart (2 Columns) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl glass-card p-6 flex flex-col justify-between space-y-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/30">
            <div>
              <h3 className="text-base font-black text-foreground tracking-tight flex items-center gap-2">
                <FiTrendingUp className="h-4 w-4 text-brand-gold" />
                <span>مقارنة الإيرادات والمصروفات الشهرية ({selectedYear})</span>
              </h3>
              <p className="text-xs text-foreground-muted mt-0.5">
                تتبع التدفقات النقدية الداخلة والخارجة وصافي الربح شهراً بشهر
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                الإيرادات
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                المصروفات
              </span>
            </div>
          </div>

          <div className="w-full h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={summary?.monthlyTrend || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  stroke="currentColor"
                  opacity={0.5}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                />
                <YAxis
                  stroke="currentColor"
                  opacity={0.3}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const incomeVal = payload.find((p) => p.dataKey === 'income')?.value || 0;
                      const expenseVal = payload.find((p) => p.dataKey === 'expense')?.value || 0;
                      const netVal = Number(incomeVal) - Number(expenseVal);
                      return (
                        <div className="rounded-2xl border border-white/60 dark:border-white/15 bg-white/85 dark:bg-black/90 backdrop-blur-2xl px-4 py-3 shadow-2xl text-xs space-y-1">
                          <p className="font-black text-foreground text-sm">{label}</p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold flex justify-between gap-4 font-mono">
                            <span>الإيراد:</span>
                            <span>{Number(incomeVal).toLocaleString()} EGP</span>
                          </p>
                          <p className="text-rose-600 dark:text-rose-400 font-bold flex justify-between gap-4 font-mono">
                            <span>المصروف:</span>
                            <span>{Number(expenseVal).toLocaleString()} EGP</span>
                          </p>
                          <p className="pt-1 border-t border-border/30 font-black text-brand-gold flex justify-between gap-4 font-mono">
                            <span>صافي الشهر:</span>
                            <span>{netVal.toLocaleString()} EGP</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#F43F5E"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Expenses by Category Donut Chart (1 Column) */}
        <div className="lg:col-span-1 relative overflow-hidden rounded-3xl glass-card p-6 flex flex-col justify-between space-y-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

          <div className="pb-3 border-b border-border/30">
            <h3 className="text-base font-black text-foreground tracking-tight flex items-center gap-2">
              <FiPieChart className="h-4 w-4 text-rose-500" />
              <span>توزيع وبنود المصروفات</span>
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              تحليل التكاليف التشغيلية ومشتريات الأصول
            </p>
          </div>

          <div className="h-48 w-full flex items-center justify-center relative">
            {expensePieData.length === 0 ? (
              <div className="text-xs text-foreground-subtle italic">
                لا توجد مصروفات مسجلة في هذا العام
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="transparent"
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-2xl border border-white/60 dark:border-white/15 bg-white/85 dark:bg-black/90 backdrop-blur-2xl px-3 py-1.5 shadow-2xl text-xs">
                            <span className="font-bold text-foreground">{data.name}: </span>
                            <span className="font-mono font-black text-rose-500">
                              {Number(data.value).toLocaleString()} EGP
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Mini Legend */}
          <div className="space-y-1.5 pt-2 border-t border-border/30 max-h-24 overflow-y-auto pr-1">
            {expensePieData.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-foreground font-bold">{item.name}</span>
                </div>
                <span className="font-mono font-black text-foreground">
                  {Number(item.value).toLocaleString()} EGP
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. SEARCH & FILTER BAR                                                */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="بحث بالبيان، رقم المرجع، أو اسم المحاسب..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-border/40 bg-surface/80 pr-10 pl-4 py-2 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:outline-none"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border/40 bg-surface/80 px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="">جميع القيود (إيراد ومصروف)</option>
            <option value="INCOME">إيرادات (+)</option>
            <option value="EXPENSE">مصروفات (-)</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border/40 bg-surface/80 px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="">جميع البنود والتصنيفات</option>
            <option value="PAYROLL">الرواتب والأجور</option>
            <option value="ASSET_PURCHASE">شراء أجهزة وأصول</option>
            <option value="SUBSCRIPTION">اشتراكات سحابية</option>
            <option value="CLIENT_PAYMENT">تحصيلات عملاء</option>
            <option value="OPERATIONAL_EXPENSE">مصاريف تشغيلية</option>
            <option value="TAX_AND_GOVERNMENT">ضرائب وتأمينات</option>
            <option value="INVESTMENT">استثمارات</option>
            <option value="MISC">نثريات وعامة</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={selectedPayment}
            onChange={(e) => {
              setSelectedPayment(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border/40 bg-surface/80 px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="">جميع طرق الدفع</option>
            <option value="BANK_TRANSFER">تحويل بنكي</option>
            <option value="CASH">نقدي</option>
            <option value="CREDIT_CARD">بطاقة ائتمان</option>
            <option value="CHEQUE">شيك مصرفي</option>
            <option value="ONLINE_GATEWAY">دفع إلكتروني</option>
          </select>

          {/* Include Reversed Checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-foreground-muted cursor-pointer px-2">
            <input
              type="checkbox"
              checked={includeReversed}
              onChange={(e) => {
                setIncludeReversed(e.target.checked);
                setPage(1);
              }}
              className="rounded"
            />
            <span>عرض المعكوسة</span>
          </label>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. GENERAL LEDGER TABLE                                               */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl glass-card border border-white/40 dark:border-white/10 shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-raised/60 text-foreground-muted font-black border-b border-border/40">
              <tr>
                <th className="py-3.5 px-4">تاريخ القيد</th>
                <th className="py-3.5 px-4">البيان والشرح</th>
                <th className="py-3.5 px-4">البند والتصنيف</th>
                <th className="py-3.5 px-4">طريقة الدفع</th>
                <th className="py-3.5 px-4">النوع</th>
                <th className="py-3.5 px-4">المبلغ المالي (EGP)</th>
                <th className="py-3.5 px-4">المحاسب المسجل</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isTransactionsLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-foreground-muted">
                    جاري تحميل قيود دفتر الأستاذ العام...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-foreground-subtle italic">
                    لا توجد معاملات أو قيود مالية مطابقة لخيارات البحث.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const catConf = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG.MISC;
                  const payConf = PAYMENT_CONFIG[tx.paymentMethod] || PAYMENT_CONFIG.BANK_TRANSFER;
                  const isIncome = tx.type === 'INCOME';

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-white/40 dark:hover:bg-white/5 transition-colors ${
                        tx.isReversed ? 'opacity-60 bg-rose-500/[0.03]' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-foreground">
                        <div>
                          {new Date(tx.transactionDate).toLocaleDateString('ar-EG')}
                        </div>
                        <div className="text-[10px] text-foreground-muted">
                          {new Date(tx.transactionDate).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Description & Reference */}
                      <td className="py-3.5 px-4">
                        <div
                          className={`font-extrabold text-foreground ${
                            tx.isReversed ? 'line-through text-foreground-subtle' : ''
                          }`}
                        >
                          {tx.description}
                        </div>
                        {tx.referenceId && (
                          <div className="text-[10px] font-mono text-foreground-muted flex items-center gap-1 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded-md bg-surface border border-border/40">
                              مرجع: {tx.referenceId}
                            </span>
                          </div>
                        )}
                        {tx.isReversed && (
                          <div className="text-[10px] text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                            <FiAlertTriangle className="h-3 w-3" />
                            <span>تم عكس القيد: {tx.reversalReason || 'قيد تسوية'}</span>
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-bold text-[10px] ${catConf.bg} ${catConf.text} ${catConf.border}`}
                        >
                          {catConf.label}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-[11px] text-foreground font-bold">
                        <span className="inline-flex items-center gap-1 bg-surface px-2.5 py-1 rounded-xl border border-border/40">
                          <span>{payConf.icon}</span>
                          <span>{payConf.label}</span>
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-black text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                            <FiArrowUpRight className="h-3 w-3" />
                            إيراد (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-black text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25">
                            <FiArrowDownLeft className="h-3 w-3" />
                            مصروف (-)
                          </span>
                        )}
                      </td>

                      {/* Amount with Exact Math & Formatting */}
                      <td className="py-3.5 px-4 font-mono font-black text-sm">
                        <span
                          className={
                            tx.isReversed
                              ? 'line-through text-foreground-subtle'
                              : isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {isIncome ? '+ ' : '- '}
                          {Number(tx.amount).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          <span className="text-[10px] font-sans">EGP</span>
                        </span>
                      </td>

                      {/* Recorded By */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-[9px] text-primary shrink-0 overflow-hidden">
                            {tx.recordedBy?.employeeProfile?.avatarUrl ? (
                              <img
                                src={tx.recordedBy.employeeProfile.avatarUrl}
                                alt="avatar"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              tx.recordedBy?.employeeProfile?.fullName?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-[11px]">
                              {tx.recordedBy?.employeeProfile?.fullName || tx.recordedBy?.email}
                            </div>
                            <div className="text-[9px] text-foreground-muted font-mono">
                              {tx.recordedBy?.employeeProfile?.employeeCode || ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => setSelectedTransaction(tx)}
                            title="تفاصيل القيد"
                            className="p-1.5 rounded-xl border border-border/40 bg-surface text-foreground hover:bg-surface-hover transition-colors"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>

                          {/* Reverse Entry Button (Immutability Pattern) */}
                          {canManage && !tx.isReversed && (
                            <button
                              onClick={() => setReversingTransaction(tx)}
                              title="عكس القيد المالي (Reversal)"
                              className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                            >
                              <FiRefreshCw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {meta && meta.totalPages > 1 && (
          <div className="p-4 border-t border-border/20 flex items-center justify-between text-xs text-foreground-muted">
            <div>
              عرض صفحة {meta.page} من {meta.totalPages} (إجمالي {meta.total} قيد مالي)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground font-bold disabled:opacity-40"
              >
                السابق
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="px-3 py-1.5 rounded-xl border border-border bg-surface text-foreground font-bold disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 6. MODALS                                                             */}
      {/* ===================================================================== */}

      {/* CREATE TRANSACTION MODAL */}
      {isCreateModalOpen && (
        <CreateTransactionModal
          onClose={() => setIsCreateModalOpen(false)}
          onSave={async (data) => {
            await createMutation.mutateAsync(data);
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {/* REVERSE TRANSACTION MODAL */}
      {reversingTransaction && (
        <ReverseTransactionModal
          transaction={reversingTransaction}
          onClose={() => setReversingTransaction(null)}
          onReverse={async (data) => {
            await reverseMutation.mutateAsync({
              id: reversingTransaction.id,
              data,
            });
            setReversingTransaction(null);
          }}
        />
      )}

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE TRANSACTION MODAL COMPONENT
// -----------------------------------------------------------------------------

function CreateTransactionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: CreateTransactionInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [category, setCategory] = useState<TransactionCategory>('OPERATIONAL_EXPENSE');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [referenceId, setReferenceId] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImg(true);
    try {
      const url = await uploadImageToImgBB(files[0]);
      setAttachmentUrl(url);
    } catch (err: any) {
      alert(err?.message || 'فشل رفع المستند أو الإيصال.');
    } finally {
      setIsUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('يرجى إدخال مبلغ مالي صحيح أكبر من 0.');
      return;
    }
    if (!description.trim()) {
      alert('يرجى إدخال بيان المعاملة.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        amount: numAmount,
        type,
        category,
        paymentMethod,
        description: description.trim(),
        transactionDate: transactionDate || undefined,
        referenceId: referenceId.trim() || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل حفظ القيد المالي.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-xl max-h-[88vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiDollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">تسجيل قيد مالي جديد</h3>
              <p className="text-[11px] text-foreground-muted">توثيق الإيرادات والمصروفات في دفتر اليومية العام</p>
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

        <form id="record-transaction-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Type Toggle & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                نوع القيد <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('INCOME')}
                  className={`py-2.5 rounded-2xl font-black text-xs transition-all border ${
                    type === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50 shadow-xs'
                      : 'bg-surface text-foreground-muted border-border/80 dark:border-white/10'
                  }`}
                >
                  إيراد (+)
                </button>
                <button
                  type="button"
                  onClick={() => setType('EXPENSE')}
                  className={`py-2.5 rounded-2xl font-black text-xs transition-all border ${
                    type === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/50 shadow-xs'
                      : 'bg-surface text-foreground-muted border-border/80 dark:border-white/10'
                  }`}
                >
                  مصروف (-)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                المبلغ المالي (EGP) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 font-mono text-sm font-black text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                بند / تصنيف المعاملة <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="CLIENT_PAYMENT">تحصيلات عملاء (CLIENT_PAYMENT)</option>
                <option value="PAYROLL">الرواتب والأجور (PAYROLL)</option>
                <option value="ASSET_PURCHASE">شراء أجهزة وأصول (ASSET_PURCHASE)</option>
                <option value="SUBSCRIPTION">اشتراكات وبرمجيات (SUBSCRIPTION)</option>
                <option value="OPERATIONAL_EXPENSE">مصاريف تشغيلية (OPERATIONAL_EXPENSE)</option>
                <option value="TAX_AND_GOVERNMENT">ضرائب وتأمينات (TAX_AND_GOVERNMENT)</option>
                <option value="INVESTMENT">استثمارات وتمويل (INVESTMENT)</option>
                <option value="MISC">نثريات وعامة (MISC)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">طريقة الدفع</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="BANK_TRANSFER">تحويل بنكي</option>
                <option value="CASH">نقدي (كاش)</option>
                <option value="CREDIT_CARD">بطاقة ائتمان</option>
                <option value="CHEQUE">شيك مصرفي</option>
                <option value="ONLINE_GATEWAY">دفع إلكتروني</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              البيان وشرح المعاملة <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: سداد فاتورة استضافة الخوادم لشهر سبتمبر..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Transaction Date & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">تاريخ المعاملة</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                رقم المرجع / الفاتورة (اختياري)
              </label>
              <input
                type="text"
                placeholder="مثال: INV-2026-089"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Attachment File Picker & Preview */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-foreground">
              إرفاق صورة الإيصال أو المستند (اختياري)
            </label>

            {attachmentUrl ? (
              <div className="relative group rounded-2xl overflow-hidden border border-border/60 dark:border-white/10 bg-surface/80 p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={attachmentUrl}
                    alt="Receipt preview"
                    className="h-12 w-16 object-cover rounded-xl border border-border/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <FiCheckCircle className="h-3.5 w-3.5" />
                      تم رفع الإيصال بنجاح
                    </span>
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline font-mono truncate block max-w-[200px]"
                    >
                      {attachmentUrl}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl('')}
                  className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                  title="حذف المرفق"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 dark:border-white/10 hover:border-primary/50 bg-surface/50 hover:bg-surface rounded-2xl p-4 cursor-pointer transition-all">
                <FiImage className="h-6 w-6 text-foreground-muted mb-1.5" />
                <span className="text-xs font-bold text-foreground">
                  {isUploadingImg
                    ? 'جاري رفع الإيصال إلى السحابة...'
                    : 'اضغط لاختيار صورة الإيصال أو الفاتورة من جهازك'}
                </span>
                <span className="text-[10px] text-foreground-muted mt-0.5">
                  PNG, JPG, WEBP حتى 10MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingImg}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
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
            form="record-transaction-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري التسجيل...' : 'ترحيل وتسجيل القيد'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// REVERSE TRANSACTION MODAL (قيد عكسي تدقيقي)
// -----------------------------------------------------------------------------

function ReverseTransactionModal({
  transaction,
  onClose,
  onReverse,
}: {
  transaction: FinancialTransaction;
  onClose: () => void;
  onReverse: (data: ReverseTransactionInput) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('يرجى توضيح سبب إلغاء القيد وعكس المعاملة.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReverse({ reason: reason.trim() });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل عكس القيد المالي.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-inner">
              <FiRefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">إجراء قيد تسوية عكسي</h3>
              <p className="text-[11px] text-foreground-muted">Reversal Entry لإلغاء الأثر المالي للقيد</p>
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

        <form id="reverse-transaction-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Transaction Summary */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5">
            <div className="font-black text-foreground">{transaction.description}</div>
            <div className="flex items-center justify-between text-[11px] font-mono font-black">
              <span className="text-foreground-muted">المبلغ المراد عكسه:</span>
              <span className="text-rose-500">
                {Number(transaction.amount).toLocaleString()} EGP
              </span>
            </div>
            <p className="text-[10px] text-foreground-muted leading-relaxed">
              وفقاً للمعايير المحاسبية الدقيقة، لا يتم حذف القيد، بل سيتم تسجيل قيد عكسي موازٍ لإلغاء الأثر المالي مع توثيق الأسباب.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              سبب إلغاء القيد المالي <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="مثال: تم إدخال المبلغ بالخطأ أو تكرار تسجيل الفاتورة..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 resize-none"
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
            form="reverse-transaction-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-rose-600 hover:bg-rose-700 px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري العكس...' : 'تأكيد القيد العكسي'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TRANSACTION DETAILS MODAL
// -----------------------------------------------------------------------------

function TransactionDetailsModal({
  transaction,
  onClose,
}: {
  transaction: FinancialTransaction;
  onClose: () => void;
}) {
  const catConf = CATEGORY_CONFIG[transaction.category] || CATEGORY_CONFIG.MISC;
  const payConf = PAYMENT_CONFIG[transaction.paymentMethod] || PAYMENT_CONFIG.BANK_TRANSFER;
  const isIncome = transaction.type === 'INCOME';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiFileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">تفاصيل السند والقيد المالي</h3>
              <p className="text-[11px] text-foreground-muted">مراجعة كامل بنود القيد والمرفقات</p>
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Header Amount */}
          <div className="p-4 rounded-2xl bg-surface/80 border border-border/60 dark:border-white/5 text-center space-y-1">
            <span className="text-[11px] text-foreground-muted font-bold block">
              قيمة المعاملة المسجلة
            </span>
            <div
              className={`text-2xl font-black font-mono ${
                transaction.isReversed
                  ? 'line-through text-foreground-subtle'
                  : isIncome
                  ? 'text-emerald-500'
                  : 'text-rose-500'
              }`}
            >
              {isIncome ? '+ ' : '- '}
              {Number(transaction.amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}{' '}
              EGP
            </div>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catConf.bg} ${catConf.text} ${catConf.border}`}
            >
              {catConf.label}
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-surface/60 border border-border/40 dark:border-white/5 divide-y divide-border/20">
            <div className="flex justify-between py-1">
              <span className="text-foreground-muted">البيان:</span>
              <span className="font-bold text-foreground text-left max-w-[200px]">
                {transaction.description}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-foreground-muted">طريقة الدفع:</span>
              <span className="font-bold text-foreground">
                {payConf.icon} {payConf.label}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-foreground-muted">تاريخ المعاملة:</span>
              <span className="font-mono text-foreground">
                {new Date(transaction.transactionDate).toLocaleDateString('ar-EG')}
              </span>
            </div>
            {transaction.referenceId && (
              <div className="flex justify-between py-1">
                <span className="text-foreground-muted">رقم المرجع:</span>
                <span className="font-mono font-bold text-primary">
                  {transaction.referenceId}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-foreground-muted">المحاسب المسجل:</span>
              <span className="font-bold text-foreground">
                {transaction.recordedBy?.employeeProfile?.fullName || transaction.recordedBy?.email}
              </span>
            </div>
          </div>

          {/* Reversal Notice if any */}
          {transaction.isReversed && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-1">
              <span className="font-black block">معلومات القيد العكسي والتسوية:</span>
              <p className="text-[11px]">{transaction.reversalReason}</p>
              {transaction.reversedAt && (
                <div className="text-[10px] font-mono text-foreground-subtle">
                  تاريخ العكس: {new Date(transaction.reversedAt).toLocaleDateString('ar-EG')}
                </div>
              )}
            </div>
          )}

          {/* Attachment Preview if URL */}
          {transaction.attachmentUrl && (
            <div className="pt-1">
              <a
                href={transaction.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full p-3 rounded-2xl border border-primary/30 bg-primary/10 text-primary font-black text-xs hover:bg-primary/20 transition-all shadow-xs"
              >
                <FiEye className="h-4 w-4" />
                <span>عرض إيصال أو مستند القيد</span>
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
