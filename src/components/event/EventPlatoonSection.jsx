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
import EventSectionCard from '@/components/event/EventSectionCard';

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
  const { data: sections = [] } = useQuery({
    queryKey: ['event-sections', event.id],
    queryFn: () => base44.entities.EventSection.filter({ EventID: event.id }),
  });

  const adultStaff = staff.filter((s) => s.StaffType === 'Adult Instructor');

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
      const platoonSections = sections.filter((s) => s.PlatoonID === platoon.id);
      for (const sec of platoonSections) {
        for (const cid of sec.CadetIDs || []) {
          await base44.entities.EventNominalRoll.update(cid, { SectionID: '' });
        }
        await base44.entities.EventSection.delete(sec.id);
      }
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
      queryClient.invalidateQueries({ queryKey: ['event-sections', event.id] });
    },
  });

  const updatePlatoonMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventPlatoon.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-platoons', event.id] }); toast.success('Platoon updated'); },
  });

  const createSectionMutation = useMutation({
    mutationFn: (data) => base44.entities.EventSection.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-sections', event.id] }),
  });

  function assignCommander(platoon, staffId) {
    if (!staffId) {
      updatePlatoonMutation.mutate({ id: platoon.id, data: { CommanderStaffID: '', CommanderName: '' } });
      return;
    }
    const s = staff.find((x) => x.id === staffId);
    updatePlatoonMutation.mutate({ id: platoon.id, data: { CommanderStaffID: staffId, CommanderName: [s.Rank, s.Name].filter(Boolean).join(' ') } });
  }

  function assign2IC(platoon, staffId) {
    if (!staffId) {
      updatePlatoonMutation.mutate({ id: platoon.id, data: { Commander2ICStaffID: '', Commander2ICName: '' } });
      return;
    }
    const s = staff.find((x) => x.id === staffId);
    updatePlatoonMutation.mutate({ id: platoon.id, data: { Commander2ICStaffID: staffId, Commander2ICName: [s.Rank, s.Name].filter(Boolean).join(' ') } });
  }

  function addSection(platoon) {
    const platoonSections = sections.filter((s) => s.PlatoonID === platoon.id);
    createSectionMutation.mutate({
      EventID: event.id,
      PlatoonID: platoon.id,
      SectionName: String(platoonSections.length + 1),
      CadetIDs: [],
      SortOrder: platoonSections.length,
      DetachmentID: event.DetachmentID,
    }, { onSuccess: () => toast.success('Section added') });
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
      queryClient.invalidateQueries({ queryKey: ['event-sections', event.id] });
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
              const pSections = sections.filter((s) => s.PlatoonID === p.id).sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
              return (
                <div key={p.id} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{p.PlatoonName}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePlatoonMutation.mutate(p)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    <div>
                      <div className="flex items-center gap-1 mb-1"><Shield className="w-3 h-3 text-muted-foreground" /><span className="text-xs font-medium">Commander</span></div>
                      <Select value={p.CommanderStaffID || ''} onValueChange={(v) => assignCommander(p, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign commander…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>— None —</SelectItem>
                          {adultStaff.map((s) => <SelectItem key={s.id} value={s.id}>{[s.Rank, s.Name].filter(Boolean).join(' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1"><Shield className="w-3 h-3 text-muted-foreground/60" /><span className="text-xs font-medium">2IC</span></div>
                      <Select value={p.Commander2ICStaffID || ''} onValueChange={(v) => assign2IC(p, v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign 2IC…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>— None —</SelectItem>
                          {adultStaff.map((s) => <SelectItem key={s.id} value={s.id}>{[s.Rank, s.Name].filter(Boolean).join(' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">Sections ({pSections.length})</span>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => addSection(p)}><Plus className="w-3 h-3 mr-1" />Add Section</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {pSections.map((sec) => (
                        <EventSectionCard key={sec.id} section={sec} platoon={p} staff={adultStaff} roll={roll} />
                      ))}
                      {pSections.length === 0 && <p className="text-xs text-muted-foreground col-span-full">No sections yet. Add sections or run Group Cadets to auto-create 3 per platoon.</p>}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">Staff: {pStaff.length} · Cadets: {pCadets.length}</p>
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
          <p className="text-xs text-muted-foreground">Allocation assigns 2 adult staff per platoon (commander + 2IC). Grouping distributes cadets into platoons and creates 3 sections per platoon.</p>
        </CardContent>
      </Card>
    </div>
  );
}