import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { startOfMonth, endOfMonth, addMonths, startOfQuarter, endOfQuarter, format } from 'date-fns';

const PRESETS = [
  { label: 'This Month', get: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Next Month', get: () => ({ start: format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd') }) },
  { label: 'Next 3 Months', get: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(addMonths(new Date(), 2)), 'yyyy-MM-dd') }) },
  { label: 'This Quarter', get: () => ({ start: format(startOfQuarter(new Date()), 'yyyy-MM-dd'), end: format(endOfQuarter(new Date()), 'yyyy-MM-dd') }) },
];

export default function DateRangeSelector({ range, onChange }) {
  const activePreset = PRESETS.find(p => {
    const r = p.get();
    return r.start === range.start && r.end === range.end;
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-2">
        <Input type="date" value={range.start} onChange={e => onChange({ ...range, start: e.target.value })} className="w-40" />
        <span className="text-muted-foreground text-sm">to</span>
        <Input type="date" value={range.end} onChange={e => onChange({ ...range, end: e.target.value })} className="w-40" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <Button
            key={p.label}
            size="sm"
            variant={activePreset?.label === p.label ? 'default' : 'outline'}
            onClick={() => onChange(p.get())}
            className="h-8 text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}