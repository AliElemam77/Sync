'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  requiredPerm?: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading, hasPermission } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const navItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Calendar', href: '/dashboard/calendar', icon: '📅' },
    { label: 'Employees', href: '/dashboard/employees', icon: '👥', requiredPerm: 'employees.view' },
    { label: 'Organization Structure', href: '/dashboard/organization', icon: '🏢', requiredPerm: 'org.view' },
    { label: 'Shifts', href: '/dashboard/shifts', icon: '⏱️' },
    { label: 'Orders', href: '/dashboard/orders', icon: '📋' },
    { label: 'Policies', href: '/dashboard/policies', icon: '📜' },
    { label: 'Attendance', href: '/dashboard/attendance', icon: '📍', requiredPerm: 'attendance.view' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/30 text-lg">
              S
            </div>
            <div>
              <span className="font-bold tracking-tight text-white text-base">Sync ERP</span>
              <p className="text-[10px] text-slate-400 font-medium">Enterprise HR & Ops</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (item.requiredPerm && !hasPermission(item.requiredPerm)) {
              return null;
            }
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between">
            <div className="truncate mr-2">
              <p className="text-xs font-medium text-white truncate">{user?.email}</p>
              <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20 mt-0.5">
                {user?.role?.name}
              </span>
            </div>

            <button
              onClick={logout}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
              title="Sign Out"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content View */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
