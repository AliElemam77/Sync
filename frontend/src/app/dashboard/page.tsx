'use client';

import React from 'react';
import { useAuth } from '../../hooks/use-auth';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur">
        <h1 className="text-xl font-bold text-white">Enterprise Workspace</h1>
        <p className="mt-1 text-sm text-slate-400">
          User ID: <code className="text-indigo-400">{user?.id}</code>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Role & Access Info */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Assigned Role
          </h2>
          <div className="mt-3 flex items-center space-x-3">
            <span className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1 text-sm font-semibold text-indigo-300">
              {user?.role?.name}
            </span>
            <span className="text-xs text-slate-500">
              {user?.role?.name === 'SUPER_ADMIN'
                ? 'Unrestricted administrative access'
                : 'Role-bounded access matrix'}
            </span>
          </div>
        </div>

        {/* Dynamic Permission Gates Demonstration */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Permission Verification
          </h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Employee Management (employees.view):</span>
              <span
                className={`font-semibold ${
                  hasPermission('employees.view') ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {hasPermission('employees.view') ? 'GRANTED' : 'DENIED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Audit Trail Access (audit.view):</span>
              <span
                className={`font-semibold ${
                  hasPermission('audit.view') ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {hasPermission('audit.view') ? 'GRANTED' : 'DENIED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Active Granted Permissions ({user?.permissions?.length || 0})
        </h2>
        <div className="flex flex-wrap gap-2">
          {user?.permissions?.map((perm) => (
            <span
              key={perm}
              className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-mono text-slate-300"
            >
              {perm}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
