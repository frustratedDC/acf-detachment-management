import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
  Check, X, Users, Clock, Circle
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO
} from 'date-fns';
import TrainingNightPanel from '@/components/calendar/TrainingNightPanel';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isAdultInstructor } from '@/lib/accessLevels';

const EVENT_COLORS = {
  'Training Night': 'bg-primary text-primary-foreground',
  'Camp': 'bg-chart-2 text-white',
  'Competition': 'bg-accent text-accent-foreground',
  'Admin': 'bg-muted text-muted-foreground',
  'Other': 'bg-chart-5 text-white',
};

const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const emptyEvent = {
  Title: '', Date: '', EndDate: '', EventType: 'Training Night',
  Notes: '', IsTrainingNight: false, AvailabilityDeadline: '', Location: '', ComplianceStatus: null
};

// Calculate automated compliance for a date
function calcAutoCompliance(dateStr, personnel, governance, availability) {
  // Get staff available on this date
  const availableOnDate = availability
    .filter(a => a.EventDate === dateStr && a.IsAvailable)
    .map(a => a.PNumber);

  const availableAdults = personnel.filter(p =>
    isAdultInstructor(p.AccessLevel) &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    availableOnDate.includes(p.PNumber)
  );

  if (availableAdults.length < 2) return 'closed';

  // Check at least one adult has valid First Aid
  const today = new Date();
  const hasFirstAid = availableAdults.some(p => {
    const rec = governance.find(g => g.PNumber === p.PNumber && g.CourseType === 'First Aid');
    if (!rec) return false;
    if (!rec.ExpiryDate) return true; // no expiry = valid
    return new Date(rec.ExpiryDate) >= today;
  });

  if (!hasFirstAid) return 'amber';
  return 'open';
}

const COMPLIANCE_ICONS = {
  open:   { dot: 'bg-green-500', title: 'Open – Compliance Met' },
  amber:  { dot: 'bg-yellow-400', title: 'Amber – Compliance Issue' },
  closed: { dot: 'bg-destructive', title: 'Closed / Insufficient Staff' },
};

