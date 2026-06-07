import React from 'react';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess } from '@/lib/accessLevels';
import { ShieldAlert } from 'lucide-react';

export default function AccessGate({ children, level = 0 }) {
  const { personnel } = usePersonnel();
  const userLevel = personnel?.AccessLevel ?? 0;

  if (!hasAccess(userLevel, level)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <ShieldAlert className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-muted-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground/60 mt-1">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}