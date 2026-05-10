import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';

const emptyForm = { PNumber: '', Surname: '', AccessLevel: '0', RoleName: '', CurrentStarLevel: 'Basic' };

export default function Personnel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PersonnelManager.create({ ...data, AccessLevel: parseInt(data.AccessLevel), IsLinked: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success('Personnel record created');
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PersonnelManager.update(id, { ...data, AccessLevel: parseInt(data.AccessLevel) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success('Personnel record updated');
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PersonnelManager.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success('Personnel record deleted');
    },
  });

  function closeDialog() {
    setOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  function openEdit(record) {
    setForm({
      PNumber: record.PNumber,
      Surname: record.Surname,
      AccessLevel: String(record.AccessLevel),
      RoleName: record.RoleName || '',
      CurrentStarLevel: record.CurrentStarLevel || 'Basic',
    });
    setEditingId(record.id);
    setOpen(true);
  }

  const filtered = personnel.filter(p =>
    p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    p.PNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.RoleName?.toLowerCase().includes(search.toLowerCase())
  );

  const atLimit = personnel.length >= 999;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Personnel Manager"
        description={`${personnel.length}/999 records`}
        icon={Users}
        actions={
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button disabled={atLimit && !editingId} onClick={() => { setForm(emptyForm); setEditingId(null); }}>
                <Plus className="w-4 h-4 mr-2" />Add Personnel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Personnel' : 'Add Personnel'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div><Label>PNumber</Label><Input value={form.PNumber} onChange={(e) => setForm(p => ({ ...p, PNumber: e.target.value }))} disabled={!!editingId} /></div>
                <div><Label>Surname</Label><Input value={form.Surname} onChange={(e) => setForm(p => ({ ...p, Surname: e.target.value }))} /></div>
                <div>
                  <Label>Access Level</Label>
                  <Select value={form.AccessLevel} onValueChange={(v) => setForm(p => ({ ...p, AccessLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_NAMES).map(([lvl, name]) => (
                        <SelectItem key={lvl} value={lvl}>{lvl} - {name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Role Name</Label><Input value={form.RoleName} onChange={(e) => setForm(p => ({ ...p, RoleName: e.target.value }))} placeholder="e.g. Cadet, Sergeant" /></div>
                <div>
                  <Label>Star Level</Label>
                  <Select value={form.CurrentStarLevel} onValueChange={(v) => setForm(p => ({ ...p, CurrentStarLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="1 Star">1 Star</SelectItem>
                      <SelectItem value="2 Star">2 Star</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!form.PNumber || !form.Surname}
                  onClick={() => {
                    if (editingId) updateMutation.mutate({ id: editingId, data: form });
                    else createMutation.mutate(form);
                  }}
                >
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {atLimit && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4" />
          Maximum 999 personnel records reached.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search personnel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {p.Surname?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.Surname}</p>
                    <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{p.CurrentStarLevel}</Badge>
                  <Badge className="text-xs">L{p.AccessLevel}</Badge>
                  {p.IsLinked && <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">Linked</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AccessGate>
  );
}