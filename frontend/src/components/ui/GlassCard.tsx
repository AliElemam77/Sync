import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'raised' | 'subtle' | 'interactive';
  glow?: boolean;
}

/**
 * GlassCard - Apple iOS Liquid Glass Component
 * High-end frosted glass container floating over subtle ambient mesh gradients.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'default',
  glow = false,
  ...props
}) => {
  const variantStyles: Record<string, string> = {
    default:
      'bg-white/35 dark:bg-black/40 border-white/40 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/40',
    raised:
      'bg-white/55 dark:bg-black/60 border-white/60 dark:border-white/15 shadow-2xl shadow-black/10 dark:shadow-black/60',
    subtle:
      'bg-white/20 dark:bg-black/25 border-white/30 dark:border-white/[0.06] shadow-lg shadow-black/5',
    interactive:
      'bg-white/35 dark:bg-black/40 border-white/40 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/40 hover:bg-white/55 dark:hover:bg-black/60 hover:border-white/70 dark:hover:border-white/20 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer',
  };

  return (
    <div
      className={`relative overflow-hidden backdrop-blur-2xl backdrop-saturate-150 border rounded-2xl transition-all duration-200 ${
        variantStyles[variant] || variantStyles.default
      } ${
        glow
          ? 'ring-1 ring-brand-gold/40 shadow-[0_0_35px_-5px_rgba(216,211,101,0.3)]'
          : ''
      } ${className}`}
      {...props}
    >
      {/* Specular Top Rim Highlight (Simulates Glass Edge Light Refraction) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent z-10" />

      {/* Content Container */}
      <div className="relative z-0 h-full w-full">{children}</div>
    </div>
  );
};

export default GlassCard;
