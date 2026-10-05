'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiAlertCircle, FiAward, FiPlus, FiX } from 'react-icons/fi';
import { useBonuses, useCancelBonus, useGrantBonus } from '../../hooks/use-bonuses';
import { useEmployees } from '../../hooks/use-employees';
import { Bonus } from '../../types/payroll';

const DAY_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

const grantSchema = z.object({
  employeeId: z.string().min(1, 'اختر الموظف'),
  kind: z.enum(['PAY', 'LEAVE']),
  days: z.string().min(1),
  reason: z.string().trim().min(3, 'اكتب سبب البونص').max(200, 'السبب طويل جدًا'),
});

type GrantFormData = z.infer<typeof grantSchema>;

const inputClass =
  'w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';

function daysLabel(days: number | string): string {
  const value = Number(days);
  if (value === 0.5) return 'نصف يوم';
  if (value === 1) return 'يوم';
  if (value === 2) return 'يومان';
  return `${value} يوم`;
}

function actorName(actor?: Bonus['grantedBy'] | null): string {
  return actor?.employeeProfile?.fullName || actor?.email || '—';
}

/**
 * Incentive bonuses (البونص): department leaders give days of pay to their team, Management to anyone
 * and also extra leave days. HR, Management and the granter can cancel a bonus until that month's
 * payroll is approved. Every rule is enforced by the backend; the flags only shape the screen.
 */
export function BonusesPanel({
  canGrant,
  canGrantLeave,
  canCancelAny,
  currentUserId,
}: {
  canGrant: boolean;
  canGrantLeave: boolean;
  canCancelAny: boolean;
  currentUserId?: string;
}) {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { data: bonuses = [], isLoading } = useBonuses(month);
  const { data: employeesResponse } = useEmployees({ limit: 100 });
  const employees = employeesResponse?.data || [];
  const grantMutation = useGrantBonus();
  const cancelMutation = useCancelBonus();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GrantFormData>({
    resolver: zodResolver(grantSchema),
    defaultValues: { employeeId: '', kind: 'PAY', days: '1', reason: '' },
  });
  const kind = watch('kind');

  const onSubmit = async (data: GrantFormData) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await grantMutation.mutateAsync({
        employeeId: data.employeeId,
        kind: data.kind,
        days: Number(data.days),
        reason: data.reason,
      });
      reset({ employeeId: '', kind: data.kind, days: '1', reason: '' });
      setSuccessMsg(
        data.kind === 'PAY'
          ? 'تم منح البونص، وسيُضاف إلى راتب الشهر.'
          : 'تمت إضافة أيام الإجازة إلى رصيد الموظف.',
      );
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل منح البونص.');
    }
  };

  const handleCancel = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await cancelMutation.mutateAsync(id);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل إلغاء البونص.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
      <div className="lg:col-span-2 rounded-3xl glass-card border border-border/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/30 bg-surface-raised/40 flex items-center justify-between gap-3">
          <h3 className="text-xs font-black text-foreground flex items-center gap-2">
            <FiAward className="h-4 w-4 text-primary" />
            <span>البونص التحفيزي</span>
          </h3>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-2xl border border-border/60 bg-surface px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary font-mono"
          />
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-xs text-foreground-subtle">جاري التحميل...</p>
        ) : bonuses.length === 0 ? (
          <p className="py-16 text-center text-xs text-foreground-subtle italic">لا يوجد بونص في هذا الشهر.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs text-foreground-muted">
              <thead className="border-b border-border/30 bg-surface-raised/40 text-[11px] font-bold text-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">الموظف</th>
                  <th className="px-4 py-3 text-start">البونص</th>
                  <th className="px-4 py-3 text-start">السبب</th>
                  <th className="px-4 py-3 text-start">منحه</th>
                  <th className="px-4 py-3 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {bonuses.map((bonus) => {
                  const isCancelled = !!bonus.cancelledAt;
                  const canCancel = !isCancelled && (canCancelAny || bonus.grantedById === currentUserId);
                  return (
                    <tr key={bonus.id} className={isCancelled ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <span className="font-bold text-foreground">{bonus.employee?.fullName}</span>
                        <span className="block text-[10px]">{bonus.employee?.department?.name}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {daysLabel(bonus.days)} {bonus.kind === 'PAY' ? 'من الراتب' : 'إجازة'}
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate" title={bonus.reason}>
                        {bonus.reason}
                      </td>
                      <td className="px-4 py-3">
                        {actorName(bonus.grantedBy)}
                        {isCancelled && (
                          <span className="block text-[10px] text-rose-500">
                            ألغاه {actorName(bonus.cancelledBy)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancel(bonus.id)}
                            disabled={cancelMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            <FiX className="h-3.5 w-3.5" />
                            <span>إلغاء</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-3xl glass-card border border-border/40 p-5 shadow-sm space-y-4 h-fit">
        <p className="text-[11px] text-foreground-muted leading-relaxed">
          يُضاف بونص الراتب إلى راتب شهر المنح بقيمة راتب يوم (الراتب ÷ 30) عن كل يوم. إذا كانت مسودة رواتب الشهر
          محسوبة بالفعل، أعد احتسابها ليظهر البونص.
        </p>

        {(errorMsg || successMsg) && (
          <div
            className={`rounded-2xl border p-3 text-xs flex items-center gap-2 ${
              errorMsg
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <FiAlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg || successMsg}</span>
          </div>
        )}

        {canGrant && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs border-t border-border/30 pt-4">
            <h4 className="font-black text-foreground">منح بونص</h4>

            <div>
              <label className="block font-bold text-foreground mb-1.5">الموظف</label>
              <select {...register('employeeId')} className={`${inputClass} cursor-pointer`}>
                <option value="">اختر الموظف...</option>
                {employees
                  .filter((emp) => emp.userId !== currentUserId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                    </option>
                  ))}
              </select>
              {errors.employeeId && (
                <p className="mt-1 text-[11px] font-bold text-rose-500">{errors.employeeId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {canGrantLeave && (
                <div>
                  <label className="block font-bold text-foreground mb-1.5">النوع</label>
                  <select {...register('kind')} className={`${inputClass} cursor-pointer`}>
                    <option value="PAY">من الراتب</option>
                    <option value="LEAVE">أيام إجازة زيادة</option>
                  </select>
                </div>
              )}
              <div className={canGrantLeave ? '' : 'col-span-2'}>
                <label className="block font-bold text-foreground mb-1.5">المدة</label>
                <select {...register('days')} className={`${inputClass} cursor-pointer`}>
                  {DAY_OPTIONS.map((value) => (
                    <option key={value} value={String(value)}>
                      {daysLabel(value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {kind === 'LEAVE' && (
              <p className="text-[11px] text-foreground-muted">
                تُضاف الأيام إلى رصيد الإجازة السنوية فوق الـ 21 يومًا.
              </p>
            )}

            <div>
              <label className="block font-bold text-foreground mb-1.5">السبب</label>
              <input
                {...register('reason')}
                placeholder="مثال: مجهود مميز في تسليم المشروع"
                className={inputClass}
              />
              {errors.reason && <p className="mt-1 text-[11px] font-bold text-rose-500">{errors.reason.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-4 py-2.5 font-black text-primary-foreground shadow-md active:scale-95 disabled:opacity-50 transition-all"
            >
              <FiPlus className="h-4 w-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'منح البونص'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
