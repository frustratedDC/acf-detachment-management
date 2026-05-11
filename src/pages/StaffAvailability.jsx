import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import AccessGate from '@/components/shared/AccessGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, Check, X, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isAdultInstructor } from '@/lib/accessLevels';

export default function StaffAvailability() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const myLevel = me?.AccessLevel ?? 0;
  const canViewAll = myLevel >= ACCESS_LEVELS.DET_2IC;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['staff-availability'],
    queryFn: () => base44.entities.StaffAvailability.filter({}),
  });

  const { data: scheduleEntries = [] } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  // Training nights in this month
  const trainingNights = useMemo(() =>
    calendarEvents
      .filter(ev => ev.IsTrainingNight && ev.Date >= monthStart && ev.Date <= monthEnd)
      .sort((a, b) => a.Date.localeCompare(b.Date)),
    [calendarEvents, monthStart, monthEnd]
  );

  const instructors = useMemo(() =>
    allPersonnel.filter(p => isAdultInstructor(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'),
    [allPersonnel]
  );

  const personnelMap = useMemo(() => {
    const m = {}; allPersonnel.forEach(p => { m[p.PNumber] = p; }); return m;
  }, [allPersonnel]);

  // My availability
  function getMyAvail(eventDate) {
    return availability.find(a => a.EventDate === eventDate && a.PNumber === me?.PNumber);
  }

  // Staff availability for a given event date
  function getAvailForDate(eventDate) {
    return availability.filter(a => a.EventDate === eventDate);
  }

  // Instructors assigned to a training night
  function getAssignedInstructors(eventDate) {
    return [...new Set(scheduleEntries.filter(s => s.Date === eventDate).map(s => s.InstructorPNumber))].filter(Boolean);
  }

  const [notesDraft, setNotesDraft] = useState({});

  const availMutation = useMutation({
    mutationFn: async ({ eventDate, isAvailable }) => {
      const existing = availability.find(a => a.EventDate === eventDate && a.PNumber === me?.PNumber);
      const notes = notesDraft[eventDate] || '';
      if (existing) {
        await base44.entities.StaffAvailability.update(existing.id, { IsAvailable: isAvailable, Notes: notes });
      } else {
        await base44.entities.StaffAvailability.create({ EventDate: eventDate, PNumber: me?.PNumber, IsAvailable: isAvailable, Notes: notes });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      toast.success('Availability saved');
    },
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Staff Availability"
        description="Submit your availability for upcoming training nights"
        icon={CalendarCheck}
      />

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {trainingNights.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No training nights scheduled for {format(currentMonth, 'MMMM yyyy')}.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {trainingNights.map(ev => {
          const myAvail = getMyAvail(ev.Date);
          const allAvail = getAvailForDate(ev.Date);
          const availableStaff = allAvail.filter(a => a.IsAvailable);
          const unavailableStaff = allAvail.filter(a => !a.IsAvailable);
          const assignedPNumbers = getAssignedInstructors(ev.Date);
          const notSubmitted = instructors.filter(p => !allAvail.find(a => a.PNumber === p.PNumber));

          return (
            <Card key={ev.id} className={`border-l-4 ${myAvail?.IsAvailable === true ? 'border-l-green-500' : myAvail?.IsAvailable === false ? 'border-l-destructive' : 'border-l-muted'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">{ev.Title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{format(parseISO(ev.Date), 'EEEE dd MMMM yyyy')}</p>
                    {ev.Location && <p className="text-xs text-muted-foreground">{ev.Location}</p>}
                    {ev.AvailabilityDeadline && (
                      <p className="text-xs text-accent-foreground">Deadline: {format(parseISO(ev.AvailabilityDeadline), 'dd MMM yyyy')}</p>
                    )}
                  </div>
                  {/* My availability buttons */}
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={myAvail?.IsAvailable === true ? 'default' : 'outline'}
                        className={myAvail?.IsAvailable === true ? 'bg-green-600 hover:bg-green-700' : ''}
                        onClick={() => availMutation.mutate({ eventDate: ev.Date, isAvailable: true })}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />Available
                      </Button>
                      <Button
                        size="sm"
                        variant={myAvail?.IsAvailable === false ? 'destructive' : 'outline'}
                        onClick={() => availMutation.mutate({ eventDate: ev.Date, isAvailable: false })}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />Unavailable
                      </Button>
                    </div>
                    <Input
                      value={notesDraft[ev.Date] ?? (myAvail?.Notes || '')}
                      onChange={e => setNotesDraft(prev => ({ ...prev, [ev.Date]: e.target.value }))}
                      placeholder="Add a note (optional)"
                      className="h-7 text-xs w-48"
                    />
                  </div>
                </div>
              </CardHeader>

              {/* Breakdown — only visible to L4+ */}
              {canViewAll && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Available */}
                    <div>
                      <p className="font-semibold text-green-700 mb-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />Available ({availableStaff.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {availableStaff.map(a => {
                          const p = personnelMap[a.PNumber];
                          const isAssigned = assignedPNumbers.includes(a.PNumber);
                          return (
                            <Badge key={a.PNumber} variant="outline" className={`text-xs ${isAssigned ? 'border-primary text-primary' : ''}`}>
                              {p ? `${p.Rank || ''} ${p.Surname}`.trim() : a.PNumber}
                              {isAssigned && ' ✓'}
                              {a.Notes && ` (${a.Notes})`}
                            </Badge>
                          );
                        })}
                        {availableStaff.length === 0 && <span className="text-muted-foreground italic">None yet</span>}
                      </div>
                    </div>
                    {/* Unavailable */}
                    <div>
                      <p className="font-semibold text-destructive mb-1 flex items-center gap-1">
                        <X className="w-3 h-3" />Unavailable ({unavailableStaff.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {unavailableStaff.map(a => {
                          const p = personnelMap[a.PNumber];
                          return (
                            <Badge key={a.PNumber} variant="outline" className="text-xs text-muted-foreground">
                              {p ? `${p.Rank || ''} ${p.Surname}`.trim() : a.PNumber}
                              {a.Notes && ` (${a.Notes})`}
                            </Badge>
                          );
                        })}
                        {unavailableStaff.length === 0 && <span className="text-muted-foreground italic">None</span>}
                      </div>
                    </div>
                    {/* Not submitted */}
                    <div>
                      <p className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />Not Submitted ({notSubmitted.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {notSubmitted.map(p => (
                          <Badge key={p.PNumber} variant="secondary" className="text-xs">
                            {p.Rank ? `${p.Rank} ` : ''}{p.Surname}
                          </Badge>
                        ))}
                        {notSubmitted.length === 0 && <span className="text-muted-foreground italic">All submitted</span>}
                      </div>
                    </div>
                  </div>

                  {/* Assigned to training plan */}
                  {assignedPNumbers.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-semibold text-primary mb-1">Assigned in Training Plan:</p>
                      <div className="flex flex-wrap gap-1">
                        {assignedPNumbers.map(pnum => {
                          const p = personnelMap[pnum];
                          const lessons = scheduleEntries.filter(s => s.Date === ev.Date && s.InstructorPNumber === pnum);
                          const isAvail = availability.find(a => a.EventDate === ev.Date && a.PNumber === pnum)?.IsAvailable;
                          return (
                            <Badge key={pnum} variant="outline" className={`text-xs ${isAvail === false ? 'border-destructive text-destructive' : 'border-primary text-primary'}`}>
                              {p ? `${p.Rank || ''} ${p.Surname}`.trim() : pnum} — {lessons.map(l => l.LessonCode).join(', ')}
                              {isAvail === false && ' ⚠ Unavailable'}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AccessGate>
  );
}