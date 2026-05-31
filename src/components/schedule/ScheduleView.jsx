import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import _ from 'lodash';

export default function ScheduleView({ schedule, isLoading, canEdit, onEdit, onDelete }) {
  const groupedByDate = _.groupBy(schedule, 'Date');
  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  // Group dates by month
  const byMonth = useMemo(() => {
    const months = {};
    sortedDates.forEach(date => {
      const key = format(parseISO(date), 'MMMM yyyy');
      if (!months[key]) months[key] = [];
      months[key].push(date);
    });
    return months;
  }, [sortedDates]);

  const monthKeys = Object.keys(byMonth);

  // Default: current month expanded, rest collapsed
  const currentMonthKey = format(new Date(), 'MMMM yyyy');
  const [collapsedMonths, setCollapsedMonths] = useState(() => {
    const init = {};
    monthKeys.forEach(m => { if (m !== currentMonthKey) init[m] = true; });
    return init;
  });

  function toggleMonth(key) {
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  }

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
    <div className="space-y-3">
      {monthKeys.map(monthKey => {
        const isCollapsed = !!collapsedMonths[monthKey];
        const dates = byMonth[monthKey];
        return (
          <div key={monthKey} className="border rounded-xl overflow-hidden">
            {/* Month header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              onClick={() => toggleMonth(monthKey)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="font-semibold text-sm">{monthKey}</span>
                <Badge variant="secondary" className="text-xs">{dates.length} night{dates.length !== 1 ? 's' : ''}</Badge>
              </div>
            </button>

            {!isCollapsed && (
              <div className="space-y-3 p-3">
                {dates.map(date => {
                  const entries = groupedByDate[date];
                  const byStarLevel = _.groupBy(entries, 'AssignedStarLevel');
                  return (
                    <Card key={date} className="border-border/50">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-accent" />
                          {format(parseISO(date), 'EEEE, d MMMM yyyy')}
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
            )}
          </div>
        );
      })}
    </div>
  );
}