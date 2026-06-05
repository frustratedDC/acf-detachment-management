import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bjMax, bjPoints, squatPoints, pressUpPoints, shuttlePoints, msftPoints, roundUpToNearest30 } from "@/lib/kaScoring";
import { CheckCircle2, Save, Star, TrendingUp } from "lucide-react";

function calcMSFT(level, shuttle) {
  if (!level) return null;
  const l = parseFloat(level);
  const s = shuttle ? parseFloat(shuttle) / 10 : 0;
  return l + s;
}

/**
 * Compute per-cadet bonus breakdown:
 *  sessionHighs: count of exercises where this cadet matched the session-high
 *  pbsBroken: count of exercises where this cadet strictly beat their all-time best
 */
function computeBonuses(pnum, currentScores, allCurrentScores, historicalSessions) {
  // Build session-level raw values for all cadets (for session-high comparison)
  const sessionBJs  = allCurrentScores.map(s => !s.BJ_skip  ? bjMax(s) : null).filter(v => v != null);
  const sessionSQ   = allCurrentScores.map(s => !s.Squats_skip ? (s.Squats ?? null) : null).filter(v => v != null);
  const sessionPU   = allCurrentScores.map(s => !s.PressUps_skip ? (s.PressUps ?? null) : null).filter(v => v != null);
  const sessionSH   = allCurrentScores.map(s => !s.Shuttle_skip ? (s.Shuttle ?? null) : null).filter(v => v != null);
  const sessionMSFT = allCurrentScores.map(s => !s.MSFT_skip ? calcMSFT(s.MSFT_level, s.MSFT_shuttle) : null).filter(v => v != null);

  const s = currentScores;
  const myBJ   = !s.BJ_skip   ? bjMax(s)   : null;
  const mySQ   = !s.Squats_skip   ? (s.Squats   ?? null) : null;
  const myPU   = !s.PressUps_skip ? (s.PressUps ?? null) : null;
  const mySH   = !s.Shuttle_skip  ? (s.Shuttle  ?? null) : null;
  const myMSFT = !s.MSFT_skip ? calcMSFT(s.MSFT_level, s.MSFT_shuttle) : null;

  // Session Highs — matched the top score for that exercise this session
  let sessionHighs = 0;
  if (myBJ   != null && sessionBJs.length  > 0 && myBJ   >= Math.max(...sessionBJs))  sessionHighs++;
  if (mySQ   != null && sessionSQ.length   > 0 && mySQ   >= Math.max(...sessionSQ))   sessionHighs++;
  if (myPU   != null && sessionPU.length   > 0 && myPU   >= Math.max(...sessionPU))   sessionHighs++;
  if (mySH   != null && sessionSH.length   > 0 && mySH   <= Math.min(...sessionSH))   sessionHighs++; // lower is better
  if (myMSFT != null && sessionMSFT.length > 0 && myMSFT >= Math.max(...sessionMSFT)) sessionHighs++;

  // PBs Broken — strictly beat all-time personal best from historical records
  const hist = historicalSessions.filter(h => h.Name === pnum);
  const histBJs  = hist.map(h => bjMax({ BJ1: h.BJ1, BJ2: h.BJ2, BJ3: h.BJ3 })).filter(v => v != null);
  const histSQ   = hist.map(h => h.Squats).filter(v => v != null);
  const histPU   = hist.map(h => h.PressUps).filter(v => v != null);
  const histSH   = hist.map(h => h.Shuttle).filter(v => v != null);
  const histMSFT = hist.map(h => h.MSFT).filter(v => v != null);

  let pbsBroken = 0;
  if (myBJ   != null && histBJs.length  > 0 && myBJ   > Math.max(...histBJs))  pbsBroken++;
  if (mySQ   != null && histSQ.length   > 0 && mySQ   > Math.max(...histSQ))   pbsBroken++;
  if (myPU   != null && histPU.length   > 0 && myPU   > Math.max(...histPU))   pbsBroken++;
  if (mySH   != null && histSH.length   > 0 && mySH   < Math.min(...histSH))   pbsBroken++; // lower is better
  if (myMSFT != null && histMSFT.length > 0 && myMSFT > Math.max(...histMSFT)) pbsBroken++;

  return { sessionHighs, pbsBroken };
}

