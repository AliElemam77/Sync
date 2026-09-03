'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useEmployees } from '../../../hooks/use-employees';
import {
  useAssets,
  useAsset,
  useAssetStats,
  useCreateAsset,
  useUpdateAsset,
  useDeleteAsset,
  useAssignAsset,
  useReturnAsset,
} from '../../../hooks/use-assets';
import {
  Asset,
  AssetType,
  AssetStatus,
  CreateAssetInput,
  UpdateAssetInput,
  AssignAssetInput,
  ReturnAssetInput,
} from '../../../types/asset';
import {
  FiCpu,
  FiHardDrive,
  FiPackage,
  FiPlus,
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiXCircle,
  FiUserCheck,
  FiUserMinus,
  FiEdit3,
  FiTrash2,
  FiEye,
  FiLayers,
  FiShield,
  FiX,
  FiCalendar,
  FiDollarSign,
  FiTag,
  FiInfo,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';

// -----------------------------------------------------------------------------
// BADGE CONFIGURATIONS
// -----------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  AssetType,
  { label: string; icon: any; bg: string; text: string; border: string }
> = {
  HARDWARE: {
    label: 'أجهزة ومعدات',
    icon: FiCpu,
    bg: 'bg-amber-500/10 dark:bg-amber-400/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/25',
  },
  SOFTWARE: {
    label: 'تراخيص وبرمجيات',
    icon: FiShield,
    bg: 'bg-sky-500/10 dark:bg-sky-400/10',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/25',
  },
  FURNITURE: {
    label: 'أثاث ومكتبيات',
    icon: FiPackage,
    bg: 'bg-purple-500/10 dark:bg-purple-400/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/25',
  },
  OTHER: {
    label: 'أخرى',
    icon: FiLayers,
    bg: 'bg-zinc-500/10 dark:bg-zinc-400/10',
    text: 'text-zinc-700 dark:text-zinc-400',
    border: 'border-zinc-500/25',
  },
};

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  AVAILABLE: {
    label: 'متاح بالمخزن',
    dot: 'bg-emerald-500 shadow-emerald-500/50',
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
  },
  ASSIGNED: {
    label: 'مسلّم كعهدة',
    dot: 'bg-brand-gold shadow-brand-gold/50',
    bg: 'bg-brand-gold/15 dark:bg-brand-gold/20',
    text: 'text-brand-gold dark:text-brand-champagne font-extrabold',
    border: 'border-brand-gold/40',
  },
  IN_MAINTENANCE: {
    label: 'تحت الصيانة',
    dot: 'bg-orange-500 shadow-orange-500/50',
    bg: 'bg-orange-500/10 dark:bg-orange-400/10',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/30',
  },
  RETIRED: {
    label: 'خارج الخدمة / تالف',
    dot: 'bg-rose-500 shadow-rose-500/50',
    bg: 'bg-rose-500/10 dark:bg-rose-400/10',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/30',
  },
};

