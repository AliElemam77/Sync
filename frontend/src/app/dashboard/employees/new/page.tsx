'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNextEmployeeCode, useCreateEmployee } from '../../../../hooks/use-employees';
import { useOrganizationTree } from '../../../../hooks/use-organization';
import { useAuth } from '../../../../hooks/use-auth';
import { canAccessEmployees } from '../../../../lib/permissions';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
} from '../../../../types/employees';
import {
  FiUser,
  FiBriefcase,
  FiPhoneCall,
  FiDollarSign,
  FiArrowLeft,
  FiSave,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';

// -----------------------------------------------------------------------------
// ZOD SCHEMA FOR ADD EMPLOYEE FORM
// -----------------------------------------------------------------------------

const addEmployeeSchema = z.object({
  fullName: z.string().min(1, 'الاسم بالكامل مطلوب'),
  email: z.string().email('يرجى إدخال بريد إلكتروني صحيح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  phone: z.string().min(1, 'رقم الهاتف مطلوب'),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  shiftType: z.enum(['RS', 'LS', 'FS']),
  avatarUrl: z.string().optional(),

  company: z.string().min(1, 'اسم الشركة مطلوب'),
  branch: z.string().min(1, 'اسم الفرع مطلوب'),
  departmentId: z.string().min(1, 'يرجى اختيار القسم'),
  positionId: z.string().min(1, 'يرجى اختيار المسمى الوظيفي'),
  levelId: z.string().optional(),
  joiningDate: z.string().min(1, 'تاريخ الالتحاق مطلوب'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']),

  address: z.string().optional(),
  altPhone: z.string().optional(),

  emergencyName: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyPhone: z.string().optional(),

  bankName: z.string().optional(),
  accountHolder: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  bankBranch: z.string().optional(),
  basicSalary: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
});

type AddEmployeeFormData = z.infer<typeof addEmployeeSchema>;

export default function AddEmployeePage() {
  const router = useRouter();
  const { user } = useAuth();
  const hasAccess = canAccessEmployees(user);

  const { data: nextCode, isLoading: isCodeLoading } = useNextEmployeeCode();
  const { data: orgTree, isLoading: isOrgLoading } = useOrganizationTree();
  const createMutation = useCreateEmployee();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4 animate-in fade-in">
        <div className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
          <FiAlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">الوصول مقيد (Restricted Access)</h2>
        <p className="text-xs text-foreground-muted max-w-md leading-relaxed">
          عذراً، إضافة كوادر وتعيين موظفين جدد مخصص حصرياً لأعضاء قسم الموارد البشرية (HR) والإدارة العامة (Management).
        </p>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black shadow-md transition-all active:scale-95"
        >
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AddEmployeeFormData>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      phone: '',
      dob: '',
      gender: 'MALE',
      shiftType: 'RS',
      avatarUrl: '',
      company: 'Tawfeer',
      branch: 'المقر الرئيسي (Cairo HQ)',
      departmentId: '',
      positionId: '',
      levelId: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      address: '',
      altPhone: '',
      emergencyName: '',
      emergencyRelationship: 'OTHER',
      emergencyPhone: '',
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      iban: '',
      swift: '',
      bankBranch: '',
      basicSalary: '',
      paymentMethod: 'BANK_TRANSFER',
    },
  });

  const departmentId = watch('departmentId');
  const positionId = watch('positionId');
  const [managedDeptIds, setManagedDeptIds] = useState<string[]>([]);

  // Set default department & position when orgTree loads
  useEffect(() => {
    if (orgTree && orgTree.length > 0 && !departmentId) {
      const firstDept = orgTree[0];
      const firstPos = firstDept.positions?.[0];
      const firstLvl = firstPos?.levels?.[0];

      setValue('departmentId', firstDept.id);
      setValue('positionId', firstPos ? firstPos.id : '');
      setValue('levelId', firstLvl ? firstLvl.id : '');
      setManagedDeptIds([firstDept.id]);
    }
  }, [orgTree, departmentId, setValue]);

  // Derived filtered positions and levels
  const selectedDepartment = orgTree?.find((d) => d.id === departmentId);
  const availablePositions = selectedDepartment?.positions || [];
  const selectedPosition = availablePositions.find((p) => p.id === positionId);
  const availableLevels = selectedPosition?.levels || [];

  const isHeadPosition =
    selectedPosition?.name?.toLowerCase().includes('head') ||
    selectedPosition?.name?.includes('رئيس') ||
    selectedPosition?.name?.includes('مدير إدارة');

  const handleDepartmentChange = (deptId: string) => {
    setValue('departmentId', deptId);
    const dept = orgTree?.find((d) => d.id === deptId);
    const firstPos = dept?.positions?.[0];
    const firstLvl = firstPos?.levels?.[0];

    setValue('positionId', firstPos ? firstPos.id : '');
    setValue('levelId', firstLvl ? firstLvl.id : '');

    // If managedDeptIds is empty or single home dept, sync it
    if (managedDeptIds.length <= 1) {
      setManagedDeptIds([deptId]);
    }
  };

  const handlePositionChange = (posId: string) => {
    setValue('positionId', posId);
    const pos = availablePositions.find((p) => p.id === posId);
    const firstLvl = pos?.levels?.[0];
    setValue('levelId', firstLvl ? firstLvl.id : '');

    const isNewHead =
      pos?.name?.toLowerCase().includes('head') ||
      pos?.name?.includes('رئيس') ||
      pos?.name?.includes('مدير إدارة');

    if (isNewHead && managedDeptIds.length === 0 && departmentId) {
      setManagedDeptIds([departmentId]);
    }
  };

  const onSubmit = async (data: AddEmployeeFormData) => {
    setErrorMessage(null);

    try {
      await createMutation.mutateAsync({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone,
        dob: data.dob || undefined,
        gender: data.gender as Gender,
        shiftType: data.shiftType as ShiftType,
        avatarUrl: data.avatarUrl || undefined,
        company: data.company,
        branch: data.branch,
        departmentId: data.departmentId,
        positionId: data.positionId,
        levelId: data.levelId || undefined,
        joiningDate: data.joiningDate || undefined,
        employmentType: data.employmentType as EmploymentType,
        status: data.status as EmployeeStatus,
        address: data.address || undefined,
        altPhone: data.altPhone || undefined,
        emergencyContact: data.emergencyName
          ? {
              name: data.emergencyName,
              relationship: data.emergencyRelationship as EmergencyRelationship,
              phone: data.emergencyPhone || data.phone,
            }
          : undefined,
        bankInfo:
          data.bankName || data.accountNumber || data.iban
            ? {
                bankName: data.bankName || undefined,
                accountHolder: data.accountHolder || undefined,
                accountNumber: data.accountNumber || undefined,
                iban: data.iban || undefined,
                swift: data.swift || undefined,
                branch: data.bankBranch || undefined,
              }
            : undefined,
        // The salary lives in the salary profile, independent of bank details (some staff are paid cash)
        salary: data.basicSalary
          ? { baseSalary: parseFloat(data.basicSalary), paymentMethod: data.paymentMethod }
          : undefined,
        managedDepartmentIds:
          isHeadPosition && managedDeptIds.length > 0 ? managedDeptIds : undefined,
      });

      router.push('/dashboard/employees');
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || 'فشل تسجيل الموظف. يرجى التحقق من صحة الحقول المطلوبة.',
      );
    }
  };

  if (isCodeLoading || isOrgLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-foreground-muted font-bold animate-pulse">جاري تحميل بيانات التسكين الوظيفي...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-foreground-muted mb-1">
            <Link href="/dashboard/employees" className="hover:text-primary transition-colors">
              دليل الموظفين
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">تسجيل موظف جديد</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>تسجيل موظف جديد في المنظومة</span>
            {nextCode && (
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-mono font-bold">
                الكود المخصص: {nextCode}
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/employees"
            className="rounded-2xl border border-border bg-surface hover:bg-surface-hover px-4 py-2.5 text-xs font-bold text-foreground transition-all"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            form="add-employee-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-6 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FiSave className="h-4 w-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتسجيل الموظف'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
          <FiAlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form id="add-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Account & Personal Identity */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FiUser className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">1. بيانات الحساب والهوية الشخصية</h2>
              <p className="text-[11px] text-foreground-muted">بيانات تسجيل الدخول إلى Sync ERP والهوية الأساسية للموظف.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                الاسم بالكامل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('fullName')}
                placeholder="مثال: محمود علي أحمد"
                className={`w-full rounded-2xl border bg-surface px-3.5 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none ${
                  errors.fullName ? 'border-rose-500' : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.fullName && <p className="text-[10px] text-rose-500 mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                البريد الإلكتروني <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="mahmoud.ali@sync-erp.local"
                className={`w-full rounded-2xl border bg-surface px-3.5 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none ${
                  errors.email ? 'border-rose-500' : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.email && <p className="text-[10px] text-rose-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                كلمة المرور الأولية <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="8 أحرف على الأقل"
                className={`w-full rounded-2xl border bg-surface px-3.5 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none font-mono ${
                  errors.password ? 'border-rose-500' : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.password && <p className="text-[10px] text-rose-500 mt-1">{errors.password.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                رقم الهاتف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('phone')}
                placeholder="+20 100 000 0000"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">النوع / الجنس</label>
              <select
                {...register('gender')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="MALE">ذكر</option>
                <option value="FEMALE">أنثى</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">تاريخ الميلاد</label>
              <input
                type="date"
                {...register('dob')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رابط الصورة الرمزية (Avatar)</label>
              <input
                type="url"
                {...register('avatarUrl')}
                placeholder="https://..."
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Employment & Hierarchy */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <FiBriefcase className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">2. التسكين الوظيفي ونظام الورديات</h2>
              <p className="text-[11px] text-foreground-muted">تحديد القسم، المسمى الوظيفي، الدرجة، وجدول ساعات العمل.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                القسم <span className="text-rose-500">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="">اختر القسم</option>
                {orgTree?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                المسمى الوظيفي <span className="text-rose-500">*</span>
              </label>
              <select
                value={positionId}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="">اختر المسمى الوظيفي</option>
                {availablePositions.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">المستوى والدرجة الوظيفية</label>
              <select
                {...register('levelId')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="">اختر المستوى (اختياري)</option>
                {availableLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} (رتبة: {lvl.rank})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Department Selector for Heads */}
          {isHeadPosition && (
            <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-brand-gold flex items-center gap-1.5">
                  <FiCheckCircle className="h-4 w-4" />
                  <span>الأقسام المدارة تحت إشراف رئيس القسم (Multi-Department Management)</span>
                </label>
                <span className="text-[11px] text-foreground-muted font-bold font-mono">
                  تم تحديد {managedDeptIds.length} قسم
                </span>
              </div>
              <p className="text-[11px] text-foreground-muted leading-relaxed">
                بصفتك تعين رئيساً للأقسام (Head)، حدد كافة الأقسام التي يديرها ويترأسها (مثل: SEO + UI/UX + Marketing):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {orgTree?.map((dept) => {
                  const isSelected = managedDeptIds.includes(dept.id);
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        setManagedDeptIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== dept.id)
                            : [...prev, dept.id],
                        );
                      }}
                      className={`p-2.5 rounded-xl border text-right text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-brand-gold/20 text-brand-gold border-brand-gold shadow-xs'
                          : 'bg-surface/80 text-foreground border-border/40 hover:bg-surface'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold">{dept.name}</div>
                        <div className="text-[10px] font-mono text-foreground-muted">{dept.code}</div>
                      </div>
                      {isSelected && <FiCheckCircle className="h-4 w-4 text-brand-gold shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">نظام الوردية (Shift)</label>
              <select
                {...register('shiftType')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="RS">RS (عادية - 6 أيام، 8 ساعات)</option>
                <option value="LS">LS (طويلة - 5 أيام، 9 ساعات)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">نوع التوظيف</label>
              <select
                {...register('employmentType')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="FULL_TIME">دوام كامل (Full Time)</option>
                <option value="PART_TIME">دوام جزئي (Part Time)</option>
                <option value="TRAINING">تدريب (Internship)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">حالة الموظف</label>
              <select
                {...register('status')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="ACTIVE">نشط (Active)</option>
                <option value="PROBATION">تحت الاختبار (Probation)</option>
                <option value="INACTIVE">غير نشط (Inactive)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">تاريخ بدء العمل</label>
              <input
                type="date"
                {...register('joiningDate')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. Emergency Contact */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <FiPhoneCall className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">3. جهة اتصال الطوارئ</h2>
              <p className="text-[11px] text-foreground-muted">الشخص المعتمد للتواصل معه في الحالات الطارئة.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">اسم جهة الاتصال</label>
              <input
                type="text"
                {...register('emergencyName')}
                placeholder="مثال: إبراهيم علي"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">صلة القرابة</label>
              <select
                {...register('emergencyRelationship')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="FATHER">أب</option>
                <option value="MOTHER">أم</option>
                <option value="BROTHER">أخ</option>
                <option value="SISTER">أخت</option>
                <option value="SPOUSE">زوج / زوجة</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">هاتف الطوارئ</label>
              <input
                type="text"
                {...register('emergencyPhone')}
                placeholder="+20 100 000 0000"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Bank Information & Payroll */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <FiDollarSign className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">4. الراتب وطريقة القبض والبيانات البنكية</h2>
              <p className="text-[11px] text-foreground-muted">البيانات البنكية مطلوبة فقط لمن يقبض بالتحويل البنكي.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">اسم البنك</label>
              <input
                type="text"
                {...register('bankName')}
                placeholder="مثال: البنك الأهلي / CIB"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">اسم صاحب الحساب</label>
              <input
                type="text"
                {...register('accountHolder')}
                placeholder="الاسم كما هو مدون في البنك"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رقم الحساب</label>
              <input
                type="text"
                {...register('accountNumber')}
                placeholder="Account number"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رقم الآيبان (IBAN)</label>
              <input
                type="text"
                {...register('iban')}
                placeholder="EG..."
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">كود السويفت (SWIFT)</label>
              <input
                type="text"
                {...register('swift')}
                placeholder="CIBEEGCX"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">فرع البنك</label>
              <input
                type="text"
                {...register('bankBranch')}
                placeholder="اسم الفرع"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">الراتب الأساسي الشهري (ج.م)</label>
              <input
                type="number"
                step="0.01"
                {...register('basicSalary')}
                placeholder="0.00"
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">طريقة القبض</label>
              <select
                {...register('paymentMethod')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
              >
                <option value="BANK_TRANSFER">تحويل بنكي</option>
                <option value="CASH">نقدي (كاش)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/employees"
            className="rounded-2xl border border-border bg-surface hover:bg-surface-hover px-5 py-2.5 text-xs font-bold text-foreground transition-all"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-7 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FiSave className="h-4 w-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتسجيل الموظف'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

