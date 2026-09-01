'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { FiSun, FiMoon } from 'react-icons/fi';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`h-9 w-9 rounded-xl bg-surface-raised border border-border flex items-center justify-center opacity-40 ${className}`}
      />
    );
  }

  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const isDark = currentTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="تبديل المظهر (داكن / فاتح)"
      title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      className={`relative h-9 w-9 rounded-xl bg-surface border border-border hover:bg-surface-hover text-foreground flex items-center justify-center transition-all duration-200 active:scale-95 shadow-xs ${className}`}
    >
      {isDark ? (
        <FiSun className="h-4 w-4 text-brand-lightBlue transition-transform duration-300 hover:rotate-45" />
      ) : (
        <FiMoon className="h-4 w-4 text-brand-blue transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
