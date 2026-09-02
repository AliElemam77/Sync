import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function Card({ children, className = '', hoverEffect = true, ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-card-border bg-card text-card-foreground p-5 sm:p-6 shadow-luxury dark:shadow-luxury-dark backdrop-blur-xl ${
        hoverEffect
          ? 'hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/25 transition-all duration-300'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
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
