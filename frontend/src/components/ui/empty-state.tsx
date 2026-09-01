import React from 'react';
import { IconType } from 'react-icons';
import { FiInbox } from 'react-icons/fi';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconType;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = FiInbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-3xl border border-dashed border-border bg-card/50 p-10 md:p-14 text-center flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      <div className="h-16 w-16 rounded-3xl bg-surface-raised border border-border flex items-center justify-center text-primary shadow-inner transition-transform hover:scale-110 duration-300">
        <Icon className="h-8 w-8 text-primary" />
      </div>

      <div className="max-w-sm space-y-1">
        <h4 className="text-base font-extrabold text-foreground">{title}</h4>
        <p className="text-xs text-foreground-muted leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-md shadow-primary/25 transition-all duration-200 active:scale-95 hover:shadow-lg"
        >
          {action.icon && <action.icon className="h-4 w-4" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
