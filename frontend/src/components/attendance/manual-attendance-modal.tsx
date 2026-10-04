'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiAlertCircle, FiEdit3, FiX } from 'react-icons/fi';
import { useRecordAttendance } from '../../hooks/use-attendance';

const manualAttendanceSchema = z
  .object({
    employeeId: z.string().min(1, 'اختر الموظف'),
    date: z.string().min(1, 'التاريخ مطلوب'),
    checkInTime: z.string().min(1, 'وقت الحضور مطلوب'),
    checkOutTime: z.string().optional(),
  })
  .refine((data) => !data.checkOutTime || data.checkInTime < data.checkOutTime, {
    message: 'وقت الانصراف يجب أن يكون بعد وقت الحضور',
    path: ['checkOutTime'],
  });

type ManualAttendanceFormData = z.infer<typeof manualAttendanceSchema>;

const inputClass =
  'w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-bold text-rose-500 dark:text-rose-400">{message}</p>;
}

/**
 * HR records or corrects one employee's day (e.g. a forgotten check-in), so it is not counted as absence.
 * Lateness and overtime are computed by the server from the times entered.
 */
export function ManualAttendanceModal({
  employees,
  onClose,
  onSuccess,
}: {
  employees: { id: string; fullName: string; employeeCode: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const recordMutation = useRecordAttendance();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const today = new Date().toLocaleDateString('en-CA');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ManualAttendanceFormData>({
    resolver: zodResolver(manualAttendanceSchema),
    defaultValues: { employeeId: '', date: today, checkInTime: '09:00', checkOutTime: '17:00' },
  });

  const onSubmit = async (data: ManualAttendanceFormData) => {
    setErrorMsg(null);
    try {
      await recordMutation.mutateAsync({
        employeeId: data.employeeId,
        date: data.date,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل تسجيل الحضور.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative overflow-hidden w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-white/30 dark:border-white/10 bg-white/90 dark:bg-[#141411]/95 backdrop-blur-3xl shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />

        <div className="px-6 py-5 border-b border-border/30 dark:border-white/10 flex items-center justify-between bg-surface/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner">
              <FiEdit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">تسجيل حضور يدوي</h2>
              <p className="text-[11px] text-foreground-muted">تصحيح يوم موظف نسي البصمة</p>
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

        <form
          id="manual-attendance-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs"
        >
          {errorMsg && (
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-rose-500 dark:text-rose-400 flex items-center gap-2">
              <FiAlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-foreground mb-1.5">الموظف</label>
            <select {...register('employeeId')} className={`${inputClass} cursor-pointer`}>
              <option value="">اختر الموظف...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </select>
            <FieldError message={errors.employeeId?.message} />
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1.5">التاريخ</label>
            <input type="date" max={today} {...register('date')} className={`${inputClass} font-mono`} />
            <FieldError message={errors.date?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-foreground mb-1.5">وقت الحضور</label>
              <input type="time" {...register('checkInTime')} className={`${inputClass} font-mono`} />
              <FieldError message={errors.checkInTime?.message} />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1.5">وقت الانصراف</label>
              <input type="time" {...register('checkOutTime')} className={`${inputClass} font-mono`} />
              <FieldError message={errors.checkOutTime?.message} />
            </div>
          </div>

          <p className="rounded-2xl bg-surface-raised px-4 py-2.5 text-[11px] text-foreground-muted leading-relaxed">
            إذا كانت هناك بصمة مسجلة لنفس اليوم فسيتم استبدالها. يُحسب التأخير والوقت الإضافي تلقائيًا بنفس قواعد البصمة.
          </p>
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
            form="manual-attendance-form"
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl btn-glow-primary px-6 py-2.5 text-xs font-black text-brand-stone-950 shadow-md active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