export default function TrainingCalendar() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const canEdit = myLevel >= ACCESS_LEVELS.DET_2IC;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [availDialogOpen, setAvailDialogOpen] = useState(false);
  const [availEvent, setAvailEvent] = useState(null);
  const [availNote, setAvailNote] = useState('');
  const [openingHoursDialogOpen, setOpeningHoursDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events'],
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

  const { data: governance = [] } = useQuery({
    queryKey: ['cfav-governance'],
    queryFn: () => base44.entities.CFAVGovernance.filter({}),
  });

  const { data: openingHours = [] } = useQuery({
    queryKey: ['opening-hours'],
    queryFn: () => base44.entities.DetachmentOpeningHours.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

  // ── Mutations ────────────────────────────────────────────────────────
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

  const complianceOverrideMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.CalendarEvent.update(id, { ComplianceStatus: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
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

  const saveOpeningHourMutation = useMutation({
    mutationFn: async (record) => {
      const existing = openingHours.find(h => h.DayOfWeek === record.DayOfWeek);
      if (existing) return base44.entities.DetachmentOpeningHours.update(existing.id, record);
      return base44.entities.DetachmentOpeningHours.create(record);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opening-hours'] }),
  });

  // ── Calendar helpers ────────────────────────────────────────────────
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
      Location: ev.Location || '',
      ComplianceStatus: ev.ComplianceStatus || null,
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

  function openAvailability(ev) { setAvailEvent(ev); setAvailNote(''); setAvailDialogOpen(true); }

  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = [];
  let d = calStart;
  while (d <= calEnd) { days.push(d); d = addDays(d, 1); }

  function eventsForDay(day) {
    const ds = format(day, 'yyyy-MM-dd');
    return events.filter(ev => ev.Date === ds || (ev.EndDate && ds >= ev.Date && ds <= ev.EndDate));
  }

  function getComplianceForEvent(ev) {
    if (ev.ComplianceStatus) return ev.ComplianceStatus;
    if (!ev.IsTrainingNight) return null;
    return calcAutoCompliance(ev.Date, personnel, governance, availability);
  }

  // Opening hours state for editor
  const [hoursForm, setHoursForm] = useState(() => {
    const m = {};
    DAYS_OF_WEEK.forEach(d => { m[d] = { IsOpen: false, OpenTime: '19:00', CloseTime: '21:30', Notes: '' }; });
    return m;
  });

  function initHoursForm() {
    const m = {};
    DAYS_OF_WEEK.forEach(day => {
      const rec = openingHours.find(h => h.DayOfWeek === day);
      m[day] = rec ? { IsOpen: rec.IsOpen, OpenTime: rec.OpenTime || '19:00', CloseTime: rec.CloseTime || '21:30', Notes: rec.Notes || '' }
                   : { IsOpen: false, OpenTime: '19:00', CloseTime: '21:30', Notes: '' };
    });
    setHoursForm(m);
  }

  function openHoursDialog() { initHoursForm(); setOpeningHoursDialogOpen(true); }

  async function saveHours() {
    for (const day of DAYS_OF_WEEK) {
      await saveOpeningHourMutation.mutateAsync({ DayOfWeek: day, ...hoursForm[day] });
    }
    toast.success('Opening hours saved');
    setOpeningHoursDialogOpen(false);
  }

  const myAvail = availEvent ? availability.find(a => a.EventDate === availEvent.Date && a.PNumber === me?.PNumber) : null;
  const openDays = openingHours.filter(h => h.IsOpen);

  // Training night panel
  const [nightPanelEvent, setNightPanelEvent] = useState(null);

  return (
    <div>
      <PageHeader
        title="Training Calendar"
        description="View events, manage training nights and opening times"
        icon={CalendarDays}
        actions={
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" onClick={openHoursDialog}>
                <Clock className="w-4 h-4 mr-2" />Opening Hours
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => openCreate(new Date())}>
                <Plus className="w-4 h-4 mr-2" />New Event
              </Button>
            )}
          </div>
        }
      />

      {/* Opening hours summary strip */}
      {openDays.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 p-3 bg-muted/40 rounded-lg border">
          <div className="flex items-center gap-1.5 mr-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Opening Times:</span>
          </div>
          {openDays.map(h => (
            <Badge key={h.DayOfWeek} variant="secondary" className="text-xs gap-1">
              <span className="font-semibold">{h.DayOfWeek.slice(0, 3)}</span>
              {h.OpenTime && h.CloseTime ? `${h.OpenTime}–${h.CloseTime}` : 'Open'}
              {h.Notes ? ` (${h.Notes})` : ''}
            </Badge>
          ))}
        </div>
      )}

      {/* Compliance legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        {Object.entries(COMPLIANCE_ICONS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full inline-block ${v.dot}`} />
            {v.title}
          </div>
        ))}
      </div>

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
                    {dayEvents.map(ev => {
                      const compliance = getComplianceForEvent(ev);
                      const compIcon = compliance ? COMPLIANCE_ICONS[compliance] : null;
                      return (
                        <div
                          key={ev.id}
                          className={`text-xs px-1.5 py-0.5 rounded-full truncate cursor-pointer flex items-center gap-1 ${EVENT_COLORS[ev.EventType] || 'bg-muted'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.IsTrainingNight) { setNightPanelEvent(ev); }
                            else if (canEdit) { openEdit(ev); }
                            else { openAvailability(ev); }
                          }}
                          title={compIcon?.title}
                        >
                          {compIcon && (
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${compIcon.dot}`} />
                          )}
                          <span className="truncate">{ev.Title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Training Nights */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Training Nights</h3>
        {events
          .filter(ev => ev.IsTrainingNight && ev.Date >= format(new Date(), 'yyyy-MM-dd'))
          .sort((a, b) => a.Date.localeCompare(b.Date))
          .slice(0, 5)
          .map(ev => {
            const availableStaff = availability.filter(a => a.EventDate === ev.Date && a.IsAvailable);
            const myStatus = availability.find(a => a.EventDate === ev.Date && a.PNumber === me?.PNumber);
            const compliance = getComplianceForEvent(ev);
            const compIcon = compliance ? COMPLIANCE_ICONS[compliance] : null;

            return (
              <Card key={ev.id} className="border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {compIcon && (
                        <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${compIcon.dot}`} title={compIcon.title} />
                      )}
                      <div>
                        <p className="font-semibold text-sm">{ev.Title}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(ev.Date), 'EEE dd MMM yyyy')}</p>
                        {ev.AvailabilityDeadline && (
                          <p className="text-xs text-accent-foreground mt-0.5">Availability due: {format(parseISO(ev.AvailabilityDeadline), 'dd MMM yyyy')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Manual compliance override */}
                      {canEdit && compliance && (
                        <Select value={ev.ComplianceStatus || ''} onValueChange={val => complianceOverrideMutation.mutate({ id: ev.id, status: val || null })}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue placeholder="Auto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>Auto</SelectItem>
                            <SelectItem value="open">✅ Open</SelectItem>
                            <SelectItem value="amber">🟡 Amber</SelectItem>
                            <SelectItem value="closed">🔴 Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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
              <Checkbox id="isTraining" checked={form.IsTrainingNight} onCheckedChange={v => setForm(p => ({ ...p, IsTrainingNight: v }))} />
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

      {/* Training Night Plan Panel */}
      <TrainingNightPanel
        event={nightPanelEvent}
        open={!!nightPanelEvent}
        onClose={() => setNightPanelEvent(null)}
      />

      {/* Opening Hours Dialog */}
      <Dialog open={openingHoursDialogOpen} onOpenChange={setOpeningHoursDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detachment Opening Hours</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {DAYS_OF_WEEK.map(day => {
              const h = hoursForm[day] || { IsOpen: false, OpenTime: '19:00', CloseTime: '21:30', Notes: '' };
              return (
                <div key={day} className={`flex items-center gap-3 p-2 rounded-lg border ${h.IsOpen ? 'bg-primary/5 border-primary/20' : 'bg-muted/20'}`}>
                  <Switch
                    checked={h.IsOpen}
                    onCheckedChange={val => setHoursForm(prev => ({ ...prev, [day]: { ...prev[day], IsOpen: val } }))}
                  />
                  <span className="text-sm font-medium w-24 shrink-0">{day}</span>
                  {h.IsOpen && (
                    <>
                      <Input
                        type="time"
                        value={h.OpenTime}
                        onChange={e => setHoursForm(prev => ({ ...prev, [day]: { ...prev[day], OpenTime: e.target.value } }))}
                        className="h-7 w-24 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={h.CloseTime}
                        onChange={e => setHoursForm(prev => ({ ...prev, [day]: { ...prev[day], CloseTime: e.target.value } }))}
                        className="h-7 w-24 text-xs"
                      />
                      <Input
                        value={h.Notes}
                        onChange={e => setHoursForm(prev => ({ ...prev, [day]: { ...prev[day], Notes: e.target.value } }))}
                        placeholder="Notes"
                        className="h-7 text-xs flex-1"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setOpeningHoursDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveHours}>Save Hours</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}