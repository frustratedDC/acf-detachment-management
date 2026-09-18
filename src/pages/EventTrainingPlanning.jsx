import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { useNavigate } from 'react-router-dom';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarDays, Plus, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { EVENT_TYPES } from '@/lib/eventConstants';

const STATUS_COLOR = {
  Draft: 'bg-muted text-muted-foreground',
  Planned: 'bg-blue-500/20 text-blue-600',
  Committed: 'bg-chart-2/20 text-chart-2',
  Cancelled: 'bg-destructive/20 text-destructive',
};

export default function EventTrainingPlanning() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({
    Title: '', StartDateTime: '', EndDateTime: '', Location: '', EventType: 'Detachment',
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['event-training-plans'],
    queryFn: () => base44.entities.EventTrainingPlan.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingPlan.create({
      ...data,
      Status: 'Draft',
      DetachmentID: me?.DetachmentID || 'GLOBAL',
      CreatedByPNumber: me?.PNumber || '',
    }),
    onSuccess: (rec) => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plans'] });
      setShowCreate(false);
      setNewEvent({ Title: '', StartDateTime: '', EndDateTime: '', Location: '', EventType: 'Detachment' });
      toast.success('Event created');
      navigate(`/event-planning/${rec.id}`);
    },
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Event Training Planning"
        description="Plan and manage training events end-to-end"
        icon={CalendarDays}
        actions={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />New Event</Button>}
      />

      {isLoading ? (
        <div className="grid gap-3">{[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-20" /></Card>)}</div>
      ) : events.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">No training events yet. Click "New Event" to begin planning.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {events.map((ev) => (
            <Card key={ev.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/event-planning/${ev.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate flex-1">{ev.Title}</h3>
                  <Badge className={`text-xs ${STATUS_COLOR[ev.Status] || ''}`}>{ev.Status}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {ev.StartDateTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(ev.StartDateTime), 'dd MMM yyyy HH:mm')}</span>}
                  {ev.Location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.Location}</span>}
                  {ev.EventType && <span>{ev.EventType}</span>}
                </div>
                {(ev.ActivityTags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ev.ActivityTags.slice(0, 5).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Training Event</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Title</Label><Input value={newEvent.Title} onChange={(e) => setNewEvent({ ...newEvent, Title: e.target.value })} placeholder="Weekend Training Camp" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date & Time</Label><Input type="datetime-local" value={newEvent.StartDateTime} onChange={(e) => setNewEvent({ ...newEvent, StartDateTime: e.target.value })} /></div>
              <div><Label>End Date & Time</Label><Input type="datetime-local" value={newEvent.EndDateTime} onChange={(e) => setNewEvent({ ...newEvent, EndDateTime: e.target.value })} /></div>
            </div>
            <div><Label>Location</Label><Input value={newEvent.Location} onChange={(e) => setNewEvent({ ...newEvent, Location: e.target.value })} placeholder="STTTC Pirbright" /></div>
            <div>
              <Label>Event Type</Label>
              <Select value={newEvent.EventType} onValueChange={(v) => setNewEvent({ ...newEvent, EventType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newEvent)} disabled={!newEvent.Title || !newEvent.StartDateTime || !newEvent.EndDateTime || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}