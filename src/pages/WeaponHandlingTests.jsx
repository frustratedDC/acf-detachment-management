import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crosshair, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Search, Clock } from 'lucide-react';
import { format, parseISO, differenceInDays, addMonths, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, hasAccess } from '@/lib/accessLevels';
import { getFormalWeaponName } from '@/lib/weaponNames';
import WHTAssessmentRequest from '@/components/wht/WHTAssessmentRequest';

const WEAPON_TYPES = ['L98A2', 'L85A2', 'L86A2', 'SA80', 'Other'];

function expiryStatus(expiryDate) {
  const today = new Date();
  const exp = parseISO(expiryDate);
  const days = differenceInDays(exp, today);
  if (isBefore(exp, today)) return { label: 'Expired', cls: 'bg-destructive/10 text-destructive border-destructive/30', urgent: true };
  if (days <= 30) return { label: `${days}d remaining`, cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', urgent: true };
  if (days <= 60) return { label: `${days}d remaining`, cls: 'bg-accent/20 text-accent-foreground border-accent/30', urgent: false };
  return { label: `${days}d remaining`, cls: 'bg-chart-2/10 text-chart-2 border-chart-2/30', urgent: false };
}

const emptyForm = { PNumber: '', WeaponType: 'L98A2', TestDate: '', ExpiryDate: '', AssessorPNumber: '', Notes: '' };

export default function WeaponHandlingTests() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const canEdit = hasAccess(myLevel, ACCESS_LEVELS.DET_2IC);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestData, setRequestData] = useState(null);

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: tests = [] } = useQuery({
    queryKey: ['wht-all'],
    queryFn: () => base44.entities.WeaponHandlingTest.filter({}),
  });

  const personnelMap = {};
  allPersonnel.forEach(p => { personnelMap[p.PNumber] = p; });

  // L3 can only see own; L4+ see all
  const viewableTests = canEdit
    ? tests
    : tests.filter(t => t.PNumber === me?.PNumber);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WeaponHandlingTest.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wht-all'] }); toast.success('WHT record added'); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WeaponHandlingTest.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wht-all'] }); toast.success('WHT record updated'); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WeaponHandlingTest.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wht-all'] }); toast.success('Record deleted'); },
  });

  function openCreate() {
    setForm({ ...emptyForm, PNumber: me?.PNumber || '', ExpiryDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd') });
    setEditingRec(null);
    setDialogOpen(true);
  }

  function openEdit(rec) {
    setForm({ PNumber: rec.PNumber, WeaponType: rec.WeaponType, TestDate: rec.TestDate, ExpiryDate: rec.ExpiryDate, AssessorPNumber: rec.AssessorPNumber || '', Notes: rec.Notes || '' });
    setEditingRec(rec);
    setDialogOpen(true);
  }

  function closeDialog() { setDialogOpen(false); setEditingRec(null); setForm(emptyForm); }

  function handleTestDateChange(val) {
    const expiry = val ? format(addMonths(new Date(val + 'T00:00:00'), 6), 'yyyy-MM-dd') : '';
    setForm(p => ({ ...p, TestDate: val, ExpiryDate: expiry }));
  }

  function save() {
    if (!form.PNumber || !form.WeaponType || !form.TestDate || !form.ExpiryDate) return;
    if (editingRec) updateMutation.mutate({ id: editingRec.id, data: form });
    else createMutation.mutate(form);
  }

  // Group by person
  const searchLower = search.toLowerCase();
  const relevantPersonnel = allPersonnel
    .filter(p => {
      if (!canEdit && p.PNumber !== me?.PNumber) return false;
      const hasTest = viewableTests.some(t => t.PNumber === p.PNumber);
      if (!hasTest && canEdit) return false; // only show people with tests in the table (unless own)
      const matchSearch = !search ||
        p.Surname?.toLowerCase().includes(searchLower) ||
        p.FirstName?.toLowerCase().includes(searchLower) ||
        p.PNumber?.toLowerCase().includes(searchLower);
      return matchSearch;
    });

  // Also show anyone with a test even if not in filtered personnel list
  const allPNumbers = canEdit
    ? [...new Set([...relevantPersonnel.map(p => p.PNumber), ...viewableTests.map(t => t.PNumber)])]
    : [me?.PNumber];

  const filteredPNumbers = allPNumbers.filter(pn => {
    if (!search) return true;
    const p = personnelMap[pn];
    return p?.Surname?.toLowerCase().includes(searchLower) ||
      p?.FirstName?.toLowerCase().includes(searchLower) ||
      pn.toLowerCase().includes(searchLower);
  });

  return (
    <div>
      <PageHeader
        title="Weapon Handling Tests"
        description="Track WHT records for cadets and CFAV — expires every 6 months"
        icon={Crosshair}
        actions={
          canEdit && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />Add Record
            </Button>
          )
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search person..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        {!canEdit && me && (
          <span className="text-sm text-muted-foreground">Showing your records only</span>
        )}
      </div>

      {/* Cards per person */}
      <div className="space-y-4">
        {filteredPNumbers.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">No WHT records found.</p>
        )}
        {filteredPNumbers.map(pn => {
          const person = personnelMap[pn];
          const personTests = viewableTests.filter(t => t.PNumber === pn).sort((a, b) => b.TestDate.localeCompare(a.TestDate));
          if (personTests.length === 0 && pn !== me?.PNumber) return null;
          return (
            <Card key={pn}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {person ? [person.Rank, person.FirstName, person.Surname].filter(Boolean).join(' ') : pn}
                    <span className="text-xs text-muted-foreground ml-2 font-normal">{pn}</span>
                  </CardTitle>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => { setForm({ ...emptyForm, PNumber: pn, ExpiryDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd') }); setEditingRec(null); setDialogOpen(true); }}>
                      <Plus className="w-3.5 h-3.5 mr-1" />Add WHT
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {personTests.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No WHT records on file.</p>
                ) : (
                  <div className="space-y-2">
                    {personTests.map(test => {
                      const s = expiryStatus(test.ExpiryDate);
                      const assessor = personnelMap[test.AssessorPNumber];
                      return (
                        <div key={test.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-2.5 rounded-lg border ${s.urgent ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/30'}`}>
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {s.urgent ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{getFormalWeaponName(test.WeaponType)}</p>
                              <p className="text-xs text-muted-foreground">
                                Tested: {format(parseISO(test.TestDate), 'dd MMM yyyy')}
                                {assessor ? ` · Assessor: ${assessor.Rank || ''} ${assessor.Surname}`.trim() : ''}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className={`text-xs font-semibold ${s.urgent ? 'text-destructive' : 'text-chart-2'}`}>
                                  Expires: {format(parseISO(test.ExpiryDate), 'dd MMM yyyy')} — {s.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.urgent && !canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                onClick={() => {
                                  setRequestData({
                                    cadetPNumber: pn,
                                    cadetName: person ? [person.Rank, person.FirstName, person.Surname].filter(Boolean).join(' ') : pn,
                                    weaponType: test.WeaponType,
                                    weaponName: getFormalWeaponName(test.WeaponType),
                                  });
                                  setRequestOpen(true);
                                }}
                              >
                                Request Assessment
                              </Button>
                            )}
                            {canEdit && (
                              <>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(test)}><Pencil className="w-3 h-3" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(test.id)}><Trash2 className="w-3 h-3" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {requestData && (
        <WHTAssessmentRequest
          open={requestOpen}
          onOpenChange={setRequestOpen}
          cadetPNumber={requestData.cadetPNumber}
          cadetName={requestData.cadetName}
          weaponType={requestData.weaponType}
          weaponName={requestData.weaponName}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRec ? 'Edit WHT Record' : 'Add WHT Record'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            {canEdit && (
              <div>
                <Label>Person</Label>
                <Select value={form.PNumber} onValueChange={v => setForm(p => ({ ...p, PNumber: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select person..." /></SelectTrigger>
                  <SelectContent>
                    {allPersonnel.filter(p => (p.PersonnelStatus || 'Active') === 'Active').map(p => (
                      <SelectItem key={p.PNumber} value={p.PNumber}>
                        {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Weapon Type</Label>
              <Select value={form.WeaponType} onValueChange={v => setForm(p => ({ ...p, WeaponType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEAPON_TYPES.map(w => (
                    <SelectItem key={w} value={w}>
                      {w} — {getFormalWeaponName(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Test Date</Label>
                <Input type="date" value={form.TestDate} onChange={e => handleTestDateChange(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={form.ExpiryDate} onChange={e => setForm(p => ({ ...p, ExpiryDate: e.target.value }))} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-0.5">Auto-set to +6 months</p>
              </div>
            </div>
            <div>
              <Label>Assessor (optional)</Label>
              <Select value={form.AssessorPNumber} onValueChange={v => setForm(p => ({ ...p, AssessorPNumber: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select assessor..." /></SelectTrigger>
                <SelectContent>
                  {allPersonnel.filter(p => p.AccessLevel >= ACCESS_LEVELS.DET_INSTRUCTOR).map(p => (
                    <SelectItem key={p.PNumber} value={p.PNumber}>
                      {[p.Rank, p.Surname].filter(Boolean).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={save} disabled={!form.PNumber || !form.WeaponType || !form.TestDate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}