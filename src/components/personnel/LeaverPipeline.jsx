import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UserMinus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LeaverPipeline({ person, open, onClose, onConfirmed }) {
  const [uniformOk, setUniformOk] = useState(false);
  const [adminOk, setAdminOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleStrikeOff() {
    setSubmitting(true);
    await base44.entities.PersonnelManager.update(person.id, {
      PersonnelStatus: 'Leaver',
      IsArchived: true,
      ArchivedAt: new Date().toISOString(),
      StatusChangedDate: new Date().toISOString().split('T')[0],
    });
    toast.success(`${person.Rank || ''} ${person.Surname} struck off strength`);
    setSubmitting(false);
    onConfirmed?.();
    onClose?.();
  }

  const allChecked = uniformOk && adminOk;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-destructive" />
            Strike Off Strength — Leaver Pipeline
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="p-3 rounded-lg bg-muted/40 text-sm">
            <p className="font-medium">{[person.Rank, person.FirstName, person.Surname].filter(Boolean).join(' ')}</p>
            <p className="text-xs text-muted-foreground">{person.PNumber}</p>
          </div>

          <p className="text-sm text-muted-foreground">Complete all checklist items before confirming strike-off.</p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
              <Checkbox
                checked={uniformOk}
                onCheckedChange={setUniformOk}
              />
              <div>
                <p className="text-sm font-medium">Uniform Accounted For</p>
                <p className="text-xs text-muted-foreground">All issued kit returned or documented</p>
              </div>
              {uniformOk && <CheckCircle2 className="w-4 h-4 text-chart-2 ml-auto" />}
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
              <Checkbox
                checked={adminOk}
                onCheckedChange={setAdminOk}
              />
              <div>
                <p className="text-sm font-medium">Admin Complete</p>
                <p className="text-xs text-muted-foreground">Records, notifications, and paperwork finalised</p>
              </div>
              {adminOk && <CheckCircle2 className="w-4 h-4 text-chart-2 ml-auto" />}
            </label>
          </div>

          {allChecked && (
            <Button
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleStrikeOff}
              disabled={submitting}
            >
              <UserMinus className="w-4 h-4 mr-2" />
              {submitting ? 'Processing...' : 'Confirm Strike Off Strength'}
            </Button>
          )}

          {!allChecked && (
            <p className="text-xs text-center text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {[uniformOk, adminOk].filter(Boolean).length}/2
              </Badge> {' '}checklist items completed — complete all to proceed
            </p>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}