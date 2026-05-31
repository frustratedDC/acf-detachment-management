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
import { Users, Plus, Pencil, Trash2, Search, AlertCircle, Eye, ArrowUpDown, Download, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';
import NonAttenderWorkflow from '@/components/personnel/NonAttenderWorkflow';
import LeaverPipeline from '@/components/personnel/LeaverPipeline';

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
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortBy, setSortBy] = useState('surname');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [profilePerson, setProfilePerson] = useState(null);
  const [leaverPerson, setLeaverPerson] = useState(null);
  const [showArchive, setShowArchive] = useState(false);

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
      PersonnelStatus: record.PersonnelStatus || 'Active',
    });
    setEditingId(record.id);
    setOpen(true);
  }

  const STAR_ORDER = { 'Basic': 0, '1 Star': 1, '2 Star': 2, '3 Star': 3, '4 Star': 4 };

  // Archived cadets (struck off strength)
  const archivedCadets = personnel.filter(p => p.IsArchived === true);

  // Non-attenders needing workflow tracking
  const nonAttenders = personnel.filter(p =>
    (p.PersonnelStatus || 'Active') === 'Non-Attender' && !p.IsArchived
  );

  const filtered = personnel
    .filter(p => {
      if (p.IsArchived) return false; // archived always excluded from main list
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
    })
    .sort((a, b) => {
      if (sortBy === 'star') {
        const aOrder = STAR_ORDER[a.CurrentStarLevel] ?? 99;
        const bOrder = STAR_ORDER[b.CurrentStarLevel] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      if (sortBy === 'star-incomplete') {
        // Sort by lowest star level that still has incomplete training
        const aOrder = STAR_ORDER[a.CurrentStarLevel] ?? 99;
        const bOrder = STAR_ORDER[b.CurrentStarLevel] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      if (sortBy === 'rank') {
        return (a.Rank || '').localeCompare(b.Rank || '');
      }
      // default: surname
      return (a.Surname || '').localeCompare(b.Surname || '');
    });

  const atLimit = personnel.length >= 999;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Personnel Manager"
        description={`${personnel.length}/999 records`}
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            {myLevel >= ACCESS_LEVELS.DET_2IC && (
              <Button variant="outline" size="sm" onClick={async () => {
                const requests = await base44.entities.UniformRequest.filter({});
                if (!requests.length) { toast.info('No uniform requests found'); return; }
                const headers = ['PNumber', 'RequestType', 'ItemName', 'SizeReturning', 'ReasonForReturn', 'Status', 'DateSubmitted'];
                const rows = requests.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','));
                const csv = [headers.join(','), ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'uniform_requests.csv'; a.click();
                URL.revokeObjectURL(url);
                toast.success(`Exported ${requests.length} uniform requests`);
              }}>
                <Download className="w-4 h-4 mr-1" />Export Uniform Requests
              </Button>
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
                           <SelectItem value="3 Star">3 Star</SelectItem>
                           <SelectItem value="4 Star">4 Star</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                  </div>
                  {editingId && (
                    <div>
                      <Label>Status</Label>
                      <Select value={form.PersonnelStatus || 'Active'} onValueChange={(v) => {
                        if (v === 'Leaver') {
                          const record = personnel.find(p => p.id === editingId);
                          if (record) { setLeaverPerson(record); closeDialog(); return; }
                        }
                        setForm(p => ({ ...p, PersonnelStatus: v }));
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Suspended">Suspended</SelectItem>
                          <SelectItem value="Leaver">Leaver</SelectItem>
                          <SelectItem value="Long-term Absence">Long-term Absence</SelectItem>
                          <SelectItem value="Non-Attender">Non-Attender</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="surname">Sort: Surname</SelectItem>
                <SelectItem value="star">Sort: Star Level ↑</SelectItem>
                <SelectItem value="star-incomplete">Sort: Lowest Incomplete Star</SelectItem>
                <SelectItem value="rank">Sort: Rank</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Non-Attender Workflow Panel */}
      {nonAttenders.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Non-Attender Outreach Tracking ({nonAttenders.length})
          </p>
          {nonAttenders.map(p => (
            <NonAttenderWorkflow
              key={p.id}
              person={p}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['all-personnel'] })}
            />
          ))}
        </div>
      )}

      {/* Archived Cadets Section */}
      {isSysAdmin && archivedCadets.length > 0 && (
        <div className="mt-4">
          <button
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 hover:text-foreground transition-colors mb-2"
            onClick={() => setShowArchive(v => !v)}
          >
            <Archive className="w-3.5 h-3.5" />
            Archived / Struck Off Strength ({archivedCadets.length})
            <span className="ml-1">{showArchive ? '▲' : '▼'}</span>
          </button>
          {showArchive && (
            <Card className="border-muted">
              <CardContent className="p-3 space-y-1">
                {archivedCadets.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded text-sm opacity-60">
                    <span>{[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')} — {p.PNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.ArchivedAt ? new Date(p.ArchivedAt).toLocaleDateString('en-GB') : 'Archived'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Profile dialog — opened by clicking a row */}
      <PersonnelProfileDialog
        person={profilePerson}
        open={!!profilePerson}
        onClose={() => setProfilePerson(null)}
      />

      {/* Leaver Pipeline modal */}
      {leaverPerson && (
        <LeaverPipeline
          person={leaverPerson}
          open={!!leaverPerson}
          onClose={() => setLeaverPerson(null)}
          onConfirmed={() => queryClient.invalidateQueries({ queryKey: ['all-personnel'] })}
        />
      )}
    </AccessGate>
  );
}