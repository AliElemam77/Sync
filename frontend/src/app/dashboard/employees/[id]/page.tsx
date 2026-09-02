'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/use-auth';
import { useEmployee } from '../../../../hooks/use-employees';
import { useEmployeeAssets } from '../../../../hooks/use-assets';
import {
  FiUser,
  FiBriefcase,
  FiPhone,
  FiMail,
  FiCalendar,
  FiHardDrive,
  FiCpu,
  FiShield,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiArrowRight,
  FiPackage,
  FiLayers,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';

export default function EmployeeProfilePage() {
  const params = useParams();
  const employeeId = params?.id as string;
  const { user, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ASSETS'>('ASSETS');

  const { data: employee, isLoading: isEmployeeLoading } = useEmployee(employeeId);
  const { data: assetsData, isLoading: isAssetsLoading } = useEmployeeAssets(employeeId);

  const activeAssets = assetsData?.activeAssets || [];
  const assetHistory = assetsData?.history || [];

  if (isEmployeeLoading) {
    return (
      <div className="py-20 text-center text-xs text-foreground-muted animate-pulse">
        جاري تحميل ملف الموظف...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-20 text-center text-xs text-foreground-subtle italic">
        لم يتم العثور على بيانات الموظف.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <Link href="/dashboard/employees" className="hover:text-primary transition-colors">
              سجل الموظفين
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{employee.fullName}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>الملف الوظيفي والعهدة</span>
            <span className="text-xs px-3 py-0.5 rounded-full font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              {employee.employeeCode}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/employees/${employeeId}/edit`}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-foreground hover:bg-surface-hover transition-all"
          >
            <FiEdit2 className="h-4 w-4" />
            <span>تعديل الملف</span>
          </Link>
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-xs font-black text-primary-foreground shadow-md active:scale-95 transition-all"
          >
            <FiHardDrive className="h-4 w-4" />
            <span>إدارة الأصول والعهد</span>
          </Link>
        </div>
      </div>

      {/* Employee Quick Info Glass Card */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        {/* Avatar */}
        <div className="h-20 w-20 rounded-3xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-black text-2xl text-primary overflow-hidden shrink-0 shadow-lg">
          {employee.avatarUrl ? (
            <img
              src={employee.avatarUrl}
              alt={employee.fullName}
              className="h-full w-full object-cover"
            />
          ) : (
            employee.fullName.charAt(0)
          )}
        </div>

        {/* Core Info */}
        <div className="space-y-1.5 text-center md:text-right flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h2 className="text-xl font-black text-foreground">{employee.fullName}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {employee.status}
            </span>
          </div>
          <p className="text-xs text-foreground-muted flex flex-wrap items-center justify-center md:justify-start gap-4">
            <span className="flex items-center gap-1">
              <BiBuildingHouse className="h-3.5 w-3.5 text-primary" />
              {employee.department?.name || 'غير محدد'}
            </span>
            <span className="flex items-center gap-1">
              <FiBriefcase className="h-3.5 w-3.5 text-primary" />
              {employee.position?.name || 'غير محدد'}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <FiPhone className="h-3.5 w-3.5 text-primary" />
              {employee.phone}
            </span>
          </p>
        </div>

        {/* Quick Custody Stat */}
        <div className="p-4 rounded-2xl bg-surface/90 border border-border/40 text-center min-w-[140px]">
          <span className="text-[11px] text-foreground-muted block font-bold">العهد النشطة</span>
          <span className="text-2xl font-black font-mono text-brand-gold">
            {activeAssets.length}
          </span>
          <span className="text-[10px] text-foreground-subtle block">أجهزة ومعدات</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-2">
        <button
          onClick={() => setActiveTab('ASSETS')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'ASSETS'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-surface/60 text-foreground-muted hover:text-foreground hover:bg-surface'
          }`}
        >
          <FiHardDrive className="h-4 w-4" />
          <span>الأصول والعهد المستلمة ({activeAssets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${
            activeTab === 'PROFILE'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-surface/60 text-foreground-muted hover:text-foreground hover:bg-surface'
          }`}
        >
          <FiUser className="h-4 w-4" />
          <span>البيانات الشخصية والوظيفية</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: ASSIGNED IT ASSETS & CUSTODY LOG                               */}
      {/* ===================================================================== */}
      {activeTab === 'ASSETS' && (
        <div className="space-y-6">
          {/* Active Assigned Assets */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <FiCheckCircle className="h-4 w-4 text-emerald-500" />
              <span>العهد والأجهزة المسلمة حالياً ({activeAssets.length})</span>
            </h3>

            {isAssetsLoading ? (
              <div className="p-8 text-center text-xs text-foreground-muted">
                جاري تحميل الأجهزة المسلمة...
              </div>
            ) : activeAssets.length === 0 ? (
              <div className="p-10 rounded-3xl glass-card text-center text-xs text-foreground-subtle italic">
                لا توجد أجهزة أو عهد تقنية مسلّمة لهذا الموظف حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="relative overflow-hidden rounded-3xl glass-card p-5 space-y-3 border border-white/50 dark:border-white/10"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-xl text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {asset.type}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-foreground-muted bg-surface px-2 py-0.5 rounded-lg border border-border/40">
                        S/N: {asset.serialNumber}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-foreground text-sm">{asset.name}</h4>
                      <p className="text-[11px] text-foreground-muted">
                        {asset.manufacturer || ''} {asset.model ? `• ${asset.model}` : ''}
                      </p>
                    </div>

                    {asset.notes && (
                      <p className="text-[11px] text-foreground-subtle line-clamp-2 bg-surface p-2 rounded-xl border border-border/30">
                        {asset.notes}
                      </p>
                    )}

                    <div className="pt-2 border-t border-border/20 flex items-center justify-between text-[11px] text-foreground-muted">
                      <span>تاريخ الإضافة:</span>
                      <span className="font-mono">
                        {new Date(asset.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custody Assignment History */}
          <div className="space-y-3 pt-4 border-t border-border/20">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <FiClock className="h-4 w-4 text-brand-gold" />
              <span>السجل التاريخي لجميع العهد المستلمة والمسترجعة ({assetHistory.length})</span>
            </h3>

            {assetHistory.length === 0 ? (
              <div className="p-8 rounded-3xl glass-card text-center text-xs text-foreground-subtle italic">
                لا توجد سجلات تاريخية سابقة لحركات العهدة.
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl glass-card border border-white/40 dark:border-white/10 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-surface-raised/60 text-foreground-muted font-bold border-b border-border/30">
                      <tr>
                        <th className="py-3 px-4">الأصل / الجهاز</th>
                        <th className="py-3 px-4">الرقم التسلسلي</th>
                        <th className="py-3 px-4">تاريخ الاستلام</th>
                        <th className="py-3 px-4">تاريخ الاسترجاع</th>
                        <th className="py-3 px-4">ملاحظات الفحص</th>
                        <th className="py-3 px-4">المسؤول عن التسليم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {assetHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-white/40 dark:hover:bg-white/5">
                          <td className="py-3 px-4 font-extrabold text-foreground">
                            {item.asset?.name || 'جهاز'}
                          </td>
                          <td className="py-3 px-4 font-mono text-foreground-muted">
                            {item.asset?.serialNumber || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {new Date(item.assignedAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {item.returnedAt ? (
                              <span className="text-zinc-600 dark:text-zinc-400">
                                {new Date(item.returnedAt).toLocaleDateString('ar-EG')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                                مستمر كعهدة حالية
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-foreground-muted">
                            {item.conditionNotes || '-'}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-foreground-subtle">
                            {item.assignedBy?.fullName || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: GENERAL PROFILE DETAILS                                        */}
      {/* ===================================================================== */}
      {activeTab === 'PROFILE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl glass-card p-5 space-y-3">
            <h3 className="text-sm font-black text-foreground">تفاصيل التعاقد والعمل</h3>
            <div className="space-y-2 text-xs divide-y divide-border/20">
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">القسم:</span>
                <span className="font-bold text-foreground">{employee.department?.name}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">المسمى الوظيفي:</span>
                <span className="font-bold text-foreground">{employee.position?.name}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">نوع الوردية:</span>
                <span className="font-bold text-brand-gold">{employee.shiftType}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">نوع التوظيف:</span>
                <span className="font-bold text-foreground">{employee.employmentType}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">تاريخ الانضمام:</span>
                <span className="font-mono text-foreground">
                  {new Date(employee.joiningDate).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl glass-card p-5 space-y-3">
            <h3 className="text-sm font-black text-foreground">بيانات الاتصال والعنوان</h3>
            <div className="space-y-2 text-xs divide-y divide-border/20">
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">البريد الإلكتروني:</span>
                <span className="font-mono text-foreground">{employee.user?.email || '-'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">رقم الهاتف:</span>
                <span className="font-mono text-foreground">{employee.phone}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-muted">العنوان:</span>
                <span className="text-foreground">{employee.address || 'غير محدد'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
