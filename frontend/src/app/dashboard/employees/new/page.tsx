'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNextEmployeeCode, useCreateEmployee } from '../../../../hooks/use-employees';
import { useOrganizationTree } from '../../../../hooks/use-organization';
import {
  Gender,
  ShiftType,
  EmploymentType,
  EmployeeStatus,
  EmergencyRelationship,
  DocumentType,
} from '../../../../types/employees';

export default function AddEmployeePage() {
  const router = useRouter();
  const { data: nextCode, isLoading: isCodeLoading } = useNextEmployeeCode();
  const { data: orgTree, isLoading: isOrgLoading } = useOrganizationTree();
  const createMutation = useCreateEmployee();

  // Form State
  const [form, setForm] = useState({
    // 1. Basic Info
    fullName: '',
    email: '',
    password: '',
    phone: '',
    dob: '',
    gender: 'MALE' as Gender,
    shiftType: 'RS' as ShiftType,
    avatarUrl: '',

    // 2. Employment Details
    company: 'Tawfeer',
    branch: 'Cairo HQ',
    departmentId: '',
    positionId: '',
    levelId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employmentType: 'FULL_TIME' as EmploymentType,
    status: 'ACTIVE' as EmployeeStatus,

    // 3. Contact Info
    address: '',
    altPhone: '',

    // 4. Emergency Contact
    emergencyName: '',
    emergencyRelationship: 'FATHER' as EmergencyRelationship,
    emergencyPhone: '',

    // 5. Bank Info
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    iban: '',
    swift: '',
    bankBranch: '',
    basicSalary: '',

    // 6. Documents
    docType: 'NATIONAL_ID' as DocumentType,
    docFileName: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default department & position when orgTree loads
  useEffect(() => {
    if (orgTree && orgTree.length > 0 && !form.departmentId) {
      const firstDept = orgTree[0];
      const firstPos = firstDept.positions?.[0];
      const firstLvl = firstPos?.levels?.[0];

      setForm((prev) => ({
        ...prev,
        departmentId: firstDept.id,
        positionId: firstPos ? firstPos.id : '',
        levelId: firstLvl ? firstLvl.id : '',
      }));
    }
  }, [orgTree, form.departmentId]);

  // Derived filtered positions and levels
  const selectedDepartment = orgTree?.find((d) => d.id === form.departmentId);
  const availablePositions = selectedDepartment?.positions || [];
  const selectedPosition = availablePositions.find((p) => p.id === form.positionId);
  const availableLevels = selectedPosition?.levels || [];

  const handleDepartmentChange = (deptId: string) => {
    const dept = orgTree?.find((d) => d.id === deptId);
    const firstPos = dept?.positions?.[0];
    const firstLvl = firstPos?.levels?.[0];

    setForm((prev) => ({
      ...prev,
      departmentId: deptId,
      positionId: firstPos ? firstPos.id : '',
      levelId: firstLvl ? firstLvl.id : '',
    }));
  };

  const handlePositionChange = (posId: string) => {
    const pos = availablePositions.find((p) => p.id === posId);
    const firstLvl = pos?.levels?.[0];

    setForm((prev) => ({
      ...prev,
      positionId: posId,
      levelId: firstLvl ? firstLvl.id : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (form.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        dob: form.dob || undefined,
        gender: form.gender,
        shiftType: form.shiftType,
        avatarUrl: form.avatarUrl || undefined,
        company: form.company,
        branch: form.branch,
        departmentId: form.departmentId,
        positionId: form.positionId,
        levelId: form.levelId || undefined,
        joiningDate: form.joiningDate || undefined,
        employmentType: form.employmentType,
        status: form.status,
        address: form.address || undefined,
        altPhone: form.altPhone || undefined,
        ...(form.emergencyName && {
          emergencyContact: {
            name: form.emergencyName,
            relationship: form.emergencyRelationship,
            phone: form.emergencyPhone,
          },
        }),
        ...(form.bankName || form.accountNumber || form.basicSalary
          ? {
              bankInfo: {
                bankName: form.bankName || undefined,
                accountHolder: form.accountHolder || form.fullName,
                accountNumber: form.accountNumber || undefined,
                iban: form.iban || undefined,
                swift: form.swift || undefined,
                branch: form.bankBranch || undefined,
                basicSalary: form.basicSalary ? Number(form.basicSalary) : 0,
              },
            }
          : undefined),
      });

      router.push('/dashboard/employees');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create employee profile';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Top Header with Back Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/employees"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-bold shadow-sm"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Add New Employee</h1>
            <p className="text-xs text-slate-400">
              Create an employee profile, assign organization units, and provision user credentials.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/employees"
            className="rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="add-employee-form"
            disabled={createMutation.isPending}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {createMutation.isPending ? 'Saving...' : 'Save Employee'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      <form id="add-employee-form" onSubmit={handleSubmit} className="space-y-6">
        {/* ===================================================================
            SECTION 1: المعلومات الأساسية (Basic Info)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>1. المعلومات الأساسية (Basic Info)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Step 1 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Mostafa Mahmoud"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Employee Code (Auto/Disabled) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Employee Code (Auto-Generated)
              </label>
              <input
                type="text"
                disabled
                value={isCodeLoading ? 'Generating...' : nextCode || 'TAR0002'}
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-indigo-400 font-mono font-bold cursor-not-allowed"
              />
            </div>

            {/* Work Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="mostafa@sync-erp.local"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+20 100 000 0000"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* DOB */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Initial Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Initial Password <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Gender (Radio) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Gender</label>
              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="MALE"
                    checked={form.gender === 'MALE'}
                    onChange={() => setForm({ ...form, gender: 'MALE' })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Male (ذكر)</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    value="FEMALE"
                    checked={form.gender === 'FEMALE'}
                    onChange={() => setForm({ ...form, gender: 'FEMALE' })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Female (أنثى)</span>
                </label>
              </div>
            </div>

            {/* Shift Type (Dropdown) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Shift Type (نوع الوردية)
              </label>
              <select
                value={form.shiftType}
                onChange={(e) => setForm({ ...form, shiftType: e.target.value as ShiftType })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="RS">Regular Shift (RS: 6 Days, 8 Hours/day)</option>
                <option value="LS">Long Shift (LS: 5 Days, 9 Hours/day)</option>
              </select>
            </div>

            {/* Profile Photo */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Avatar / Photo URL</label>
              <input
                type="url"
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                placeholder="https://..."
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 2: تفاصيل التوظيف (Employment Details)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>2. تفاصيل التوظيف (Employment Details)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Step 2 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Branch</label>
              <input
                type="text"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Department <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.departmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {orgTree?.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Job Title / Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Job Title / Position <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.positionId}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {availablePositions.length === 0 ? (
                  <option value="">No positions in department</option>
                ) : (
                  availablePositions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Seniority Level</label>
              <select
                value={form.levelId}
                onChange={(e) => setForm({ ...form, levelId: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">None / Not Applicable</option>
                {availableLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    L{lvl.rank} - {lvl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Joining Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Joining Date</label>
              <input
                type="date"
                required
                value={form.joiningDate}
                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Employment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Employment Type</label>
              <select
                value={form.employmentType}
                onChange={(e) =>
                  setForm({ ...form, employmentType: e.target.value as EmploymentType })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="FULL_TIME">Full-Time (دوام كامل)</option>
                <option value="PART_TIME">Part-Time (دوام جزئي)</option>
                <option value="TRAINING">Training / Internship (تدريب)</option>
              </select>
            </div>

            {/* Employee Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="ACTIVE">Active (نشط)</option>
                <option value="PROBATION">Probation (تحت الاختبار)</option>
                <option value="INACTIVE">Inactive (غير نشط)</option>
                <option value="ENDED">Ended (منتهي)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 3: معلومات التواصل (Contact Info)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>3. معلومات التواصل (Contact Info)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Step 3 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300">Detailed Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street name, Building, City, Country"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Alternate Phone</label>
              <input
                type="tel"
                value={form.altPhone}
                onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
                placeholder="+20 111 000 0000"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 4: إتصال الطوارئ (Emergency Contact)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>4. إتصال الطوارئ (Emergency Contact)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Step 4 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Contact Name</label>
              <input
                type="text"
                value={form.emergencyName}
                onChange={(e) => setForm({ ...form, emergencyName: e.target.value })}
                placeholder="Relative or guardian full name"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Relationship</label>
              <select
                value={form.emergencyRelationship}
                onChange={(e) =>
                  setForm({
                    ...form,
                    emergencyRelationship: e.target.value as EmergencyRelationship,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="FATHER">Father (أب)</option>
                <option value="MOTHER">Mother (أم)</option>
                <option value="BROTHER">Brother (أخ)</option>
                <option value="SISTER">Sister (أخت)</option>
                <option value="SPOUSE">Spouse (زوج / زوجة)</option>
                <option value="OTHER">Other (أخرى)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Emergency Phone</label>
              <input
                type="tel"
                value={form.emergencyPhone}
                onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                placeholder="+20 100 000 0000"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 5: معلومات البنك (Bank Info)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>5. معلومات البنك (Bank Info)</span>
            </h2>
            <span className="text-[11px] text-amber-400 font-mono">
              [Protected: employees.manage_salary]
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Bank Name</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="e.g. CIB / QNB"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Account Holder</label>
              <input
                type="text"
                value={form.accountHolder}
                onChange={(e) => setForm({ ...form, accountHolder: e.target.value })}
                placeholder="Matches official bank registry"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Account Number</label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="1000..."
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">IBAN</label>
              <input
                type="text"
                value={form.iban}
                onChange={(e) => setForm({ ...form, iban: e.target.value })}
                placeholder="EG..."
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">SWIFT Code</label>
              <input
                type="text"
                value={form.swift}
                onChange={(e) => setForm({ ...form, swift: e.target.value })}
                placeholder="CIBEEGCX"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Bank Branch</label>
              <input
                type="text"
                value={form.bankBranch}
                onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
                placeholder="Nasr City"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Basic Salary (الراتب الأساسي)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.basicSalary}
                onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
                placeholder="0.00"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            SECTION 6: الوثائق (Documents)
        =================================================================== */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>6. الوثائق (Documents)</span>
            </h2>
            <span className="text-[11px] text-slate-400">Step 6 of 6</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300">Document Type</label>
              <select
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value as DocumentType })}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="NATIONAL_ID">National ID (بطاقة الرقم القومي)</option>
                <option value="PASSPORT">Passport (جواز السفر)</option>
                <option value="CV">Curriculum Vitae (السيرة الذاتية)</option>
                <option value="CONTRACT">Employment Contract (عقد العمل)</option>
                <option value="OTHER">Other Attachment (أخرى)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Upload File</label>
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setForm({ ...form, docFileName: e.target.files[0].name });
                  }
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-400 file:mr-4 file:rounded file:border-0 file:bg-indigo-600 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {form.docFileName && (
                <p className="mt-1 text-[11px] text-indigo-400">Selected: {form.docFileName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
          <Link
            href="/dashboard/employees"
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition-all"
          >
            {createMutation.isPending ? 'Saving Employee...' : 'Save Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
