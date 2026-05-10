import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import _ from 'lodash';

export default function ScheduleView({ schedule, isLoading, canEdit, onEdit, onDelete }) {
  const groupedByDate = _.groupBy(schedule, 'Date');
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">No training nights scheduled yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sortedDates.map(date => {
        const entries = groupedByDate[date];
        const byStarLevel = _.groupBy(entries, 'AssignedStarLevel');
        return (
          <Card key={date}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                {format(new Date(date + 'T00:00:00'), 'EEEE, d MMMM yyyy')}
              </CardTitle>
              {canEdit && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(date)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(date)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Basic', '1 Star', '2 Star'].map(star => {
                  const starEntries = byStarLevel[star] || [];
                  return (
                    <div key={star} className="space-y-2">
                      <Badge variant="outline" className="mb-1">{star}</Badge>
                      {starEntries.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No lessons</p>
                      ) : (
                        starEntries.sort((a, b) => a.Period - b.Period).map(entry => (
                          <div key={entry.id} className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-muted-foreground">P{entry.Period}</span>
                              <span className="text-sm font-semibold">{entry.LessonName || entry.LessonCode}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {[entry.InstructorPNumber, entry.DressCode, entry.Location].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}