import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, Plus, Trash2, Pencil, Save } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isAdultInstructor } from '@/lib/accessLevels';

export default function InstructorQualMatrix() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const myLevel = me?.AccessLevel ?? 0;
  const isSysAdmin = myLevel >= ACCESS_LEVELS.SYSTEM_ADMIN;

  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [editingCol, setEditingCol] = useState(null);
  const [colForm, setColForm] = useState({ Code: '', Name: '', Category: '', SortOrder: 0 });

  // Pending tick changes: { pnum_qualcode: true/false }
  const [pendingChanges, setPendingChanges] = useState({});

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: qualColumns = [] } = useQuery({
    queryKey: ['qual-columns'],
    queryFn: () => base44.entities.QualificationColumn.filter({}),
  });

  const { data: qualRecords = [] } = useQuery({
    queryKey: ['instructor-quals'],
    queryFn: () => base44.entities.InstructorQualification.filter({}),
  });

  const instructors = useMemo(() =>
    allPersonnel
      .filter(p => isAdultInstructor(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active')
      .sort((a, b) => (a.Surname || '').localeCompare(b.Surname || '')),
    [allPersonnel]
  );

  const sortedCols = useMemo(() =>
    [...qualColumns].sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0) || a.Name.localeCompare(b.Name)),
    [qualColumns]
  );

  const categories = useMemo(() => [...new Set(sortedCols.map(c => c.Category || 'General'))], [sortedCols]);

  // Has qualification
  function hasQual(pnum, qualCode) {
    const key = `${pnum}::${qualCode}`;
    if (pendingChanges[key] !== undefined) return pendingChanges[key];
    return qualRecords.some(q => q.PNumber === pnum && q.QualCode === qualCode);
  }

  function toggleQual(pnum, qualCode) {
    const key = `${pnum}::${qualCode}`;
    const current = hasQual(pnum, qualCode);
    setPendingChanges(prev => ({ ...prev, [key]: !current }));
  }

  const pendingCount = Object.keys(pendingChanges).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      for (const [key, shouldHave] of Object.entries(pendingChanges)) {
        const [pnum, qualCode] = key.split('::');
        const existing = qualRecords.find(q => q.PNumber === pnum && q.QualCode === qualCode);
        if (shouldHave && !existing) {
          await base44.entities.InstructorQualification.create({ PNumber: pnum, QualCode: qualCode, AwardedDate: today });
        } else if (!shouldHave && existing) {
          await base44.entities.InstructorQualification.delete(existing.id);
        }
      }
    },
    onSuccess: () => {
      toast.success(`Saved ${pendingCount} change${pendingCount !== 1 ? 's' : ''}`);
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ['instructor-quals'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Column CRUD
  const saveColMutation = useMutation({
    mutationFn: async () => {
      if (editingCol) return base44.entities.QualificationColumn.update(editingCol.id, colForm);
      return base44.entities.QualificationColumn.create(colForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qual-columns'] });
      toast.success(editingCol ? 'Column updated' : 'Column added');
      setColDialogOpen(false);
      setEditingCol(null);
      setColForm({ Code: '', Name: '', Category: '', SortOrder: 0 });
    },
  });

  const deleteColMutation = useMutation({
    mutationFn: async (col) => {
      await base44.entities.QualificationColumn.delete(col.id);
      // Also delete all qual records for this code
      const toDelete = qualRecords.filter(q => q.QualCode === col.Code);
      for (const q of toDelete) await base44.entities.InstructorQualification.delete(q.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qual-columns', 'instructor-quals'] }),
  });

  function openAddCol() {
    setEditingCol(null);
    setColForm({ Code: '', Name: '', Category: '', SortOrder: sortedCols.length });
    setColDialogOpen(true);
  }

  function openEditCol(col) {
    setEditingCol(col);
    setColForm({ Code: col.Code, Name: col.Name, Category: col.Category || '', SortOrder: col.SortOrder ?? 0 });
    setColDialogOpen(true);
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Instructor Qualifications"
        description="Adult instructor qualification matrix"
        icon={GraduationCap}
        actions={
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-1.5" />
                Save {pendingCount} Change{pendingCount !== 1 ? 's' : ''}
              </Button>
            )}
            {isSysAdmin && (
              <Button size="sm" variant="outline" onClick={openAddCol}>
                <Plus className="w-4 h-4 mr-1.5" />Add Qualification
              </Button>
            )}
          </div>
        }
      />

      {sortedCols.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-3">No qualifications defined yet.</p>
            {isSysAdmin && (
              <Button onClick={openAddCol}><Plus className="w-4 h-4 mr-2" />Add First Qualification</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-semibold sticky left-0 bg-muted z-10 min-w-[160px]">Instructor</th>
                  {sortedCols.map(col => (
                    <th key={col.Code} className="p-2 text-center font-semibold min-w-[80px] max-w-[100px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono">{col.Code}</span>
                        <span className="text-muted-foreground font-normal leading-tight" style={{ fontSize: '0.65rem', maxWidth: 80 }}>
                          {col.Name.length > 18 ? col.Name.slice(0, 16) + '…' : col.Name}
                        </span>
                        {col.Category && (
                          <Badge variant="outline" className="text-xs py-0 h-3.5" style={{ fontSize: '0.6rem' }}>{col.Category}</Badge>
                        )}
                        {isSysAdmin && (
                          <div className="flex gap-0.5 mt-0.5">
                            <button onClick={() => openEditCol(col)} className="text-muted-foreground hover:text-foreground">
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button onClick={() => { if (confirm(`Delete qualification "${col.Name}"?`)) deleteColMutation.mutate(col); }} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instructors.map(inst => {
                  const tickedCount = sortedCols.filter(c => hasQual(inst.PNumber, c.Code)).length;
                  return (
                    <tr key={inst.PNumber} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 sticky left-0 bg-card z-10">
                        <p className="font-medium">{[inst.Rank, inst.Surname].filter(Boolean).join(' ')}</p>
                        <p className="text-muted-foreground">{inst.FirstName}</p>
                        {tickedCount > 0 && (
                          <Badge variant="secondary" className="text-xs py-0 h-4 mt-0.5">{tickedCount} quals</Badge>
                        )}
                      </td>
                      {sortedCols.map(col => {
                        const has = hasQual(inst.PNumber, col.Code);
                        const isPending = pendingChanges[`${inst.PNumber}::${col.Code}`] !== undefined;
                        return (
                          <td key={col.Code} className="p-2 text-center">
                            <Checkbox
                              checked={has}
                              onCheckedChange={() => toggleQual(inst.PNumber, col.Code)}
                              className={isPending ? 'border-yellow-400 ring-1 ring-yellow-400' : ''}
                              disabled={myLevel < ACCESS_LEVELS.DET_2IC}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {instructors.length === 0 && (
                  <tr>
                    <td colSpan={sortedCols.length + 1} className="text-center py-8 text-muted-foreground">No active instructors found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''} — highlighted in yellow. Click Save to apply.
        </p>
      )}

      {/* Add/Edit column dialog */}
      <Dialog open={colDialogOpen} onOpenChange={v => { if (!v) { setColDialogOpen(false); setEditingCol(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCol ? 'Edit Qualification' : 'Add Qualification'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code (short)</Label>
                <Input value={colForm.Code} onChange={e => setColForm(p => ({ ...p, Code: e.target.value }))} placeholder="e.g. ACLC" className="mt-1" />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={colForm.SortOrder} onChange={e => setColForm(p => ({ ...p, SortOrder: +e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Full Name</Label>
              <Input value={colForm.Name} onChange={e => setColForm(p => ({ ...p, Name: e.target.value }))} placeholder="e.g. Adult Cadet Leadership Course" className="mt-1" />
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Input value={colForm.Category} onChange={e => setColForm(p => ({ ...p, Category: e.target.value }))} placeholder="e.g. Leadership, Shooting" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setColDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveColMutation.mutate()} disabled={!colForm.Code || !colForm.Name}>
                {editingCol ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}