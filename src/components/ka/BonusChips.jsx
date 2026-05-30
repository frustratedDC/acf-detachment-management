import React from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function Chip({ icon: Icon, label, active, color }) {
  if (!active) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function BonusChips({ bonuses }) {
  if (!bonuses) return null;
  const items = [
    { key: 'bj', label: 'BJ' },
    { key: 'sq', label: 'SQ' },
    { key: 'pu', label: 'PU' },
    { key: 'sh', label: 'SH' },
    { key: 'msft', label: 'MSFT' },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ key, label }) => (
        <React.Fragment key={key}>
          <Chip icon={Trophy} label={`${label} Best`} active={bonuses[`${key}_h`]} color="bg-amber-50 text-amber-700 border-amber-200" />
          <Chip icon={TrendingUp} label={`${label} PB`} active={bonuses[`${key}_i`]} color="bg-sky-50 text-sky-700 border-sky-200" />
        </React.Fragment>
      ))}
    </div>
  );
}