'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { LoginResponse } from '../../types/auth';
import { useAuth } from '../../hooks/use-auth';
import { AxiosError } from 'axios';
import { ThemeToggle } from '../../components/ui/theme-toggle';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', {
        email: email.trim(),
        password,
      });
      return response.data;
    },
    onSuccess: (data) => {
      login(data.accessToken, data.user);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email.includes('@')) {
      setValidationError('يرجى إدخال بريد إلكتروني صالح.');
      return;
    }
    if (password.length < 8) {
      setValidationError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
      return;
    }

    loginMutation.mutate();
  };

  const errorMessage =
    validationError ||
    (loginMutation.error instanceof AxiosError
      ? (loginMutation.error.response?.data as any)?.message || 'فشل تسجيل الدخول. تحقق من صحة البيانات.'
      : null);

  return (
    <div dir="rtl" className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background overflow-hidden transition-colors duration-300">
      {/* Ambient background glow orbs */}
      <div className="absolute -top-40 -start-40 w-96 h-96 rounded-full bg-brand-gold/15 dark:bg-brand-champagne/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -end-40 w-96 h-96 rounded-full bg-brand-taupe/15 dark:bg-brand-gold/10 blur-3xl pointer-events-none" />

      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-6 end-6 z-20">
        <ThemeToggle />
      </div>

      {/* Main Container Card */}
      <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-3xl border border-card-border bg-card text-card-foreground p-7 sm:p-9 shadow-luxury dark:shadow-luxury-dark backdrop-blur-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-tr from-brand-taupe to-brand-gold dark:from-brand-gold dark:to-brand-champagne flex items-center justify-center font-black text-white dark:text-brand-stone-950 text-2xl shadow-lg shadow-brand-taupe/20 transition-transform hover:scale-105">
              S
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight pt-2">
              Sync ERP
            </h1>
            <p className="text-xs sm:text-sm text-foreground-muted font-medium">
              بوابة تسجيل الدخول لمنظومة إدارة المؤسسة
            </p>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500 dark:text-rose-400 flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold text-foreground-muted mb-1.5"
                >
                  البريد الإلكتروني للعمل
                </label>
                <div className="relative">
                  <FiMail className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full rounded-2xl border border-border bg-surface ps-10 pe-4 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-foreground-muted mb-1.5"
                >
                  كلمة المرور
                </label>
                <div className="relative">
                  <FiLock className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-border bg-surface ps-10 pe-11 py-2.5 text-xs text-foreground placeholder-foreground-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground p-1 rounded-lg"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground font-black text-xs shadow-md shadow-primary/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>جاري تسجيل الدخول...</span>
                </div>
              ) : (
                <span>دخول إلى المنظومة</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
