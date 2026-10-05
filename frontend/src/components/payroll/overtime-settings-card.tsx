'use client';

import React, { useEffect, useState } from 'react';
import { FiAlertCircle, FiClock } from 'react-icons/fi';
import { usePayrollSettings, useUpdatePayrollSettings } from '../../hooks/use-payroll';

const MULTIPLIER_OPTIONS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

/**
 * Overtime option: paid only once Management turns it on, at a rate Management sets
 * (how many regular hours one overtime hour pays). Payroll staff see the current setting.
 */
export function OvertimeSettingsCard({ canEdit }: { canEdit: boolean }) {
  const { data: settings, isLoading } = usePayrollSettings();
  const updateMutation = useUpdatePayrollSettings();
  const [multiplier, setMultiplier] = useState('2');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setMultiplier(String(Number(settings.overtimeMultiplier)));
  }, [settings]);

  if (isLoading || !settings) return null;

  const save = async (data: { overtimeEnabled?: boolean; overtimeMultiplier?: number }) => {
    setErrorMsg(null);
    try {
      await updateMutation.mutateAsync(data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل حفظ إعدادات الوقت الإضافي.');
    }
  };

  const currentMultiplier = Number(settings.overtimeMultiplier);
  const options = MULTIPLIER_OPTIONS.includes(currentMultiplier)
    ? MULTIPLIER_OPTIONS
    : [...MULTIPLIER_OPTIONS, currentMultiplier].sort((a, b) => a - b);

  return (
    <div className="rounded-3xl glass-card p-5 border border-border/40 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-black text-foreground flex items-center gap-2">
            <FiClock className="h-4 w-4 text-primary" />
            <span>الوقت الإضافي</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                settings.overtimeEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-surface-raised text-foreground-muted border-border'
              }`}
            >
              {settings.overtimeEnabled ? 'مُفعّل' : 'متوقف'}
            </span>
          </h2>
          <p className="text-[11px] text-foreground-muted leading-relaxed">
            {settings.overtimeEnabled
              ? `ساعة الوقت الإضافي تُحسب بسعر ${currentMultiplier} ساعة عمل عادية.`
              : 'لا يُحتسب الوقت الإضافي في الرواتب حتى تفعّله الإدارة.'}
            {!canEdit && ' تحدد الإدارة هذا الإعداد.'}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] font-bold text-foreground-muted">الساعة الإضافية =</label>
            <select
              value={multiplier}
              onChange={(e) => {
                setMultiplier(e.target.value);
                save({ overtimeMultiplier: Number(e.target.value) });
              }}
              disabled={updateMutation.isPending}
              className="rounded-2xl border border-border/60 bg-surface px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
            >
              {options.map((value) => (
                <option key={value} value={String(value)}>
                  {value} ساعة عادية
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => save({ overtimeEnabled: !settings.overtimeEnabled })}
              disabled={updateMutation.isPending}
              className={`px-4 py-2 rounded-2xl text-xs font-black shadow-md active:scale-95 disabled:opacity-50 transition-all ${
                settings.overtimeEnabled
                  ? 'bg-surface border border-border text-foreground hover:bg-surface-hover'
                  : 'bg-primary hover:bg-primary-hover text-primary-foreground'
              }`}
            >
              {settings.overtimeEnabled ? 'إيقاف الوقت الإضافي' : 'تفعيل الوقت الإضافي'}
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
          <FiAlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
