import React from 'react';
import { CheckCircle2, Circle, HelpCircle } from 'lucide-react';
import { RANK_REQUIREMENTS } from '@/lib/rankUtils';

export default function CadetCriteriaDetails({ cadet, syllabus, approvedCodes, pendingCodes, nextRank, timeInRankMonths, attendancePct, disciplineClean }) {
  const reqs = nextRank ? RANK_REQUIREMENTS[nextRank] : null;

  if (!reqs) {
    return <p className="text-xs text-muted-foreground py-2">No further rank progression defined.</p>;
  }

  const levelLessons = reqs.requiredStarLevel
    ? syllabus.filter(l => l.StarLevel === reqs.requiredStarLevel && l.IsMandatory)
    : [];
  const fieldcraftLessons = reqs.extraStarLevel
    ? syllabus.filter(l => l.StarLevel === reqs.extraStarLevel && l.SubjectName?.toLowerCase().includes(reqs.extraSubject.toLowerCase()))
    : [];

  const Row = ({ done, label, sub }) => (
    <div className="flex items-center gap-2 text-xs">
      {done ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      {sub}
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Criteria for {nextRank}</p>

      {reqs.timeInRankMonths != null && (
        <Row done={timeInRankMonths >= reqs.timeInRankMonths} label={`Time in current rank ≥ ${reqs.timeInRankMonths} months (currently ${timeInRankMonths})`} />
      )}
      <Row done={attendancePct != null && attendancePct >= 80} label={`General attendance ≥ 80% (last 12 months)${attendancePct != null ? ` — ${attendancePct}%` : ' — no data'}`} />
      <Row done={disciplineClean} label="Clear disciplinary record (last 12 months)" />

      {levelLessons.length > 0 && levelLessons.map(lesson => {
        const done = approvedCodes.has(lesson.LessonCode);
        const pending = pendingCodes.has(lesson.LessonCode);
        return (
          <Row
            key={lesson.LessonCode}
            done={done}
            label={`${lesson.SubjectName} — ${lesson.LessonName}`}
            sub={pending && !done ? <span className="text-chart-3 font-medium">(Pending)</span> : null}
          />
        );
      })}

      {fieldcraftLessons.map(lesson => {
        const done = approvedCodes.has(lesson.LessonCode);
        const pending = pendingCodes.has(lesson.LessonCode);
        return (
          <Row
            key={lesson.LessonCode}
            done={done}
            label={`${reqs.extraStarLevel} Fieldcraft — ${lesson.LessonName}`}
            sub={pending && !done ? <span className="text-chart-3 font-medium">(Pending)</span> : null}
          />
        );
      })}

      {reqs.manualCriteria.map(item => (
        <div key={item} className="flex items-center gap-2 text-xs">
          <HelpCircle className="w-3.5 h-3.5 text-chart-3 shrink-0" />
          <span className="text-muted-foreground">{item} (manual sign-off required)</span>
        </div>
      ))}
    </div>
  );
}