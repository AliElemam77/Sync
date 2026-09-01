'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNextEmployeeCode, useCreateEmployee } from '../../../../hooks/use-employees';
import { useOrganizationTree } from '../../../../hooks/use-organization';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
} from '../../../../types/employees';

// -----------------------------------------------------------------------------
// ZOD SCHEMA FOR ADD EMPLOYEE FORM
// -----------------------------------------------------------------------------

const addEmployeeSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().min(1, 'Phone number is required'),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  shiftType: z.enum(['RS', 'LS', 'FS']),
  avatarUrl: z.string().optional(),

  company: z.string().min(1, 'Company name is required'),
  branch: z.string().min(1, 'Branch location is required'),
  departmentId: z.string().min(1, 'Department is required'),
  positionId: z.string().min(1, 'Position is required'),
  levelId: z.string().optional(),
  joiningDate: z.string().min(1, 'Joining date is required'),
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
});

type AddEmployeeFormData = z.infer<typeof addEmployeeSchema>;

export default function AddEmployeePage() {
  const router = useRouter();
  const { data: nextCode, isLoading: isCodeLoading } = useNextEmployeeCode();
  const { data: orgTree, isLoading: isOrgLoading } = useOrganizationTree();
  const createMutation = useCreateEmployee();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      branch: 'Cairo HQ',
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
    },
  });

  const departmentId = watch('departmentId');
  const positionId = watch('positionId');

  // Set default department & position when orgTree loads
  useEffect(() => {
    if (orgTree && orgTree.length > 0 && !departmentId) {
      const firstDept = orgTree[0];
      const firstPos = firstDept.positions?.[0];
      const firstLvl = firstPos?.levels?.[0];

      setValue('departmentId', firstDept.id);
      setValue('positionId', firstPos ? firstPos.id : '');
      setValue('levelId', firstLvl ? firstLvl.id : '');
    }
  }, [orgTree, departmentId, setValue]);

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
      });

      router.push('/dashboard/employees');
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || 'Failed to create employee. Please verify required fields.',
      );
    }
  };

  if (isCodeLoading || isOrgLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading form dependencies...</p>
        </div>
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
            <span>New Employee Enrollment</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>New Employee Registration</span>
            {nextCode && (
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-500/20 font-mono">
                Assigned Code: {nextCode}
              </span>
            )}
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
            form="add-employee-form"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            <span>{isSubmitting ? 'Registering...' : 'Save & Register Employee'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Form */}
      <form id="add-employee-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Account & Personal Identity */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">1. Account & Personal Identity</h2>
            <p className="text-xs text-slate-400">Credentials for logging into Sync ERP and primary personal identity.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('fullName')}
                placeholder="e.g. Mahmoud Ali"
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
                placeholder="mahmoud.ali@sync-erp.local"
                className={`w-full rounded-xl border bg-slate-800/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none ${
                  errors.email ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'
                }`}
              />
              {errors.email && <p className="text-[10px] text-red-400 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Initial Password <span className="text-red-400">*</span>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                {...register('phone')}
                placeholder="+20 100 000 0000"
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Avatar Image URL</label>
              <input
                type="url"
                {...register('avatarUrl')}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Employment & Hierarchy */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">2. Organization & Employment Placement</h2>
            <p className="text-xs text-slate-400">Assign department, job title, and shift schedule.</p>
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
            <p className="text-xs text-slate-400">Point of contact for emergency notifications.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contact Name</label>
              <input
                type="text"
                {...register('emergencyName')}
                placeholder="e.g. Ibrahim Ali"
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
                placeholder="+20 100 000 0000"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Bank Information & Payroll */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">4. Bank & Payroll Compensation</h2>
            <p className="text-xs text-slate-400">Direct deposit banking info and basic compensation.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Name</label>
              <input
                type="text"
                {...register('bankName')}
                placeholder="e.g. CIB / QNB"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Holder Name</label>
              <input
                type="text"
                {...register('accountHolder')}
                placeholder="Full Name as in Bank"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Number</label>
              <input
                type="text"
                {...register('accountNumber')}
                placeholder="Account number"
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
                placeholder="EG..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">SWIFT / BIC Code</label>
              <input
                type="text"
                {...register('swift')}
                placeholder="e.g. CIBEEGCX"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Bank Branch</label>
              <input
                type="text"
                {...register('bankBranch')}
                placeholder="Branch name"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Basic Salary (EGP)</label>
              <input
                type="number"
                step="0.01"
                {...register('basicSalary')}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
            {isSubmitting ? 'Registering...' : 'Save & Register Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
