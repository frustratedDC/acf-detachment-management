import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import PersonnelStatusBadge from '@/components/personnel/PersonnelStatusBadge';

export default function PersonnelRow({
  person: p,
  isInactive,
  canViewSensitive,
  canViewAs,
  isSysAdmin,
  onSelect,
  onViewAs,
  onEdit,
  onDelete,
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isInactive ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
          {p.Surname?.[0]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
          </p>
          <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
        </div>
      </div>
      <div className="flex items-center flex-wrap gap-2 sm:shrink-0 pl-11 sm:pl-0">
        {p.Type !== 'Adult Instructor' && <Badge variant="outline" className="text-xs">{p.CurrentStarLevel}</Badge>}
        <Badge className="text-xs">L{p.AccessLevel}</Badge>
        {p.IsLinked && <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">Linked</Badge>}
        {canViewSensitive && <PersonnelStatusBadge status={p.PersonnelStatus || 'Active'} />}
        <div className="flex items-center gap-1 ml-auto sm:ml-0">
          {canViewAs && (
            <Button variant="ghost" size="sm" title={`View as ${p.Surname}`} onClick={(e) => { e.stopPropagation(); onViewAs(); }}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={(e) => onEdit(e)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {isSysAdmin && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}