import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SLOT_TYPES } from '@/lib/eventConstants';

export default function EventItinerarySection({ event }) {
  const queryClient = useQueryClient();
  const [newSlot, setNewSlot] = useState({ StartTime: '', DurationMinutes: 60, SlotType: 'BREAK', Label: '' });

  const { data: slots = [] } = useQuery({
    queryKey: ['event-itinerary', event.id],
    queryFn: () => base44.entities.EventItinerarySlot.filter({ EventID: event.id }),
  });

  const sorted = [...slots].sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));

  const addMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(newSlot.StartTime);
      const eventStart = new Date(event.StartDateTime);
      const eventEnd = new Date(event.EndDateTime);
      if (start < eventStart || start > eventEnd) {
        throw new Error('Slot start time must be within event start/end boundaries.');
      }
      return base44.entities.EventItinerarySlot.create({ ...newSlot, EventID: event.id, DetachmentID: event.DetachmentID });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-itinerary', event.id] });
      setNewSlot({ StartTime: '', DurationMinutes: 60, SlotType: 'BREAK', Label: '' });
      toast.success('Timeframe added');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventItinerarySlot.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-itinerary', event.id] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="w-4 h-4" />Add Timeframe</h3>
          <p className="text-xs text-muted-foreground">Event runs {format(new Date(event.StartDateTime), 'dd MMM HH:mm')} → {format(new Date(event.EndDateTime), 'dd MMM HH:mm')}. Slots must fall within these boundaries.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Start Time</Label><Input type="datetime-local" value={newSlot.StartTime} onChange={(e) => setNewSlot({ ...newSlot, StartTime: e.target.value })} /></div>
            <div><Label className="text-xs">Duration (min)</Label><Input type="number" value={newSlot.DurationMinutes} onChange={(e) => setNewSlot({ ...newSlot, DurationMinutes: Number(e.target.value) })} /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newSlot.SlotType} onValueChange={(v) => setNewSlot({ ...newSlot, SlotType: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SLOT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={!newSlot.StartTime}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <div><Label className="text-xs">Label (optional)</Label><Input value={newSlot.Label} onChange={(e) => setNewSlot({ ...newSlot, Label: e.target.value })} placeholder="e.g. Range Practice" /></div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {sorted.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{format(new Date(s.StartTime), 'dd MMM HH:mm')}</span>
                <span className="text-xs text-muted-foreground ml-2">· {s.DurationMinutes}min · {s.SlotType}</span>
                {s.Label && <p className="text-xs text-muted-foreground">{s.Label}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </CardContent>
          </Card>
        ))}
        {sorted.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No timeframes added yet.</p>}
      </div>
    </div>
  );
}