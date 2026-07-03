import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAvailability } from '@/lib/useAvailability';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crosshair, AlertTriangle, UserX, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isAfter, subDays } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function ConflictMonitor() {
  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { availability } = useAvailability();

  const personnelMap = useMemo(() => {
    const m = {}; allPersonnel.forEach(p => { m[p.PNumber] = p; }); return m;
  }, [allPersonnel]);

  function nameFor(pnum) {
    const p = personnelMap[pnum];
    return p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pnum;
  }

  const yesterday = subDays(new Date(), 1);

  // Only look at upcoming / recent training nights
  const upcomingEntries = useMemo(() =>
    schedule.filter(e => e.Date && isAfter(parseISO(e.Date), yesterday)),
    [schedule, yesterday]
  );

  const conflicts = useMemo(() => {
    const list = [];
    upcomingEntries.forEach(entry => {
      [entry.InstructorPNumber, entry.Instructor2PNumber].filter(Boolean).forEach(pnum => {
        const avail = availability.find(a => a.Date === entry.Date && a.InstructorPNumber === pnum);
        if (avail?.Status === 'Unavailable') {
          list.push({
            type: 'unavailable',
            date: entry.Date,
            period: entry.Period,
            lesson: entry.LessonName || entry.LessonCode,
            starLevel: entry.AssignedStarLevel,
            pnum,
            name: nameFor(pnum),
            reason: avail.Reason,
          });
        }
      });
      if (!entry.InstructorPNumber) {
        list.push({
          type: 'gap',
          date: entry.Date,
          period: entry.Period,
          lesson: entry.LessonName || entry.LessonCode,
          starLevel: entry.AssignedStarLevel,
        });
      }
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [upcomingEntries, availability, personnelMap]);

  const unavailableConflicts = conflicts.filter(c => c.type === 'unavailable');
  const gapConflicts = conflicts.filter(c => c.type === 'gap');

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Conflict Monitor"
        description="Cross-references the Training Plan with staff availability to surface gaps and conflicts"
        icon={Crosshair}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Upcoming Sessions</p>
            <p className="text-2xl font-bold">{upcomingEntries.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" />Availability Conflicts</p>
            <p className="text-2xl font-bold text-destructive">{unavailableConflicts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><UserX className="w-3 h-3 text-amber-700" />Unassigned Slots</p>
            <p className="text-2xl font-bold text-amber-700">{gapConflicts.length}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : conflicts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600/50" />
            <p className="text-muted-foreground">No conflicts or gaps detected in the upcoming Training Plan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conflicts.map((c, i) => (
            <Card key={i} className={c.type === 'unavailable' ? 'border-destructive/30 bg-destructive/5' : 'border-amber-300/50 bg-amber-50/50'}>
              <CardContent className="p-3.5 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {format(parseISO(c.date), 'EEE d MMM yyyy')} · Period {c.period} · {c.starLevel}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.lesson}</p>
                  {c.type === 'unavailable' && (
                    <p className="text-xs mt-1">
                      <span className="font-semibold text-destructive">{c.name}</span> is marked unavailable
                      {c.reason && <span className="italic text-muted-foreground"> — "{c.reason}"</span>}
                    </p>
                  )}
                  {c.type === 'gap' && (
                    <p className="text-xs mt-1 text-amber-700 font-semibold">No instructor assigned</p>
                  )}
                </div>
                <Badge variant={c.type === 'unavailable' ? 'destructive' : 'outline'} className={c.type === 'gap' ? 'border-amber-400 text-amber-700' : ''}>
                  {c.type === 'unavailable' ? 'Conflict' : 'Gap'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AccessGate>
  );
}