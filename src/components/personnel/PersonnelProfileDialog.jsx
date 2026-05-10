import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { ACCESS_LEVELS, LEVEL_NAMES, isCadet } from '@/lib/accessLevels';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import PersonnelStatusBadge from './PersonnelStatusBadge';
import { ShieldAlert, User, Link, Star, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUSES = ['Active', 'Suspended', 'Leaver', 'Long-term Absence', 'Deceased'];

export default function PersonnelProfileDialog({ person, open, onClose }) {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const myLevel = me?.AccessLevel ?? 0;

  const canViewSensitive = myLevel >= ACCESS_LEVELS.DET_2IC;
  const canChangeStatus = myLevel >= ACCESS_LEVELS.DET_COMMANDER;

  const [status, setStatus] = useState(person?.PersonnelStatus || 'Active');
  const [notes, setNotes] = useState(person?.StatusNotes || '');
  const [dirty, setDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.PersonnelManager.update(person.id, {
      PersonnelStatus: status,
      StatusNotes: notes,
      StatusChangedDate: format(new Date(), 'yyyy-MM-dd'),
      StatusChangedByPNumber: me?.PNumber,
    }),
    onSuccess: () => {
      toast.success('Personnel status updated');
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      setDirty(false);
      onClose();
    },
  });

  if (!person) return null;

  const fullName = [person.Rank, person.FirstName, person.Surname].filter(Boolean).join(' ');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Personnel Profile
          </DialogTitle>
        </DialogHeader>

        {/* Identity */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
            {person.Surname?.[0]}
          </div>
          <div>
            <p className="font-semibold text-base">{fullName}</p>
            <p className="text-sm text-muted-foreground">{person.PNumber} · {person.RoleName}</p>
            <div className="flex gap-1 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{person.Type || 'Cadet'}</Badge>
              <Badge className="text-xs">L{person.AccessLevel} — {LEVEL_NAMES[person.AccessLevel]}</Badge>
              {!isCadet(person.AccessLevel) ? null : (
                <Badge variant="outline" className="text-xs">{person.CurrentStarLevel}</Badge>
              )}
              {person.IsLinked && (
                <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">
                  <Link className="w-3 h-3 mr-1" />Linked
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Status section — visible to L4+ only */}
        {canViewSensitive && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                <p className="text-sm font-semibold">Personnel Status</p>
                <span className="text-xs text-muted-foreground ml-auto">L4+ only</span>
              </div>

              {canChangeStatus ? (
                <>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={status} onValueChange={(v) => { setStatus(v); setDirty(true); }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Commander Notes (confidential)</Label>
                    <Textarea
                      value={notes}
                      onChange={e => { setNotes(e.target.value); setDirty(true); }}
                      placeholder="Reason for status change..."
                      className="mt-1 text-sm"
                      rows={3}
                    />
                  </div>
                  {person.StatusChangedDate && (
                    <p className="text-xs text-muted-foreground">
                      Last changed: {person.StatusChangedDate}
                      {person.StatusChangedByPNumber ? ` by ${person.StatusChangedByPNumber}` : ''}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={!dirty || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    Save Status Change
                  </Button>
                </>
              ) : (
                // L4 (2IC) can VIEW status but not change it
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Status:</span>
                    <PersonnelStatusBadge status={person.PersonnelStatus} />
                    {person.PersonnelStatus === 'Active' && <span className="text-sm text-chart-2">Active</span>}
                  </div>
                  {person.StatusNotes && (
                    <p className="text-xs text-muted-foreground italic">"{person.StatusNotes}"</p>
                  )}
                  {person.StatusChangedDate && (
                    <p className="text-xs text-muted-foreground">
                      Changed: {person.StatusChangedDate}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">Only L5+ Detachment Commander can change status.</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}