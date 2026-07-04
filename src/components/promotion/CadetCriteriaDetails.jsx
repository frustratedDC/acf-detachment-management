import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { RANK_REQUIREMENTS } from '@/lib/rankUtils';

export default function CadetCriteriaDetails({ cadet, syllabus, approvedCodes, nextRank, timeInRankMonths, attendancePct, disciplineClean, disciplineCount }) {
  const queryClient = useQueryClient();
  const reqs = nextRank ? RANK_REQUIREMENTS[nextRank] : null;

  const levelLessons = reqs?.requiredStarLevel
    ? syllabus.filter(l => l.StarLevel === reqs.requiredStarLevel && l.IsMandatory)
    : [];
  const fieldcraftLessons = reqs?.extraStarLevel
    ? syllabus.filter(l => l.StarLevel === reqs.extraStarLevel && l.SubjectName?.toLowerCase().includes(reqs.extraSubject.toLowerCase()))
    : [];
  const starLevelMet = levelLessons.length === 0 || levelLessons.every(l => approvedCodes.has(l.LessonCode));
  const fieldcraftMet = fieldcraftLessons.length === 0 || fieldcraftLessons.every(l => approvedCodes.has(l.LessonCode));

  const handleToggle = async (field, checked) => {
    await base44.entities.PersonnelManager.update(cadet.id, { [field]: checked });
    queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
  };

  const Row = ({ done, label }) => (
    <div className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t space-y-1.5">
      {reqs ? (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Criteria for {nextRank}</p>
          {reqs.requiredStarLevel && <Row done={starLevelMet} label={`${reqs.requiredStarLevel} completed`} />}
          {reqs.extraStarLevel && <Row done={fieldcraftMet} label={`${reqs.extraStarLevel} Fieldcraft completed`} />}
          {reqs.timeInRankMonths != null && (
            <Row done={timeInRankMonths >= reqs.timeInRankMonths} label={`Time in current rank ≥ ${reqs.timeInRankMonths} months (currently ${timeInRankMonths})`} />
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">No further rank progression defined.</p>
      )}

      <Row done={attendancePct != null && attendancePct >= 80} label={`General attendance ≥ 80% (last 12 months)${attendancePct != null ? ` — ${attendancePct}%` : ' — no data'}`} />
      <div className="flex items-center gap-2 text-xs">
        {disciplineClean ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-destructive shrink-0" />}
        <span className={disciplineClean ? 'text-foreground' : 'text-destructive'}>
          Discipline/SG Log entries (last 12 months): {disciplineCount}
        </span>
      </div>

      {reqs?.manualCriteria?.map(item => (
        <div key={item.field} className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={!!cadet[item.field]}
            onCheckedChange={(checked) => handleToggle(item.field, checked)}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}