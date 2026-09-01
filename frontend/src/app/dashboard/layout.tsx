'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { IconType } from 'react-icons';
import {
  FiHome,
  FiMessageSquare,
  FiCheckSquare,
  FiUsers,
  FiLayers,
  FiClock,
  FiCalendar,
  FiFileText,
  FiActivity,
  FiLogOut,
  FiChevronRight,
  FiChevronLeft,
  FiMenu,
  FiX,
  FiSearch,
  FiBell,
  FiCommand,
  FiShield,
  FiRadio,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
import { SocketProvider } from '../../providers/socket-provider';
import { NotificationCenter } from '../../components/notifications/notification-center';
import { ThemeToggle } from '../../components/ui/theme-toggle';

interface SidebarItem {
  label: string;
  href: string;
  icon: IconType;
  requiredPerm?: string | null;
  badge?: string | number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading, hasPermission } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-xs font-bold text-foreground-muted animate-pulse">جاري تهيئة مساحة العمل...</span>
        </div>
      </div>
    );
  }

  const navItems: SidebarItem[] = [
    { label: 'الرئيسية', href: '/dashboard', icon: FiHome },
    { label: 'الدردشة والفرق', href: '/dashboard/chat', icon: FiMessageSquare },
    { label: 'المهام وكانبان', href: '/dashboard/tasks', icon: FiCheckSquare, requiredPerm: 'tasks.view' },
    { label: 'سجل الموظفين', href: '/dashboard/employees', icon: FiUsers, requiredPerm: 'employees.view' },
    { label: 'الهيكل التنظيمي', href: '/dashboard/organization', icon: BiBuildingHouse, requiredPerm: 'org.view' },
    { label: 'سجل الحضور الذكي', href: '/dashboard/attendance', icon: FiClock, requiredPerm: 'attendance.view' },
    { label: 'التقويم المؤسسي', href: '/dashboard/calendar', icon: FiCalendar },
    { label: 'الورديات ومواعيد العمل', href: '/dashboard/shifts', icon: FiLayers },
    { label: 'الطلبات والإجراءات', href: '/dashboard/orders', icon: FiActivity },
    { label: 'السياسات واللوائح', href: '/dashboard/policies', icon: FiFileText },
  ];

  return (
    <SocketProvider>
      <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased transition-colors duration-200">
        <div className="flex-1 flex min-h-screen">
          {/* ================================================================= */}
          {/* DESKTOP SIDEBAR (Collapsible)                                     */}
          {/* ================================================================= */}
          <aside
            className={`hidden md:flex flex-col border-e border-border bg-card/80 backdrop-blur-2xl transition-all duration-300 relative shrink-0 z-20 ${
              isCollapsed ? 'w-20' : 'w-64'
            }`}
          >
            {/* Sidebar Header / Brand */}
            <div className="h-16 p-4 border-b border-border flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-blue to-brand-lightBlue flex items-center justify-center font-extrabold text-white text-lg shadow-md shadow-brand-blue/30 shrink-0">
                  S
                </div>
                {!isCollapsed && (
                  <div className="truncate">
                    <span className="font-black text-sm tracking-tight text-foreground block">Sync ERP</span>
                    <span className="text-[10px] text-foreground-muted font-bold block">منصة إدارة الأعمال</span>
                  </div>
                )}
              </Link>

              {/* Collapse Toggle Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-all duration-200"
                title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
              >
                {isCollapsed ? <FiChevronLeft className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
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
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover border border-transparent hover:border-border/60'
                    }`}
                  >
                    <item.icon
                      className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-primary-foreground' : 'text-foreground-muted group-hover:text-primary'
                      }`}
                    />

                    {!isCollapsed && <span className="truncate">{item.label}</span>}

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="absolute start-full ms-3 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-foreground text-xs font-extrabold shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Sidebar User Footer */}
            <div className="p-3.5 border-t border-border bg-surface-raised/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center font-extrabold text-xs text-primary shrink-0">
                    {user?.employee?.fullName?.slice(0, 1) || user?.email?.slice(0, 1) || 'U'}
                  </div>

                  {!isCollapsed && (
                    <div className="truncate">
                      <p className="text-xs font-extrabold text-foreground truncate">
                        {user?.employee?.fullName || user?.email}
                      </p>
                      <span className="inline-block text-[9px] font-bold text-primary px-1.5 py-0.2 rounded-md bg-primary/10 border border-primary/20">
                        {user?.role?.name || 'موظف'}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-xl border border-border bg-surface hover:bg-rose-500/10 hover:border-rose-500/30 text-foreground-muted hover:text-rose-400 transition-colors shrink-0"
                  title="تسجيل الخروج"
                >
                  <FiLogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* ================================================================= */}
          {/* MOBILE DRAWER (Slide-over)                                        */}
          {/* ================================================================= */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              {/* Backdrop */}
              <div
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              />

              <div className="relative w-72 max-w-[80vw] bg-card border-e border-border h-full flex flex-col p-4 shadow-2xl z-10 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-brand-blue to-brand-lightBlue flex items-center justify-center font-black text-white text-lg">
                      S
                    </div>
                    <span className="font-extrabold text-sm text-foreground">Sync ERP</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    if (item.requiredPerm && !hasPermission(item.requiredPerm)) return null;
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md font-black'
                            : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                        }`}
                      >
                        <item.icon className="h-4.5 w-4.5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground truncate">{user?.employee?.fullName || user?.email}</p>
                    <span className="text-[10px] text-primary">{user?.role?.name}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 rounded-xl bg-surface border border-border text-foreground-muted hover:text-rose-400"
                  >
                    <FiLogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MAIN CONTENT WRAPPER & TOP NAVBAR                                 */}
          {/* ================================================================= */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Top Navbar */}
            <header className="h-16 border-b border-border bg-card/60 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-10 transition-colors">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2.5 rounded-xl border border-border bg-surface md:hidden text-foreground hover:bg-surface-hover"
                  title="فتح القائمة"
                >
                  <FiMenu className="h-4.5 w-4.5" />
                </button>

                {/* Real-Time Pulse Indicator */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>متزامن لحظياً</span>
                </div>

                {/* Department Badge */}
                {user?.employee?.department && (
                  <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-xs font-bold text-foreground-muted">
                    <BiBuildingHouse className="h-4 w-4 text-primary" />
                    <span>{user.employee.department.name}</span>
                    <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                      {user.employee.department.code}
                    </span>
                  </div>
                )}
              </div>

              {/* Top Bar Right: Search, Notifications & Theme Toggle */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Search Bar */}
                <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-surface border border-border text-xs text-foreground-muted focus-within:border-primary focus-within:text-foreground transition-all">
                  <FiSearch className="h-4 w-4" />
                  <input
                    type="text"
                    placeholder="بحث سريع في النظام..."
                    className="bg-transparent border-none outline-hidden w-40 lg:w-56 text-xs text-foreground placeholder-foreground-subtle"
                  />
                  <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-surface-raised border border-border text-[10px] font-mono text-foreground-subtle">
                    <FiCommand className="h-2.5 w-2.5" /> K
                  </kbd>
                </div>

                {/* Notification Center */}
                <NotificationCenter />

                {/* Dark / Light Theme Toggle */}
                <ThemeToggle />
              </div>
            </header>

            {/* Main Page Canvas */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
          </div>
        </div>
      </div>
    </SocketProvider>
  );
}
