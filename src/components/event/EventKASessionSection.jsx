import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Activity, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function EventKASessionSection({ event }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ StanceID: '', Date: event.StartDateTime?.slice(0, 10) || '', StartTime: '', EndTime: '', Activities: '' });
  const [attendees, setAttendees] = useState([]);

  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: sessions = [] } = useQuery({ queryKey: ['event-ka-sessions', event.id], queryFn: () => base44.entities.KASession.filter({ EventID: event.id }) });

  const stance = stances.find((s) => s.id === form.StanceID);
  const stanceCadets = stance ? (stance.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean) : [];

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KASession.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-ka-sessions', event.id] });
      setForm({ StanceID: form.StanceID, Date: form.Date, StartTime: '', EndTime: '', Activities: '' });
      setAttendees([]);
      toast.success('KA session saved — cadet records updated');
    },
  });

  function toggleAttendee(id) {
    setAttendees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function selectAllStance() {
    if (attendees.length === stanceCadets.length) { setAttendees([]); }
    else { setAttendees(stanceCadets.map((c) => c.id)); }
  }

  function save() {
    if (!form.Date || !form.StartTime || !form.StanceID || attendees.length === 0) { toast.error('Select a stance, date, start time and at least one cadet'); return; }
    const dur = form.EndTime ? Math.round((new Date(`${form.Date}T${form.EndTime}`) - new Date(`${form.Date}T${form.StartTime}`)) / 60000) : 30;
    createMutation.mutate({
      Date: form.Date, StartTime: form.StartTime, EndTime: form.EndTime || '',
      DurationMinutes: dur > 0 ? dur : 30,
      AssignedStarLevels: [...new Set(stanceCadets.filter((c) => attendees.includes(c.id)).map((c) => c.CurrentStarLevel).filter(Boolean))],
      Attendees: attendees.map((id) => roll.find((c) => c.id === id)?.PNumber).filter(Boolean),
      Scores: {}, EventID: event.id, StanceID: form.StanceID, DetachmentID: event.DetachmentID,
    });
  }

  return (
    <div className="space-y-4 pb-20">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4" />Run KA Session</h3>
          <p className="text-xs text-muted-foreground">Sessions run during the event write back to the permanent Keeping Active tracker for each cadet.</p>
          <div>
            <Label className="text-xs">Stance</Label>
            <Select value={form.StanceID} onValueChange={(v) => { setForm({ ...form, StanceID: v }); setAttendees([]); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select stance…" /></SelectTrigger>
              <SelectContent>{stances.map((s) => <SelectItem key={s.id} value={s.id}>{s.StanceLabel} — {s.SubjectName || ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.Date} onChange={(e) => setForm({ ...form, Date: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Start</Label>
              <Input type="time" value={form.StartTime} onChange={(e) => setForm({ ...form, StartTime: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">End</Label>
              <Input type="time" value={form.EndTime} onChange={(e) => setForm({ ...form, EndTime: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Activities</Label>
            <Input placeholder="e.g. Warm-up, Bleep test, Press-ups" value={form.Activities} onChange={(e) => setForm({ ...form, Activities: e.target.value })} className="h-8 text-xs" />
          </div>
          {stance && (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cadets ({attendees.length}/{stanceCadets.length})</Label>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={selectAllStance}>{attendees.length === stanceCadets.length ? 'Clear' : 'Select All'}</Button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded p-1.5 space-y-1">
                {stanceCadets.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={attendees.includes(c.id)} onCheckedChange={() => toggleAttendee(c.id)} />
                    <span>{[c.Rank, c.FirstName, c.Surname].filter(Boolean).join(' ')}</span>
                  </label>
                ))}
                {stanceCadets.length === 0 && <p className="text-xs text-muted-foreground p-1">No cadets assigned to this stance.</p>}
              </div>
            </div>
          )}
          <Button onClick={save} disabled={createMutation.isPending}><Plus className="w-4 h-4 mr-1.5" />Save KA Session</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2">Sessions Run ({sessions.length})</h3>
          {sessions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No KA sessions recorded yet.</p> : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <div>
                    <span className="font-medium">{s.Date} {s.StartTime}</span>
                    <span className="text-muted-foreground ml-2">{s.DurationMinutes}min · {(s.Attendees || []).length} cadets</span>
                  </div>
                  <Badge variant="outline">{(s.AssignedStarLevels || []).join(', ') || '—'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}