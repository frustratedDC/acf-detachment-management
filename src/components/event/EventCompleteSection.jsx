import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { buildPerCadetRecords, buildSnapshotRecords } from '@/lib/eventCadetReport';
import EventFinalReportEditor from '@/components/event/EventFinalReportEditor';

export default function EventCompleteSection({ event }) {
  const queryClient = useQueryClient();
  const [showReport, setShowReport] = useState(false);

  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: staff = [] } = useQuery({ queryKey: ['event-staff', event.id], queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }) });
  const { data: completions = [] } = useQuery({ queryKey: ['event-lesson-completions', event.id], queryFn: () => base44.entities.EventLessonCompletion.filter({ EventID: event.id }) });
  const { data: scores = [] } = useQuery({ queryKey: ['event-scores', event.id], queryFn: () => base44.entities.EventScoreEntry.filter({ EventID: event.id }) });
  const { data: awards = [] } = useQuery({ queryKey: ['event-awards', event.id], queryFn: () => base44.entities.EventAward.filter({ EventID: event.id }) });
  const { data: kaSessions = [] } = useQuery({ queryKey: ['event-ka-sessions', event.id], queryFn: () => base44.entities.KASession.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });
  const { data: snapshots = [] } = useQuery({ queryKey: ['event-cadet-snapshots', event.id], queryFn: () => base44.entities.EventCadetSnapshot.filter({ EventID: event.id }) });

  const isComplete = event.Status === 'Complete';

  const completeMutation = useMutation({
    mutationFn: async () => {
      const records = buildPerCadetRecords({ roll, stances, completions, scores, awards, kaSessions, syllabus });
      const now = new Date().toISOString();
      const snapshotPayload = buildSnapshotRecords(event.id, event.DetachmentID, records, now);
      // clear any prior snapshots then write fresh
      for (const s of snapshots) await base44.entities.EventCadetSnapshot.delete(s.id).catch(() => {});
      if (snapshotPayload.length) await base44.entities.EventCadetSnapshot.bulkCreate(snapshotPayload);
      await base44.entities.EventTrainingPlan.update(event.id, { Status: 'Complete', CompletedAt: now });
      return snapshotPayload.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-cadet-snapshots', event.id] });
      toast.success(`Event marked complete — ${count} cadet records frozen`);
    },
  });

  return (
    <div className="space-y-3 pb-20">
      {!showReport && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Event Completion</h3>
            {isComplete ? (
              <div className="space-y-2">
                <Badge className="bg-chart-2/20 text-chart-2">Complete</Badge>
                <p className="text-xs text-muted-foreground">This event was marked complete on {event.CompletedAt ? new Date(event.CompletedAt).toLocaleString('en-GB') : '—'}. {snapshots.length} cadet record snapshot(s) are frozen for the chain of command.</p>
                <Button onClick={() => setShowReport(true)}><FileText className="w-4 h-4 mr-1.5" />Generate / Edit Final Report</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {event.Status === 'Draft' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Event is still in Draft. Set it to Planned or Committed before completing.</p>
                )}
                {(event.Status === 'Planned' || event.Status === 'Committed') && (
                  <p className="text-xs text-muted-foreground">Marking the event complete freezes a per-cadet snapshot (lessons, KA, awards, points) as the permanent record. This cannot be undone — the snapshot becomes immune to further edits.</p>
                )}
                <Button
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending || event.Status === 'Draft' || roll.length === 0}
                >
                  {completeMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Lock className="w-4 h-4 mr-1.5" />}
                  Mark Event Complete
                </Button>
                {roll.length === 0 && <p className="text-[10px] text-destructive">Add cadets to the nominal roll first.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showReport && isComplete && (
        <EventFinalReportEditor event={event} snapshots={snapshots} stances={stances} staff={staff} awards={awards} kaSessions={kaSessions} syllabus={syllabus} onBack={() => setShowReport(false)} />
      )}
    </div>
  );
}