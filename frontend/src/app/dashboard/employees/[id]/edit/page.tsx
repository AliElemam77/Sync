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
import { AlertTriangle } from 'lucide-react';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
} from '../../../../../types/employees';

// -----------------------------------------------------------------------------
// ZOD SCHEMA FOR EDIT EMPLOYEE FORM
// -----------------------------------------------------------------------------

const editEmployeeSchema = z.object({
  // 1. Account & Identity
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().optional(),
  isActive: z.boolean(),
  phone: z.string().min(1, 'Phone is required'),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  shiftType: z.enum(['RS', 'LS', 'FS']),
  avatarUrl: z.string().optional(),

  // 2. Employment Details
  company: z.string().min(1, 'Company is required'),
  branch: z.string().min(1, 'Branch is required'),
  departmentId: z.string().min(1, 'Department is required'),
  positionId: z.string().min(1, 'Position is required'),
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
});

type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>;

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params?.id as string;

  const { hasPermission } = useAuth();
  const canManageSalary = hasPermission('employees.manage_salary');

  const { data: employee, isLoading: isEmployeeLoading, isError: isEmployeeError } = useEmployee(employeeId);
  const { data: orgTree, isLoading: isOrgLoading } = useOrganizationTree();
  const updateMutation = useUpdateEmployee();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    },
  });

  const departmentId = watch('departmentId');
  const positionId = watch('positionId');
  const shiftType = watch('shiftType');

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
        annualLeaveDays: employee.annualLeaveDays ?? (employee.shiftType === 'RS' ? 21 : 30),
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
        basicSalary: employee.bankInfo?.basicSalary ? String(employee.bankInfo.basicSalary) : '',
      });
    }
  }, [employee, reset]);

  // Derived filtered positions and levels
  const selectedDepartment = orgTree?.find((d) => d.id === departmentId);
  const availablePositions = selectedDepartment?.positions || [];
  const selectedPosition = availablePositions.find((p) => p.id === positionId);
  const availableLevels = selectedPosition?.levels || [];

  const handleDepartmentChange = (deptId: string) => {
    setValue('departmentId', deptId);
    const dept = orgTree?.find((d) => d.id === deptId);
    const firstPos = dept?.positions?.[0];
    const firstLvl = firstPos?.levels?.[0];

    setValue('positionId', firstPos ? firstPos.id : '');
    setValue('levelId', firstLvl ? firstLvl.id : '');
  };

  const handlePositionChange = (posId: string) => {
    setValue('positionId', posId);
    const pos = availablePositions.find((p) => p.id === posId);
    const firstLvl = pos?.levels?.[0];
    setValue('levelId', firstLvl ? firstLvl.id : '');
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
            data.bankName || data.accountNumber || data.basicSalary
              ? {
                  bankName: data.bankName || undefined,
                  accountHolder: data.accountHolder || undefined,
                  accountNumber: data.accountNumber || undefined,
                  iban: data.iban || undefined,
                  swift: data.swift || undefined,
                  branch: data.bankBranch || undefined,
                  basicSalary: data.basicSalary ? parseFloat(data.basicSalary) : undefined,
                }
              : undefined,
        },
      });

      setSuccessMessage('Employee profile updated successfully!');
      setTimeout(() => {
        router.push('/dashboard/employees');
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || 'Failed to update employee. Please verify required fields.',
      );
    }
  };

  if (isEmployeeLoading || isOrgLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading employee data...</p>
        </div>
      </div>
    );
  }

  if (isEmployeeError || !employee) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <div className="rounded-full bg-red-500/10 p-3 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Employee Not Found</h2>
        <Link
          href="/dashboard/employees"
          className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          Return to Employee Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/dashboard/employees" className="hover:text-indigo-400 transition-colors">
              Employees
            </Link>
            <span>/</span>
            <span className="text-white font-medium">{employee.employeeCode}</span>
            <span>/</span>
            <span>Edit Profile</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Edit Employee: {employee.fullName}</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 font-mono">
              {employee.employeeCode}
            </span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/employees"
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="edit-employee-form"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400">
          {successMessage}
        </div>
      )}

      {/* Main Form */}
      <form id="edit-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Account & Security Credentials */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">1. Account & Authentication</h2>
              <p className="text-xs text-slate-400">Manage user access credentials, active status, and primary email.</p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
              User ID: {employee.user?.email || 'No User Account'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('fullName')}
                className={`w-full rounded-xl border bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  errors.fullName ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'
                }`}
              />
              {errors.fullName && <p className="text-[10px] text-red-400 mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                {...register('email')}
                className={`w-full rounded-xl border bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  errors.email ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'
                }`}
              />
              {errors.email && <p className="text-[10px] text-red-400 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Password <span className="text-slate-500">(Leave blank to keep current)</span>
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="Min 8 characters"
                className={`w-full rounded-xl border bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  errors.password ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'
                }`}
              />
              {errors.password && <p className="text-[10px] text-red-400 mt-1">{errors.password.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Active Status</label>
              <select
                {...register('isActive', { setValueAs: (v) => v === 'true' || v === true })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="true">Active (Allowed to Login)</option>
                <option value="false">Suspended / Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('phone')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Gender</label>
              <select
                {...register('gender')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth</label>
              <input
                type="date"
                {...register('dob')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Employment & Organization Hierarchy */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">2. Organization & Employment Placement</h2>
            <p className="text-xs text-slate-400">Assign department, job title position, seniority level, and shift policies.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department <span className="text-red-400">*</span>
              </label>
              <select
                value={departmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Department</option>
                {orgTree?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Position <span className="text-red-400">*</span>
              </label>
              <select
                value={positionId}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Position</option>
                {availablePositions.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Seniority Level</label>
              <select
                {...register('levelId')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Level (Optional)</option>
                {availableLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} (Rank: {lvl.rank})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Shift Type</label>
              <select
                {...register('shiftType')}
                onChange={(e) => {
                  const s = e.target.value;
                  setValue('shiftType', s as ShiftType);
                  if (s === 'RS') setValue('annualLeaveDays', 21);
                  else if (s === 'LS') setValue('annualLeaveDays', 30);
                  else if (s === 'FS') setValue('annualLeaveDays', 30);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="RS">RS (Regular - 21 Days)</option>
                <option value="LS">LS (Long Shift - 30 Days)</option>
                <option value="FS">FS (Full Shift - 30 Days)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Employment Type</label>
              <select
                {...register('employmentType')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Employment Status</label>
              <select
                {...register('status')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="PROBATION">Probation</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Joining Date</label>
              <input
                type="date"
                {...register('joiningDate')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. Emergency Contact */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">3. Emergency Contact</h2>
            <p className="text-xs text-slate-400">Primary point of contact during emergency situations.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contact Name</label>
              <input
                type="text"
                {...register('emergencyName')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Relationship</label>
              <select
                {...register('emergencyRelationship')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="BROTHER">Brother</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="FRIEND">Friend</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Phone</label>
              <input
                type="text"
                {...register('emergencyPhone')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Bank Information & Compensation */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">4. Bank & Payroll Compensation</h2>
            <p className="text-xs text-slate-400">Direct deposit account specifications and basic salary definition.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Name</label>
              <input
                type="text"
                {...register('bankName')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Holder Name</label>
              <input
                type="text"
                {...register('accountHolder')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Number</label>
              <input
                type="text"
                {...register('accountNumber')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">IBAN</label>
              <input
                type="text"
                {...register('iban')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">SWIFT / BIC Code</label>
              <input
                type="text"
                {...register('swift')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Branch</label>
              <input
                type="text"
                {...register('bankBranch')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Basic Salary (EGP) {!canManageSalary && <span className="text-slate-500">(Read Only)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                disabled={!canManageSalary}
                {...register('basicSalary')}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white disabled:opacity-50 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <Link
            href="/dashboard/employees"
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
