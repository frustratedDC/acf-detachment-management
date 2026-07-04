import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

export default function DisciplineLogForm({ open, onClose, personnel, onSave, isSaving }) {
  const [form, setForm] = useState({
    Date: format(new Date(), 'yyyy-MM-dd'),
    PersonnelInvolved: [],
    Description: '',
    UIN: '',
  });

  function togglePerson(pnum) {
    setForm(p => ({
      ...p,
      PersonnelInvolved: p.PersonnelInvolved.includes(pnum)
        ? p.PersonnelInvolved.filter(x => x !== pnum)
        : [...p.PersonnelInvolved, pnum],
    }));
  }

  function handleSave() {
    onSave(form);
  }

  const canSave = form.Date && form.PersonnelInvolved.length > 0 && form.Description.trim() && form.UIN.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Discipline / SG Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.Date} onChange={e => setForm(p => ({ ...p, Date: e.target.value }))} />
            </div>
            <div>
              <Label>UIN</Label>
              <Input value={form.UIN} onChange={e => setForm(p => ({ ...p, UIN: e.target.value }))} placeholder="Unique Incident Number" />
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Personnel Involved</Label>
            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
              {personnel.map(p => (
                <label key={p.PNumber} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={form.PersonnelInvolved.includes(p.PNumber)}
                    onCheckedChange={() => togglePerson(p.PNumber)}
                  />
                  {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')} <span className="text-xs text-muted-foreground">({p.PNumber})</span>
                </label>
              ))}
              {personnel.length === 0 && <p className="text-xs text-muted-foreground p-2">No personnel found.</p>}
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.Description}
              onChange={e => setForm(p => ({ ...p, Description: e.target.value }))}
              placeholder="Describe the discipline or safeguarding issue..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? 'Saving...' : 'Save Entry'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}