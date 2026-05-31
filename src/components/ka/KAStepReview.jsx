import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bjMax, bjPoints, squatPoints, pressUpPoints, shuttlePoints, msftPoints, roundUpToNearest30 } from "@/lib/kaScoring";
import { CheckCircle2, Save } from "lucide-react";

function calcMSFT(level, shuttle) {
  if (!level) return null;
  const l = parseFloat(level);
  const s = shuttle ? parseFloat(shuttle) / 10 : 0;
  return l + s;
}

export default function KAStepReview({ attendees, personnelMap, scores, sessionStartTime, sessionEndTime, selectedActivities, onSubmit, submitting, submitted }) {
  const elapsedMinutes = useMemo(() => {
    if (!sessionStartTime || !sessionEndTime) return 0;
    return (sessionEndTime.getTime() - sessionStartTime.getTime()) / 60000;
  }, [sessionStartTime, sessionEndTime]);

  const roundedMinutes = roundUpToNearest30(elapsedMinutes);
  const participationPts = Math.floor(roundedMinutes / 30) * 2;

  const rows = useMemo(() => attendees.map(pnum => {
    const p = personnelMap[pnum];
    const s = scores[pnum] || {};
    const name = p ? `${p.Rank ? p.Rank + ' ' : ''}${p.FirstName || ''} ${p.Surname}`.trim() : pnum;

    const bjBest = !s.BJ_skip ? bjMax({ BJ1: s.BJ1, BJ2: s.BJ2, BJ3: s.BJ3 }) : null;
    const bjPts = bjPoints(bjBest);
    const sqPts = !s.Squats_skip ? squatPoints(s.Squats) : 0;
    const puPts = !s.PressUps_skip ? pressUpPoints(s.PressUps) : 0;
    const shPts = !s.Shuttle_skip ? shuttlePoints(s.Shuttle) : 0;
    const msftVal = !s.MSFT_skip ? calcMSFT(s.MSFT_level, s.MSFT_shuttle) : null;
    const msftPts = msftPoints(msftVal);

    const activityTotal = bjPts + sqPts + puPts + shPts + msftPts;
    const total = activityTotal + participationPts;

    return { pnum, name, s, bjBest, bjPts, sqPts, puPts, shPts, msftPts, msftVal, activityTotal, total };
  }), [attendees, personnelMap, scores, participationPts]);

  const has = (key) => selectedActivities.includes(key);

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-12 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Session Submitted</h3>
        <p className="text-sm text-muted-foreground">All scores have been committed to the KA database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Session Meta */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Elapsed</p>
          <p className="text-lg font-bold tabular-nums">{Math.floor(elapsedMinutes)}m {Math.round((elapsedMinutes % 1) * 60)}s</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Rounded</p>
          <p className="text-lg font-bold">{roundedMinutes} min</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-xs text-muted-foreground">Participation Pts</p>
          <p className="text-lg font-bold text-primary">+{participationPts}</p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-semibold text-xs">Cadet</th>
              {has('BroadJump') && <th className="px-3 py-2 text-center text-xs">BJ Best</th>}
              {has('BroadJump') && <th className="px-3 py-2 text-center text-xs">BJ Pts</th>}
              {has('Squats') && <th className="px-3 py-2 text-center text-xs">Sq Pts</th>}
              {has('PressUps') && <th className="px-3 py-2 text-center text-xs">PU Pts</th>}
              {has('Shuttle') && <th className="px-3 py-2 text-center text-xs">Sh Pts</th>}
              {has('MSFT') && <th className="px-3 py-2 text-center text-xs">MSFT Pts</th>}
              <th className="px-3 py-2 text-center text-xs">Activity</th>
              <th className="px-3 py-2 text-center text-xs">Part.</th>
              <th className="px-3 py-2 text-center text-xs font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.pnum} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-2 font-medium text-xs whitespace-nowrap">{row.name}</td>
                {has('BroadJump') && <td className="px-3 py-2 text-center text-xs">{row.bjBest != null ? `${row.bjBest}cm` : <span className="text-muted-foreground">—</span>}</td>}
                {has('BroadJump') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.bjPts}</Badge></td>}
                {has('Squats') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.sqPts}</Badge></td>}
                {has('PressUps') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.puPts}</Badge></td>}
                {has('Shuttle') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.shPts}</Badge></td>}
                {has('MSFT') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.msftPts}</Badge></td>}
                <td className="px-3 py-2 text-center font-semibold text-xs">{row.activityTotal}</td>
                <td className="px-3 py-2 text-center font-semibold text-xs">+{participationPts}</td>
                <td className="px-3 py-2 text-center">
                  <Badge className="bg-primary text-primary-foreground text-xs font-bold">{row.total}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground border border-border rounded-lg p-3 space-y-1">
        <p><strong>Start:</strong> {sessionStartTime?.toLocaleString('en-GB')}</p>
        <p><strong>End:</strong> {sessionEndTime?.toLocaleString('en-GB')}</p>
        <p><strong>Attendees:</strong> {attendees.length}</p>
      </div>

      <Button className="w-full gap-2" onClick={() => onSubmit(rows, roundedMinutes, participationPts)} disabled={submitting}>
        <Save className="w-4 h-4" />
        {submitting ? 'Submitting…' : 'Confirm & Submit for Scoring'}
      </Button>
    </div>
  );
}