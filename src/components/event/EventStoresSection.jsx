import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EventStoresSection({ event }) {
  const queryClient = useQueryClient();
  const [stanceId, setStanceId] = useState('');
  const [editing, setEditing] = useState({});

  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });
  const { data: stores = [] } = useQuery({ queryKey: ['event-lesson-stores', event.id], queryFn: () => base44.entities.EventLessonStores.filter({ EventID: event.id }) });

  const stance = stances.find((s) => s.id === stanceId);
  const stanceLessons = useMemo(() => stance ? (stance.LessonCodes || []).map((c) => syllabus.find((x) => x.LessonCode === c)).filter(Boolean) : [], [stance, syllabus]);
  const stanceStores = stores.filter((s) => s.StanceID === stanceId);

  const upsertMutation = useMutation({
    mutationFn: async ({ lessonCode, data }) => {
      const existing = stanceStores.find((s) => s.LessonCode === lessonCode);
      if (existing) return base44.entities.EventLessonStores.update(existing.id, data);
      return base44.entities.EventLessonStores.create({ EventID: event.id, StanceID: stanceId, LessonCode: lessonCode, ...data, DetachmentID: event.DetachmentID });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-lesson-stores', event.id] }),
  });

  const totals = useMemo(() => {
    const map = {};
    stores.forEach((s) => {
      (s.StoresRequest || '').split(/[,;+]/).map((x) => x.trim()).filter(Boolean).forEach((item) => {
        const m = item.match(/(\d+)\s*x\s*(.+)/i);
        if (m) { map[m[2].trim()] = (map[m[2].trim()] || 0) + parseInt(m[1], 10); }
        else map[item] = (map[item] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [stores]);

  const sortedStances = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

  function save(lessonCode) {
    const data = editing[lessonCode] || {};
    upsertMutation.mutate({ lessonCode, data }, { onSuccess: () => { setEditing((p) => { const n = { ...p }; delete n[lessonCode]; return n; }); toast.success('Stores saved'); } });
  }

  return (
    <div className="space-y-4 pb-20">
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2"><Package className="w-4 h-4" />Per-Lesson Stores</h3>
          <Select value={stanceId} onValueChange={(v) => { setStanceId(v); setEditing({}); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select stance…" /></SelectTrigger>
            <SelectContent>{sortedStances.map((s) => <SelectItem key={s.id} value={s.id}>{s.StanceLabel} — {s.SubjectName || ''}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!stance && <p className="text-center py-8 text-sm text-muted-foreground">Select a stance to edit its lesson stores.</p>}

      {stance && stanceLessons.map((l) => {
        const existing = stanceStores.find((s) => s.LessonCode === l.LessonCode);
        const ed = editing[l.LessonCode] || existing || {};
        return (
          <Card key={l.LessonCode}>
            <CardContent className="p-3 space-y-2">
              <p className="text-sm font-medium">[{l.LessonCode}] {l.LessonName}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input value={ed.Location || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, Location: e.target.value } })} className="h-8 text-xs" placeholder="e.g. Training Wing" />
                </div>
                <div>
                  <Label className="text-xs">Dress</Label>
                  <Input value={ed.Dress || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, Dress: e.target.value } })} className="h-8 text-xs" placeholder="e.g. Waterproofs" />
                </div>
                <div>
                  <Label className="text-xs">Welfare</Label>
                  <Input value={ed.Welfare || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, Welfare: e.target.value } })} className="h-8 text-xs" placeholder="e.g. Water" />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input value={ed.Notes || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, Notes: e.target.value } })} className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Stores Request (CQMS)</Label>
                <Input value={ed.StoresRequest || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, StoresRequest: e.target.value } })} className="h-8 text-xs" placeholder="e.g. OS Maps, Map Symbols Cards" />
              </div>
              <div>
                <Label className="text-xs">Own Stores (cadets bring)</Label>
                <Input value={ed.OwnStores || ''} onChange={(e) => setEditing({ ...editing, [l.LessonCode]: { ...ed, OwnStores: e.target.value } })} className="h-8 text-xs" placeholder="e.g. own packed bergan" />
              </div>
              {editing[l.LessonCode] && <Button size="sm" onClick={() => save(l.LessonCode)}><Save className="w-3.5 h-3.5 mr-1.5" />Save</Button>}
            </CardContent>
          </Card>
        );
      })}

      {totals.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">Aggregate Stores Totals</h3>
            <div className="flex flex-wrap gap-2">
              {totals.map(([name, qty]) => <Badge key={name} variant="outline" className="text-xs">{qty}x {name}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}