import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { STAR_LEVELS } from '@/lib/eventConstants';

export default function EventManualCadetModal({ event, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ Rank: 'Cdt', FirstName: '', Surname: '', PNumber: '', Detachment: '', Gender: '', CurrentStarLevel: 'Basic', WHTAirRifle: '', WHTGPRifle: '' });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventNominalRoll.create({ ...data, EventID: event.id, DetachmentID: event.DetachmentID, SubjectCompletions: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
      setForm({ Rank: 'Cdt', FirstName: '', Surname: '', PNumber: '', Detachment: '', Gender: '', CurrentStarLevel: 'Basic', WHTAirRifle: '', WHTGPRifle: '' });
      onOpenChange(false);
      toast.success('Cadet added to nominal roll');
    },
  });

  function save() {
    if (!form.Surname) { toast.error('Surname is required'); return; }
    createMutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" />Add Cadet Manually</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Rank</Label>
              <Input value={form.Rank} onChange={(e) => setForm({ ...form, Rank: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label>PNumber</Label>
              <Input value={form.PNumber} onChange={(e) => setForm({ ...form, PNumber: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label>First Name</Label>
              <Input value={form.FirstName} onChange={(e) => setForm({ ...form, FirstName: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label>Surname *</Label>
              <Input value={form.Surname} onChange={(e) => setForm({ ...form, Surname: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label>Detachment</Label>
              <Input value={form.Detachment} onChange={(e) => setForm({ ...form, Detachment: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.Gender} onValueChange={(v) => setForm({ ...form, Gender: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Star Level</Label>
              <Select value={form.CurrentStarLevel} onValueChange={(v) => setForm({ ...form, CurrentStarLevel: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STAR_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>WHT Air Rifle</Label>
              <Input value={form.WHTAirRifle} onChange={(e) => setForm({ ...form, WHTAirRifle: e.target.value })} className="h-8 text-xs" placeholder="date or REVAL" />
            </div>
            <div>
              <Label>WHT GP Rifle</Label>
              <Input value={form.WHTGPRifle} onChange={(e) => setForm({ ...form, WHTGPRifle: e.target.value })} className="h-8 text-xs" placeholder="date or REVAL" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={createMutation.isPending}><UserPlus className="w-4 h-4 mr-1.5" />Add Cadet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}