export default function KAStepReview({
  attendees, personnelMap, scores, sessionStartTime, sessionEndTime,
  selectedActivities, historicalSessions = [], onSubmit, submitting, submitted, onReset
}) {
  const elapsedMinutes = useMemo(() => {
    if (!sessionStartTime || !sessionEndTime) return 0;
    return (sessionEndTime.getTime() - sessionStartTime.getTime()) / 60000;
  }, [sessionStartTime, sessionEndTime]);

  const roundedMinutes = roundUpToNearest30(elapsedMinutes);
  const participationPts = Math.floor(roundedMinutes / 30) * 2;

  // All current scores as array (for session-high comparisons)
  const allCurrentScores = attendees.map(pnum => scores[pnum] || {});

  const rows = useMemo(() => attendees.map((pnum, idx) => {
    const p = personnelMap[pnum];
    const s = scores[pnum] || {};
    const name = p ? `${p.Rank ? p.Rank + ' ' : ''}${p.FirstName || ''} ${p.Surname}`.trim() : pnum;

    const bjBest = !s.BJ_skip ? bjMax({ BJ1: s.BJ1, BJ2: s.BJ2, BJ3: s.BJ3 }) : null;
    const bjPts  = bjPoints(bjBest);
    const sqPts  = !s.Squats_skip   ? squatPoints(s.Squats)       : 0;
    const puPts  = !s.PressUps_skip ? pressUpPoints(s.PressUps)   : 0;
    const shPts  = !s.Shuttle_skip  ? shuttlePoints(s.Shuttle)    : 0;
    const msftVal = !s.MSFT_skip    ? calcMSFT(s.MSFT_level, s.MSFT_shuttle) : null;
    const msftPts = msftPoints(msftVal);
    const activityTotal = bjPts + sqPts + puPts + shPts + msftPts;

    const bonuses = computeBonuses(pnum, s, allCurrentScores, historicalSessions);
    const total = activityTotal + participationPts + bonuses.sessionHighs + bonuses.pbsBroken;

    return { pnum, name, s, bjBest, bjPts, sqPts, puPts, shPts, msftPts, msftVal, activityTotal, bonuses, total };
  }), [attendees, personnelMap, scores, participationPts, historicalSessions]);

  const has = (key) => selectedActivities.includes(key);

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-12 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Session Submitted</h3>
        <p className="text-sm text-muted-foreground">All scores have been committed to the KA database.</p>
        {onReset && (
          <Button variant="outline" onClick={onReset} className="mt-2">Start New Session</Button>
        )}
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
              {has('Squats')    && <th className="px-3 py-2 text-center text-xs">Sq Pts</th>}
              {has('PressUps')  && <th className="px-3 py-2 text-center text-xs">PU Pts</th>}
              {has('Shuttle')   && <th className="px-3 py-2 text-center text-xs">Sh Pts</th>}
              {has('MSFT')      && <th className="px-3 py-2 text-center text-xs">MSFT Pts</th>}
              <th className="px-3 py-2 text-center text-xs">Activity</th>
              <th className="px-3 py-2 text-center text-xs">Part.</th>
              <th className="px-3 py-2 text-center text-xs text-amber-600">
                <span className="flex items-center justify-center gap-1"><Star className="w-3 h-3" />Highs</span>
              </th>
              <th className="px-3 py-2 text-center text-xs text-emerald-600">
                <span className="flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />PBs</span>
              </th>
              <th className="px-3 py-2 text-center text-xs font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.pnum} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-2 font-medium text-xs whitespace-nowrap">{row.name}</td>
                {has('BroadJump') && <td className="px-3 py-2 text-center text-xs">{row.bjBest != null ? `${row.bjBest}cm` : <span className="text-muted-foreground">—</span>}</td>}
                {has('BroadJump') && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.bjPts}</Badge></td>}
                {has('Squats')    && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.sqPts}</Badge></td>}
                {has('PressUps')  && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.puPts}</Badge></td>}
                {has('Shuttle')   && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.shPts}</Badge></td>}
                {has('MSFT')      && <td className="px-3 py-2 text-center"><Badge variant="secondary" className="text-xs">{row.msftPts}</Badge></td>}
                <td className="px-3 py-2 text-center font-semibold text-xs">{row.activityTotal}</td>
                <td className="px-3 py-2 text-center font-semibold text-xs">+{participationPts}</td>
                <td className="px-3 py-2 text-center">
                  {row.bonuses.sessionHighs > 0
                    ? <Badge className="bg-amber-500 text-white text-xs">+{row.bonuses.sessionHighs}</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.bonuses.pbsBroken > 0
                    ? <Badge className="bg-emerald-500 text-white text-xs">+{row.bonuses.pbsBroken}</Badge>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge className="bg-primary text-primary-foreground text-xs font-bold">{row.total}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" /><strong>Session Highs</strong> — matched the top score for an exercise this session (+1 per exercise)</span>
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /><strong>PBs Broken</strong> — strictly beat all-time personal best (+1 per exercise)</span>
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