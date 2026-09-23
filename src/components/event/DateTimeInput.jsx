import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

// Constrained datetime-local input bounded by event start/end, with formatted preview and inline validation.
export default function DateTimeInput({ label, value, onChange, min, max, required }) {
  const [touched, setTouched] = useState(false);
  const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
  const minLocal = min ? toLocal(min) : undefined;
  const maxLocal = max ? toLocal(max) : undefined;

  const valDate = value ? new Date(value) : null;
  const minDate = min ? new Date(min) : null;
  const maxDate = max ? new Date(max) : null;
  const tooEarly = valDate && minDate && valDate < minDate;
  const tooLate = valDate && maxDate && valDate > maxDate;
  const invalid = touched && (tooEarly || tooLate);

  return (
    <div className="space-y-0.5">
      {label && <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>}
      <Input
        type="datetime-local"
        value={toLocal(value)}
        min={minLocal}
        max={maxLocal}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        className={`h-8 text-xs ${invalid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
      />
      {invalid && (
        <p className="text-[10px] text-destructive">
          {tooEarly && min && `Must be on/after ${format(new Date(min), 'dd MMM HH:mm')}`}
          {tooLate && max && `Must be on/before ${format(new Date(max), 'dd MMM HH:mm')}`}
        </p>
      )}
    </div>
  );
}