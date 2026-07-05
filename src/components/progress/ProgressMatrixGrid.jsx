import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

// Data-driven grid: rows = cadets, columns = mandatory lessons for the star level.
// Sticky first column keeps the cadet name visible while scrolling horizontally on mobile.
export default function ProgressMatrixGrid({ lessons, cadets }) {
  if (lessons.length === 0) {
    return <p className="text-xs text-muted-foreground p-3">No lessons to display for this group.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="text-xs w-full border-collapse min-w-max">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-10 text-left p-2 border-b border-r min-w-[130px]">Cadet</th>
            {lessons.map(l => (
              <th key={l.LessonCode} className="p-1.5 border-b text-center align-bottom" title={`${l.LessonCode} — ${l.LessonName}`}>
                <span className="block font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.LessonCode}</span>
              </th>
            ))}
            <th className="p-2 border-b text-center min-w-[56px]">%</th>
          </tr>
        </thead>
        <tbody>
          {cadets.map(({ cadet, completedCodes, pct }) => (
            <tr key={cadet.PNumber} className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card z-10 p-2 border-r border-b font-medium whitespace-nowrap">{cadet.Surname}</td>
              {lessons.map(l => (
                <td key={l.LessonCode} className="text-center p-1.5 border-b">
                  {completedCodes.has(l.LessonCode)
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 mx-auto" />
                    : <Circle className="w-3 h-3 text-muted-foreground/25 mx-auto" />}
                </td>
              ))}
              <td className="text-center p-1.5 border-b font-semibold">{pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}