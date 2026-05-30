import React from 'react';
import { cn } from '@/lib/utils';

export default function ActivityPointsBadge({ points, label }) {
  const color =
    points === 5 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
    points === 4 ? 'bg-green-100 text-green-800 border-green-200' :
    points === 3 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    points === 2 ? 'bg-orange-100 text-orange-800 border-orange-200' :
    points === 1 ? 'bg-red-100 text-red-700 border-red-200' :
    'bg-muted text-muted-foreground border-border';

  return (
    <div className={cn('flex flex-col items-center rounded-lg border px-3 py-2 min-w-[64px]', color)}>
      <span className="text-lg font-bold">{points}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}