import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

export default function TrainingNightPanel({ event, open, onClose }) {
  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-date', event?.Date],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: event?.Date }),
    enabled: !!event?.Date && open,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
    enabled: open,
  });

  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const STAR_LEVELS = ['Basic','1 Star','2 Star','3 Star','4 Star'];

  function getInstructor(pnum) {
    const p = personnelMap[pnum];
    if (!p) return pnum || '—';
    return [p.Rank, p.Surname].filter(Boolean).join(' ');
  }

  if (!event) return null;

  const periods = [...new Set(schedule.map(s => s.Period))].sort();

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {event.Title} — Training Plan
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{format(parseISO(event.Date), 'EEEE dd MMMM yyyy')}</p>
        </DialogHeader>

        {schedule.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No training plan entered for this night.</p>
            <Link to="/schedule">
              <Button variant="outline" size="sm" className="mt-3">Go to Training Plan</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {STAR_LEVELS.map(sl => {
              const rows = schedule.filter(s => s.AssignedStarLevel === sl).sort((a, b) => a.Period - b.Period);
              if (rows.length === 0) return null;
              return (
                <div key={sl}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-primary/10 text-primary border-0">{sl}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {rows.map(row => (
                      <div key={row.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                        <Badge variant="outline" className="shrink-0 text-xs">P{row.Period}</Badge>
                        <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 truncate">{row.LessonCode}</span>
                        <span className="flex-1 font-medium truncate">{row.LessonName || row.LessonCode}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{getInstructor(row.InstructorPNumber)}</span>
                        {row.Location && <Badge variant="secondary" className="text-xs shrink-0">{row.Location}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center mt-3 pt-3 border-t">
          <Link to="/schedule">
            <Button variant="outline" size="sm">View Full Training Plan</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4 mr-1" />Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}