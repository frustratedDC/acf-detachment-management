import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const empty = { Title: '', Date: '', EndDate: '', EventType: 'Camp', Location: '', Notes: '', FullPrice: '', FSMPrice: '', AdultPrice: '' };

export default function EventCreateDialog({ open, onClose, myPNumber }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);

  const createMutation = useMutation({
    mutationFn: () => base44.entities.CalendarEvent.create({
      ...form,
      FullPrice: form.FullPrice === '' ? null : Number(form.FullPrice),
      FSMPrice: form.FSMPrice === '' ? null : Number(form.FSMPrice),
      AdultPrice: form.AdultPrice === '' ? null : Number(form.AdultPrice),
      GeneratedFromPlan: true,
      CreatedByPNumber: myPNumber,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success('Event generated');
      setForm(empty);
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Generate New Event</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Title</Label>
            <Input value={form.Title} onChange={e => setForm(p => ({ ...p, Title: e.target.value }))} placeholder="e.g. Summer Camp" />
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
                  {['Camp', 'Competition', 'Admin', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.Location} onChange={e => setForm(p => ({ ...p, Location: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Full Price</Label>
              <Input type="number" value={form.FullPrice} onChange={e => setForm(p => ({ ...p, FullPrice: e.target.value }))} placeholder="£" />
            </div>
            <div>
              <Label className="text-xs">FSM Price</Label>
              <Input type="number" value={form.FSMPrice} onChange={e => setForm(p => ({ ...p, FSMPrice: e.target.value }))} placeholder="£" />
            </div>
            <div>
              <Label className="text-xs">Adult Price</Label>
              <Input type="number" value={form.AdultPrice} onChange={e => setForm(p => ({ ...p, AdultPrice: e.target.value }))} placeholder="£" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.Notes} onChange={e => setForm(p => ({ ...p, Notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.Title || !form.Date}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}