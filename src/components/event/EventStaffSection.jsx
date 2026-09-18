import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { QUALIFIED_STATUS_OPTIONS, SUBJECT_QUAL_DOMAINS, CI_QUALIFICATIONS, CI_SUBJECT_QUALS } from '@/lib/eventConstants';

export default function EventStaffSection({ event }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('Adult Instructor');
  const [pickPNumber, setPickPNumber] = useState('');
  const [manual, setManual] = useState({ Rank: '', Name: '', PNumber: '' });
  const [quals, setQuals] = useState([]);
  const [ciQuals, setCiQuals] = useState([]);
  const [qualifiedStatus, setQualifiedStatus] = useState('Qualified');

  const { data: staff = [] } = useQuery({
    queryKey: ['event-staff', event.id],
    queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }),
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const existingPNumbers = new Set(staff.map((s) => s.PNumber).filter(Boolean));
  const availableAI = personnel.filter((p) => p.Type === 'Adult Instructor' && p.PersonnelStatus === 'Active' && !existingPNumbers.has(p.PNumber));
  const availableCI = personnel.filter((p) => p.Type === 'Cadet' && p.AccessLevel >= 2 && p.PersonnelStatus === 'Active' && !existingPNumbers.has(p.PNumber));

  const addMutation = useMutation({
    mutationFn: async (data) => {
      const rec = await base44.entities.EventStaff.create({ ...data, EventID: event.id, DetachmentID: event.DetachmentID });
      if (data.StaffType === 'Cadet Instructor' && data.PNumber) {
        const p = personnel.find((x) => x.PNumber === data.PNumber);
        if (p) {
          await base44.entities.EventNominalRoll.create({
            EventID: event.id, PNumber: p.PNumber, Rank: p.Rank || '', Surname: p.Surname || '', FirstName: p.FirstName || '',
            Detachment: event.DetachmentID, CurrentStarLevel: p.CurrentStarLevel || 'Basic', DetachmentID: event.DetachmentID,
          }).catch(() => {});
        }
      }
      return rec;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-staff', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
      resetForm();
      toast.success('Staff added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventStaff.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-staff', event.id] }),
  });

  function resetForm() {
    setShowAdd(false); setPickPNumber(''); setManual({ Rank: '', Name: '', PNumber: '' });
    setQuals([]); setCiQuals([]); setQualifiedStatus('Qualified');
  }

  function handleAdd() {
    const isAI = addType === 'Adult Instructor';
    const p = personnel.find((x) => x.PNumber === pickPNumber);
    if (p) {
      addMutation.mutate({
        StaffType: addType, PNumber: p.PNumber, Rank: p.Rank || '', Name: [p.FirstName, p.Surname].filter(Boolean).join(' '),
        QualifiedStatus: isAI ? qualifiedStatus : 'Qualified', SubjectQualifications: isAI ? quals : [], CIQualifications: isAI ? [] : ciQuals,
      });
    } else if (manual.Name) {
      addMutation.mutate({
        StaffType: addType, ...manual, QualifiedStatus: isAI ? qualifiedStatus : 'Qualified',
        SubjectQualifications: isAI ? quals : [], CIQualifications: isAI ? [] : ciQuals,
      });
    }
  }

  function toggleQual(q) { setQuals((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]); }
  function toggleCiQual(q) { setCiQuals((prev) => prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]); }

  const available = addType === 'Adult Instructor' ? availableAI : availableCI;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Instructional Staff ({staff.length})</h3>
        <Button size="sm" onClick={() => { setShowAdd(true); setAddType('Adult Instructor'); }}>
          <UserPlus className="w-4 h-4 mr-1.5" />Add Staff
        </Button>
      </div>
      <div className="grid gap-2">
        {staff.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{s.StaffType === 'Adult Instructor' ? 'AI' : 'CI'}</Badge>
                  <span className="text-sm font-medium">{[s.Rank, s.Name].filter(Boolean).join(' ')}</span>
                  {s.QualifiedStatus && s.StaffType === 'Adult Instructor' && <Badge className="text-xs bg-primary/10 text-primary">{s.QualifiedStatus}</Badge>}
                </div>
                {(s.SubjectQualifications || []).length > 0 && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.SubjectQualifications.join(', ')}</p>}
                {(s.CIQualifications || []).length > 0 && <p className="text-xs text-muted-foreground mt-0.5">CI Quals: {s.CIQualifications.join(', ')}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {staff.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No staff added yet.</p>}
      </div>

      <Dialog open={showAdd} onOpenChange={(v) => !v && resetForm()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Event Staff</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Staff Type</Label>
              <Select value={addType} onValueChange={(v) => { setAddType(v); setQuals([]); setCiQuals([]); setPickPNumber(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Adult Instructor">Adult Instructor (AI)</SelectItem>
                  <SelectItem value="Cadet Instructor">Cadet Instructor (CI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {available.length > 0 && (
              <div>
                <Label>Pick from Personnel</Label>
                <Select value={pickPNumber} onValueChange={setPickPNumber}>
                  <SelectTrigger><SelectValue placeholder="Select existing member..." /></SelectTrigger>
                  <SelectContent>
                    {available.map((p) => <SelectItem key={p.PNumber} value={p.PNumber}>{[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')} ({p.PNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!pickPNumber && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs font-semibold text-muted-foreground">Or add manually:</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Rank" value={manual.Rank} onChange={(e) => setManual({ ...manual, Rank: e.target.value })} />
                  <Input placeholder="Name" value={manual.Name} onChange={(e) => setManual({ ...manual, Name: e.target.value })} className="col-span-2" />
                  <Input placeholder="PNumber" value={manual.PNumber} onChange={(e) => setManual({ ...manual, PNumber: e.target.value })} className="col-span-3" />
                </div>
              </div>
            )}
            {addType === 'Adult Instructor' && (
              <>
                <div>
                  <Label>Qualified Status</Label>
                  <Select value={qualifiedStatus} onValueChange={setQualifiedStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{QUALIFIED_STATUS_OPTIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {Object.entries(SUBJECT_QUAL_DOMAINS).map(([domain, qList]) => (
                  <div key={domain}>
                    <Label className="text-xs font-semibold">{domain}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {qList.map((q) => (
                        <button key={q} type="button" onClick={() => toggleQual(q)} className={`text-xs px-2 py-1 rounded border ${quals.includes(q) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{q}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            {addType === 'Cadet Instructor' && (
              <>
                <div>
                  <Label className="text-xs font-semibold">CI Qualifications</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CI_QUALIFICATIONS.map((q) => <button key={q} type="button" onClick={() => toggleCiQual(q)} className={`text-xs px-2 py-1 rounded border ${ciQuals.includes(q) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{q}</button>)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">CI Subject Qualifications</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CI_SUBJECT_QUALS.map((q) => <button key={q} type="button" onClick={() => toggleQual(q)} className={`text-xs px-2 py-1 rounded border ${quals.includes(q) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{q}</button>)}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending || (!pickPNumber && !manual.Name)}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}