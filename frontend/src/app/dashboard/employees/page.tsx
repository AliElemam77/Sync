'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useEmployees, useDeleteEmployee } from '../../../hooks/use-employees';
import { useOrganizationTree } from '../../../hooks/use-organization';
import { useAuth } from '../../../hooks/use-auth';

export default function EmployeesListPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('employees.create');
  const canUpdate = hasPermission('employees.update');
  const canDelete = hasPermission('employees.delete');

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  const { data: orgTree } = useOrganizationTree();
  const { data: response, isLoading, isError } = useEmployees({
    search: search.trim() || undefined,
    departmentId: departmentId || undefined,
    page,
    limit: 10,
  });

  const deleteMutation = useDeleteEmployee();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove employee '${name}'? This will also terminate login credentials.`)) {
      return;
    }
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete employee');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Employee Directory</h1>
          <p className="mt-1 text-xs text-slate-400">
            Enterprise workforce roster, shift allocations, and organizational assignments.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/dashboard/employees/new"
            className="inline-flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
          >
            <span>+ Add Employee</span>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800 backdrop-blur-sm">
        <div className="sm:col-span-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by employee name, code (TAR...), email, or phone..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Departments</option>
            {orgTree?.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {deleteError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400">
          {deleteError}
        </div>
      )}

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/90 uppercase tracking-wider text-[10px] font-bold text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Department & Job Title</th>
                <th className="px-5 py-3.5">Shift & Leaves</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  </td>
                </tr>
              ) : response?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                    No employees matching your criteria.
                  </td>
                </tr>
              ) : (
                response?.data.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-indigo-400">
                      {emp.employeeCode}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{emp.fullName}</div>
                      <div className="text-[11px] text-slate-400">{emp.user?.email}</div>
                      <div className="text-[10px] text-slate-500">{emp.phone}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-white font-medium">{emp.position?.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {emp.department?.name} ({emp.department?.code})
                      </div>
                      {emp.level && (
                        <span className="inline-block mt-0.5 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-indigo-300">
                          {emp.level.name}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 space-y-1">
                      <div>
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${
                            emp.shiftType === 'RS'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {emp.shiftType === 'RS' ? 'RS: 6 Days (8h)' : 'LS: 5 Days (9h)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Annual: <span className="text-slate-200">{emp.annualLeaveDays}d</span> | Perm:{' '}
                        <span className="text-slate-200">{emp.monthlyPermissionHours}h/mo</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : emp.status === 'PROBATION'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      {canUpdate && (
                        <Link
                          href={`/dashboard/employees/${emp.id}/edit`}
                          className="inline-block rounded px-2.5 py-1 text-[11px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                        >
                          Edit
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(emp.id, emp.fullName)}
                          className="inline-block rounded px-2.5 py-1 text-[11px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {response && response.meta.totalPages > 1 && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing page <span className="text-white font-bold">{response.meta.page}</span> of{' '}
              <span className="text-white font-bold">{response.meta.totalPages}</span> ({response.meta.total} employees)
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(response.meta.totalPages, p + 1))}
                disabled={page === response.meta.totalPages}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 disabled:opacity-40 hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
