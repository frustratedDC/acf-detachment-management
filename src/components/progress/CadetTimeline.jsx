import React from 'react';
import { Check } from 'lucide-react';

export default function CadetTimeline({ lessons, completedCodes }) {
  return (
    <div className="flex items-center overflow-x-auto pb-1 gap-0">
      {lessons.map((lesson, idx) => {
        const done = completedCodes.has(lesson.LessonCode);
        return (
          <div key={lesson.LessonCode} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center w-16">
              <div
                title={lesson.LessonName}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                  done
                    ? 'bg-chart-2 border-chart-2 text-white'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className="mt-1 text-[10px] text-muted-foreground text-center leading-tight truncate w-16">
                {lesson.LessonCode}
              </span>
            </div>
            {idx < lessons.length - 1 && (
              <div className={`h-0.5 w-6 -mt-4 flex-shrink-0 ${done ? 'bg-chart-2' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}