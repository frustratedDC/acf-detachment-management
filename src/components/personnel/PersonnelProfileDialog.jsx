import React, { useState, useEffect } from 'react';
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
import { ShieldAlert, User, Link, Star, Layers, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

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
  const [qualInput, setQualInput] = useState('');
  const [qualsDirty, setQualsDirty] = useState(false);
  const [qualsList, setQualsList] = useState(person?.QualifiedSubjects || []);

  // Reset state whenever the person changes
  useEffect(() => {
    setStatus(person?.PersonnelStatus || 'Active');
    setNotes(person?.StatusNotes || '');
    setQualsList(person?.QualifiedSubjects || []);
    setDirty(false);
    setQualsDirty(false);
  }, [person?.id]);

  // Fetch syllabus subjects for autocomplete
  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
    enabled: canViewSensitive && !isCadet(person?.AccessLevel ?? 0),
  });
  const allSubjects = [...new Set(syllabus.map(l => l.SubjectName))].sort();

  const saveQualsMutation = useMutation({
    mutationFn: () => base44.entities.PersonnelManager.update(person.id, { QualifiedSubjects: qualsList }),
    onSuccess: () => {
      toast.success('Qualifications updated');
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      setQualsDirty(false);
    },
  });

  function addQual(subj) {
    const s = subj.trim();
    if (s && !qualsList.includes(s)) {
      setQualsList(prev => [...prev, s]);
      setQualsDirty(true);
    }
    setQualInput('');
  }

  function removeQual(subj) {
    setQualsList(prev => prev.filter(q => q !== subj));
    setQualsDirty(true);
  }

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

        {/* Qualified Subjects — instructors only, L4+ can edit */}
        {canViewSensitive && !isCadet(person.AccessLevel) && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Qualified Subjects</p>
                <span className="text-xs text-muted-foreground ml-auto">Subjects they can teach/assess</span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {qualsList.length === 0 && <span className="text-xs text-muted-foreground italic">None recorded</span>}
                {qualsList.map(q => (
                  <Badge key={q} variant="secondary" className="text-xs gap-1">
                    {q}
                    {canChangeStatus && (
                      <button onClick={() => removeQual(q)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              {canChangeStatus && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={qualInput}
                      onChange={e => setQualInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQual(qualInput); } }}
                      placeholder="Type or select subject..."
                      list="subj-list"
                      className="text-xs h-8"
                    />
                    <datalist id="subj-list">
                      {allSubjects.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => addQual(qualInput)} disabled={!qualInput.trim()}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              )}
              {qualsDirty && canChangeStatus && (
                <Button size="sm" className="w-full" onClick={() => saveQualsMutation.mutate()} disabled={saveQualsMutation.isPending}>
                  Save Qualifications
                </Button>
              )}
            </div>
          </>
        )}

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