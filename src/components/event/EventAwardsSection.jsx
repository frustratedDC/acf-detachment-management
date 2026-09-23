import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Trophy, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PRESET_AWARDS, DEFAULT_SCORING } from '@/lib/awardPresets';

export default function EventAwardsSection({ event }) {
  const queryClient = useQueryClient();
  const qAwards = ['event-awards', event.id];
  const qScores = ['event-scores', event.id];

  const { data: awards = [] } = useQuery({ queryKey: qAwards, queryFn: () => base44.entities.EventAward.filter({ EventID: event.id }) });
  const { data: scores = [] } = useQuery({ queryKey: qScores, queryFn: () => base44.entities.EventScoreEntry.filter({ EventID: event.id }) });
  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: staff = [] } = useQuery({ queryKey: ['event-staff', event.id], queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }) });

  const scoring = event.CompetitionScoring || DEFAULT_SCORING;

  const tally = useMemo(() => {
    const map = {};
    scores.forEach((s) => { map[s.CadetID] = (map[s.CadetID] || 0) + (s.Points || 0); });
    return Object.entries(map)
      .map(([id, pts]) => ({ cadet: roll.find((c) => c.id === id), pts }))
      .filter((x) => x.cadet)
      .sort((a, b) => b.pts - a.pts);
  }, [scores, roll]);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const existing = PRESET_AWARDS.map((p) => p.AwardName);
      const missing = PRESET_AWARDS.filter((p) => !awards.find((a) => a.AwardName === p.AwardName));
      if (missing.length === 0) return;
      await base44.entities.EventAward.bulkCreate(missing.map((p) => ({ ...p, EventID: event.id, DetachmentID: event.DetachmentID })));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qAwards }); toast.success('Preset awards seeded'); },
  });

  const addAwardMutation = useMutation({
    mutationFn: (data) => base44.entities.EventAward.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qAwards }); toast.success('Award added'); },
  });
  const updateAwardMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventAward.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qAwards }),
  });
  const deleteAwardMutation = useMutation({
    mutationFn: (id) => base44.entities.EventAward.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qAwards }),
  });
  const scoreMutation = useMutation({
    mutationFn: (data) => base44.entities.EventScoreEntry.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qScores }),
  });
  const deleteScoreMutation = useMutation({
    mutationFn: (id) => base44.entities.EventScoreEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qScores }),
  });
  const saveScoringMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingPlan.update(event.id, { CompetitionScoring: data }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] }); toast.success('Scoring saved'); },
  });

  const [newAward, setNewAward] = React.useState({ AwardName: '', Prize: '', Description: '' });
  const [scoreForm, setScoreForm] = React.useState({ StanceID: '', CadetID: '', Points: 3, Bonus: false });

  function addAward() {
    if (!newAward.AwardName) return;
    addAwardMutation.mutate({ ...newAward, AwardType: 'custom', EventID: event.id, DetachmentID: event.DetachmentID, SortOrder: awards.length + 5 });
    setNewAward({ AwardName: '', Prize: '', Description: '' });
  }

  function awardScore() {
    if (!scoreForm.StanceID || !scoreForm.CadetID) return;
    scoreMutation.mutate({
      EventID: event.id, StanceID: scoreForm.StanceID, CadetID: scoreForm.CadetID,
      Points: scoreForm.Bonus ? (scoring.bonusPoints || 1) : Number(scoreForm.Points),
      Bonus: scoreForm.Bonus, DetachmentID: event.DetachmentID,
    });
    setScoreForm({ ...scoreForm, CadetID: '' });
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Scoring config */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Star className="w-4 h-4" />Competition Scoring</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">1st place pts</Label>
              <Input type="number" value={scoring.pointsPerRank?.[0] ?? 3} onChange={(e) => saveScoringMutation.mutate({ ...scoring, pointsPerRank: [Number(e.target.value), scoring.pointsPerRank?.[1] ?? 2, scoring.pointsPerRank?.[2] ?? 1] })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">2nd place pts</Label>
              <Input type="number" value={scoring.pointsPerRank?.[1] ?? 2} onChange={(e) => saveScoringMutation.mutate({ ...scoring, pointsPerRank: [scoring.pointsPerRank?.[0] ?? 3, Number(e.target.value), scoring.pointsPerRank?.[2] ?? 1] })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">3rd place pts</Label>
              <Input type="number" value={scoring.pointsPerRank?.[2] ?? 1} onChange={(e) => saveScoringMutation.mutate({ ...scoring, pointsPerRank: [scoring.pointsPerRank?.[0] ?? 3, scoring.pointsPerRank?.[1] ?? 2, Number(e.target.value)] })} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Instructor bonus points</Label>
            <Input type="number" value={scoring.bonusPoints ?? 1} onChange={(e) => saveScoringMutation.mutate({ ...scoring, bonusPoints: Number(e.target.value) })} className="h-8 text-xs w-24" />
          </div>
          <p className="text-xs text-muted-foreground">Scoring saves automatically to the event. Instructors award points per cadet per stance below.</p>
        </CardContent>
      </Card>

      {/* Awards */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="w-4 h-4" />Awards</h3>
            <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>Seed Presets</Button>
          </div>
          <div className="space-y-2">
            {awards.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0)).map((a) => (
              <div key={a.id} className="p-2 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{a.AwardName}</span>
                      <Badge variant="outline" className="text-xs">{a.AwardType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.Prize}</p>
                    {a.Description && <p className="text-xs text-muted-foreground mt-0.5">{a.Description}</p>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAwardMutation.mutate(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="mt-2">
                  <Select value={a.WinnerCadetID || ''} onValueChange={(v) => updateAwardMutation.mutate({ id: a.id, data: { WinnerCadetID: v } })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Nominate winner…" /></SelectTrigger>
                    <SelectContent>{roll.map((c) => <SelectItem key={c.id} value={c.id}>{[c.Rank, c.FirstName, c.Surname].filter(Boolean).join(' ')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {awards.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No awards yet. Click "Seed Presets" to load the four standard awards.</p>}
          </div>
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs font-semibold">Add Custom Award</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Award name" value={newAward.AwardName} onChange={(e) => setNewAward({ ...newAward, AwardName: e.target.value })} className="h-8 text-xs" />
              <Input placeholder="Prize" value={newAward.Prize} onChange={(e) => setNewAward({ ...newAward, Prize: e.target.value })} className="h-8 text-xs" />
            </div>
            <Input placeholder="Description (optional)" value={newAward.Description} onChange={(e) => setNewAward({ ...newAward, Description: e.target.value })} className="h-8 text-xs" />
            <Button size="sm" variant="outline" onClick={addAward}><Plus className="w-4 h-4 mr-1.5" />Add Award</Button>
          </div>
        </CardContent>
      </Card>

      {/* Award points */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="text-sm font-semibold">Award Points</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Stance</Label>
              <Select value={scoreForm.StanceID} onValueChange={(v) => setScoreForm({ ...scoreForm, StanceID: v, CadetID: '' })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select stance…" /></SelectTrigger>
                <SelectContent>{stances.map((s) => <SelectItem key={s.id} value={s.id}>{s.StanceLabel} — {(s.SubjectNames && s.SubjectNames.length ? s.SubjectNames : s.SubjectName ? [s.SubjectName] : []).join(', ') || ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cadet</Label>
              <Select value={scoreForm.CadetID} onValueChange={(v) => setScoreForm({ ...scoreForm, CadetID: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select cadet…" /></SelectTrigger>
                <SelectContent>
                  {(stances.find((s) => s.id === scoreForm.StanceID)?.CadetIDs || []).map((id) => {
                    const c = roll.find((x) => x.id === id); if (!c) return null;
                    return <SelectItem key={id} value={id}>{[c.Rank, c.FirstName, c.Surname].filter(Boolean).join(' ')}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(scoreForm.Points)} onValueChange={(v) => setScoreForm({ ...scoreForm, Points: Number(v), Bonus: false })}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{scoring.pointsPerRank?.map((p, i) => <SelectItem key={i} value={String(p)}>{p} pts ({i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'})</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant={scoreForm.Bonus ? 'default' : 'outline'} onClick={() => setScoreForm({ ...scoreForm, Bonus: !scoreForm.Bonus, Points: scoring.bonusPoints })} className="h-8 text-xs">Bonus +{scoring.bonusPoints}</Button>
            <Button size="sm" onClick={awardScore} disabled={!scoreForm.StanceID || !scoreForm.CadetID}>Award Points</Button>
          </div>
        </CardContent>
      </Card>

      {/* Live tally */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2">Live Points Tally</h3>
          {tally.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No points awarded yet.</p> : (
            <div className="space-y-1">
              {tally.map((t, i) => (
                <div key={t.cadet.id} className={`flex items-center justify-between p-2 rounded text-sm ${i === 0 ? 'bg-accent/20' : i < 3 ? 'bg-muted/40' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono w-5 text-muted-foreground">{i + 1}</span>
                    {i === 0 && <Trophy className="w-4 h-4 text-accent" />}
                    <span className="font-medium">{[t.cadet.Rank, t.cadet.FirstName, t.cadet.Surname].filter(Boolean).join(' ')}</span>
                  </div>
                  <Badge variant={i === 0 ? 'default' : 'outline'}>{t.pts} pts</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}