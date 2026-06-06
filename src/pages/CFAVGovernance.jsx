import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { getAuditInfo } from '@/lib/FeatureAuditLog';
import AccessGate from '@/components/shared/AccessGate';
import BriefingBar from '@/components/shared/BriefingBar';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldCheck, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, hasAccess, isAdultInstructor } from '@/lib/accessLevels';

const COURSE_TYPES = [
  'First Aid',
  'Data Protection',
  'Safeguarding',
  'Fire Safety',
  'Medication Management',
  'Cold Injury and Heat Illness',
  'Mental Health Awareness',
];

const MANDATORY = ['First Aid', 'Data Protection', 'Safeguarding', 'Fire Safety'];

function expiryStatus(expiryDate) {
  if (!expiryDate) return { label: 'No expiry', color: 'bg-chart-2/10 text-chart-2 border-chart-2/30', urgent: false };
  const today = new Date();
  const exp = parseISO(expiryDate);
  const days = differenceInDays(exp, today);
  if (isBefore(exp, today)) return { label: 'Expired', color: 'bg-destructive/10 text-destructive border-destructive/30', urgent: true };
  if (days <= 30) return { label: `${days}d`, color: 'bg-yellow-100 text-yellow-800 border-yellow-300', urgent: true };
  if (days <= 90) return { label: `${days}d`, color: 'bg-accent/20 text-accent-foreground border-accent/30', urgent: false };
  return { label: `${days}d`, color: 'bg-chart-2/10 text-chart-2 border-chart-2/30', urgent: false };
}

const emptyForm = { CourseType: 'First Aid', CompletionDate: '', ExpiryDate: '', CertificateRef: '', Notes: '' };

