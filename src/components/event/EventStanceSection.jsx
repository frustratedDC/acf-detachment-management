import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Clock } from 'lucide-react';
import { toast } from 'sonner';

function nextLabel(stances) {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (const l of letters) {
    for (let n = 1; n <= 2; n++) {
      if (!stances.find((s) => s.StanceLabel === `${l}${n}`)) return `${l}${n}`;
    }
  }
  return `S${stances.length + 1}`;
}

export default function EventStanceSection({ event }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(null);

  const { data: stances = [] } = useQuery({
    queryKey: ['event-stances', event.id],
    queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }),
  });
  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['event-staff', event.id],
    queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }),
  });
  const { data: roll = [] } = useQuery({
    queryKey: ['event-nominal-roll', event.id],
    queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }),
  });

  const sorted = useMemo(() => [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0)), [stances]);
  const subjects = useMemo(() => [...new Set(syllabus.map((s) => s.SubjectName).filter(Boolean))].sort(), [syllabus]);

  const qKey = ['event-stances', event.id];

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingStance.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventTrainingStance.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventTrainingStance.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  function addStance() {
    const label = nextLabel(sorted);
    createMutation.mutate({
      EventID: event.id, StanceLabel: label, StartTime: event.StartDateTime, EndTime: event.EndDateTime,
      SubjectName: '', LessonCodes: [], StaffIDs: [], CadetIDs: [], SortOrder: sorted.length, DetachmentID: event.DetachmentID,
    }, {
      onSuccess: () => toast.success(`Stance ${label} added`),
    });
  }

  function toggleArr(field, val, stance) {
    const arr = stance[field] || [];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    updateMutation.mutate({ id: stance.id, data: { [field]: next } });
  }
  function move(stance, dir) {
    const idx = sorted.findIndex((s) => s.id === stance.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    updateMutation.mutate({ id: stance.id, data: { SortOrder: swap.SortOrder } });
    updateMutation.mutate({ id: swap.id, data: { SortOrder: stance.SortOrder } });
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Training Stances</h3>
          <p className="text-xs text-muted-foreground">Time-blocked training rotations (A1, B2…). Independent of platoons.</p>
        </div>
        <Button size="sm" onClick={addStance} disabled={createMutation.isPending}><Plus className="w-4 h-4 mr-1.5" />Add Stance</Button>
      </div>

      {sorted.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No stances yet. Add one to build your training plan.</p>}

      {sorted.map((s, i) => {
        const isOpen = expanded === s.id;
        const lessons = (s.LessonCodes || []).map((c) => syllabus.find((x) => x.LessonCode === c)).filter(Boolean);
        const stanceStaff = (s.StaffIDs || []).map((id) => staff.find((x) => x.id === id)).filter(Boolean);
        const cadets = (s.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean);
        const subjectLessons = syllabus.filter((x) => !s.SubjectName || x.SubjectName === s.SubjectName);
        return (
          <Card key={s.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(s, -1)} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => move(s, 1)} disabled={i === sorted.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                </div>
                <Badge className="bg-primary text-primary-foreground">{s.StanceLabel}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.SubjectName || 'No subject'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{s.StartTime ? new Date(s.StartTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                </div>
                <div className="flex gap-1 text-xs">
                  <Badge variant="outline">{lessons.length}L</Badge>
                  <Badge variant="outline">{stanceStaff.length}S</Badge>
                  <Badge variant="outline">{cadets.length}C</Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(isOpen ? null : s.id)}>{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</Button>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input type="datetime-local" value={s.StartTime ? new Date(s.StartTime).toISOString().slice(0, 16) : ''} onChange={(e) => updateMutation.mutate({ id: s.id, data: { StartTime: e.target.value } })} className="text-xs h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input type="datetime-local" value={s.EndTime ? new Date(s.EndTime).toISOString().slice(0, 16) : ''} onChange={(e) => updateMutation.mutate({ id: s.id, data: { EndTime: e.target.value } })} className="text-xs h-8" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Select value={s.SubjectName || ''} onValueChange={(v) => updateMutation.mutate({ id: s.id, data: { SubjectName: v, LessonCodes: [] } })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                      <SelectContent>{subjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {s.SubjectName && (
                    <div>
                      <Label className="text-xs">Lessons (from Master Syllabus)</Label>
                      <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                        {subjectLessons.map((l) => (
                          <button key={l.LessonCode} type="button" onClick={() => toggleArr('LessonCodes', l.LessonCode, s)} className={`block w-full text-left text-xs px-2 py-1 rounded ${((s.LessonCodes || []).includes(l.LessonCode)) ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                            [{l.LessonCode}] {l.LessonName}
                          </button>
                        ))}
                        {subjectLessons.length === 0 && <p className="text-xs text-muted-foreground">No lessons for this subject.</p>}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Instructors ({stanceStaff.length})</Label>
                    <div className="flex flex-wrap gap-1">
                      {staff.map((st) => (
                        <button key={st.id} type="button" onClick={() => toggleArr('StaffIDs', st.id, s)} className={`text-xs px-2 py-1 rounded border ${((s.StaffIDs || []).includes(st.id)) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                          {[st.Rank, st.Name].filter(Boolean).join(' ')}
                        </button>
                      ))}
                      {staff.length === 0 && <p className="text-xs text-muted-foreground">Add staff on the Staff tab first.</p>}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Cadets ({cadets.length})</Label>
                    <div className="max-h-32 overflow-y-auto border rounded p-1.5 flex flex-wrap gap-1">
                      {roll.map((c) => (
                        <button key={c.id} type="button" onClick={() => toggleArr('CadetIDs', c.id, s)} className={`text-xs px-1.5 py-0.5 rounded border ${((s.CadetIDs || []).includes(c.id)) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                          {c.Surname}
                        </button>
                      ))}
                      {roll.length === 0 && <p className="text-xs text-muted-foreground">Add cadets on the Nominal Roll tab first.</p>}
                    </div>
                  </div>

                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { deleteMutation.mutate(s.id); setExpanded(null); }}><Trash2 className="w-4 h-4 mr-1.5" />Delete Stance</Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}