import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const emptyForm = { PNumber: '', AwardName: '', DateAwarded: '', Notes: '' };

export default function AwardFormDialog({ award, personnel, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!award;

  useEffect(() => {
    if (open) setForm(award ? { PNumber: award.PNumber, AwardName: award.AwardName, DateAwarded: award.DateAwarded, Notes: award.Notes || '' } : emptyForm);
  }, [open, award]);

  const saveMutation = useMutation({
    mutationFn: () => isEdit
      ? base44.entities.Award.update(award.id, form)
      : base44.entities.Award.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awards-all'] });
      toast.success(isEdit ? 'Award updated' : 'Award added');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Award' : 'Add Award'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Cadet / Instructor</Label>
            <Select value={form.PNumber} onValueChange={(v) => setForm(p => ({ ...p, PNumber: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {personnel.map(p => (
                  <SelectItem key={p.PNumber} value={p.PNumber}>{p.Rank ? `${p.Rank} ` : ''}{p.FirstName} {p.Surname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Award Name</Label>
            <Input value={form.AwardName} onChange={(e) => setForm(p => ({ ...p, AwardName: e.target.value }))} placeholder="e.g. Best Recruit" className="mt-1" />
          </div>
          <div>
            <Label>Date Awarded</Label>
            <Input type="date" value={form.DateAwarded} onChange={(e) => setForm(p => ({ ...p, DateAwarded: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={form.Notes} onChange={(e) => setForm(p => ({ ...p, Notes: e.target.value }))} className="mt-1" />
          </div>
          <Button
            className="w-full"
            disabled={!form.PNumber || !form.AwardName || !form.DateAwarded || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Award')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}