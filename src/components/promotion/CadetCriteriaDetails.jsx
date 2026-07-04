import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export default function CadetCriteriaDetails({ cadet, syllabus, approvedCodes, pendingCodes }) {
  const levelLessons = syllabus.filter(l => l.StarLevel === cadet.CurrentStarLevel && l.IsMandatory);

  if (levelLessons.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No mandatory lessons found for this star level.</p>;
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Criteria Breakdown</p>
      {levelLessons.map(lesson => {
        const done = approvedCodes.has(lesson.LessonCode);
        const pending = pendingCodes.has(lesson.LessonCode);
        return (
          <div key={lesson.LessonCode} className="flex items-center gap-2 text-xs">
            {done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={done ? 'text-foreground' : 'text-muted-foreground'}>
              {lesson.SubjectName} — {lesson.LessonName}
            </span>
            {pending && !done && (
              <span className="text-chart-3 font-medium">(Pending)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}