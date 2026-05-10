import React from 'react';
import { Badge } from '@/components/ui/badge';

const STATUS_STYLES = {
  Active: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
  Suspended: 'bg-destructive/15 text-destructive border-destructive/30',
  Leaver: 'bg-muted text-muted-foreground border-border',
  'Long-term Absence': 'bg-yellow-500/15 text-yellow-700 border-yellow-400/30',
  Deceased: 'bg-slate-200 text-slate-600 border-slate-300',
};

export default function PersonnelStatusBadge({ status }) {
  if (!status || status === 'Active') return null;
  return (
    <Badge variant="outline" className={`text-xs ${STATUS_STYLES[status] || ''}`}>
      {status}
    </Badge>
  );
}