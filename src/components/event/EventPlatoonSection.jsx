import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, RefreshCw, Wand2, Group, Loader2, Shield } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const COMPANY_ROLES = [
  { key: 'CompanyStaffOC', label: 'OC' },
  { key: 'CompanyStaffTO', label: 'TO' },
  { key: 'CompanyStaffCSM', label: 'CSM' },
  { key: 'CompanyStaffOfficer', label: 'Staff Officer' },
  { key: 'CompanyStaffCQMS', label: 'CQMS' },
];

export default function EventPlatoonSection({ event }) {
  const queryClient = useQueryClient();
  const [newPlatoon, setNewPlatoon] = useState('');
  const [companyForm, setCompanyForm] = useState({});
  const [allocating, setAllocating] = useState(false);
  const [grouping, setGrouping] = useState(false);

  const { data: platoons = [] } = useQuery({
    queryKey: ['event-platoons', event.id],
    queryFn: () => base44.entities.EventPlatoon.filter({ EventID: event.id }),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['event-staff', event.id],
    queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }),
  });
  const { data: roll = [] } = useQuery({
    queryKey: ['event-nominal-roll', event.id],
    queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }),
  });

  useEffect(() => {
    const form = {};
    COMPANY_ROLES.forEach((r) => { form[r.key] = event[r.key] || ''; });
    setCompanyForm(form);
  }, [event.id]);

  const updateEventMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingPlan.update(event.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] }),
  });

  const createPlatoonMutation = useMutation({
    mutationFn: (name) => base44.entities.EventPlatoon.create({ EventID: event.id, PlatoonName: name, StaffIDs: [], CadetIDs: [], DetachmentID: event.DetachmentID }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] }); setNewPlatoon(''); toast.success('Platoon created'); },
  });

  const deletePlatoonMutation = useMutation({
    mutationFn: async (platoon) => {
      for (const sid of platoon.StaffIDs || []) {
        await base44.entities.EventStaff.update(sid, { PlatoonID: '' });
      }
      for (const cid of platoon.CadetIDs || []) {
        await base44.entities.EventNominalRoll.update(cid, { PlatoonID: '' });
      }
      await base44.entities.EventPlatoon.delete(platoon.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-staff', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
    },
  });

  const updatePlatoonMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventPlatoon.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] }); toast.success('Platoon commander updated'); },
  });

  function assignCommander(platoon, staffId) {
    if (!staffId) {
      updatePlatoonMutation.mutate({ id: platoon.id, data: { CommanderStaffID: '', CommanderName: '' } });
      return;
    }
    const s = staff.find((x) => x.id === staffId);
    updatePlatoonMutation.mutate({ id: platoon.id, data: { CommanderStaffID: staffId, CommanderName: [s.Rank, s.Name].filter(Boolean).join(' ') } });
  }

  async function handleAllocate() {
    setAllocating(true);
    try {
      const res = await base44.functions.invoke('allocateEventPlatoons', { eventId: event.id });
      if (res.data?.error) toast.error(res.data.error);
      else toast.success(`Allocated ${res.data.staffAssigned} staff across ${res.data.platoonCount} platoons`);
      queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-staff', event.id] });
    } catch (err) { toast.error(err.message); }
    setAllocating(false);
  }

  async function handleGroup() {
    setGrouping(true);
    try {
      const res = await base44.functions.invoke('groupEventCadets', { eventId: event.id });
      if (res.data?.error) toast.error(res.data.error);
      else toast.success(`Grouped ${res.data.totalCadets} cadets across ${res.data.groupings?.length} platoons`);
      queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
    } catch (err) { toast.error(err.message); }
    setGrouping(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <h3 className="text-sm font-semibold">Company Staff Roles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COMPANY_ROLES.map((r) => (
              <div key={r.key}><Label className="text-xs">{r.label}</Label><Input value={companyForm[r.key] || ''} onChange={(e) => setCompanyForm({ ...companyForm, [r.key]: e.target.value })} placeholder={r.label} /></div>
            ))}
          </div>
          <Button size="sm" onClick={() => updateEventMutation.mutate(companyForm)} disabled={updateEventMutation.isPending}>Save Company Staff</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Training Teams / Platoons</h3>
          <div className="flex gap-2">
            <Input placeholder="Platoon name..." value={newPlatoon} onChange={(e) => setNewPlatoon(e.target.value)} />
            <Button size="sm" onClick={() => createPlatoonMutation.mutate(newPlatoon)} disabled={!newPlatoon}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <div className="space-y-2">
            {platoons.map((p) => {
              const pStaff = (p.StaffIDs || []).map((id) => staff.find((s) => s.id === id)).filter(Boolean);
              const pCadets = (p.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean);
              return (
                <div key={p.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{p.PlatoonName}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePlatoonMutation.mutate(p)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="mt-1">
                    <div className="flex items-center gap-1 mb-1"><Shield className="w-3 h-3 text-muted-foreground" /><span className="text-xs font-medium">Commander</span></div>
                    <Select value={p.CommanderStaffID || ''} onValueChange={(v) => assignCommander(p, v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign commander…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>— None —</SelectItem>
                        {staff.map((s) => <SelectItem key={s.id} value={s.id}>{[s.Rank, s.Name].filter(Boolean).join(' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Staff: {pStaff.length} · Cadets: {pCadets.length}</p>
                  {pCadets.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pCadets.slice(0, 8).map((c) => <Badge key={c.id} variant="outline" className="text-xs">{c.Surname}</Badge>)}
                      {pCadets.length > 8 && <span className="text-xs text-muted-foreground">+{pCadets.length - 8}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {platoons.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No platoons yet. Create platoons first, then run allocation.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Automated Allocation & Grouping</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAllocate} disabled={allocating || platoons.length === 0}>
              {allocating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
              {allocating ? 'Allocating...' : 'Allocate AI Platoons'}
            </Button>
            <Button size="sm" onClick={handleGroup} disabled={grouping || platoons.length === 0}>
              {grouping ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Group className="w-4 h-4 mr-1.5" />}
              {grouping ? 'Grouping...' : 'Group Cadets'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleGroup} disabled={grouping || platoons.length === 0}>
              <RefreshCw className="w-4 h-4 mr-1.5" />Redo Grouping
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Allocation priority: subject match → qualified status → command role. Grouping priority: fastest star trajectory → most completed subjects → targeted training.</p>
        </CardContent>
      </Card>
    </div>
  );
}