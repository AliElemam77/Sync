import React from 'react';
import { Skeleton } from './skeleton';

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-3xl border border-card-border bg-card/80 p-5 md:p-6 shadow-sm overflow-hidden space-y-4">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <Skeleton className="h-6 w-40 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Table grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-start">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="py-3 px-4">
                  <Skeleton className="h-4 w-20 rounded-md" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="py-3.5 px-4">
                    <Skeleton className={`h-4 ${c === 0 ? 'w-32' : 'w-20'} rounded-md`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