export default function CFAVGovernance() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const canCRUD = hasAccess(myLevel, ACCESS_LEVELS.DET_2IC);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPNumber, setSelectedPNumber] = useState(me?.PNumber || '');
  const [dismissedBriefing, setDismissedBriefing] = useState(false);
  const auditInfo = getAuditInfo('/cfav-governance');

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: governance = [] } = useQuery({
    queryKey: ['cfav-governance'],
    queryFn: () => base44.entities.CFAVGovernance.filter({}),
  });

  const instructors = allPersonnel.filter(p => isAdultInstructor(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active');
  const visibleInstructors = canCRUD ? instructors : instructors.filter(p => p.PNumber === me?.PNumber);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CFAVGovernance.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cfav-governance'] }); toast.success('Record added'); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CFAVGovernance.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cfav-governance'] }); toast.success('Record updated'); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CFAVGovernance.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cfav-governance'] }); toast.success('Record deleted'); },
  });

  // Quick-check: toggle completion for a course type with today's date
  const quickCheckMutation = useMutation({
    mutationFn: async ({ courseType, pNumber, existingRec }) => {
      if (existingRec) {
        await base44.entities.CFAVGovernance.delete(existingRec.id);
      } else {
        await base44.entities.CFAVGovernance.create({
          PNumber: pNumber,
          CourseType: courseType,
          CompletionDate: format(new Date(), 'yyyy-MM-dd'),
          ExpiryDate: '',
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cfav-governance'] }),
  });

  function openCreate(pNumber) {
    setForm({ ...emptyForm, PNumber: pNumber || me?.PNumber });
    setEditingRec(null);
    setDialogOpen(true);
  }

  function openEdit(rec) {
    setForm({
      CourseType: rec.CourseType,
      CompletionDate: rec.CompletionDate,
      ExpiryDate: rec.ExpiryDate || '',
      CertificateRef: rec.CertificateRef || '',
      Notes: rec.Notes || '',
      PNumber: rec.PNumber,
    });
    setEditingRec(rec);
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setEditingRec(null); setForm(emptyForm); }

  function save() {
    if (!form.CourseType || !form.CompletionDate) return;
    if (editingRec) updateMutation.mutate({ id: editingRec.id, data: form });
    else createMutation.mutate(form);
  }

  const viewPNumber = canCRUD ? (selectedPNumber || me?.PNumber) : me?.PNumber;
  const myRecords = governance.filter(r => r.PNumber === viewPNumber);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      {!dismissedBriefing && auditInfo && (
        <BriefingBar
          reason={auditInfo.reason}
          details={auditInfo.details}
          estimatedCompletion={auditInfo.estimatedCompletion}
          onDismiss={() => setDismissedBriefing(true)}
        />
      )}

      <PageHeader
        title="CFAV Governance"
        description="Adult instructor mandatory and supplementary qualifications"
        icon={ShieldCheck}
        actions={
          canCRUD && (
            <Button onClick={() => openCreate(viewPNumber)}>
              <Plus className="w-4 h-4 mr-2" />Add Record
            </Button>
          )
        }
      />

      {/* Instructor selector for L4+ */}
      {canCRUD && (
        <div className="mb-4 flex items-center gap-3">
          <Label className="shrink-0">Viewing:</Label>
          <Select value={viewPNumber} onValueChange={setSelectedPNumber}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select instructor..." />
            </SelectTrigger>
            <SelectContent>
              {visibleInstructors.map(p => (
                <SelectItem key={p.PNumber} value={p.PNumber}>
                  {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Course grid — one card per course type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {COURSE_TYPES.map(courseType => {
          const rec = myRecords.find(r => r.CourseType === courseType);
          const isMandatory = MANDATORY.includes(courseType);
          const status = rec ? expiryStatus(rec.ExpiryDate) : null;
          const isCompleted = !!rec;

          return (
            <Card key={courseType} className={`${status?.urgent ? 'border-destructive/40' : ''}`}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {/* Quick checkbox toggle */}
                  {canCRUD && (
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => quickCheckMutation.mutate({
                        courseType,
                        pNumber: viewPNumber,
                        existingRec: rec,
                      })}
                      className="mt-0.5 shrink-0"
                    />
                  )}
                  <div>
                    <CardTitle className="text-sm">{courseType}</CardTitle>
                    {isMandatory && <Badge variant="secondary" className="text-xs mt-1">Mandatory</Badge>}
                  </div>
                </div>
                {rec ? (
                  status?.urgent
                    ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
                ) : (
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${isMandatory ? 'text-destructive' : 'text-muted-foreground opacity-40'}`} />
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {rec ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Completed: {format(parseISO(rec.CompletionDate), 'dd MMM yyyy')}</p>
                    {rec.ExpiryDate && (
                      <>
                        <p className="text-xs text-muted-foreground">Expires: {format(parseISO(rec.ExpiryDate), 'dd MMM yyyy')}</p>
                        <Badge variant="outline" className={`text-xs ${status.color}`}>
                          {status.label === 'Expired' ? 'Expired' : `${status.label} remaining`}
                        </Badge>
                      </>
                    )}
                    {!rec.ExpiryDate && (
                      <Badge variant="outline" className="text-xs bg-chart-2/10 text-chart-2 border-chart-2/30">Completed</Badge>
                    )}
                    {canCRUD && (
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => openEdit(rec)}>
                          <Pencil className="w-3 h-3 mr-1" />Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => deleteMutation.mutate(rec.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground italic">No record</p>
                    {canCRUD && (
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => openCreate(viewPNumber)}>
                        <Plus className="w-3 h-3 mr-1" />Add Details
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* L4+ — Summary table of all instructors */}
      {canCRUD && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Instructors Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-2 font-semibold">Instructor</th>
                  {COURSE_TYPES.map(c => (
                    <th key={c} className="text-center p-2 font-semibold whitespace-nowrap">{c.length > 12 ? c.slice(0, 10) + '…' : c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleInstructors.map(p => {
                  const recs = governance.filter(r => r.PNumber === p.PNumber);
                  return (
                    <tr key={p.PNumber} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedPNumber(p.PNumber)}>
                      <td className="p-2 font-medium">{[p.Rank, p.Surname].filter(Boolean).join(' ')}</td>
                      {COURSE_TYPES.map(c => {
                        const rec = recs.find(r => r.CourseType === c);
                        if (!rec) return <td key={c} className="p-2 text-center text-muted-foreground">—</td>;
                        const s = rec.ExpiryDate ? expiryStatus(rec.ExpiryDate) : null;
                        return (
                          <td key={c} className="p-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${s ? s.color : 'bg-chart-2/10 text-chart-2'}`}>
                              {s ? (s.label === 'Expired' ? 'EXP' : `✓ ${s.label}`) : '✓'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRec ? 'Edit Record' : 'Add Governance Record'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {canCRUD && !editingRec && (
              <div>
                <Label>Instructor</Label>
                <Select value={form.PNumber} onValueChange={v => setForm(p => ({ ...p, PNumber: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {visibleInstructors.map(p => (
                      <SelectItem key={p.PNumber} value={p.PNumber}>
                        {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Course Type</Label>
              <Select value={form.CourseType} onValueChange={v => setForm(p => ({ ...p, CourseType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COURSE_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Completion Date</Label>
                <Input type="date" value={form.CompletionDate} onChange={e => setForm(p => ({ ...p, CompletionDate: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Expiry Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input type="date" value={form.ExpiryDate} onChange={e => setForm(p => ({ ...p, ExpiryDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Certificate Ref <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.CertificateRef} onChange={e => setForm(p => ({ ...p, CertificateRef: e.target.value }))} className="mt-1" placeholder="e.g. ABC-12345" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={save} disabled={!form.CourseType || !form.CompletionDate}>
                {editingRec ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}