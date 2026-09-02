import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function Card({ children, className = '', hoverEffect = true, ...props }: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 bg-white/35 dark:bg-black/40 text-card-foreground p-5 sm:p-6 shadow-2xl shadow-black/5 dark:shadow-black/40 backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300 ${
        hoverEffect
          ? 'hover:-translate-y-0.5 hover:shadow-2xl hover:bg-white/50 dark:hover:bg-black/55 hover:border-white/60 dark:hover:border-white/20'
          : ''
      } ${className}`}
      {...props}
    >
      {/* Specular Top Rim Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent z-10" />

      <div className="relative z-0">{children}</div>
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between pb-4 border-b border-border/20 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-black text-foreground tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-foreground-muted mt-0.5 leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`pt-4 ${className}`} {...props}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 pt-4 border-t border-border/20 flex items-center justify-between ${className}`} {...props}>
      {children}
    </div>
  );
}
