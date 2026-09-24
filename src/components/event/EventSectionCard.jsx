import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Shield } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function EventSectionCard({ section, platoon, staff, roll }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.SectionName);

  const sectionCadets = (section.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventSection.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-sections', section.EventID] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (sec) => {
      for (const cid of sec.CadetIDs || []) {
        await base44.entities.EventNominalRoll.update(cid, { SectionID: '' });
      }
      await base44.entities.EventSection.delete(sec.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-sections', section.EventID] });
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', section.EventID] });
      toast.success('Section deleted');
    },
  });

  function assignCommander(staffId) {
    if (!staffId) {
      updateMutation.mutate({ id: section.id, data: { CommanderStaffID: '', CommanderName: '' } });
      return;
    }
    const s = staff.find((x) => x.id === staffId);
    updateMutation.mutate({ id: section.id, data: { CommanderStaffID: staffId, CommanderName: [s.Rank, s.Name].filter(Boolean).join(' ') } });
  }

  function saveName() {
    updateMutation.mutate({ id: section.id, data: { SectionName: name } }, { onSuccess: () => { setEditing(false); toast.success('Section renamed'); } });
  }

  return (
    <div className="p-2.5 rounded-lg border bg-muted/20">
      <div className="flex items-center justify-between mb-1.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-6 w-16 text-xs" />
            <Button size="sm" className="h-6 px-2 text-xs" onClick={saveName}>OK</Button>
          </div>
        ) : (
          <button onClick={() => { setName(section.SectionName); setEditing(true); }} className="text-xs font-semibold hover:underline">
            Section {section.SectionName}
          </button>
        )}
        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(section)}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <Shield className="w-3 h-3 text-muted-foreground" />
        <Select value={section.CommanderStaffID || ''} onValueChange={assignCommander}>
          <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Section commander…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>— None —</SelectItem>
            {staff.map((s) => <SelectItem key={s.id} value={s.id}>{[s.Rank, s.Name].filter(Boolean).join(' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Cadets: {sectionCadets.length}</p>
      {sectionCadets.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sectionCadets.slice(0, 6).map((c) => <Badge key={c.id} variant="outline" className="text-xs">{c.Surname}</Badge>)}
          {sectionCadets.length > 6 && <span className="text-xs text-muted-foreground">+{sectionCadets.length - 6}</span>}
        </div>
      )}
    </div>
  );
}