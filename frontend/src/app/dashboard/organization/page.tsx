'use client';

import React, { useState } from 'react';
import {
  useOrganizationTree,
  useCreateDepartment,
  useDeleteDepartment,
  useUpdateDepartment,
  useCreatePosition,
  useDeletePosition,
  useCreateLevel,
  useDeleteLevel,
} from '../../../hooks/use-organization';
import { useAuth } from '../../../hooks/use-auth';
import { Department } from '../../../types/organization';
import { Card } from '../../../components/ui/card';
import { CardGridSkeleton } from '../../../components/ui/card-grid-skeleton';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  FiChevronDown,
  FiChevronRight,
  FiPlus,
  FiLayers,
  FiUsers,
  FiTrash2,
  FiAlertCircle,
  FiX,
  FiTrendingUp,
  FiEdit2,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';

export default function OrganizationPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');
  // Commission rates are set by Management (and the Super Admin)
  const canSetCommission = user?.role?.name === 'SUPER_ADMIN' || !!user?.isManagement;

  const { data: departments, isLoading, isError, error } = useOrganizationTree();
  const createDeptMutation = useCreateDepartment();
  const deleteDeptMutation = useDeleteDepartment();
  const createPosMutation = useCreatePosition();
  const deletePosMutation = useDeletePosition();
  const createLvlMutation = useCreateLevel();
  const deleteLvlMutation = useDeleteLevel();

  // Modals state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [isLvlModalOpen, setIsLvlModalOpen] = useState(false);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });
  const [posForm, setPosForm] = useState({ name: '', departmentId: '', description: '' });
  const [lvlForm, setLvlForm] = useState({ name: '', positionId: '', rank: 1, description: '' });

  // Expansion State for Department cards
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => {
      const isCurrentlyExpanded = prev[id] !== false; // defaults to true
      return { ...prev, [id]: !isCurrentlyExpanded };
    });
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createDeptMutation.mutateAsync({
        ...deptForm,
        code: deptForm.code.toUpperCase(),
      });
      setDeptForm({ name: '', code: '', description: '' });
      setIsDeptModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل إنشاء القسم';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createPosMutation.mutateAsync(posForm);
      setPosForm({ name: '', departmentId: '', description: '' });
      setIsPosModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل إنشاء المسمى الوظيفي';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleCreateLvl = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await createLvlMutation.mutateAsync({
        ...lvlForm,
        rank: Number(lvlForm.rank) || 1,
      });
      setLvlForm({ name: '', positionId: '', rank: 1, description: '' });
      setIsLvlModalOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل إضافة المستوى الوظيفي';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف قسم '${name}'؟`)) return;
    setActionError(null);
    try {
      await deleteDeptMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل حذف القسم';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeletePos = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف المسمى الوظيفي '${name}'؟`)) return;
    setActionError(null);
    try {
      await deletePosMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل حذف المسمى الوظيفي';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const handleDeleteLvl = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف المستوى '${name}'؟`)) return;
    setActionError(null);
    try {
      await deleteLvlMutation.mutateAsync(id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل حذف المستوى';
      setActionError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  const totalPositions = departments?.reduce((acc, d) => acc + (d.positions?.length || 0), 0) || 0;
  const totalEmployees = departments?.reduce((acc, d) => acc + (d._count?.employees || 0), 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <span>الهيكل المؤسسي</span>
            <span>/</span>
            <span className="text-foreground font-medium">الأقسام والمسارات الوظيفية</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span>الهيكل التنظيمي والوحدات الإدارية</span>
            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
              {departments?.length || 0} أقسام
            </span>
          </h1>
        </div>

        {canManage && (
          <button
            onClick={() => setIsDeptModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-all self-start sm:self-auto"
          >
            <FiPlus className="h-4 w-4" />
            <span>إضافة قسم جديد</span>
          </button>
        )}
      </div>

      {/* Top Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">الأقسام والوحدات</span>
            <div className="text-2xl font-black text-foreground font-mono">{departments?.length || 0}</div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
            <BiBuildingHouse className="h-5 w-5" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">المسميات الوظيفية</span>
            <div className="text-2xl font-black text-foreground font-mono">{totalPositions}</div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 text-brand-gold dark:text-brand-champagne flex items-center justify-center">
            <FiLayers className="h-5 w-5" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-5">
          <div className="space-y-1">
            <span className="text-xs font-bold text-foreground-muted">الموظفين المسكنين</span>
            <div className="text-2xl font-black text-foreground font-mono">{totalEmployees}</div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <FiUsers className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:text-rose-600">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Departments Tree Container */}
      <div className="space-y-4">
        {isLoading ? (
          <CardGridSkeleton count={3} />
        ) : departments?.length === 0 ? (
          <EmptyState
            icon={BiBuildingHouse}
            title="لا توجد أقسام مسجلة"
            description="ابدأ بإضافة الأقسام التنظيمية والمسميات الوظيفية للمنظومة."
            action={
              canManage
                ? {
                    label: 'إضافة أول قسم',
                    onClick: () => setIsDeptModalOpen(true),
                    icon: FiPlus,
                  }
                : undefined
            }
          />
        ) : (
          departments?.map((dept) => {
            const isExpanded = expandedDepts[dept.id] !== false; // default expanded

            return (
              <div
                key={dept.id}
                className="rounded-3xl border border-card-border bg-card shadow-luxury dark:shadow-luxury-dark overflow-hidden transition-all"
              >
                {/* Department Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-raised/40">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleDept(dept.id)}
                      className="p-1.5 rounded-xl bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-all"
                    >
                      {isExpanded ? (
                        <FiChevronDown className="h-4 w-4" />
                      ) : (
                        <FiChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      <BiBuildingHouse className="h-5 w-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-foreground">{dept.name}</span>
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-bold text-primary">
                          {dept.code}
                        </span>
                      </div>
                      <div className="text-xs text-foreground-muted flex items-center gap-3 mt-0.5 font-mono">
                        <span>{dept.positions?.length || 0} مسميات وظيفية</span>
                        <span>•</span>
                        <span>{dept._count?.employees || 0} موظف مسكن</span>
                        {dept.head && (
                          <>
                            <span>•</span>
                            <span className="text-brand-gold font-bold flex items-center gap-1 font-sans">
                              <span>رئيس القسم:</span>
                              <span className="underline">{dept.head.fullName}</span>
                            </span>
                          </>
                        )}
                      </div>
                      {canSetCommission && <DepartmentCommission dept={dept} />}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {canManage && (
                      <>
                        <button
                          onClick={() => {
                            setPosForm({ name: '', departmentId: dept.id, description: '' });
                            setIsPosModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-2xl bg-surface hover:bg-surface-hover px-3.5 py-1.5 text-xs font-bold text-foreground transition-all"
                        >
                          <FiPlus className="h-3.5 w-3.5 text-primary" />
                          <span>إضافة مسمى وظيفي</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDept(dept.id, dept.name)}
                          className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                          title="حذف القسم"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Positions and Levels List (Accordion Content) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-2.5 bg-surface/30">
                    {dept.positions?.length === 0 ? (
                      <p className="text-xs text-foreground-subtle italic py-2">
                        لا توجد مسميات وظيفية مسجلة في هذا القسم بعد.
                      </p>
                    ) : (
                      dept.positions?.map((pos) => (
                        <div
                          key={pos.id}
                          className="rounded-2xl bg-card p-4 space-y-2.5 shadow-xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                              <span className="text-xs font-black text-foreground">{pos.name}</span>
                            </div>

                            <div className="flex items-center gap-3 self-start sm:self-auto">
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => {
                                      setLvlForm({ name: '', positionId: pos.id, rank: 1, description: '' });
                                      setIsLvlModalOpen(true);
                                    }}
                                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                  >
                                    <FiPlus className="h-3 w-3" />
                                    <span>إضافة مستوى/درجة</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeletePos(pos.id, pos.name)}
                                    className="text-rose-500 dark:text-rose-400 hover:text-rose-600 p-1"
                                    title="حذف المسمى"
                                  >
                                    <FiTrash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Seniority Levels Tags */}
                          <div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[10px] text-foreground-subtle font-bold">المستويات:</span>
                              {pos.levels?.length === 0 ? (
                                <span className="text-[10px] text-foreground-subtle italic">بدون مستويات مخصصة</span>
                              ) : (
                                pos.levels
                                  ?.sort((a, b) => a.rank - b.rank)
                                  .map((lvl) => (
                                    <span
                                      key={lvl.id}
                                      className="inline-flex items-center gap-2 rounded-xl bg-surface px-2.5 py-1 text-[10px] font-mono text-foreground font-semibold group"
                                    >
                                      <span>{lvl.name}</span>
                                      <span className="rounded bg-surface-raised px-1 py-0.2 text-[9px] text-foreground-muted">
                                        رتبة {lvl.rank}
                                      </span>
                                      {canManage && (
                                        <button
                                          onClick={() => handleDeleteLvl(lvl.id, lvl.name)}
                                          className="text-foreground-subtle hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <FiX className="h-3 w-3" />
                                        </button>
                                      )}
                                    </span>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL: CREATE DEPARTMENT                                              */}
      {/* ===================================================================== */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <BiBuildingHouse className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">إضافة قسم تنظيمي جديد</h2>
                  <p className="text-[11px] text-foreground-muted">إنشاء وحدة إدارية جديدة في الهيكل التنظيمي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="create-dept-form" onSubmit={handleCreateDept} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  اسم القسم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="مثال: إدارة تكنولوجيا المعلومات"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  كود القسم (Code) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="مثال: IT / HR / FIN"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground font-mono placeholder:text-foreground-subtle uppercase focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">الوصف (اختياري)</label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="نبذة عن مهام القسم والمسؤوليات الأساسية..."
                  rows={3}
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="create-dept-form"
                type="submit"
                disabled={createDeptMutation.isPending}
                className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                {createDeptMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء القسم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE POSITION                                                */}
      {/* ===================================================================== */}
      {isPosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiLayers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">إضافة مسمى وظيفي للقسم</h2>
                  <p className="text-[11px] text-foreground-muted">تعريف الدور الوظيفي ومسؤولياته</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPosModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="create-pos-form" onSubmit={handleCreatePos} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  المسمى الوظيفي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={posForm.name}
                  onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                  placeholder="مثال: مهندس برمجيات أول (Senior Software Engineer)"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">الوصف (اختياري)</label>
                <textarea
                  value={posForm.description}
                  onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                  placeholder="المتطلبات والمسؤوليات الأساسية للدور..."
                  rows={3}
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsPosModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="create-pos-form"
                type="submit"
                disabled={createPosMutation.isPending}
                className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                {createPosMutation.isPending ? 'جاري الإضافة...' : 'إضافة المسمى'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREATE LEVEL                                                   */}
      {/* ===================================================================== */}
      {isLvlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
            {/* Top Specular Rim */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

            <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
                  <FiTrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-foreground">إضافة درجة / مستوى وظيفي</h2>
                  <p className="text-[11px] text-foreground-muted">تحديد رتب ومسارات الترقي الوظيفي</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLvlModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                title="إغلاق"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <form id="create-lvl-form" onSubmit={handleCreateLvl} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  اسم المستوى <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lvlForm.name}
                  onChange={(e) => setLvlForm({ ...lvlForm, name: e.target.value })}
                  placeholder="مثال: مبتدئ (Junior) / خبير (Lead)"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  الرتبة الرقمية (Rank) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={lvlForm.rank}
                  onChange={(e) => setLvlForm({ ...lvlForm, rank: Number(e.target.value) })}
                  placeholder="1"
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground font-mono focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">الوصف (اختياري)</label>
                <textarea
                  value={lvlForm.description}
                  onChange={(e) => setLvlForm({ ...lvlForm, description: e.target.value })}
                  placeholder="سنوات الخبرة أو المعايير المطلوبة للمستوى..."
                  rows={3}
                  className="w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-4 py-2.5 text-xs text-foreground placeholder:text-foreground-subtle focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-border/30 dark:border-white/10 bg-surface/60 dark:bg-white/[0.02] backdrop-blur-xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsLvlModalOpen(false)}
                className="rounded-2xl border border-border/80 bg-surface px-5 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-colors shadow-xs"
              >
                إلغاء
              </button>
              <button
                form="create-lvl-form"
                type="submit"
                disabled={createLvlMutation.isPending}
                className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
              >
                {createLvlMutation.isPending ? 'جاري الإضافة...' : 'إضافة المستوى'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Management sets how much each accepted task (x its weight) earns this department's employees
function DepartmentCommission({ dept }: { dept: Department }) {
  const updateMutation = useUpdateDepartment();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(Number(dept.commissionPerTask ?? 0)));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('أدخل مبلغًا صحيحًا (0 أو أكثر)');
      return;
    }
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: dept.id,
        data: { commissionPerTask: Math.round(amount * 100) / 100 },
      });
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'فشل حفظ الكوميشن');
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        title="تعديل كوميشن التاسك لهذا القسم"
      >
        <span>كوميشن التاسك:</span>
        <span className="font-mono">
          {Number(dept.commissionPerTask ?? 0).toLocaleString('ar-EG')} ج.م
        </span>
        <FiEdit2 className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="font-bold text-foreground">كوميشن التاسك (ج.م):</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-xl border border-border bg-surface px-2.5 py-1 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="button"
        onClick={save}
        disabled={updateMutation.isPending}
        className="rounded-xl bg-primary px-3 py-1 font-bold text-primary-foreground disabled:opacity-50"
      >
        {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsEditing(false);
          setError(null);
          setValue(String(Number(dept.commissionPerTask ?? 0)));
        }}
        className="rounded-xl bg-surface px-3 py-1 font-bold text-foreground-muted hover:text-foreground"
      >
        إلغاء
      </button>
      {error && <span className="font-bold text-rose-500">{error}</span>}
    </div>
  );
}
