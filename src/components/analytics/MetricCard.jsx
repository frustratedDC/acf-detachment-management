import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, AlertCircle } from 'lucide-react';

function getStatusColor(status) {
  switch (status) {
    case 'green':
      return 'bg-chart-2/10 border-chart-2/30 text-chart-2';
    case 'amber':
      return 'bg-amber-100/30 border-amber-300/50 text-amber-700';
    case 'red':
      return 'bg-destructive/10 border-destructive/30 text-destructive';
    default:
      return 'bg-card border-border';
  }
}

export default function MetricCard({ title, value, status = 'green', icon: Icon, onClick, details = [] }) {
  return (
    <Card className={`cursor-pointer border-2 transition-all hover:shadow-md ${getStatusColor(status)}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" />}
            <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
          </div>
          {status === 'amber' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {status === 'red' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        </div>
        <p className="text-3xl font-bold mb-2">{value}</p>
        {details.length > 0 && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}