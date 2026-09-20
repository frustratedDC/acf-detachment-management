import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { COMPLETION_STATUSES } from '@/lib/awardPresets';

const CYCLE = ['', 'Pass', 'Stance', 'REVAL'];
const STATUS_COLOR = { Pass: 'bg-chart-2/30 text-chart-2', Stance: 'bg-blue-500/30 text-blue-600', REVAL: 'bg-destructive/30 text-destructive', '': 'bg-muted/40 text-muted-foreground' };

export default function EventLessonTrackingSection({ event }) {
  const queryClient = useQueryClient();
  const [stanceId, setStanceId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });
  const { data: completions = [] } = useQuery({ queryKey: ['event-lesson-completions', event.id], queryFn: () => base44.entities.EventLessonCompletion.filter({ EventID: event.id }) });

  const stance = stances.find((s) => s.id === stanceId);
  const stanceCadets = useMemo(() => (stance ? (stance.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean) : []), [stance, roll]);
  const stanceLessons = useMemo(() => (stance ? (stance.LessonCodes || []).map((c) => syllabus.find((x) => x.LessonCode === c)).filter(Boolean) : []), [stance, syllabus]);
  const stanceCompletions = useMemo(() => completions.filter((c) => c.StanceID === stanceId), [completions, stanceId]);

  const upsertMutation = useMutation({
    mutationFn: async ({ cadetId, lessonCode, status }) => {
      const existing = stanceCompletions.find((c) => c.CadetID === cadetId && c.LessonCode === lessonCode);
      if (existing) {
        if (status === '') { return base44.entities.EventLessonCompletion.delete(existing.id); }
        return base44.entities.EventLessonCompletion.update(existing.id, { Status: status });
      }
      if (status === '') return null;
      return base44.entities.EventLessonCompletion.create({ EventID: event.id, StanceID: stanceId, CadetID: cadetId, LessonCode: lessonCode, Status: status, DetachmentID: event.DetachmentID });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-lesson-completions', event.id] }),
  });

  function cycle(cadetId, lessonCode) {
    const existing = stanceCompletions.find((c) => c.CadetID === cadetId && c.LessonCode === lessonCode);
    const cur = existing?.Status || '';
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    upsertMutation.mutate({ cadetId, lessonCode, status: next });
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: { type: 'object', properties: { records: { type: 'array', items: { type: 'object', properties: {
          PNumber: { type: 'string' }, Subject: { type: 'string' }, Status: { type: 'string' }, StanceLabel: { type: 'string' },
        } } } } },
      });
      const records = result.output?.records || result.output || [];
      let count = 0;
      for (const r of records) {
        const cadet = roll.find((c) => c.PNumber === r.PNumber);
        const st = stances.find((s) => s.StanceLabel === r.StanceLabel || s.SubjectName === r.Subject);
        if (!cadet || !st) continue;
        const status = r.Status === 'P' ? 'Pass' : r.Status === 'REVAL' ? 'REVAL' : (r.StanceLabel && r.StanceLabel !== 'P') ? 'Stance' : 'Pass';
        for (const lc of (st.LessonCodes || [])) {
          await base44.entities.EventLessonCompletion.create({ EventID: event.id, StanceID: st.id, CadetID: cadet.id, LessonCode: lc, Status: status, DetachmentID: event.DetachmentID }).catch(() => {});
          count++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['event-lesson-completions', event.id] });
      toast.success(`${count} completion records imported`);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
    e.target.value = '';
  }

  const sortedStances = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

  return (
    <div className="space-y-3 pb-20">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-40">
              <Select value={stanceId} onValueChange={setStanceId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a stance to track…" /></SelectTrigger>
                <SelectContent>{sortedStances.map((s) => <SelectItem key={s.id} value={s.id}>{s.StanceLabel} — {s.SubjectName || 'No subject'}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading || stances.length === 0}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}Upload Completions CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleUpload} />
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPLETION_STATUSES.map((s) => <span key={s.value || 'blank'} className={`text-xs px-2 py-0.5 rounded ${s.color}`}>{s.label}</span>)}
            <span className="text-xs text-muted-foreground">Tap a cell to cycle: blank → Pass → Stance → REVAL → blank</span>
          </div>
        </CardContent>
      </Card>

      {!stance && <p className="text-center py-8 text-sm text-muted-foreground">Select a stance to view its completion grid.</p>}
      {stance && stanceCadets.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No cadets assigned to this stance.</p>}

      {stance && stanceCadets.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card border-b border-r px-2 py-1.5 text-left min-w-32">Cadet</th>
                {stanceLessons.map((l) => (
                  <th key={l.LessonCode} className="border-b px-1 py-1 text-center min-w-16 max-w-20" title={`${l.LessonCode} ${l.LessonName}`}>
                    <div className="text-[10px] font-mono">{l.LessonCode}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stanceCadets.map((c) => (
                <tr key={c.id}>
                  <td className="sticky left-0 z-10 bg-card border-r px-2 py-1.5 font-medium whitespace-nowrap">{c.Surname}, {c.FirstName}</td>
                  {stanceLessons.map((l) => {
                    const comp = stanceCompletions.find((x) => x.CadetID === c.id && x.LessonCode === l.LessonCode);
                    const status = comp?.Status || '';
                    return (
                      <td key={l.LessonCode} className="border-b border-r p-0.5 text-center">
                        <button type="button" onClick={() => cycle(c.id, l.LessonCode)} className={`w-9 h-7 rounded text-[10px] font-medium ${STATUS_COLOR[status] || STATUS_COLOR['']}`}>
                          {status === 'Pass' ? 'P' : status === 'Stance' ? stance.StanceLabel : status === 'REVAL' ? 'RV' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stance && stanceCadets.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-semibold mb-2">Per-Cadet Summary</h4>
            <div className="space-y-1">
              {stanceCadets.map((c) => {
                const comps = stanceCompletions.filter((x) => x.CadetID === c.id);
                const pass = comps.filter((x) => x.Status === 'Pass').length;
                const stance2 = comps.filter((x) => x.Status === 'Stance').length;
                const reval = comps.filter((x) => x.Status === 'REVAL').length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.Surname}, {c.FirstName}</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="bg-chart-2/10">{pass}P</Badge>
                      <Badge variant="outline" className="bg-blue-500/10">{stance2}S</Badge>
                      {reval > 0 && <Badge variant="outline" className="bg-destructive/10">{reval}RV</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}