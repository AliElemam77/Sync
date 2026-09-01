import React from 'react';
import { Skeleton } from './skeleton';

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-card-border bg-card/80 p-5 md:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-20 rounded-xl" />
            <Skeleton className="h-3.5 w-36 rounded-lg" />
          </div>
          <div className="pt-2 border-t border-border">
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
