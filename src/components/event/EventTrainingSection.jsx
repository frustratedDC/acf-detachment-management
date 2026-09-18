import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { STAR_LEVELS } from '@/lib/eventConstants';

export default function EventTrainingSection({ event }) {
  const queryClient = useQueryClient();
  const [starLevels, setStarLevels] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [targetedInputs, setTargetedInputs] = useState({});

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });
  const { data: roll = [] } = useQuery({
    queryKey: ['event-nominal-roll', event.id],
    queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }),
  });

  useEffect(() => {
    setStarLevels(event.TrainingStarLevels || []);
    setSubjects(event.TrainingSubjects || []);
  }, [event.id]);

  const availableSubjects = [...new Set(syllabus.map((s) => s.SubjectName).filter(Boolean))].sort();

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingPlan.update(event.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] });
      toast.success('Training scope saved');
    },
  });

  const targetedMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventNominalRoll.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] }),
  });

  function addTargeted(cadet) {
    const val = (targetedInputs[cadet.id] || '').trim();
    if (!val) return;
    const updated = [...(cadet.TargetedTraining || []), val];
    targetedMutation.mutate({ id: cadet.id, data: { TargetedTraining: updated } });
    setTargetedInputs((prev) => ({ ...prev, [cadet.id]: '' }));
  }
  function removeTargeted(cadet, idx) {
    const updated = (cadet.TargetedTraining || []).filter((_, i) => i !== idx);
    targetedMutation.mutate({ id: cadet.id, data: { TargetedTraining: updated } });
  }

  function toggleStar(s) { setStarLevels((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]); }
  function toggleSubject(s) { setSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]); }

  const relevantLessons = syllabus.filter((s) =>
    (starLevels.length === 0 || starLevels.includes(s.StarLevel)) &&
    (subjects.length === 0 || subjects.includes(s.SubjectName))
  );
  const cadetGaps = roll.map((c) => {
    const completed = new Set(c.SubjectCompletions || []);
    const gaps = relevantLessons.filter((l) => !completed.has(l.LessonCode)).map((l) => l.LessonCode);
    return { cadet: c, gaps };
  });

  return (
    <div className="space-y-4 pb-20">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div>
            <Label className="text-sm font-semibold">Star Levels</Label>
            <p className="text-xs text-muted-foreground mb-2">Select all or specific star levels for training.</p>
            <div className="flex flex-wrap gap-2">
              {STAR_LEVELS.map((s) => (
                <button key={s} type="button" onClick={() => toggleStar(s)} className={`text-xs px-2.5 py-1 rounded-full border ${starLevels.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Subjects</Label>
            <p className="text-xs text-muted-foreground mb-2">Select all or specific subjects from the master syllabus.</p>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((s) => (
                <button key={s} type="button" onClick={() => toggleSubject(s)} className={`text-xs px-2.5 py-1 rounded-full border ${subjects.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>{s}</button>
              ))}
            </div>
            {availableSubjects.length === 0 && <p className="text-xs text-muted-foreground">No subjects in master syllabus.</p>}
          </div>
          <Button onClick={() => saveMutation.mutate({ TrainingStarLevels: starLevels, TrainingSubjects: subjects })} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-1.5" />{saveMutation.isPending ? 'Saving...' : 'Save Training Scope'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" />Uncompleted Lessons per Cadet</h3>
          <p className="text-xs text-muted-foreground mb-3">Based on selected scope vs. each cadet's recorded completions.</p>
          <div className="space-y-2">
            {cadetGaps.map(({ cadet, gaps }) => (
              <div key={cadet.id} className="p-2 rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{[cadet.Rank, cadet.FirstName, cadet.Surname].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">{cadet.PNumber} · {cadet.CurrentStarLevel}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant="outline" className="text-xs">{gaps.length} outstanding</Badge>
                    <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-48">
                      {gaps.slice(0, 4).map((g) => <Badge key={g} variant="outline" className="text-xs">{g}</Badge>)}
                      {gaps.length > 4 && <span className="text-xs text-muted-foreground">+{gaps.length - 4}</span>}
                    </div>
                  </div>
                </div>
                {(cadet.TargetedTraining || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cadet.TargetedTraining.map((t, idx) => (
                      <button key={idx} type="button" onClick={() => removeTargeted(cadet, idx)} className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground border border-accent/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">{t} ×</button>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={targetedInputs[cadet.id] || ''}
                    onChange={(e) => setTargetedInputs((prev) => ({ ...prev, [cadet.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTargeted(cadet); } }}
                    placeholder="Add targeted training (e.g. 3 Star:Navigation)"
                    className="text-xs flex-1 px-2 py-1 rounded border border-input bg-background"
                  />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addTargeted(cadet)}>Add</Button>
                </div>
              </div>
            ))}
            {cadetGaps.length === 0 && <p className="text-center py-4 text-sm text-muted-foreground">No cadets on nominal roll.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}