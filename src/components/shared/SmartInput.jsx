import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { usePersonnel } from '@/lib/usePersonnel';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

const STORAGE_KEY_PREFIX = 'acf_smart_';

/**
 * SmartInput: for L5+, shows a dropdown of previously used values and remembers new ones.
 * Falls back to a plain Input for lower levels.
 */
export default function SmartInput({ fieldKey, value, onChange, placeholder, className, disabled }) {
  const { personnel } = usePersonnel();
  const canRemember = (personnel?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_COMMANDER;
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!canRemember) return;
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + fieldKey);
    setSuggestions(stored ? JSON.parse(stored) : []);
  }, [fieldKey, canRemember]);

  function saveValue(val) {
    if (!canRemember || !val.trim()) return;
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + fieldKey);
    const existing = stored ? JSON.parse(stored) : [];
    if (!existing.includes(val.trim())) {
      const updated = [val.trim(), ...existing].slice(0, 20);
      localStorage.setItem(STORAGE_KEY_PREFIX + fieldKey, JSON.stringify(updated));
      setSuggestions(updated);
    }
  }

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes((value || '').toLowerCase()) && s !== value
  );

  if (!canRemember) {
    return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} disabled={disabled} />;
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 150);
          saveValue(value || '');
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={() => {
                onChange(s);
                setShowDropdown(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}