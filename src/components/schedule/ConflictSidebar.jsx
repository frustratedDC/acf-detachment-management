import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Users } from 'lucide-react';

export default function ConflictSidebar({ schedule, availability, personnelMap, collapsed, onToggle }) {
  // Find all conflicts: instructor assigned to a night but marked Unavailable
  const conflicts = [];
  const resolvedCount = { ok: 0, warn: 0, unknown: 0 };

  const dateGroups = {};
  schedule.forEach(entry => {
    if (!dateGroups[entry.Date]) dateGroups[entry.Date] = new Set();
    if (entry.InstructorPNumber) dateGroups[entry.Date].add(entry.InstructorPNumber);
    if (entry.Instructor2PNumber) dateGroups[entry.Date].add(entry.Instructor2PNumber);
  });

  Object.entries(dateGroups).forEach(([date, pnums]) => {
    pnums.forEach(pnum => {
      const avail = availability.find(a => a.Date === date && a.InstructorPNumber === pnum);
      const p = personnelMap[pnum];
      const name = p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pnum;
      if (!avail) {
        resolvedCount.unknown++;
      } else if (avail.Status === 'Unavailable') {
        conflicts.push({ date, name, pnum, reason: avail.Reason });
        resolvedCount.warn++;
      } else {
        resolvedCount.ok++;
      }
    });
  });

  return (
    <div className={`transition-all duration-300 shrink-0 ${collapsed ? 'w-9' : 'w-64'}`}>
      <div className="sticky top-4">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-primary/10">
            {!collapsed && (
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Resource Tracker
              </span>
            )}
            <button
              onClick={onToggle}
              className="ml-auto text-primary hover:opacity-70 transition-opacity"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!collapsed && (
            <div className="p-3 space-y-3 text-xs">
              {/* Summary counts */}
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="rounded bg-green-50 border border-green-200 p-1.5">
                  <p className="font-bold text-green-700 text-sm">{resolvedCount.ok}</p>
                  <p className="text-green-600">Confirmed</p>
                </div>
                <div className="rounded bg-amber-50 border border-amber-200 p-1.5">
                  <p className="font-bold text-amber-700 text-sm">{resolvedCount.unknown}</p>
                  <p className="text-amber-600">Unconfirmed</p>
                </div>
                <div className="rounded bg-red-50 border border-red-200 p-1.5">
                  <p className="font-bold text-red-700 text-sm">{resolvedCount.warn}</p>
                  <p className="text-red-600">Conflicts</p>
                </div>
              </div>

              {/* Conflict list */}
              {conflicts.length === 0 ? (
                <div className="flex items-center gap-2 text-green-700 p-2 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>No availability conflicts detected</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Conflicts ({conflicts.length})
                  </p>
                  {conflicts.map((c, i) => (
                    <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 space-y-0.5">
                      <p className="font-semibold text-destructive">{c.name}</p>
                      <p className="text-muted-foreground">{c.date}</p>
                      {c.reason && <p className="italic text-muted-foreground">"{c.reason}"</p>}
                      <Badge variant="destructive" className="text-xs mt-1">Unavailable</Badge>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-muted-foreground text-center italic">
                Based on instructor availability submissions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}