import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, CalendarDays, ChevronDown, ChevronRight, Clock, CheckCircle2, FileEdit } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter, isWithinInterval } from 'date-fns';
import _ from 'lodash';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

const STAR_COLORS = {
  'Basic':  'bg-emerald-50 border-emerald-200',
  '1 Star': 'bg-blue-50 border-blue-200',
  '2 Star': 'bg-purple-50 border-purple-200',
  '3 Star': 'bg-orange-50 border-orange-200',
  '4 Star': 'bg-red-50 border-red-200',
};

const SECTIONS = [
  {
    key: 'current',
    label: 'Current',
    icon: Clock,
    badgeClass: 'bg-primary text-primary-foreground',
    headerClass: 'bg-primary/10 border-primary/20',
    description: 'This month',
  },
  {
    key: 'draft',
    label: 'Draft',
    icon: FileEdit,
    badgeClass: 'bg-accent text-accent-foreground',
    headerClass: 'bg-accent/10 border-accent/20',
    description: 'Upcoming months',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-muted text-muted-foreground',
    headerClass: 'bg-muted/40 border-border',
    description: 'Past months',
  },
];

function MonthBlock({ monthKey, dates, groupedByDate, canEdit, onEdit, onDelete, personnelMap }) {
  const [collapsed, setCollapsed] = useState(false);

  function instructorLabel(pnum) {
    if (!pnum) return null;
    const p = personnelMap[pnum];
    return p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pnum;
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setCollapsed(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="font-semibold text-sm">{monthKey}</span>
          <Badge variant="secondary" className="text-xs">{dates.length} night{dates.length !== 1 ? 's' : ''}</Badge>
        </div>
      </button>

      {!collapsed && (
        <div className="space-y-3 p-3">
          {dates.map(date => {
            const entries = groupedByDate[date];
            const byStarLevel = _.groupBy(entries, 'AssignedStarLevel');
            const presentStars = STAR_LEVELS.filter(sl => (byStarLevel[sl] || []).length > 0);

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
                  {presentStars.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No lessons recorded.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {presentStars.map(star => {
                        const starEntries = (byStarLevel[star] || []).sort((a, b) => a.Period - b.Period);
                        return (
                          <div key={star} className={`rounded-lg border p-2.5 ${STAR_COLORS[star] || ''}`}>
                            <Badge variant="outline" className="mb-2 text-xs font-bold">{star}</Badge>
                            <div className="space-y-2">
                              {starEntries.map(entry => {
                                const inst1 = instructorLabel(entry.InstructorPNumber);
                                const inst2 = instructorLabel(entry.Instructor2PNumber);
                                return (
                                  <div key={entry.id} className="p-2 rounded bg-white/70 border border-black/5 text-xs">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="font-bold text-muted-foreground">P{entry.Period}</span>
                                      <span className="font-semibold text-foreground truncate">{entry.LessonName || entry.LessonCode}</span>
                                      {entry.LessonCode && <span className="text-muted-foreground font-mono shrink-0">({entry.LessonCode})</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
                                      {inst1 && <span>👤 {inst1}{inst2 ? ` + ${inst2}` : ''}</span>}
                                      {entry.Location && <span>📍 {entry.Location}</span>}
                                      {entry.DressCode && <span>👕 {entry.DressCode}</span>}
                                    </div>
                                    {entry.Notes && (
                                      <p className="mt-1 text-muted-foreground italic truncate">{entry.Notes}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ScheduleView({ schedule, isLoading, canEdit, onEdit, onDelete }) {
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {};
    allPersonnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [allPersonnel]);

  const today = new Date();
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);

  // Group all schedule entries by date, then categorise each unique date
  const groupedByDate = useMemo(() => _.groupBy(schedule, 'Date'), [schedule]);

  const { currentDates, draftDates, completedDates } = useMemo(() => {
    const allDates = Object.keys(groupedByDate).sort(); // ascending = soonest first
    const current = [];
    const draft = [];
    const completed = [];

    allDates.forEach(dateStr => {
      const d = parseISO(dateStr);
      if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) {
        current.push(dateStr);
      } else if (isAfter(d, thisMonthEnd)) {
        draft.push(dateStr);
      } else {
        completed.push(dateStr);
      }
    });

    return { currentDates: current, draftDates: draft, completedDates: completed };
  }, [groupedByDate, thisMonthStart, thisMonthEnd]);

  // Group dates into month buckets (sorted ascending within each section)
  function groupByMonth(dates) {
    const months = {};
    dates.forEach(date => {
      const key = format(parseISO(date), 'MMMM yyyy');
      if (!months[key]) months[key] = [];
      months[key].push(date);
    });
    // keys already in ascending date order because dates is sorted ascending
    return months;
  }

  const sections = [
    { ...SECTIONS[0], datesByMonth: groupByMonth(currentDates), totalNights: currentDates.length },
    { ...SECTIONS[1], datesByMonth: groupByMonth(draftDates), totalNights: draftDates.length },
    { ...SECTIONS[2], datesByMonth: groupByMonth(completedDates), totalNights: completedDates.length },
  ];

  const [collapsedSections, setCollapsedSections] = useState({ completed: true });

  function toggleSection(key) {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
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

  if (schedule.length === 0) {
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
      {sections.map(section => {
        const { key, label, icon: Icon, badgeClass, headerClass, description, datesByMonth, totalNights } = section;
        const monthKeys = Object.keys(datesByMonth);
        const isCollapsed = !!collapsedSections[key];

        if (totalNights === 0) return null;

        return (
          <div key={key} className={`rounded-xl border-2 overflow-hidden ${headerClass}`}>
            {/* Section header */}
            <button
              className={`w-full flex items-center justify-between px-4 py-3 hover:opacity-90 transition-opacity text-left ${headerClass}`}
              onClick={() => toggleSection(key)}
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
                <Badge className={`text-xs ${badgeClass}`}>
                  {totalNights} night{totalNights !== 1 ? 's' : ''}
                </Badge>
              </div>
            </button>

            {/* Month sub-groups */}
            {!isCollapsed && (
              <div className="p-3 space-y-3 bg-background">
                {monthKeys.map(monthKey => (
                  <MonthBlock
                    key={monthKey}
                    monthKey={monthKey}
                    dates={datesByMonth[monthKey]}
                    groupedByDate={groupedByDate}
                    canEdit={canEdit}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    personnelMap={personnelMap}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}