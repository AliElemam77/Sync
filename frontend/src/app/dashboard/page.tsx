'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/use-auth';
import { useEmployees } from '../../hooks/use-employees';
import { useTasks } from '../../hooks/use-tasks';
import { useConversations } from '../../hooks/use-chat';
import { useOrganizationTree } from '../../hooks/use-organization';
import { CardGridSkeleton } from '../../components/ui/card-grid-skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import {
  FiUsers,
  FiCheckSquare,
  FiMessageSquare,
  FiClock,
  FiTrendingUp,
  FiArrowUpLeft,
  FiShield,
  FiActivity,
  FiPlus,
  FiArrowRight,
  FiCalendar,
  FiMapPin,
  FiCheckCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Queries for dynamic metrics
  const { data: employeesData, isLoading: isEmployeesLoading } = useEmployees({ page: 1, limit: 1 });
  const { data: tasksData, isLoading: isTasksLoading } = useTasks();
  const { data: conversations = [], isLoading: isConversationsLoading } = useConversations();
  const { data: departments = [], isLoading: isOrgLoading } = useOrganizationTree();

  // Live Clock & Arabic Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
      setCurrentDate(
        now.toLocaleDateString('ar-EG', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isLoadingStats = isEmployeesLoading || isTasksLoading || isConversationsLoading || isOrgLoading;

  // Task statistics
  const tasks = tasksData || [];
  const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const totalTasks = tasks.length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total unread chat messages
  const totalUnreadChat = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Dynamic greeting based on hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'صباح الخير والإنتاجية ☀️';
    if (hour >= 12 && hour < 17) return 'مساء الخير والعمل المتميز 🌤️';
    return 'مساء الخير والإنجاز ✨';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ===================================================================== */}
      {/* HERO GREETING & WORKSPACE HEADER                                      */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-card via-card/90 to-surface-raised p-6 sm:p-8 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-brand-lightBlue/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black">
                {user?.role?.name || 'موظف'}
              </span>
              <span className="text-xs text-foreground-muted font-bold font-mono">
                {currentDate}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {getGreeting()}, {user?.employee?.fullName || user?.email?.split('@')[0]}
            </h1>

            <p className="text-xs sm:text-sm text-foreground-muted max-w-xl leading-relaxed">
              مرحباً بك في لوحة تحكم Sync ERP الموحدة. تابع مؤشرات الأداء، المهام اليومية، وتواصل مع فريقك في الوقت الفعلي.
            </p>
          </div>

          {/* Quick Actions & Live Clock */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-surface border border-border flex items-center gap-2.5 shadow-inner">
              <FiClock className="h-4 w-4 text-primary animate-spin [animation-duration:10s]" />
              <span className="font-mono text-sm font-black text-foreground">{currentTime || '...'}</span>
            </div>

            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-black shadow-md shadow-primary/25 transition-all duration-200 active:scale-95 hover:shadow-lg"
            >
              <FiMessageSquare className="h-4 w-4" />
              <span>محادثة فورية</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4 CORE EXECUTIVE METRICS CARDS                                        */}
      {/* ===================================================================== */}
      {isLoadingStats ? (
        <CardGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Card 1: Team Members */}
          <Card className="relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground-muted">فريق العمل والكوادر</span>
                <div className="text-3xl font-black text-foreground tracking-tight font-mono">
                  {employeesData?.meta?.total ?? employeesData?.data?.length ?? 12}
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-brand-lightBlue/15 border border-brand-lightBlue/30 text-brand-blue dark:text-brand-lightBlue flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                <FiUsers className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <FiTrendingUp className="h-3.5 w-3.5" /> 100% نشط
              </span>
              <Link href="/dashboard/employees" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                <span>عرض الكل</span>
                <FiArrowUpLeft className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          {/* Card 2: Active Tasks */}
          <Card className="relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground-muted">المهام الجارية والمكتملة</span>
                <div className="text-3xl font-black text-foreground tracking-tight font-mono">
                  {totalTasks}
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                <FiCheckSquare className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-foreground-muted font-bold font-mono">
                {taskCompletionRate}% نسبة الإنجاز
              </span>
              <Link href="/dashboard/tasks" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                <span>لوحة كانبان</span>
                <FiArrowUpLeft className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          {/* Card 3: Chat & Groups */}
          <Card className="relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground-muted">غرف المحادثة والفرق</span>
                <div className="text-3xl font-black text-foreground tracking-tight font-mono">
                  {conversations.length}
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                <FiMessageSquare className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              {totalUnreadChat > 0 ? (
                <span className="text-rose-400 font-bold font-mono animate-pulse">
                  {totalUnreadChat} رسائل غير مقروءة
                </span>
              ) : (
                <span className="text-emerald-500 font-bold">جميع القنوات مقروءة</span>
              )}
              <Link href="/dashboard/chat" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                <span>فتح المحادثات</span>
                <FiArrowUpLeft className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          {/* Card 4: Departments & Org */}
          <Card className="relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-foreground-muted">الأقسام والوحدات الإدارية</span>
                <div className="text-3xl font-black text-foreground tracking-tight font-mono">
                  {departments.length || 5}
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                <BiBuildingHouse className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-foreground-muted font-bold font-mono">
                {user?.employee?.department?.code || 'CORP'} قسمك الحالي
              </span>
              <Link href="/dashboard/organization" className="text-primary hover:underline font-bold flex items-center gap-0.5">
                <span>الهيكل الإداري</span>
                <FiArrowUpLeft className="h-3 w-3" />
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2-COLUMN SECTION: SMART ATTENDANCE + URGENT TASKS MATRIX             */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left / Attendance Quick Card (1 Column) */}
        <Card className="lg:col-span-1 flex flex-col justify-between">
          <div>
            <CardHeader className="border-none pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FiClock className="h-5 w-5 text-primary" />
                  <span>تسجيل الحضور الذكي</span>
                </CardTitle>
                <CardDescription>متابعة ساعات العمل والورديات المعتمدة</CardDescription>
              </div>
            </CardHeader>

            {/* Attendance Progress Ring Mockup */}
            <div className="my-6 flex flex-col items-center justify-center text-center">
              <div className="relative h-36 w-36 rounded-full border-8 border-surface-raised border-t-primary border-r-primary flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black font-mono text-foreground">08:00</span>
                  <span className="text-[10px] font-bold text-foreground-muted">ساعات الوردية</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-extrabold text-foreground">وردية الصباح (09:00 - 17:00)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <Link
              href="/dashboard/attendance"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-black text-xs shadow-md transition-all active:scale-95"
            >
              <FiMapPin className="h-4 w-4" />
              <span>إثبات الحضور والانصراف الآن</span>
            </Link>
          </div>
        </Card>

        {/* Right / Urgent Tasks & Active Activities (2 Columns) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FiCheckSquare className="h-5 w-5 text-primary" />
                  <span>المهام المعينة وقيد التنفيذ</span>
                </CardTitle>
                <CardDescription>المهام ذات الأولوية المباشرة في مساحة العمل</CardDescription>
              </div>

              <Link
                href="/dashboard/tasks"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>فتح كانبان</span>
                <FiArrowUpLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={FiCheckSquare}
                title="لا توجد مهام معلقة"
                description="رائع! لقد أنجزت جميع المهام الموكلة إليك حالياً."
                action={{
                  label: 'إنشاء مهمة جديدة',
                  onClick: () => (window.location.href = '/dashboard/tasks'),
                  icon: FiPlus,
                }}
              />
            ) : (
              <div className="space-y-2.5 divide-y divide-border/50">
                {tasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                          task.status === 'DONE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-surface-raised text-foreground-muted border border-border'
                        }`}
                      >
                        {task.status === 'DONE' ? <FiCheckCircle className="h-4 w-4" /> : <FiClock className="h-4 w-4" />}
                      </div>

                      <div className="truncate">
                        <Link
                          href="/dashboard/tasks"
                          className="text-xs font-extrabold text-foreground hover:text-primary transition-colors truncate block"
                        >
                          {task.title}
                        </Link>
                        <span className="text-[10px] text-foreground-muted font-mono">
                          المعين: {task.assignee?.fullName || 'عام'} • {task.priority || 'NORMAL'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border ${
                        task.priority === 'URGENT'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {task.priority === 'URGENT'
                        ? 'عاجل جداً'
                        : task.priority === 'HIGH'
                        ? 'مرتفع'
                        : 'عادي'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* GRANULAR RBAC & SECURITY AUDIT MATRIX                                 */}
      {/* ===================================================================== */}
      <Card hoverEffect={false} className="bg-surface-raised/50 border-border">
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FiShield className="h-4.5 w-4.5 text-primary" />
                <span>مصفوفة الصلاحيات والأمان (RBAC Matrix)</span>
              </CardTitle>
              <CardDescription>الصلاحيات المعتمدة لحسابك في الجلسة النشطة</CardDescription>
            </div>

            <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
              {user?.permissions?.length || 0} صلاحية نشطة
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap gap-2 pt-1">
            {user?.permissions?.map((perm) => (
              <span
                key={perm}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-[11px] font-mono font-semibold text-foreground-muted shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {perm}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
