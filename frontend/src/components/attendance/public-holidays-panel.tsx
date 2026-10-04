'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiAlertCircle, FiCalendar, FiChevronLeft, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  useCreatePublicHoliday,
  useDeletePublicHoliday,
  usePublicHolidays,
} from '../../hooks/use-attendance';

const holidaySchema = z
  .object({
    name: z.string().trim().min(2, 'اسم الإجازة مطلوب').max(100, 'الاسم طويل جدًا'),
    startDate: z.string().min(1, 'تاريخ البداية مطلوب'),
    endDate: z.string().optional(),
  })
  .refine((data) => !data.endDate || data.startDate <= data.endDate, {
    message: 'تاريخ النهاية لا يمكن أن يسبق تاريخ البداية',
    path: ['endDate'],
  });

type HolidayFormData = z.infer<typeof holidaySchema>;

const inputClass =
  'w-full rounded-2xl border border-border/80 dark:border-white/10 bg-surface/80 px-3.5 py-2.5 text-xs text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';

// Holidays are stored as date-only values (UTC midnight): format them in UTC so the day never shifts
function formatHolidayDate(date: string): string {
  return new Date(date).toLocaleDateString('ar-EG', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Public holidays (الإجازات الرسمية): days off for everyone, so they are never counted as absence.
 * Everyone can see them; HR adds and removes them.
 */
export function PublicHolidaysPanel({ canManage }: { canManage: boolean }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { data: holidays = [], isLoading } = usePublicHolidays(year);
  const createMutation = useCreatePublicHoliday();
  const deleteMutation = useDeletePublicHoliday();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormData>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { name: '', startDate: '', endDate: '' },
  });

  const onSubmit = async (data: HolidayFormData) => {
    setErrorMsg(null);
    try {
      await createMutation.mutateAsync({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate || undefined,
      });
      reset();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل حفظ الإجازة الرسمية.');
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل حذف الإجازة الرسمية.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
      <div className="lg:col-span-2 rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 backdrop-blur-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border bg-surface-raised/40 flex items-center justify-between gap-3">
          <h3 className="text-xs font-black text-foreground flex items-center gap-2">
            <FiCalendar className="h-4 w-4 text-primary" />
            <span>الإجازات الرسمية لسنة {year}</span>
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover"
              title="السنة السابقة"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover"
              title="السنة التالية"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-xs text-foreground-subtle">جاري التحميل...</p>
        ) : holidays.length === 0 ? (
          <p className="py-16 text-center text-xs text-foreground-subtle italic">
            لا توجد إجازات رسمية مسجلة لهذه السنة.
          </p>
        ) : (
          <ul className="divide-y divide-border/20">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-foreground">{holiday.name}</span>
                  <span className="block text-[11px] text-foreground-muted">{formatHolidayDate(holiday.date)}</span>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(holiday.id)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                    title="حذف"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-5 backdrop-blur-xl shadow-xs space-y-4 h-fit">
        <p className="text-[11px] text-foreground-muted leading-relaxed">
          أيام الإجازات الرسمية لا تُحسب غيابًا لأي موظف. الغياب في يوم عمل بدون إجازة أو إذن معتمد يُخصم يومًا من الراتب.
        </p>

        {canManage && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs border-t border-border/30 pt-4">
            <h4 className="font-black text-foreground">إضافة إجازة رسمية</h4>

            {errorMsg && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-rose-500 dark:text-rose-400 flex items-center gap-2">
                <FiAlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-foreground mb-1.5">الاسم</label>
              <input {...register('name')} placeholder="مثال: عيد الفطر" className={inputClass} />
              {errors.name && <p className="mt-1 text-[11px] font-bold text-rose-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-foreground mb-1.5">من</label>
                <input type="date" {...register('startDate')} className={`${inputClass} font-mono`} />
                {errors.startDate && (
                  <p className="mt-1 text-[11px] font-bold text-rose-500">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1.5">إلى (اختياري)</label>
                <input type="date" {...register('endDate')} className={`${inputClass} font-mono`} />
                {errors.endDate && (
                  <p className="mt-1 text-[11px] font-bold text-rose-500">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-4 py-2.5 font-black text-primary-foreground shadow-md active:scale-95 disabled:opacity-50 transition-all"
            >
              <FiPlus className="h-4 w-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'إضافة'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
