import React from 'react';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, LEVEL_NAMES } from '@/lib/accessLevels';
import { ShieldX } from 'lucide-react';

export default function AccessGate({ level, children }) {
  const { personnel } = usePersonnel();
  const userLevel = personnel?.AccessLevel ?? 0;

  if (!hasAccess(userLevel, level)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          This section requires <strong>{LEVEL_NAMES[level]}</strong> access or above.
          Your current level: <strong>{LEVEL_NAMES[userLevel]}</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}