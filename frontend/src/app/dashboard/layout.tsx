'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';

import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Building2,
  Calendar,
  Clock,
  ClipboardList,
  FileText,
  MapPin,
  LogOut,
  Radio,
} from 'lucide-react';

import { SocketProvider } from '../../providers/socket-provider';
import { NotificationCenter } from '../../components/notifications/notification-center';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks & Kanban', href: '/dashboard/tasks', icon: CheckSquare, requiredPerm: 'tasks.view' },
    { label: 'Employees', href: '/dashboard/employees', icon: Users, requiredPerm: 'employees.view' },
    { label: 'Organization Structure', href: '/dashboard/organization', icon: Building2, requiredPerm: 'org.view' },
    { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
    { label: 'Shifts', href: '/dashboard/shifts', icon: Clock },
    { label: 'Orders', href: '/dashboard/orders', icon: ClipboardList },
    { label: 'Policies', href: '/dashboard/policies', icon: FileText },
    { label: 'Attendance', href: '/dashboard/attendance', icon: MapPin, requiredPerm: 'attendance.view' },
  ];

  return (
    <SocketProvider>
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
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div className="truncate mr-2">
                <p className="text-xs font-bold text-white truncate">
                  {user?.employee?.fullName || user?.email}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold text-indigo-400 border border-indigo-500/20">
                    {user?.role?.name}
                  </span>
                  {user?.employee?.department && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 border border-emerald-500/20 truncate max-w-[150px]">
                      <Building2 className="h-2.5 w-2.5 shrink-0" />
                      <span>{user.employee.department.code}</span>
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shrink-0"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content View with Top Bar */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar with Real-Time Notification Center & User Department Badge */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-400">
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] text-slate-300 hidden sm:inline">Live Sync</span>
              </div>

              {/* Department Badge */}
              {user?.employee?.department ? (
                <div className="flex items-center space-x-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                  <Building2 className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden sm:inline">Department:</span>
                  <span className="text-white font-bold">{user.employee.department.name}</span>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300 font-mono">
                    {user.employee.department.code}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Department: Company-Wide (Admin)</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <NotificationCenter />
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </SocketProvider>
  );
}
