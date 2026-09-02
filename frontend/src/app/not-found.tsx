'use client';

import React from 'react';
import Link from 'next/link';
import { FiHome, FiAlertTriangle } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-6 relative overflow-hidden">
      {/* Ambient decorative glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="text-center space-y-5 max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary text-3xl shadow-lg">
          <FiAlertTriangle className="h-10 w-10" />
        </div>

        <h1 className="text-7xl font-black text-primary font-mono tracking-tight">404</h1>
        
        <h2 className="text-2xl font-black text-foreground">الصفحة غير موجودة</h2>
        
        <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
          الصفحة أو المورد الذي تبحث عنه قد تم نقله أو حذفه أو ليس لديك الصلاحية الكافية للوصول إليه.
        </p>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover px-6 py-3 text-xs font-black text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-all"
          >
            <FiHome className="h-4 w-4" />
            <span>العودة إلى لوحة التحكم</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
