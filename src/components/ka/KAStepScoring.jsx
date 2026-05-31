import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import KAStopwatch from "./KAStopwatch";
import { SquareSlash } from "lucide-react";

export default function KAStepScoring({ attendees, personnelMap, selectedActivities, scores, setScores, onEnd }) {
  const activities = selectedActivities;

  function update(pnum, field, value) {
    setScores(prev => ({
      ...prev,
      [pnum]: { ...prev[pnum], [field]: value }
    }));
  }

  function toggleSkip(pnum, field) {
    setScores(prev => {
      const cur = prev[pnum] || {};
      return { ...prev, [pnum]: { ...cur, [`${field}_skip`]: !cur[`${field}_skip`] } };
    });
  }

  const hasActivities = (key) => activities.includes(key);

  // Check all attendees have either a score or skip for every non-mandatory optional activity
  const allScored = attendees.every(pnum => {
    const s = scores[pnum] || {};
    if (hasActivities('WarmUp') && !s.WarmUp) return false;
    if (hasActivities('BroadJump') && !s.BJ_skip && !s.BJ1 && !s.BJ2 && !s.BJ3) return false;
    if (hasActivities('Squats') && !s.Squats_skip && (s.Squats == null || s.Squats === '')) return false;
    if (hasActivities('PressUps') && !s.PressUps_skip && (s.PressUps == null || s.PressUps === '')) return false;
    if (hasActivities('Shuttle') && !s.Shuttle_skip && (s.Shuttle == null || s.Shuttle === '')) return false;
    if (hasActivities('MSFT') && !s.MSFT_skip && (s.MSFT_level == null || s.MSFT_level === '')) return false;
    if (hasActivities('CoolDown') && !s.CoolDown) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <KAStopwatch />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-3 py-2 font-semibold text-xs w-40 sticky left-0 bg-muted/40">Cadet</th>
              {hasActivities('WarmUp') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">Warm Up</th>}
              {hasActivities('BroadJump') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">BJ Att 1</th>}
              {hasActivities('BroadJump') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">BJ Att 2</th>}
              {hasActivities('BroadJump') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">BJ Att 3</th>}
              {hasActivities('BroadJump') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">BJ Skip</th>}
              {hasActivities('Squats') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">Squats</th>}
              {hasActivities('PressUps') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">Press Ups</th>}
              {hasActivities('Shuttle') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">Shuttle (s)</th>}
              {hasActivities('MSFT') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">MSFT Lvl</th>}
              {hasActivities('MSFT') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">MSFT Sh</th>}
              {hasActivities('CoolDown') && <th className="px-3 py-2 text-center font-semibold text-xs whitespace-nowrap">Cool Down</th>}
            </tr>
          </thead>
          <tbody>
            {attendees.map((pnum, idx) => {
              const p = personnelMap[pnum];
              const s = scores[pnum] || {};
              const name = p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pnum;
              return (
                <tr key={pnum} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-2 font-medium text-xs sticky left-0 bg-inherit whitespace-nowrap">{name}</td>

                  {hasActivities('WarmUp') && (
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={!!s.WarmUp} onCheckedChange={v => update(pnum, 'WarmUp', v)} />
                    </td>
                  )}
                  {hasActivities('BroadJump') && (
                    <>
                      <td className="px-1 py-2"><Input type="number" min="0" max="400" className="w-16 h-7 text-xs text-center" value={s.BJ1 ?? ''} disabled={s.BJ_skip} onChange={e => update(pnum, 'BJ1', e.target.value === '' ? '' : Number(e.target.value))} /></td>
                      <td className="px-1 py-2"><Input type="number" min="0" max="400" className="w-16 h-7 text-xs text-center" value={s.BJ2 ?? ''} disabled={s.BJ_skip} onChange={e => update(pnum, 'BJ2', e.target.value === '' ? '' : Number(e.target.value))} /></td>
                      <td className="px-1 py-2"><Input type="number" min="0" max="400" className="w-16 h-7 text-xs text-center" value={s.BJ3 ?? ''} disabled={s.BJ_skip} onChange={e => update(pnum, 'BJ3', e.target.value === '' ? '' : Number(e.target.value))} /></td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" title="No Score" onClick={() => toggleSkip(pnum, 'BJ')} className={`p-1 rounded transition-colors ${s.BJ_skip ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>
                          <SquareSlash className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                  {hasActivities('Squats') && (
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" max="200" className="w-16 h-7 text-xs text-center" value={s.Squats ?? ''} disabled={s.Squats_skip} onChange={e => update(pnum, 'Squats', e.target.value === '' ? '' : Number(e.target.value))} />
                        <button type="button" onClick={() => toggleSkip(pnum, 'Squats')} className={`p-1 rounded ${s.Squats_skip ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}><SquareSlash className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                  {hasActivities('PressUps') && (
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" max="200" className="w-16 h-7 text-xs text-center" value={s.PressUps ?? ''} disabled={s.PressUps_skip} onChange={e => update(pnum, 'PressUps', e.target.value === '' ? '' : Number(e.target.value))} />
                        <button type="button" onClick={() => toggleSkip(pnum, 'PressUps')} className={`p-1 rounded ${s.PressUps_skip ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}><SquareSlash className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                  {hasActivities('Shuttle') && (
                    <td className="px-1 py-2">
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" max="120" className="w-16 h-7 text-xs text-center" value={s.Shuttle ?? ''} disabled={s.Shuttle_skip} onChange={e => update(pnum, 'Shuttle', e.target.value === '' ? '' : Number(e.target.value))} />
                        <button type="button" onClick={() => toggleSkip(pnum, 'Shuttle')} className={`p-1 rounded ${s.Shuttle_skip ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}><SquareSlash className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  )}
                  {hasActivities('MSFT') && (
                    <>
                      <td className="px-1 py-2"><Input type="number" step="0.1" min="0" max="20" className="w-16 h-7 text-xs text-center" placeholder="Lvl" value={s.MSFT_level ?? ''} disabled={s.MSFT_skip} onChange={e => update(pnum, 'MSFT_level', e.target.value)} /></td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1">
                          <Input type="number" min="0" max="20" className="w-16 h-7 text-xs text-center" placeholder="Sh" value={s.MSFT_shuttle ?? ''} disabled={s.MSFT_skip} onChange={e => update(pnum, 'MSFT_shuttle', e.target.value)} />
                          <button type="button" onClick={() => toggleSkip(pnum, 'MSFT')} className={`p-1 rounded ${s.MSFT_skip ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}><SquareSlash className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                  {hasActivities('CoolDown') && (
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={!!s.CoolDown} onCheckedChange={v => update(pnum, 'CoolDown', v)} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button className="w-full" onClick={onEnd} disabled={!allScored}>
        End & Review Session →
      </Button>
      {!allScored && (
        <p className="text-xs text-center text-muted-foreground">All rows must have scores or be marked as skipped before ending.</p>
      )}
    </div>
  );
}