export default function ITAssetsPage() {
  const { user, hasPermission } = useAuth();
  const canManage =
    user?.role?.name === 'SUPER_ADMIN' ||
    hasPermission('it.manage_assets') ||
    user?.role?.name === 'MANAGEMENT';

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Queries
  const { data: assetsData, isLoading: isAssetsLoading } = useAssets({
    search: search.trim() || undefined,
    type: (selectedType as AssetType) || undefined,
    status: (selectedStatus as AssetStatus) || undefined,
    page,
    limit: 15,
  });

  const { data: stats } = useAssetStats();
  const { data: employeesData } = useEmployees({ page: 1, limit: 150 });
  const allEmployees = employeesData?.data || [];

  // Mutations
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const deleteMutation = useDeleteAsset();
  const assignMutation = useAssignAsset();
  const returnMutation = useReturnAsset();

  const assets = assetsData?.data || [];
  const meta = assetsData?.meta;

  // Chart Data for Asset Breakdown
  const chartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'أجهزة ومعدات', value: stats.byType.hardware || 0, color: '#D8D365' },
      { name: 'تراخيص وبرمجيات', value: stats.byType.software || 0, color: '#38BDF8' },
      { name: 'أثاث ومكتبيات', value: stats.byType.furniture || 0, color: '#A855F7' },
      { name: 'أخرى', value: stats.byType.other || 0, color: '#71717A' },
    ].filter((item) => item.value > 0);
  }, [stats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* 1. HEADER SECTION                                                    */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>إدارة العمليات</span>
            <span>/</span>
            <span className="text-foreground font-medium">تقنية المعلومات والأصول</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>إدارة الأصول والعهد التقنية (IT Assets)</span>
            {stats && (
              <span className="text-xs px-3 py-1 rounded-full font-bold bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
                {stats.totalAssets} أصل مسجل
              </span>
            )}
          </h1>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-all"
          >
            <FiPlus className="h-4 w-4" />
            <span>إضافة أصل / جهاز جديد</span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. EXECUTIVE METRICS & CHART SECTION                                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Assets */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">إجمالي الأصول</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FiHardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-foreground">
            {stats?.totalAssets || 0}
          </div>
          <div className="text-[11px] text-foreground-muted flex items-center gap-1 font-mono">
            <span>القيمة التقديرية:</span>
            <span className="font-black text-brand-gold">
              {(stats?.totalValuation || 0).toLocaleString()} EGP
            </span>
          </div>
        </div>

        {/* Metric 2: Assigned Assets */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">مسلّم كعهدة نشطة</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FiUserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-brand-gold">
            {stats?.assignedCount || 0}
          </div>
          <div className="text-[11px] text-foreground-muted">
            عهدة لدى الكوادر والموظفين
          </div>
        </div>

        {/* Metric 3: Available In Stock */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">متاح بالمخزن</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiCheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-500">
            {stats?.availableCount || 0}
          </div>
          <div className="text-[11px] text-foreground-muted">
            جاهز للتسليم الفوري
          </div>
        </div>

        {/* Metric 4: Maintenance / Retired */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="font-bold">صيانة وتوالف</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <FiAlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-500 flex items-center gap-2">
            <span>{stats?.maintenanceCount || 0}</span>
            <span className="text-xs text-foreground-muted font-normal font-sans">
              صيانة / {stats?.retiredCount || 0} خارج الخدمة
            </span>
          </div>
          <div className="text-[11px] text-foreground-muted">
            تحتاج متابعة أو استبعاد
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. SEARCH & FILTERS BAR                                              */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="بحث بالاسم، السيريال، الموديل، الموظف..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-2xl border border-border/40 bg-surface/80 pr-10 pl-4 py-2 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
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
            <option value="">جميع الأنواع</option>
            <option value="HARDWARE">أجهزة ومعدات</option>
            <option value="SOFTWARE">تراخيص وبرمجيات</option>
            <option value="FURNITURE">أثاث ومكتبيات</option>
            <option value="OTHER">أخرى</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border/40 bg-surface/80 px-3 py-2 text-xs font-bold text-foreground focus:outline-none"
          >
            <option value="">جميع الحالات</option>
            <option value="AVAILABLE">متاح بالمخزن</option>
            <option value="ASSIGNED">مسلّم كعهدة</option>
            <option value="IN_MAINTENANCE">تحت الصيانة</option>
            <option value="RETIRED">خارج الخدمة</option>
          </select>

          {(search || selectedType || selectedStatus) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedType('');
                setSelectedStatus('');
                setPage(1);
              }}
              className="px-3 py-2 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition-colors"
            >
              إعادة ضبط
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. ASSETS TABLE                                                      */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl glass-card border border-white/40 dark:border-white/10 shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-raised/60 text-foreground-muted font-black border-b border-border/40">
              <tr>
                <th className="py-3.5 px-4">الأصل / الجهاز</th>
                <th className="py-3.5 px-4">الرقم التسلسلي (S/N)</th>
                <th className="py-3.5 px-4">النوع</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">المستلم الحالي (العهدة)</th>
                <th className="py-3.5 px-4">الشراء والقيمة</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isAssetsLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-foreground-muted">
                    جاري تحميل سجلات الأصول والعهد...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-foreground-subtle italic">
                    لا توجد أجهزة أو أصول مطابقة لخيارات البحث الحالية.
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const typeConf = TYPE_CONFIG[asset.type] || TYPE_CONFIG.OTHER;
                  const statusConf = STATUS_CONFIG[asset.status] || STATUS_CONFIG.AVAILABLE;
                  const TypeIcon = typeConf.icon;

                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                    >
                      {/* Name & Model */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-2xl border ${typeConf.bg} ${typeConf.border} ${typeConf.text}`}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-foreground text-xs">
                              {asset.name}
                            </div>
                            <div className="text-[11px] text-foreground-muted">
                              {asset.manufacturer || 'معدات'} {asset.model ? `• ${asset.model}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Serial Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        <span className="bg-surface px-2.5 py-1 rounded-xl border border-border/40 text-[11px]">
                          {asset.serialNumber}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-bold text-[10px] ${typeConf.bg} ${typeConf.text} ${typeConf.border}`}
                        >
                          {typeConf.label}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-bold text-[10px] ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shadow-xs ${statusConf.dot}`} />
                          {statusConf.label}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4">
                        {asset.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-[10px] text-primary shrink-0 overflow-hidden">
                              {asset.assignee.avatarUrl ? (
                                <img
                                  src={asset.assignee.avatarUrl}
                                  alt={asset.assignee.fullName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                asset.assignee.fullName.charAt(0)
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">
                                {asset.assignee.fullName}
                              </div>
                              <div className="text-[10px] text-foreground-muted font-mono">
                                {asset.assignee.employeeCode}{' '}
                                {asset.assignee.department ? `(${asset.assignee.department.name})` : ''}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-foreground-subtle italic">
                            غير مسلّم (بالمخزن)
                          </span>
                        )}
                      </td>

                      {/* Cost & Purchase */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {asset.purchaseCost ? (
                          <div className="font-bold text-foreground">
                            {Number(asset.purchaseCost).toLocaleString()} EGP
                          </div>
                        ) : (
                          <span className="text-foreground-subtle">-</span>
                        )}
                        {asset.purchaseDate && (
                          <div className="text-[10px] text-foreground-muted">
                            {new Date(asset.purchaseDate).toLocaleDateString('ar-EG')}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Assignment / Return Button */}
                          {canManage && (
                            <>
                              {asset.status === 'ASSIGNED' ? (
                                <button
                                  onClick={() => setReturningAsset(asset)}
                                  title="استرجاع العهدة"
                                  className="p-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                                >
                                  <FiUserMinus className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setAssigningAsset(asset)}
                                  disabled={asset.status === 'RETIRED'}
                                  title="تسليم عهدة لموظف"
                                  className="p-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition-colors"
                                >
                                  <FiUserCheck className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}

                          {/* History Log */}
                          <button
                            onClick={() => setHistoryAsset(asset)}
                            title="السجل التاريخي للعهدة"
                            className="p-1.5 rounded-xl border border-border/40 bg-surface text-foreground hover:bg-surface-hover transition-colors"
                          >
                            <FiClock className="h-4 w-4" />
                          </button>

                          {/* Edit */}
                          {canManage && (
                            <button
                              onClick={() => setEditingAsset(asset)}
                              title="تعديل الأصل"
                              className="p-1.5 rounded-xl border border-border/40 bg-surface text-foreground hover:bg-surface-hover transition-colors"
                            >
                              <FiEdit3 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {canManage && (
                            <button
                              onClick={async () => {
                                if (asset.status === 'ASSIGNED') {
                                  alert('لا يمكن حذف أصل مسلّم كعهدة حالياً لموظف، يرجى استرجاع العهدة أولاً.');
                                  return;
                                }
                                if (confirm(`هل أنت متأكد من حذف الأصل '${asset.name}' نهائياً؟`)) {
                                  await deleteMutation.mutateAsync(asset.id);
                                }
                              }}
                              title="حذف الأصل"
                              className="p-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                            >
                              <FiTrash2 className="h-4 w-4" />
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
              عرض صفحة {meta.page} من {meta.totalPages} (إجمالي {meta.total} أصل)
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
      {/* 5. MODALS                                                             */}
      {/* ===================================================================== */}

      {/* CREATE ASSET MODAL */}
      {isCreateModalOpen && (
        <CreateAssetModal
          employees={allEmployees}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={async (data) => {
            await createMutation.mutateAsync(data);
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {/* ASSIGN ASSET MODAL */}
      {assigningAsset && (
        <AssignAssetModal
          asset={assigningAsset}
          employees={allEmployees}
          onClose={() => setAssigningAsset(null)}
          onAssign={async (data) => {
            await assignMutation.mutateAsync({
              id: assigningAsset.id,
              data,
            });
            setAssigningAsset(null);
          }}
        />
      )}

      {/* RETURN ASSET MODAL */}
      {returningAsset && (
        <ReturnAssetModal
          asset={returningAsset}
          onClose={() => setReturningAsset(null)}
          onReturn={async (data) => {
            await returnMutation.mutateAsync({
              id: returningAsset.id,
              data,
            });
            setReturningAsset(null);
          }}
        />
      )}

      {/* ASSET HISTORY MODAL */}
      {historyAsset && (
        <AssetHistoryModal
          asset={historyAsset}
          onClose={() => setHistoryAsset(null)}
        />
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <EditAssetModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={async (data) => {
            await updateMutation.mutateAsync({
              id: editingAsset.id,
              data,
            });
            setEditingAsset(null);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// CREATE ASSET MODAL COMPONENT
// -----------------------------------------------------------------------------

function CreateAssetModal({
  employees,
  onClose,
  onSave,
}: {
  employees: any[];
  onClose: () => void;
  onSave: (data: CreateAssetInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [type, setType] = useState<AssetType>('HARDWARE');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [purchaseCost, setPurchaseCost] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serialNumber.trim()) {
      alert('اسم الأصل والرقم التسلسلي مطلوبان.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        serialNumber: serialNumber.trim(),
        type,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyExpiry: warrantyExpiry || undefined,
        notes: notes.trim() || undefined,
        assigneeId: assigneeId || undefined,
        conditionNotes: conditionNotes.trim() || undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل حفظ الأصل.');
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
              <FiPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">إضافة أصل / عهدة تقنية جديدة</h3>
              <p className="text-[11px] text-foreground-muted">تسجيل الأجهزة والمعدات والتراخيص في المخزن</p>
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

        <form id="add-asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                اسم الأصل / الجهاز <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: MacBook Pro 16 M3 Max"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                نوع الأصل <span className="text-rose-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="HARDWARE">💻 أجهزة ومعدات (HARDWARE)</option>
                <option value="SOFTWARE">🔑 تراخيص وبرمجيات (SOFTWARE)</option>
                <option value="FURNITURE">🪑 أثاث ومكتبية (FURNITURE)</option>
                <option value="OTHER">📦 أخرى (OTHER)</option>
              </select>
            </div>
          </div>

          {/* Serial Number & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                الرقم التسلسلي (S/N) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="مثال: C02G90XXMD6M"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                الشركة المصنعة / الماركة
              </label>
              <input
                type="text"
                placeholder="مثال: Apple, Dell, JetBrains..."
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Model & Purchase Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">الموديل / الإصدار</label>
              <input
                type="text"
                placeholder="مثال: A2991 / 2024"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">تكلفة الشراء (EGP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs font-mono text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Purchase Date & Warranty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">تاريخ الشراء</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">انتهاء الضمان</label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={(e) => setWarrantyExpiry(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
            </div>
          </div>

          {/* Initial Assignment */}
          <div className="pt-2 border-t border-border/30">
            <label className="block text-xs font-bold text-foreground mb-1.5">
              تسليم كعهدة فورية لموظف (اختياري)
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">-- حفظ في المخزن كأصل متاح --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          {assigneeId && (
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                ملاحظات حالة الجهاز عند التسليم
              </label>
              <input
                type="text"
                placeholder="مثال: تسليم بحالة المصنع مع الشاحن والملحقات كاملة"
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">ملاحظات ومواصفات إضافية</label>
            <textarea
              rows={2}
              placeholder="مثال: 64GB RAM, 1TB SSD, لون رمادي فلكي..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
            form="add-asset-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ وإضافة الأصل'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ASSIGN ASSET MODAL COMPONENT (تسليم عهدة)
// -----------------------------------------------------------------------------

function AssignAssetModal({
  asset,
  employees,
  onClose,
  onAssign,
}: {
  asset: Asset;
  employees: any[];
  onClose: () => void;
  onAssign: (data: AssignAssetInput) => Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      alert('يرجى تحديد الموظف المستلم للعهدة.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssign({
        employeeId,
        conditionNotes: conditionNotes.trim() || undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل تسليم العهدة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shadow-inner">
              <FiUserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">تسليم عهدة لموظف</h3>
              <p className="text-[11px] text-foreground-muted">نقل مسؤولية الأصل إلى عهدة الموظف</p>
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

        <form id="assign-asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Asset Brief */}
          <div className="p-3.5 rounded-2xl bg-surface/80 border border-border/60 dark:border-white/5 text-xs space-y-1">
            <div className="font-extrabold text-foreground">{asset.name}</div>
            <div className="text-[11px] text-foreground-muted font-mono flex items-center justify-between">
              <span>S/N: {asset.serialNumber}</span>
              <span>{asset.manufacturer || ''}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              الموظف المستلم للعهدة <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="" disabled>
                اختر الموظف...
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode}) - {emp.department?.name || ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              ملاحظات حالة الجهاز عند التسليم
            </label>
            <textarea
              rows={3}
              placeholder="مثال: تم فحص الجهاز ويعمل بكفاءة 100% مع الشاحن الأصلي وحقيبة الحمل..."
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
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
            form="assign-asset-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري التسليم...' : 'تأكيد تسليم العهدة'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RETURN ASSET MODAL COMPONENT (استرجاع عهدة)
// -----------------------------------------------------------------------------

function ReturnAssetModal({
  asset,
  onClose,
  onReturn,
}: {
  asset: Asset;
  onClose: () => void;
  onReturn: (data: ReturnAssetInput) => Promise<void>;
}) {
  const [status, setStatus] = useState<AssetStatus>('AVAILABLE');
  const [conditionNotes, setConditionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onReturn({
        status,
        conditionNotes: conditionNotes.trim() || undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل استرجاع العهدة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
              <FiUserMinus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">استرجاع عهدة وفحص الجهاز</h3>
              <p className="text-[11px] text-foreground-muted">إعادة الأصل إلى المخزن وتحديث حالته</p>
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

        <form id="return-asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Current Holder Brief */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="font-extrabold text-foreground">{asset.name}</div>
            <div className="text-[11px] text-amber-700 dark:text-amber-300">
              عهدة حالياً لدى: <span className="font-bold">{asset.assignee?.fullName}</span> (
              {asset.assignee?.employeeCode})
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              حالة الأصل بعد الاسترجاع والفحص <span className="text-rose-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="AVAILABLE">✅ متاح وسليم بالمخزن (جاهز للتسليم مجدداً)</option>
              <option value="IN_MAINTENANCE">🛠️ يحتاج صيانة وفحص فني</option>
              <option value="RETIRED">⛔ تالف / خارج الخدمة نهائياً</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              تقرير الفحص وملاحظات الاستلام
            </label>
            <textarea
              rows={3}
              placeholder="مثال: تم الاستلام بحالة ممتازة مع كافة الملحقات وتم عمل مسح للبيانات..."
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
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
            form="return-asset-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-amber-500 hover:bg-amber-600 px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري الاسترجاع...' : 'تأكيد استرجاع العهدة'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ASSET HISTORY MODAL (السجل الزمني للعهدة)
// -----------------------------------------------------------------------------

function AssetHistoryModal({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const { data: fullAsset, isLoading } = useAsset(asset.id);
  const selected = fullAsset || asset;
  const history = selected.assignmentHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        {/* Top Specular Rim */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">السجل التاريخي للعهدة</h3>
              <p className="text-[11px] text-foreground-muted font-mono truncate max-w-[280px]">
                {asset.name} • S/N: {asset.serialNumber}
              </p>
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

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-foreground-muted animate-pulse">
              جاري تحميل السجل التاريخي وحركات العهدة...
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center text-xs text-foreground-subtle italic">
              لا توجد حركات تسليم أو استرجاع سابقة مسجلة لهذا الأصل.
            </div>
          ) : (
            history.map((record, index) => (
              <div
                key={record.id || index}
                className="relative p-4 rounded-2xl border border-border/60 dark:border-white/5 bg-surface/80 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="font-extrabold text-foreground">
                      {record.employee?.fullName || 'موظف'}
                    </span>
                    <span className="text-[10px] font-mono text-foreground-muted">
                      ({record.employee?.employeeCode})
                    </span>
                  </div>

                  {record.returnedAt ? (
                    <span className="px-2.5 py-1 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold border border-zinc-500/20">
                      تم الاسترجاع
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      عهدة نشطة حالياً
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-foreground-muted pt-1 border-t border-border/20">
                  <div>
                    <span className="font-bold text-foreground">تاريخ التسليم: </span>
                    <span className="font-mono">
                      {new Date(record.assignedAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-foreground">تاريخ الاسترجاع: </span>
                    <span className="font-mono">
                      {record.returnedAt
                        ? new Date(record.returnedAt).toLocaleDateString('ar-EG')
                        : 'مستمر حتى الآن'}
                    </span>
                  </div>
                </div>

                {record.conditionNotes && (
                  <div className="p-3 rounded-xl bg-surface-raised/60 text-[11px] text-foreground border border-border/20">
                    <span className="font-bold text-foreground-muted block mb-0.5">ملاحظات الفحص والحالة:</span>
                    {record.conditionNotes}
                  </div>
                )}

                {record.assignedBy && (
                  <div className="text-[10px] text-foreground-subtle text-left">
                    المسؤول: {record.assignedBy.fullName}
                  </div>
                )}
              </div>
            ))
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

// -----------------------------------------------------------------------------
// EDIT ASSET MODAL COMPONENT
// -----------------------------------------------------------------------------

function EditAssetModal({
  asset,
  onClose,
  onSave,
}: {
  asset: Asset;
  onClose: () => void;
  onSave: (data: UpdateAssetInput) => Promise<void>;
}) {
  const [name, setName] = useState(asset.name);
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber);
  const [type, setType] = useState<AssetType>(asset.type);
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [manufacturer, setManufacturer] = useState(asset.manufacturer || '');
  const [model, setModel] = useState(asset.model || '');
  const [purchaseCost, setPurchaseCost] = useState(asset.purchaseCost ? String(asset.purchaseCost) : '');
  const [notes, setNotes] = useState(asset.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        serialNumber: serialNumber.trim(),
        type,
        status,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'فشل تحديث الأصل.');
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
              <FiEdit3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">تعديل بيانات الأصل</h3>
              <p className="text-[11px] text-foreground-muted">تحديث المواصفات والحالة الفنية</p>
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

        <form id="edit-asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                اسم الأصل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                الرقم التسلسلي (S/N) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs font-mono text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="HARDWARE">أجهزة ومعدات</option>
                <option value="SOFTWARE">تراخيص وبرمجيات</option>
                <option value="FURNITURE">أثاث ومكتبيات</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">الحالة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssetStatus)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="AVAILABLE">متاح بالمخزن</option>
                <option value="ASSIGNED">مسلّم كعهدة</option>
                <option value="IN_MAINTENANCE">تحت الصيانة</option>
                <option value="RETIRED">خارج الخدمة</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">الشركة المصنعة</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">الموديل</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">تكلفة الشراء (EGP)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchaseCost}
              onChange={(e) => setPurchaseCost(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs font-mono text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">ملاحظات ومواصفات</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 p-3 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
            form="edit-asset-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري الحفظ...' : 'تحديث البيانات'}
          </button>
        </div>
      </div>
    </div>
  );
}
