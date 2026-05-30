import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import PersonnelProfileDialog from '@/components/personnel/PersonnelProfileDialog';
import PersonnelStatusBadge from '@/components/personnel/PersonnelStatusBadge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, Search, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';

const emptyForm = {
  PNumber: '', Rank: '', FirstName: '', Surname: '', Type: 'Cadet',
  AccessLevel: '0', RoleName: '', CurrentStarLevel: 'Basic'
};

export default function Personnel() {
  const queryClient = useQueryClient();
  const { personnel: currentUser } = usePersonnel();
  const myLevel = currentUser?.AccessLevel ?? 0;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [starFilter, setStarFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // default: hide non-active for lower levels
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [profilePerson, setProfilePerson] = useState(null);

  const isSysAdmin = myLevel >= ACCESS_LEVELS.SYSTEM_ADMIN;
  const isCommander = myLevel >= ACCESS_LEVELS.DET_COMMANDER;
  const canViewSensitive = myLevel >= ACCESS_LEVELS.DET_2IC; // L4+ can see Suspended/Leavers
  const canViewAs = myLevel >= ACCESS_LEVELS.DET_2IC;
  const { setViewAs } = usePersonnel();

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PersonnelManager.create({
      ...data,
      AccessLevel: parseInt(data.AccessLevel),
      PersonnelStatus: 'Active',
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
    mutationFn: async (record) => {
      // Never allow deletion of your own linked record
      if (record.LinkedEmailUID && record.LinkedEmailUID === currentUser?.LinkedEmailUID) {
        throw new Error('You cannot delete your own linked personnel record.');
      }
      return base44.entities.PersonnelManager.delete(record.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success('Personnel record deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  function closeDialog() {
    setOpen(false);
    setForm(emptyForm);
    setEditingId(null);
  }

  function openEdit(record, e) {
    e.stopPropagation();
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

  const filtered = personnel.filter(p => {
    // Hide non-active personnel from L3 and below
    const status = p.PersonnelStatus || 'Active';
    if (!canViewSensitive && status !== 'Active') return false;

    const matchSearch = !search ||
      p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
      p.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
      p.PNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.RoleName?.toLowerCase().includes(search.toLowerCase()) ||
      p.Rank?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.Type === typeFilter;
    const matchStar = starFilter === 'all' || p.CurrentStarLevel === starFilter;
    const matchLevel = levelFilter === 'all' || String(p.AccessLevel) === levelFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? status === 'Active' : status !== 'Active');
    return matchSearch && matchType && matchStar && matchLevel && matchStatus;
  });

  const atLimit = personnel.length >= 999;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Personnel Manager"
        description={`${personnel.length}/999 records`}
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
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
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name, PNumber, rank, role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Cadet">Cadet</SelectItem>
                <SelectItem value="Adult Instructor">Instructor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={starFilter} onValueChange={setStarFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Star Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stars</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
                <SelectItem value="1 Star">1 Star</SelectItem>
                <SelectItem value="2 Star">2 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Access Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {Object.entries(LEVEL_NAMES).map(([lvl, name]) => (
                  <SelectItem key={lvl} value={lvl}>L{lvl} – {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canViewSensitive && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="non-active">Non-Active</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{filtered.length} of {personnel.length} shown</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map(p => {
              const status = p.PersonnelStatus || 'Active';
              const isInactive = status !== 'Active';
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
                  onClick={() => setProfilePerson(p)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isInactive ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
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
                    {canViewSensitive && <PersonnelStatusBadge status={status} />}
                    {canViewAs && (
                      <Button variant="ghost" size="sm" title={`View as ${p.Surname}`} onClick={(e) => { e.stopPropagation(); setViewAs(p); toast.success(`Now viewing as ${[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}`); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => openEdit(p, e)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {isSysAdmin && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(p); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No personnel match the current filters.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile dialog — opened by clicking a row */}
      <PersonnelProfileDialog
        person={profilePerson}
        open={!!profilePerson}
        onClose={() => setProfilePerson(null)}
      />
    </AccessGate>
  );
}