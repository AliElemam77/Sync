'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { IconType } from 'react-icons';
import {
  FiHome,
  FiMessageSquare,
  FiCheckSquare,
  FiUsers,
  FiClock,
  FiLogOut,
  FiChevronRight,
  FiChevronLeft,
  FiMenu,
  FiX,
  FiSearch,
  FiPlus,
  FiLayers,
  FiCommand,
  FiInfo,
  FiCheckCircle,
  FiTrendingUp,
  FiHardDrive,
  FiDollarSign,
  FiCreditCard,
} from 'react-icons/fi';
import { BiBuildingHouse } from 'react-icons/bi';
import { SocketProvider } from '../../providers/socket-provider';
import { NotificationCenter } from '../../components/notifications/notification-center';
import { ThemeToggle } from '../../components/ui/theme-toggle';
import { getUserDirectoryScope, canAccessEmployees } from '../../lib/permissions';

interface NavSection {
  id: string;
  label: string;
  category: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPerm?: string;
  purposeTitle: string;
  purposeDescription: string;
  highlights: { title: string; desc: string }[];
  primaryActionLabel?: string;
  primaryActionHref?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Dual-tier sidebar state
  const [isSubPanelOpen, setIsSubPanelOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const dirScope = useMemo(() => getUserDirectoryScope(user), [user]);

  // Nav configuration with clear purpose and explanatory guidance
  const navSections: NavSection[] = useMemo(
    () => [
      {
        id: 'home',
        label: 'الرئيسية',
        category: 'مركز القيادة',
        href: '/dashboard',
        icon: FiHome,
        purposeTitle: 'نظرة عامة على المنظومة',
        purposeDescription:
          'لوحة المتابعة الشاملة لعرض مؤشرات الأداء الحية، والمهام العاجلة، ومصفوفة الصلاحيات المعتمدة لحسابك.',
        highlights: [
          { title: 'مؤشرات الأداء', desc: 'إحصائيات فورية للموظفين والمهام والمحادثات' },
          { title: 'الوردية الحالية', desc: 'متابعة مباشرة لساعات الحضور والانصراف' },
          { title: 'الصلاحيات النشطة', desc: 'عرض أذونات وحقوق الوصول الخاصة بك' },
        ],
        primaryActionLabel: 'فتح المحادثات',
        primaryActionHref: '/dashboard/chat',
      },
      {
        id: 'tasks',
        label: 'المهام وكانبان',
        category: 'إدارة العمليات',
        href: '/dashboard/tasks',
        icon: FiCheckSquare,
        requiredPerm: 'tasks.view',
        purposeTitle: 'لوحة كانبان التفاعلية',
        purposeDescription:
          'إدارة وتوزيع مهام العمل عبر 6 مراحل متسلسلة مع إمكانية السحب والإفلات، وإرفاق الصور، ومتابعة سجل المراجعات.',
        highlights: [
          { title: 'السحب والإفلات', desc: 'نقل سلس بين قيد التنفيذ، والمراجعة، والإنجاز' },
          { title: 'مرفقات الصور', desc: 'رفع لقطات الشاشة والمستندات عبر ImgBB' },
          { title: 'صندوق مهام القسم', desc: 'توزيع المهام المحولة على أعضاء الفريق' },
        ],
        primaryActionLabel: 'إنشاء مهمة جديدة',
        primaryActionHref: '/dashboard/tasks',
      },
      {
        id: 'chat',
        label: 'الدردشة والفرق',
        category: 'التواصل والتعاون',
        href: '/dashboard/chat',
        icon: FiMessageSquare,
        purposeTitle: 'غرف التواصل الفوري',
        purposeDescription:
          'محادثات فورية مباشرة وقنوات جماعية لفرق العمل مع دعم إرسال الصور في شبكة معرض (Gallery) وتفاعلات الإيموجي.',
        highlights: [
          { title: 'المحادثات المباشرة', desc: 'تواصل فوري مشفر بين الزملاء' },
          { title: 'قنوات الفرق', desc: 'مجموعات عمل مخصصة لكل قسم ومشروع' },
          { title: 'معرض الصور المرفقة', desc: 'عرض الصور المرفقة في شبكة تفاعلية' },
        ],
        primaryActionLabel: 'بدء محادثة جديدة',
        primaryActionHref: '/dashboard/chat',
      },
      {
        id: 'attendance',
        label: 'سجل الحضور الذكي',
        category: 'شؤون العاملين',
        href: '/dashboard/attendance',
        icon: FiClock,
        requiredPerm: 'attendance.view',
        purposeTitle: 'الحضور والإجازات والأذونات',
        purposeDescription:
          'تسجيل الحضور والانصراف بالعداد الحي، وتقديم طلبات الإجازات السنوية والأذونات الساعية، واعتمادها إدارياً.',
        highlights: [
          { title: 'العداد الحي', desc: 'احتساب دقيق لساعات الوردية والتأخير والإضافي' },
          { title: 'أرصدة الإجازات', desc: 'متابعة رصيد الإجازات الاعتيادية والسنوية' },
          { title: 'الأذونات الساعية', desc: 'تقديم ومراجعة أذونات الخروج الشهرية' },
        ],
        primaryActionLabel: 'طلب إجازة / إذن',
        primaryActionHref: '/dashboard/attendance',
      },
      {
        id: 'employees',
        label: dirScope.isCompanyWide
          ? 'سجل الموظفين'
          : dirScope.isHead
          ? 'فرق وأقسام القطاع'
          : dirScope.isTeamLeader
          ? 'أعضاء الفريق'
          : 'زملائي في الفريق',
        category: dirScope.scopeBadge,
        href: '/dashboard/employees',
        icon: FiUsers,
        requiredPerm: 'employees.view',
        purposeTitle: dirScope.isCompanyWide
          ? 'دليل الكوادر البشرية العام'
          : dirScope.isHead
          ? 'إدارة كوادر وفرق القطاع'
          : dirScope.isTeamLeader
          ? 'إدارة ومتابعة أعضاء الفريق'
          : 'دليل زملاء الفريق والقسم',
        purposeDescription: dirScope.isCompanyWide
          ? 'استعراض وتعديل بيانات جميع موظفي الشركة، وبيانات الاتصال، والورديات، والصلاحيات.'
          : dirScope.isHead
          ? 'استعراض ومتابعة كوادر الأقسام التابعة لك، وتوزيع المهام، والاطلاع على بيانات الاتصال.'
          : dirScope.isTeamLeader
          ? 'متابعة أعضاء فريقك، والتأكد من وردياتهم وساعات عملهم والتواصل المباشر معهم.'
          : 'استعراض الزملاء في نفس فريقك وقسمك، ومعرفة مسمياتهم الوظيفية والتواصل السريع معهم.',
        highlights: dirScope.isCompanyWide
          ? [
              { title: 'البحث والفلترة', desc: 'فرز فوري حسب الأقسام والاسم وكود الموظف' },
              { title: 'الملف الوظيفي', desc: 'إدارة الرتب والمسميات وتفاصيل التعاقد' },
              { title: 'حسابات الدخول', desc: 'ربط الصلاحيات والبريد الرسمي بحساب الموظف' },
            ]
          : dirScope.isHead || dirScope.isTeamLeader
          ? [
              { title: 'أعضاء الفريق', desc: 'استعراض الموظفين التابعين لإشرافك' },
              { title: 'التواصل المباشر', desc: 'بدء محادثات فورية وتوزيع المهام' },
              { title: 'بيانات الوردية', desc: 'معرفة مواعيد ونوع الوردية لكل عضو' },
            ]
          : [
              { title: 'زملاء الفريق', desc: 'قائمة أعضاء القسم وفريق العمل المشترك' },
              { title: 'التواصل والتعاون', desc: 'بيانات الاتصال وغرف الدردشة المباشرة' },
              { title: 'المسمى الوظيفي', desc: 'معرفة أدوار وتخصصات الزملاء' },
            ],
        primaryActionLabel: dirScope.canManage ? 'إضافة موظف جديد' : 'فتح المحادثات',
        primaryActionHref: dirScope.canManage ? '/dashboard/employees/new' : '/dashboard/chat',
      },
      {
        id: 'organization',
        label: 'الهيكل التنظيمي',
        category: 'الهيكل الإداري',
        href: '/dashboard/organization',
        icon: BiBuildingHouse,
        requiredPerm: 'org.view',
        purposeTitle: 'الأقسام والمسارات الوظيفية',
        purposeDescription:
          'تنظيم الوحدات الإدارية للشركة وتحديد المسميات الوظيفية لكل قسم وتعيين مستويات الترقية والرتب.',
        highlights: [
          { title: 'شجرة الأقسام', desc: 'هيكل متكامل للأقسام والوحدات التابعة' },
          { title: 'المسميات الوظيفية', desc: 'تحديد الوظائف لكل قسم على حدة' },
          { title: 'المستويات والرتب', desc: 'مسارات الترقي الوظيفي (Seniority Levels)' },
        ],
        primaryActionLabel: 'إضافة قسم جديد',
        primaryActionHref: '/dashboard/organization',
      },
      {
        id: 'assets',
        label: 'الأصول والعهد التقنية',
        category: 'تقنية المعلومات',
        href: '/dashboard/assets',
        icon: FiHardDrive,
        requiredPerm: 'assets.view',
        purposeTitle: 'إدارة الأصول والعهد والمعدات',
        purposeDescription:
          'متابعة وجرد أجهزة الشركة وحسابات التراخيص، وإدارة حركات تسليم واسترجاع العهد للكوادر البشرية مع سجل تاريخي دقيق.',
        highlights: [
          { title: 'جرد الأجهزة والبرمجيات', desc: 'حصر كامل لأجهزة اللابتوب والشاشات والتراخيص' },
          { title: 'تسليم واسترجاع العهد', desc: 'تسجيل حركات الاستلام والتسليم وفحص الحالة' },
          { title: 'السجل التاريخي للعهدة', desc: 'تتبع زمني دقيق لكل من استلم الجهاز وحالته' },
        ],
        primaryActionLabel: 'إضافة أصل جديد',
        primaryActionHref: '/dashboard/assets',
      },
      {
        id: 'accounting',
        label: 'الإدارة المالية ودفتر الأستاذ',
        category: 'المالية والمحاسبة',
        href: '/dashboard/accounting',
        icon: FiDollarSign,
        requiredPerm: 'accounting.view',
        purposeTitle: 'دفتر الأستاذ العام والتقارير المالية',
        purposeDescription:
          'متابعة الإيرادات والمصروفات بدقة متناهية، وإدارة قيود اليومية والتسويات العكسية، وتحليل صافي الأرباح.',
        highlights: [
          { title: 'دفتر الأستاذ العام', desc: 'تسجيل قيود الإيراد والمصروف والتصنيفات' },
          { title: 'القيود العكسية', desc: 'إلغاء المعاملات الخاطئة بقيود تسوية تدقيقية' },
          { title: 'تحليلات الأرباح والمصاريف', desc: 'مقارنة سنوية ورسوم بيانية للتدفقات النقدية' },
        ],
        primaryActionLabel: 'تسجيل قيد مالي',
        primaryActionHref: '/dashboard/accounting',
      },
      {
        id: 'payroll',
        label: 'مسير الرواتب والمستحقات',
        category: 'المالية والمحاسبة',
        href: '/dashboard/payroll',
        icon: FiCreditCard,
        purposeTitle: 'محرك الرواتب والخصومات وقسائم الموظفين',
        purposeDescription:
          'احتساب مسيرات الرواتب الشهرية وخصومات التأخير اللحظية من سجلات الحضور والانصراف، وإصدار قسائم الراتب التفصيلية للموظفين.',
        highlights: [
          { title: 'احتساب الرواتب التلقائي', desc: 'محرك ذكي لاحتساب الأساسي والكوميشن والخصومات' },
          { title: 'خصومات الحضور', desc: 'التأخير بالشرايح والغياب ونسيان الانصراف من سجل الحضور' },
          { title: 'قسائم الراتب الذاتية', desc: 'استعراض قسائم الرواتب وبنود الخصم والإضافي' },
        ],
        primaryActionLabel: 'إصدار مسير جديد',
        primaryActionHref: '/dashboard/payroll',
      },
      {
        id: 'management',
        label: 'مركز القيادة والتدقيق',
        category: 'الإدارة العليا',
        href: '/dashboard/management',
        icon: FiCommand,
        requiredPerm: 'audit.view',
        purposeTitle: 'مركز القيادة وسجل التدقيق العام',
        purposeDescription:
          'رؤية شاملة وشريط زمني فوري لكافة حركات الإضافة والتعديل والحذف، وصندوق موحد للطلبات والموافقات الإدارية العاجلة.',
        highlights: [
          { title: 'صندوق الموافقات الموحد', desc: 'اعتماد ورفض الإجازات والأذونات وتاسكات المراجعة' },
          { title: 'شريط الأنشطة الزمني', desc: 'تتبع زمني فوري لكافة التغييرات والعمليات المنفذة' },
          { title: 'مؤشرات القيادة الحية', desc: 'متابعة مباشرة للكوادر، والمهام، والتدفقات المالية' },
        ],
        primaryActionLabel: 'استعراض مركز القيادة',
        primaryActionHref: '/dashboard/management',
      },
    ],
    [],
  );

  // Filter accessible sections based on user role and department
  const accessibleSections = useMemo(() => {
    return navSections.filter((section) => {
      if (section.id === 'employees' && !canAccessEmployees(user)) {
        return false;
      }
      if (section.id === 'payroll') {
        const canView =
          hasPermission('payroll.view') ||
          hasPermission('payroll.self') ||
          user?.role?.name === 'SUPER_ADMIN';
        if (!canView) return false;
      } else if (section.requiredPerm && !hasPermission(section.requiredPerm)) {
        return false;
      }
      return true;
    });
  }, [navSections, user, hasPermission]);

  // Sync active section from pathname
  useEffect(() => {
    if (pathname === '/dashboard') {
      setActiveSectionId('home');
    } else if (pathname.startsWith('/dashboard/tasks')) {
      setActiveSectionId('tasks');
    } else if (pathname.startsWith('/dashboard/chat')) {
      setActiveSectionId('chat');
    } else if (pathname.startsWith('/dashboard/attendance')) {
      setActiveSectionId('attendance');
    } else if (pathname.startsWith('/dashboard/employees')) {
      if (canAccessEmployees(user)) {
        setActiveSectionId('employees');
      } else {
        setActiveSectionId('home');
      }
    } else if (pathname.startsWith('/dashboard/organization')) {
      setActiveSectionId('organization');
    } else if (pathname.startsWith('/dashboard/assets')) {
      setActiveSectionId('assets');
    } else if (pathname.startsWith('/dashboard/accounting')) {
      setActiveSectionId('accounting');
    } else if (pathname.startsWith('/dashboard/payroll')) {
      setActiveSectionId('payroll');
    } else if (pathname.startsWith('/dashboard/management')) {
      setActiveSectionId('management');
    }
    setIsMobileMenuOpen(false);
  }, [pathname, user]);

  const currentSection = useMemo(() => {
    return accessibleSections.find((s) => s.id === activeSectionId) || accessibleSections[0] || navSections[0];
  }, [accessibleSections, navSections, activeSectionId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-xs font-bold text-foreground-muted animate-pulse">
            جاري تهيئة مساحة العمل...
          </span>
        </div>
      </div>
    );
  }

  const handleRailItemClick = (section: NavSection) => {
    setActiveSectionId(section.id);
    router.push(section.href);
  };

  return (
    <SocketProvider>
      <div
        dir="rtl"
        className="h-screen w-full bg-background text-foreground flex font-sans antialiased transition-colors duration-200 relative overflow-hidden"
      >
        {/* Ambient Mesh Gradient Canvas (Apple Liquid Glass Optical Foundation) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
          {/* Custom Luxury Isometric Grid Texture */}
          <svg className="absolute inset-0 w-full h-full text-foreground opacity-[0.08] dark:opacity-[0.04] animate-pattern-glow" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="luxury-pattern-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2,6" />
                <circle cx="24" cy="24" r="1.5" fill="currentColor" />
                <path d="M 24 20 L 24 28 M 20 24 L 28 24" stroke="currentColor" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#luxury-pattern-grid)" />
          </svg>

          {/* Orb 1: Glowing Gold Lime & Warm Amber (Top-Start) */}
          <div
            className="absolute -top-[12%] start-[8%] w-[820px] h-[640px] rounded-full blur-[75px] opacity-80 dark:opacity-45 animate-aurora-1"
            style={{
              background: 'radial-gradient(circle, #D4AF37 0%, #D8D365 40%, rgba(230, 240, 130, 0.3) 65%, transparent 80%)',
            }}
          />

          {/* Orb 2: Deep Warm Cognac & Taupe (Center-End) */}
          <div
            className="absolute top-[22%] end-[-6%] w-[760px] h-[760px] rounded-full blur-[80px] opacity-75 dark:opacity-40 animate-aurora-2"
            style={{
              background: 'radial-gradient(circle, #8C7B65 0%, #C49B38 40%, rgba(96, 91, 81, 0.3) 65%, transparent 80%)',
            }}
          />

          {/* Orb 3: Luminous Champagne Amber (Bottom-Start) */}
          <div
            className="absolute -bottom-[15%] start-[-5%] w-[720px] h-[720px] rounded-full blur-[75px] opacity-80 dark:opacity-40 animate-aurora-3"
            style={{
              background: 'radial-gradient(circle, #E6C25E 0%, #D8D365 45%, rgba(216, 211, 101, 0.25) 65%, transparent 80%)',
            }}
          />

          {/* Orb 4: Mid Ambient Pulse Light (Center Core) */}
          <div
            className="absolute top-[45%] start-[30%] w-[620px] h-[620px] rounded-full blur-[90px] opacity-65 dark:opacity-30 animate-aurora-1"
            style={{
              background: 'radial-gradient(circle, #D4AF37 0%, rgba(216, 211, 101, 0.4) 45%, transparent 70%)',
            }}
          />
        </div>

        {/* ================================================================= */}
        {/* DESKTOP DUAL-SIDEBAR CONTAINER (FLOATING LIQUID GLASS)             */}
        {/* ================================================================= */}
        <aside className="hidden md:flex shrink-0 z-30 h-full select-none relative">
          {/* TIER 1: NARROW ICON RAIL (Minimalist Vertical Bar) */}
          <div className="w-20 min-w-20 shrink-0 h-full bg-white/30 dark:bg-black/40 backdrop-blur-2xl border-e border-white/40 dark:border-white/10 flex flex-col items-center justify-between py-4 px-2 z-20 shadow-2xl">
            {/* Top: Circular Avatar with Sparkle / Online Status */}
            <div className="flex flex-col items-center gap-4 w-full shrink-0">
              <div className="relative group cursor-pointer" onClick={() => router.push('/dashboard')}>
                <div className="h-11 w-11 rounded-full overflow-hidden border-2 border-white/40 dark:border-white/10 group-hover:border-primary/50 transition-all p-0.5 bg-surface shadow-md flex items-center justify-center">
                  {user?.employee?.avatarUrl ? (
                    <img
                      src={user.employee.avatarUrl}
                      alt="Profile"
                      className="h-full w-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-gradient-to-tr from-brand-taupe to-brand-gold dark:from-brand-gold dark:to-brand-champagne flex items-center justify-center text-white dark:text-brand-stone-950 font-black text-sm">
                      {user?.employee?.fullName?.slice(0, 1) || user?.email?.slice(0, 1) || 'U'}
                    </div>
                  )}
                </div>
                {/* Status Indicator Sparkle */}
                <span className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card shadow-xs flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping opacity-75" />
                </span>
              </div>
            </div>

            {/* Vertical Stack of Minimalist Outline Icons */}
            <nav className="flex flex-col items-center gap-2 w-full flex-1 justify-center py-2 overflow-y-auto no-scrollbar">
              {accessibleSections.map((section) => {
                const isSelected = activeSectionId === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleRailItemClick(section)}
                    className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-200 group relative shrink-0 ${
                      isSelected
                        ? 'bg-surface-raised text-foreground font-black shadow-md border border-white/40 dark:border-white/10 scale-105'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover hover:scale-105'
                    }`}
                    title={section.label}
                  >
                    <section.icon
                      className={`h-5 w-5 transition-transform duration-200 ${
                        isSelected
                          ? 'text-primary scale-110'
                          : 'text-foreground-muted group-hover:text-primary'
                      }`}
                    />

                    {/* Tooltip on Hover */}
                    <div className="absolute end-full me-3 px-3 py-1.5 rounded-xl bg-surface-raised border border-border text-foreground text-xs font-black shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      {section.label}
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Bottom Quick Controls (Logout & Panel Toggle) */}
            <div className="flex flex-col items-center gap-2 w-full shrink-0 pt-2 border-t border-border/20">
              <button
                type="button"
                onClick={() => setIsSubPanelOpen(!isSubPanelOpen)}
                className="h-10 w-10 rounded-2xl bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground flex items-center justify-center transition-all shadow-xs border border-white/20 dark:border-white/5 shrink-0"
                title={isSubPanelOpen ? 'إخفاء دليل الصفحة' : 'إظهار دليل الصفحة'}
              >
                {isSubPanelOpen ? (
                  <FiChevronRight className="h-4 w-4" />
                ) : (
                  <FiChevronLeft className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={logout}
                className="h-10 w-10 rounded-2xl bg-surface hover:bg-rose-500/10 text-foreground-muted hover:text-rose-500 flex items-center justify-center transition-colors shadow-xs border border-white/20 dark:border-white/5 shrink-0"
                title="تسجيل الخروج"
              >
                <FiLogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* TIER 2: EXPLANATORY PAGE PURPOSE & INSIGHT PANEL (FROSTED GLASS) */}
          {isSubPanelOpen && (
            <div className="w-72 min-w-72 shrink-0 h-full bg-white/40 dark:bg-black/45 backdrop-blur-2xl border-e border-white/40 dark:border-white/10 flex flex-col justify-between p-5 z-10 animate-in slide-in-from-right duration-200 shadow-2xl overflow-y-auto no-scrollbar">
                <div className="space-y-5">
                  {/* Top Module Header */}
                  <div className="space-y-1.5 border-b border-border/30 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20">
                        {currentSection.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSubPanelOpen(false)}
                        className="p-1.5 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                        title="طي اللوحة"
                      >
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="h-9 w-9 rounded-2xl bg-surface-raised flex items-center justify-center text-primary shrink-0 shadow-inner border border-white/[0.06]">
                        <currentSection.icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-sm font-black text-foreground tracking-tight">
                        {currentSection.purposeTitle}
                      </h2>
                    </div>

                    <p className="text-xs text-foreground-muted leading-relaxed pt-1">
                      {currentSection.purposeDescription}
                    </p>
                  </div>

                  {/* Highlights & Features Breakdown */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-extrabold text-foreground-subtle uppercase tracking-wider block">
                      دليل إمكانيات القسم
                    </span>

                    <div className="space-y-2">
                      {currentSection.highlights.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-surface/70 hover:bg-surface transition-all space-y-1 border border-white/[0.04]"
                        >
                          <div className="flex items-center gap-2">
                            <FiCheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-bold text-foreground">{item.title}</span>
                          </div>
                          <p className="text-[11px] text-foreground-muted leading-relaxed ps-5">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Primary Action Card */}
                {currentSection.primaryActionLabel && (
                  <div className="pt-4 border-t border-border/30">
                    <Link
                      href={currentSection.primaryActionHref || currentSection.href}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl btn-glow-primary font-black text-xs shadow-md transition-all active:scale-95"
                    >
                      <FiPlus className="h-4 w-4" />
                      <span>{currentSection.primaryActionLabel}</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ================================================================= */}
          {/* MOBILE DRAWER (Slide-over Liquid Glass)                           */}
          {/* ================================================================= */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <div
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
              />

              <div className="relative w-72 max-w-[80vw] bg-white/75 dark:bg-black/80 backdrop-blur-2xl border-e border-white/40 dark:border-white/10 h-full flex flex-col p-4 shadow-2xl z-10 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between pb-4 border-b border-border/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-taupe to-brand-gold dark:from-brand-gold dark:to-brand-champagne flex items-center justify-center font-black text-white dark:text-brand-stone-950 text-lg shadow-md">
                      S
                    </div>
                    <span className="font-black text-sm text-foreground">Sync ERP</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-xl text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto">
                  {accessibleSections.map((section) => {
                    const isActive = pathname.startsWith(section.href);

                    return (
                      <Link
                        key={section.id}
                        href={section.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-surface-raised text-foreground font-black shadow-xs'
                            : 'text-foreground-muted hover:text-foreground hover:bg-surface-hover'
                        }`}
                      >
                        <section.icon className="h-4.5 w-4.5" />
                        <span>{section.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground truncate">
                      {user?.employee?.fullName || user?.email}
                    </p>
                    <span className="text-[10px] text-primary">{user?.role?.name}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 rounded-xl bg-surface text-foreground-muted hover:text-rose-500"
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
          <div className="flex-1 flex flex-col h-full min-w-0 bg-transparent overflow-hidden">
            {/* Top Navbar */}
            <header className="h-16 shrink-0 border-b border-white/40 dark:border-white/10 bg-white/30 dark:bg-black/35 backdrop-blur-2xl px-4 md:px-8 flex items-center justify-between z-20 transition-colors shadow-xs">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2.5 rounded-2xl border border-border bg-surface md:hidden text-foreground hover:bg-surface-hover"
                  title="فتح القائمة"
                >
                  <FiMenu className="h-4.5 w-4.5" />
                </button>

                {/* Subpanel toggle for desktop */}
                <button
                  type="button"
                  onClick={() => setIsSubPanelOpen(!isSubPanelOpen)}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface/80 hover:bg-surface text-xs font-bold text-foreground transition-all border border-white/[0.04]"
                  title="طي أو إظهار دليل الصفحة"
                >
                  <FiInfo className="h-4 w-4 text-primary" />
                  <span>{isSubPanelOpen ? 'إخفاء دليل الصفحة' : 'دليل الصفحة'}</span>
                </button>

                {/* Real-Time Pulse Indicator */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>متزامن لحظياً</span>
                </div>

                {/* Department Badge */}
                {user?.employee?.department && (
                  <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-surface/80 text-xs font-bold text-foreground-muted border border-white/[0.04]">
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
                <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl text-xs text-foreground-muted focus-within:text-foreground focus-within:border-primary/40 transition-all shadow-inner">
                  <FiSearch className="h-4 w-4" />
                  <input
                    type="text"
                    placeholder="بحث سريع في النظام..."
                    className="bg-transparent border-none outline-hidden w-40 lg:w-56 text-xs text-foreground placeholder-foreground-subtle"
                  />
                  <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-surface-raised text-[10px] font-mono text-foreground-subtle">
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
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative z-10">
              <div className="max-w-7xl w-full mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SocketProvider>
    );
  }
