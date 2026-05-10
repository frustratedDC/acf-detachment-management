import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Check, X, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';

const EVENT_COLORS = {
  'Training Night': 'bg-primary text-primary-foreground',
  'Camp': 'bg-chart-2 text-white',
  'Competition': 'bg-accent text-accent-foreground',
  'Admin': 'bg-muted text-muted-foreground',
  'Other': 'bg-chart-5 text-white',
};

const emptyEvent = {
  Title: '', Date: '', EndDate: '', EventType: 'Training Night',
  Notes: '', IsTrainingNight: false, AvailabilityDeadline: '', Location: ''
};

export default function TrainingCalendar() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const canEdit = myLevel >= ACCESS_LEVELS.DET_2IC;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [availDialogOpen, setAvailDialogOpen] = useState(false);
  const [availEvent, setAvailEvent] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events', format(monthStart, 'yyyy-MM')],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['staff-availability'],
    queryFn: () => base44.entities.StaffAvailability.filter({}),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CalendarEvent.create({ ...data, CreatedByPNumber: me?.PNumber }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar-events'] }); toast.success('Event created'); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CalendarEvent.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar-events'] }); toast.success('Event updated'); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CalendarEvent.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['calendar-events'] }); toast.success('Event deleted'); },
  });

  const availMutation = useMutation({
    mutationFn: async ({ eventDate, isAvailable, notes }) => {
      const existing = availability.find(a => a.EventDate === eventDate && a.PNumber === me?.PNumber);
      if (existing) {
        await base44.entities.StaffAvailability.update(existing.id, { IsAvailable: isAvailable, Notes: notes });
      } else {
        await base44.entities.StaffAvailability.create({ EventDate: eventDate, PNumber: me?.PNumber, IsAvailable: isAvailable, Notes: notes });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff-availability'] }); toast.success('Availability saved'); setAvailDialogOpen(false); },
  });

  function openCreate(date) {
    if (!canEdit) return;
    setForm({ ...emptyEvent, Date: format(date, 'yyyy-MM-dd') });
    setEditingEvent(null);
    setDialogOpen(true);
  }

  function openEdit(ev) {
    setForm({
      Title: ev.Title, Date: ev.Date, EndDate: ev.EndDate || '',
      EventType: ev.EventType, Notes: ev.Notes || '',
      IsTrainingNight: ev.IsTrainingNight || false,
      AvailabilityDeadline: ev.AvailabilityDeadline || '',
      Location: ev.Location || ''
    });
    setEditingEvent(ev);
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setEditingEvent(null); setForm(emptyEvent); }

  function saveEvent() {
    if (!form.Title || !form.Date) return;
    if (editingEvent) updateMutation.mutate({ id: editingEvent.id, data: form });
    else createMutation.mutate(form);
  }

  function openAvailability(ev) {
    setAvailEvent(ev);
    setAvailDialogOpen(true);
  }

  // Build calendar grid
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }

  function eventsForDay(day) {
    const ds = format(day, 'yyyy-MM-dd');
    return events.filter(ev => ev.Date === ds || (ev.EndDate && ds >= ev.Date && ds <= ev.Date));
  }

  function availableStaffForEvent(ev) {
    return availability.filter(a => a.EventDate === ev.Date && a.IsAvailable);
  }

  const myAvail = availEvent ? availability.find(a => a.EventDate === availEvent.Date && a.PNumber === me?.PNumber) : null;
  const [availNote, setAvailNote] = useState('');

  return (
    <div>
      <PageHeader
        title="Training Calendar"
        description="View events and manage training nights"
        icon={CalendarDays}
        actions={
          canEdit && (
            <Button onClick={() => openCreate(new Date())}>
              <Plus className="w-4 h-4 mr-2" />New Event
            </Button>
          )
        }
      />

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {days.map(day => {
              const dayEvents = eventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const inMonth = isSameMonth(day, currentMonth);
              return (
                <div
                  key={day.toISOString()}
                  className={`bg-card min-h-20 p-1 cursor-pointer hover:bg-muted/30 transition-colors ${!inMonth ? 'opacity-40' : ''}`}
                  onClick={() => canEdit && openCreate(day)}
                >
                  <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        className={`text-xs px-1.5 py-0.5 rounded-full truncate cursor-pointer ${EVENT_COLORS[ev.EventType] || 'bg-muted'}`}
                        onClick={(e) => { e.stopPropagation(); canEdit ? openEdit(ev) : openAvailability(ev); }}
                      >
                        {ev.Title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events with availability */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Training Nights</h3>
        {events
          .filter(ev => ev.IsTrainingNight && ev.Date >= format(new Date(), 'yyyy-MM-dd'))
          .sort((a, b) => a.Date.localeCompare(b.Date))
          .slice(0, 5)
          .map(ev => {
            const availableStaff = availableStaffForEvent(ev);
            const myStatus = availability.find(a => a.EventDate === ev.Date && a.PNumber === me?.PNumber);
            const personnelMap = {};
            personnel.forEach(p => { personnelMap[p.PNumber] = p; });
            return (
              <Card key={ev.id} className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{ev.Title}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(ev.Date), 'EEE dd MMM yyyy')}</p>
                      {ev.AvailabilityDeadline && (
                        <p className="text-xs text-accent-foreground mt-0.5">Availability due: {format(parseISO(ev.AvailabilityDeadline), 'dd MMM yyyy')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {myLevel >= ACCESS_LEVELS.DET_INSTRUCTOR && (
                        <Button size="sm" variant="outline" onClick={() => openAvailability(ev)}>
                          {myStatus ? (myStatus.IsAvailable ? '✓ Available' : '✗ Unavailable') : 'My Availability'}
                        </Button>
                      )}
                      {canEdit && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(ev)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(ev.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                  {availableStaff.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                      {availableStaff.map(a => {
                        const p = personnelMap[a.PNumber];
                        return <Badge key={a.PNumber} variant="outline" className="text-xs">{p ? `${p.Rank || ''} ${p.Surname}`.trim() : a.PNumber}</Badge>;
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Title</Label>
              <Input value={form.Title} onChange={e => setForm(p => ({ ...p, Title: e.target.value }))} placeholder="Event title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.Date} onChange={e => setForm(p => ({ ...p, Date: e.target.value }))} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.EndDate} onChange={e => setForm(p => ({ ...p, EndDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.EventType} onValueChange={v => setForm(p => ({ ...p, EventType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Training Night','Camp','Competition','Admin','Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Input value={form.Location} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} placeholder="Location" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isTraining"
                checked={form.IsTrainingNight}
                onCheckedChange={v => setForm(p => ({ ...p, IsTrainingNight: v }))}
              />
              <Label htmlFor="isTraining">This is a Training Night (closes detachment)</Label>
            </div>
            {form.IsTrainingNight && (
              <div>
                <Label>Availability Submission Deadline</Label>
                <Input type="date" value={form.AvailabilityDeadline} onChange={e => setForm(p => ({ ...p, AvailabilityDeadline: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.Notes} onChange={e => setForm(p => ({ ...p, Notes: e.target.value }))} rows={2} placeholder="Optional notes..." />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={saveEvent} disabled={!form.Title || !form.Date}>
                {editingEvent ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Availability Dialog */}
      <Dialog open={availDialogOpen} onOpenChange={setAvailDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>My Availability — {availEvent?.Title}</DialogTitle></DialogHeader>
          {availEvent && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{availEvent.Date && format(parseISO(availEvent.Date), 'EEEE dd MMMM yyyy')}</p>
              <div>
                <Label>Are you available?</Label>
                <div className="flex gap-3 mt-2">
                  <Button
                    variant={myAvail?.IsAvailable !== false ? 'default' : 'outline'}
                    onClick={() => availMutation.mutate({ eventDate: availEvent.Date, isAvailable: true, notes: availNote })}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />Available
                  </Button>
                  <Button
                    variant={myAvail?.IsAvailable === false ? 'destructive' : 'outline'}
                    onClick={() => availMutation.mutate({ eventDate: availEvent.Date, isAvailable: false, notes: availNote })}
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />Unavailable
                  </Button>
                </div>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={availNote} onChange={e => setAvailNote(e.target.value)} placeholder="e.g. Arriving late" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}