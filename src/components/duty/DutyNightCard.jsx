import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import _ from 'lodash';

export default function DutyNightCard({ date, entries, personnelMap, dutyCadets = [] }) {
  const byPeriod = _.groupBy(entries, 'Period');

  function nameFor(pnum) {
    if (!pnum) return null;
    const p = personnelMap[pnum];
    return p ? `${p.Rank ? p.Rank + ' ' : ''}${p.FirstName || ''} ${p.Surname}` : pnum;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent" />
          {format(parseISO(date), 'EEEE, d MMMM yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dutyCadets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dutyCadets.map(a => (
              <Badge key={a.id} variant="outline" className="text-xs">
                {a.Role}: {nameFor(a.CadetPNumber)}
              </Badge>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {Object.entries(byPeriod).sort(([a], [b]) => a - b).map(([period, periodEntries]) => (
            <div key={period}>
              <p className="text-xs font-bold text-muted-foreground mb-1.5">Period {period}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {periodEntries.map(entry => (
                  <div key={entry.id} className="rounded-lg border p-2.5 bg-muted/20">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{entry.AssignedStarLevel}</Badge>
                      {entry.Location && <span className="text-xs text-muted-foreground">📍 {entry.Location}</span>}
                    </div>
                    <p className="text-sm font-semibold">{entry.LessonName || entry.LessonCode}</p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {entry.InstructorPNumber && (
                        <p className="flex items-center gap-1"><User className="w-3 h-3" />Lead: {nameFor(entry.InstructorPNumber)}</p>
                      )}
                      {entry.Instructor2PNumber && (
                        <p className="flex items-center gap-1"><User className="w-3 h-3" />2nd: {nameFor(entry.Instructor2PNumber)}</p>
                      )}
                      {entry.DressCode && <p>Dress: {entry.DressCode}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}