'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEmployee, useUpdateEmployee } from '../../../../../hooks/use-employees';
import { useOrganizationTree } from '../../../../../hooks/use-organization';
import { useAuth } from '../../../../../hooks/use-auth';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
} from '../../../../../types/employees';
import {
  FiUser,
  FiBriefcase,
  FiPhoneCall,
  FiDollarSign,
  FiSave,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheckCircle,
  FiArrowLeft,
  FiShield,
} from 'react-icons/fi';
import { canAccessEmployees } from '../../../../../lib/permissions';

// -----------------------------------------------------------------------------
// ZOD SCHEMA FOR EDIT EMPLOYEE FORM
// -----------------------------------------------------------------------------

const editEmployeeSchema = z.object({
  // 1. Account & Identity
  fullName: z.string().min(1, 'الاسم بالكامل مطلوب'),
  email: z.string().email('يرجى إدخال بريد إلكتروني صحيح'),
  password: z.string().optional(),
  isActive: z.boolean(),
  phone: z.string().min(1, 'رقم الهاتف مطلوب'),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  shiftType: z.enum(['RS', 'LS', 'FS']),
  avatarUrl: z.string().optional(),

  // 2. Employment Details
  company: z.string().min(1, 'اسم الشركة مطلوب'),
  branch: z.string().min(1, 'اسم الفرع مطلوب'),
  departmentId: z.string().min(1, 'يرجى اختيار القسم'),
  positionId: z.string().min(1, 'يرجى اختيار المسمى الوظيفي'),
  levelId: z.string().optional(),
  joiningDate: z.string().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  status: z.enum(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']),
  annualLeaveDays: z.number().min(0),
  monthlyPermissionHours: z.number().min(0),

  // 3. Contact Info
  address: z.string().optional(),
  altPhone: z.string().optional(),

  // 4. Emergency Contact
  emergencyName: z.string().optional(),
  emergencyRelationship: z.string().optional(),
  emergencyPhone: z.string().optional(),

  // 5. Bank Info
  bankName: z.string().optional(),
  accountHolder: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  bankBranch: z.string().optional(),
  basicSalary: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
});

type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params?.id as string;

  const { user, hasPermission } = useAuth();
  const hasAccess = canAccessEmployees(user);
  const canManageSalary = hasPermission('employees.manage_salary');

  const { data: employee, isLoading: isEmployeeLoading, isError: isEmployeeError } = useEmployee(
    hasAccess ? employeeId : '',
  );
  const { data: orgTree, isLoading: isOrgLoading } = useOrganizationTree();
  const updateMutation = useUpdateEmployee();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4 animate-in fade-in">
        <div className="h-16 w-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-inner">
          <FiAlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">الوصول مقيد (Restricted Access)</h2>
        <p className="text-xs text-foreground-muted max-w-md leading-relaxed">
          عذراً، تعديل بيانات الكوادر والموظفين مخصص حصرياً لأعضاء قسم الموارد البشرية (HR) والإدارة العامة (Management).
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
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      isActive: true,
      phone: '',
      dob: '',
      gender: 'MALE',
      shiftType: 'RS',
      avatarUrl: '',
      company: 'Tawfeer',
      branch: 'Cairo HQ',
      departmentId: '',
      positionId: '',
      levelId: '',
      joiningDate: '',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      annualLeaveDays: 21,
      monthlyPermissionHours: 4,
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

  // Initialize form when employee data loads
  useEffect(() => {
    if (employee) {
      reset({
        fullName: employee.fullName || '',
        email: employee.user?.email || '',
        password: '',
        isActive: employee.user?.isActive ?? true,
        phone: employee.phone || '',
        dob: employee.dob ? new Date(employee.dob).toISOString().split('T')[0] : '',
        gender: (employee.gender as any) || 'MALE',
        shiftType: (employee.shiftType as any) || 'RS',
        avatarUrl: employee.avatarUrl || '',
        company: employee.company || 'Tawfeer',
        branch: employee.branch || 'Cairo HQ',
        departmentId: employee.departmentId || '',
        positionId: employee.positionId || '',
        levelId: employee.levelId || '',
        joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
        employmentType: (employee.employmentType as any) || 'FULL_TIME',
        status: (employee.status as any) || 'ACTIVE',
        // Decimal balance (accrues 1.75 days/month); the API serializes it as a string
        annualLeaveDays: Number(employee.annualLeaveDays ?? 0),
        monthlyPermissionHours: employee.monthlyPermissionHours ?? 4,
        address: employee.address || '',
        altPhone: employee.altPhone || '',
        emergencyName: employee.emergencyContact?.name || '',
        emergencyRelationship: (employee.emergencyContact?.relationship as any) || 'OTHER',
        emergencyPhone: employee.emergencyContact?.phone || '',
        bankName: employee.bankInfo?.bankName || '',
        accountHolder: employee.bankInfo?.accountHolder || '',
        accountNumber: employee.bankInfo?.accountNumber || '',
        iban: employee.bankInfo?.iban || '',
        swift: employee.bankInfo?.swift || '',
        bankBranch: employee.bankInfo?.branch || '',
        basicSalary: employee.salaryProfile ? String(Number(employee.salaryProfile.baseSalary)) : '',
        paymentMethod: employee.salaryProfile?.paymentMethod || 'BANK_TRANSFER',
      });

      if (employee.managedDepartments && employee.managedDepartments.length > 0) {
        setManagedDeptIds(employee.managedDepartments.map((d) => d.id));
      } else if (employee.departmentId) {
        setManagedDeptIds([employee.departmentId]);
      }
    }
  }, [employee, reset]);

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

  const onSubmit = async (data: EditEmployeeFormData) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateMutation.mutateAsync({
        id: employeeId,
        data: {
          fullName: data.fullName,
          email: data.email,
          ...(data.password ? { password: data.password } : {}),
          isActive: data.isActive,
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
          annualLeaveDays: Number(data.annualLeaveDays),
          monthlyPermissionHours: Number(data.monthlyPermissionHours),
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
          managedDepartmentIds: isHeadPosition ? managedDeptIds : [],
        },
      });

      setSuccessMessage('تم تحديث الملف الشخصي للموظف بنجاح!');
      setTimeout(() => {
        router.push('/dashboard/employees');
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || 'فشل تحديث بيانات الموظف. يرجى مراجعة الحقول المطلوبة.',
      );
    }
  };

  if (isEmployeeLoading || isOrgLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-foreground-muted font-bold animate-pulse">جاري تحميل بيانات الموظف...</p>
        </div>
      </div>
    );
  }

  if (isEmployeeError || !employee) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
        <div className="rounded-3xl bg-rose-500/10 p-4 text-rose-500">
          <FiAlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-black text-foreground">لم يتم العثور على الموظف</h2>
        <Link
          href="/dashboard/employees"
          className="rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md"
        >
          العودة لسجل الموظفين
        </Link>
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
            <span className="text-foreground font-mono font-bold">{employee.employeeCode}</span>
            <span>/</span>
            <span className="text-foreground font-medium">تعديل الملف</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span>تعديل بيانات: {employee.fullName}</span>
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-mono font-bold">
              {employee.employeeCode}
            </span>
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
            form="edit-employee-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-6 py-2.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FiSave className="h-4 w-4" />
            <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2">
          <FiAlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <FiCheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Form */}
      <form id="edit-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Account & Security Credentials */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FiUser className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-foreground">1. بيانات الحساب والمصادقة</h2>
                <p className="text-[11px] text-foreground-muted">بيانات تسجيل الدخول، البريد، وحالة التفعيل.</p>
              </div>
            </div>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20 font-bold">
              {employee.user?.email || 'بدون حساب مستخدم'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                الاسم بالكامل <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('fullName')}
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
                className={`w-full rounded-2xl border bg-surface px-3.5 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none ${
                  errors.email ? 'border-rose-500' : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                }`}
              />
              {errors.email && <p className="text-[10px] text-rose-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                كلمة مرور جديدة <span className="text-foreground-subtle font-normal">(اتركها فارغة للإبقاء على الحالية)</span>
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
              <label className="block text-xs font-bold text-foreground-muted mb-1">حالة تفعيل الحساب</label>
              <select
                {...register('isActive', { setValueAs: (v) => v === 'true' || v === true })}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="true">مفعل (يسمح له بتسجيل الدخول)</option>
                <option value="false">معطل / موقوف</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                رقم الهاتف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('phone')}
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
          </div>
        </div>

        {/* 2. Employment & Organization Hierarchy */}
        <div className="rounded-3xl border border-card-border bg-card/80 dark:bg-card/70 p-6 backdrop-blur-xl space-y-4 shadow-xs">
          <div className="border-b border-border/20 pb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <FiBriefcase className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">2. التسكين الوظيفي والرصيد الإجازات</h2>
              <p className="text-[11px] text-foreground-muted">تحديد القسم، المسمى الوظيفي، الدرجة، ورصيد الإجازات والأذونات.</p>
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
                بصفتك تعدل بيانات رئيس قسم (Head)، حدد كافة الأقسام التي يديرها ويترأسها (مثل: SEO + UI/UX + Marketing):
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
                onChange={(e) => {
                  // Changing the shift must not overwrite the accrued leave balance
                  setValue('shiftType', e.target.value as ShiftType);
                }}
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
                <option value="ON_LEAVE">في إجازة (On Leave)</option>
                <option value="INACTIVE">غير نشط (Inactive)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">تاريخ الالتحاق</label>
              <input
                type="date"
                {...register('joiningDate')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رصيد الإجازات السنوية (أيام)</label>
              <input
                type="number"
                step="0.25"
                {...register('annualLeaveDays', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رصيد الأذونات الشهرية (ساعات)</label>
              <input
                type="number"
                {...register('monthlyPermissionHours', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono font-bold"
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
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Bank Information & Compensation */}
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
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">اسم صاحب الحساب</label>
              <input
                type="text"
                {...register('accountHolder')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">رقم الحساب</label>
              <input
                type="text"
                {...register('accountNumber')}
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
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">كود السويفت (SWIFT)</label>
              <input
                type="text"
                {...register('swift')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">فرع البنك</label>
              <input
                type="text"
                {...register('bankBranch')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">
                الراتب الأساسي الشهري (ج.م) {!canManageSalary && <span className="text-foreground-subtle font-normal">(للقراءة فقط)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!canManageSalary}
                {...register('basicSalary')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground disabled:opacity-50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground-muted mb-1">طريقة القبض</label>
              <select
                disabled={!canManageSalary}
                {...register('paymentMethod')}
                className="w-full rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground disabled:opacity-50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
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
            <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

