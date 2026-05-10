import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, Search, AlertCircle, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';
import { usePersonnel } from '@/lib/usePersonnel';

const emptyForm = {
  PNumber: '', Rank: '', FirstName: '', Surname: '', Type: 'Cadet',
  AccessLevel: '0', RoleName: '', CurrentStarLevel: 'Basic'
};

export default function Personnel() {
  const queryClient = useQueryClient();
  const { personnel: currentUser } = usePersonnel();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const isAdmin = currentUser?.AccessLevel >= ACCESS_LEVELS.SYSTEM_ADMIN;

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PersonnelManager.create({
      ...data,
      AccessLevel: parseInt(data.AccessLevel),
      IsLinked: false
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success('Personnel record created');
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PersonnelManager.update(id, {
      ...data,
      AccessLevel: parseInt(data.AccessLevel)
    }),
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
      Rank: record.Rank || '',
      FirstName: record.FirstName || '',
      Surname: record.Surname,
      Type: record.Type || 'Cadet',
      AccessLevel: String(record.AccessLevel),
      RoleName: record.RoleName || '',
      CurrentStarLevel: record.CurrentStarLevel || 'Basic',
    });
    setEditingId(record.id);
    setOpen(true);
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            PNumber: { type: "string" },
            Rank: { type: "string" },
            FirstName: { type: "string" },
            Surname: { type: "string" },
            Type: { type: "string" },
            AccessLevel: { type: "number" },
            RoleName: { type: "string" },
            CurrentStarLevel: { type: "string" }
          }
        }
      }
    });

    if (result.status === 'success' && result.output) {
      const records = Array.isArray(result.output) ? result.output : [result.output];
      const batch = records.filter(r => r.PNumber && r.Surname).map(r => ({
        PNumber: r.PNumber,
        Rank: r.Rank || '',
        FirstName: r.FirstName || '',
        Surname: r.Surname,
        Type: r.Type || 'Cadet',
        AccessLevel: parseInt(r.AccessLevel) || 0,
        RoleName: r.RoleName || '',
        CurrentStarLevel: r.CurrentStarLevel || 'Basic',
        IsLinked: false,
      }));
      if (batch.length > 0) {
        for (let i = 0; i < batch.length; i += 50) {
          await base44.entities.PersonnelManager.bulkCreate(batch.slice(i, i + 50));
        }
        toast.success(`Imported ${batch.length} personnel records`);
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      } else {
        toast.error('No valid records found in CSV');
      }
    } else {
      toast.error('Failed to parse CSV: ' + (result.details || 'Unknown error'));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const filtered = personnel.filter(p =>
    p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    p.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <input type="file" accept=".csv,.xlsx" ref={fileRef} onChange={handleCsvUpload} className="hidden" />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                  Import CSV
                </Button>
              </>
            )}
            <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button disabled={atLimit && !editingId} onClick={() => { setForm(emptyForm); setEditingId(null); }}>
                  <Plus className="w-4 h-4 mr-2" />Add Personnel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Personnel' : 'Add Personnel'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>PNumber</Label>
                      <Input value={form.PNumber} onChange={(e) => setForm(p => ({ ...p, PNumber: e.target.value }))} disabled={!!editingId} />
                    </div>
                    <div>
                      <Label>Rank</Label>
                      <Input value={form.Rank} onChange={(e) => setForm(p => ({ ...p, Rank: e.target.value }))} placeholder="e.g. Cdt, LCpl, Lt" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First Name</Label>
                      <Input value={form.FirstName} onChange={(e) => setForm(p => ({ ...p, FirstName: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Surname</Label>
                      <Input value={form.Surname} onChange={(e) => setForm(p => ({ ...p, Surname: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.Type} onValueChange={(v) => setForm(p => ({ ...p, Type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cadet">Cadet</SelectItem>
                          <SelectItem value="Adult Instructor">Adult Instructor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Access Level</Label>
                      <Select value={form.AccessLevel} onValueChange={(v) => setForm(p => ({ ...p, AccessLevel: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(LEVEL_NAMES).map(([lvl, name]) => (
                            <SelectItem key={lvl} value={lvl}>{lvl} – {name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Role Name</Label>
                      <Input value={form.RoleName} onChange={(e) => setForm(p => ({ ...p, RoleName: e.target.value }))} placeholder="e.g. Sergeant, Officer" />
                    </div>
                    <div>
                      <Label>Star Level (Cadets)</Label>
                      <Select value={form.CurrentStarLevel} onValueChange={(v) => setForm(p => ({ ...p, CurrentStarLevel: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Basic">Basic</SelectItem>
                          <SelectItem value="1 Star">1 Star</SelectItem>
                          <SelectItem value="2 Star">2 Star</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
          </div>
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
            <Input placeholder="Search by name, PNumber or role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                    <p className="text-sm font-medium truncate">
                      {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{p.Type || 'Cadet'}</Badge>
                  {p.Type !== 'Adult Instructor' && <Badge variant="outline" className="text-xs">{p.CurrentStarLevel}</Badge>}
                  <Badge className="text-xs">L{p.AccessLevel}</Badge>
                  {p.IsLinked && <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">Linked</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AccessGate>
  );
}