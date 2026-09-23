import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Search, Award, Activity, Trophy, BookOpen } from 'lucide-react';
import { buildPerCadetRecords } from '@/lib/eventCadetReport';

export default function EventCadetRecordsSection({ event }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: completions = [] } = useQuery({ queryKey: ['event-lesson-completions', event.id], queryFn: () => base44.entities.EventLessonCompletion.filter({ EventID: event.id }) });
  const { data: scores = [] } = useQuery({ queryKey: ['event-scores', event.id], queryFn: () => base44.entities.EventScoreEntry.filter({ EventID: event.id }) });
  const { data: awards = [] } = useQuery({ queryKey: ['event-awards', event.id], queryFn: () => base44.entities.EventAward.filter({ EventID: event.id }) });
  const { data: kaSessions = [] } = useQuery({ queryKey: ['event-ka-sessions', event.id], queryFn: () => base44.entities.KASession.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });

  const records = useMemo(() => buildPerCadetRecords({ roll, stances, completions, scores, awards, kaSessions, syllabus }), [roll, stances, completions, scores, awards, kaSessions, syllabus]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.Name.toLowerCase().includes(q) || r.PNumber?.toLowerCase().includes(q));
  }, [records, search]);

  return (
    <div className="space-y-3 pb-20">
      <div>
        <h3 className="text-sm font-semibold">Cadet Records</h3>
        <p className="text-xs text-muted-foreground">Live aggregate per cadet — lessons, subjects, KA, awards, points. Sorted by surname.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search cadets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">{roll.length === 0 ? 'No cadets on the nominal roll yet.' : 'No cadets match your search.'}</p>}

      <div className="space-y-2">
        {filtered.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <Card key={r.id}>
              <CardContent className="p-3">
                <button type="button" className="w-full flex items-center gap-2 text-left" onClick={() => setExpanded(isOpen ? null : r.id)}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.Rank ? r.Rank + ' ' : ''}{r.Name}</p>
                    <p className="text-xs text-muted-foreground">{r.PNumber} · {r.StarLevel}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs"><BookOpen className="w-3 h-3 mr-1" />{r.lessonsPassed.length}P</Badge>
                    <Badge variant="outline" className="text-xs"><Activity className="w-3 h-3 mr-1" />{r.kaSessionsAttended}KA</Badge>
                    <Badge variant="outline" className="text-xs"><Trophy className="w-3 h-3 mr-1" />{r.competitionPoints}</Badge>
                    {r.awardsWon.length > 0 && <Badge className="text-xs bg-accent/20 text-accent-foreground"><Award className="w-3 h-3 mr-1" />{r.awardsWon.length}</Badge>}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                    <div>
                      <p className="font-semibold mb-1">Subjects Completed ({r.subjectsCompleted.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {r.subjectsCompleted.length === 0 ? <span className="text-muted-foreground">—</span> :
                          r.subjectsCompleted.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Lesson Completions</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs bg-chart-2/10">{r.lessonsPassed.length} Pass</Badge>
                        <Badge variant="outline" className="text-xs bg-blue-500/10">{r.lessonsStance.length} Stance</Badge>
                        {r.lessonsREVAL.length > 0 && <Badge variant="outline" className="text-xs bg-destructive/10">{r.lessonsREVAL.length} REVAL</Badge>}
                      </div>
                    </div>
                    {Object.keys(r.bySubject).length > 0 && (
                      <div>
                        <p className="font-semibold mb-1">Per-Subject Breakdown</p>
                        <div className="space-y-1">
                          {Object.entries(r.bySubject).map(([subj, c]) => (
                            <div key={subj} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30">
                              <span className="font-medium">{subj}</span>
                              <span className="text-muted-foreground">{c.Pass}P · {c.Stance}S{c.REVAL ? ` · ${c.REVAL}RV` : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.kaSessionsAttended > 0 && (
                      <div>
                        <p className="font-semibold mb-1">Keeping Active</p>
                        <p className="text-muted-foreground">{r.kaSessionsAttended} session(s) attended</p>
                        {Object.keys(r.kaScores).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(r.kaScores).map(([k, v]) => <Badge key={k} variant="outline" className="text-xs">{k}: {v}</Badge>)}
                          </div>
                        )}
                      </div>
                    )}
                    {r.awardsWon.length > 0 && (
                      <div>
                        <p className="font-semibold mb-1">Awards Won</p>
                        <div className="flex flex-wrap gap-1">
                          {r.awardsWon.map((a) => <Badge key={a} className="text-xs bg-accent/20 text-accent-foreground">{a}</Badge>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}