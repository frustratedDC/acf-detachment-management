import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAvailability } from '@/lib/useAvailability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, CalendarDays, ChevronDown, ChevronRight, Clock, CheckCircle2, FileEdit, Lock, Save, X } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isAfter, isWithinInterval } from 'date-fns';
import _ from 'lodash';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isCadet, isAdultInstructor } from '@/lib/accessLevels';
import ConflictSidebar from './ConflictSidebar';
import MarkCompleteButton from './MarkCompleteButton';
import LessonSelector from '@/components/shared/LessonSelector';

const STAR_LEVELS = ['Admin', 'Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

const STAR_COLORS = {
  'Admin':  'bg-slate-50 border-slate-200',
  'Basic':  'bg-emerald-50 border-emerald-200',
  '1 Star': 'bg-blue-50 border-blue-200',
  '2 Star': 'bg-purple-50 border-purple-200',
  '3 Star': 'bg-orange-50 border-orange-200',
  '4 Star': 'bg-red-50 border-red-200',
};

const SECTIONS = [
  { key: 'current', label: 'Current',   icon: Clock,        badgeClass: 'bg-primary text-primary-foreground',   headerClass: 'border-primary/30 bg-primary/5'  },
  { key: 'draft',   label: 'Draft',     icon: FileEdit,     badgeClass: 'bg-accent text-accent-foreground',     headerClass: 'border-accent/30 bg-accent/5'    },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, badgeClass: 'bg-muted text-muted-foreground',     headerClass: 'border-border bg-muted/20'       },
];

// ─── Night card ───────────────────────────────────────────────────────────────
function NightCard({ date, entries, canEdit, onEdit, onDelete, personnelMap, availability, isLocked, myPNumber, accessLevel, dayNotes }) {
  const byStarLevel = _.groupBy(entries, 'AssignedStarLevel');
  const isUserCadet = isCadet(accessLevel);
  const isUserInstructor = isAdultInstructor(accessLevel) && accessLevel < ACCESS_LEVELS.DET_2IC;
  const isDCOrAbove = accessLevel >= ACCESS_LEVELS.DET_2IC;
  const queryClient = useQueryClient();
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editLessonCode, setEditLessonCode] = useState('');

  const { data: allLessons = [] } = useQuery({
    queryKey: ['all-syllabus'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
    enabled: isDCOrAbove && !isLocked,
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ entry, lessonCode }) => {
      const lesson = allLessons.find(l => l.LessonCode === lessonCode);
      await base44.entities.NightlySchedule.update(entry.id, {
        LessonCode: lessonCode,
        LessonName: lesson?.LessonName || lessonCode,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-all'] });
      toast.success('Lesson updated');
      setEditingEntryId(null);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId) => base44.entities.NightlySchedule.delete(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-all'] });
      toast.success('Lesson removed');
    },
  });

  function startEdit(entry) {
    setEditingEntryId(entry.id);
    setEditLessonCode(entry.LessonCode || '');
  }

  function instructorLabel(pnum) {
    if (!pnum) return null;
    const p = personnelMap[pnum];
    return p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pnum;
  }

  function instructorConflict(pnum) {
    const avail = availability.find(a => a.Date === date && a.InstructorPNumber === pnum);
    return avail?.Status === 'Unavailable';
  }

  // Role-filtered star levels
  let visibleStars = STAR_LEVELS.filter(sl => (byStarLevel[sl] || []).length > 0);

  if (isUserInstructor) {
    // Instructors only see their own assigned sessions
    visibleStars = visibleStars.filter(sl =>
      (byStarLevel[sl] || []).some(e => e.InstructorPNumber === myPNumber || e.Instructor2PNumber === myPNumber)
    );
  }
  // Cadets see all star levels but only lesson names, no instructor details

  if (visibleStars.length === 0 && !isDCOrAbove) return null;

  return (
    <Card className={`border-border/50 ${isLocked ? 'opacity-90' : ''}`}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent" />
          {format(parseISO(date), 'EEEE, d MMMM yyyy')}
          {isLocked && <Badge variant="outline" className="text-xs border-primary/30 text-primary gap-1"><Lock className="w-3 h-3" />Locked</Badge>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {isDCOrAbove && !isLocked && (
            <MarkCompleteButton date={date} scheduleEntries={entries} accessLevel={accessLevel} />
          )}
          {canEdit && !isLocked && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEdit(date)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(date)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {dayNotes && (
          <div className="mb-3 p-2 rounded-lg bg-accent/10 border border-accent/20 text-xs text-foreground italic">
            {dayNotes}
          </div>
        )}
        {visibleStars.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No lessons recorded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleStars.map(star => {
              const starEntries = (byStarLevel[star] || []).sort((a, b) => a.Period - b.Period);
              return (
                <div key={star} className={`rounded-lg border p-2.5 ${STAR_COLORS[star] || ''}`}>
                  <Badge variant="outline" className="mb-2 text-xs font-bold">{star}</Badge>
                  <div className="space-y-2">
                    {starEntries.map(entry => {
                      const inst1 = instructorLabel(entry.InstructorPNumber);
                      const inst2 = instructorLabel(entry.Instructor2PNumber);
                      const conflict1 = entry.InstructorPNumber && instructorConflict(entry.InstructorPNumber);
                      const conflict2 = entry.Instructor2PNumber && instructorConflict(entry.Instructor2PNumber);
                      const hasConflict = conflict1 || conflict2;

                      const isEditingEntry = editingEntryId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={`p-2 rounded border text-xs transition-colors ${
                            hasConflict && isDCOrAbove
                              ? 'bg-destructive/10 border-destructive/40'
                              : 'bg-white/70 border-black/5'
                          }`}
                        >
                          {isEditingEntry ? (
                            <div className="space-y-1.5">
                              <LessonSelector
                                value={editLessonCode}
                                onChange={setEditLessonCode}
                                starLevel={star}
                                className="h-7 text-xs"
                              />
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost" size="sm" className="h-6 px-2"
                                  onClick={() => setEditingEntryId(null)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm" className="h-6 px-2"
                                  disabled={updateEntryMutation.isPending || !editLessonCode}
                                  onClick={() => updateEntryMutation.mutate({ entry, lessonCode: editLessonCode })}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-bold text-muted-foreground">P{entry.Period}</span>
                            <span className="font-semibold text-foreground truncate">{entry.LessonName || entry.LessonCode}</span>
                            {entry.LessonCode && !isUserCadet && (
                              <span className="text-muted-foreground font-mono shrink-0">({entry.LessonCode})</span>
                            )}
                            {isDCOrAbove && !isLocked && (
                              <span className="ml-auto flex items-center gap-0.5 shrink-0">
                                <button
                                  className="p-0.5 rounded hover:bg-black/5 text-muted-foreground"
                                  onClick={() => startEdit(entry)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-0.5 rounded hover:bg-destructive/10 text-destructive"
                                  onClick={() => deleteEntryMutation.mutate(entry.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          )}
                          {!isEditingEntry && !isUserCadet && (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
                              {inst1 && (
                                <span className={conflict1 && isDCOrAbove ? 'text-destructive font-medium' : ''}>
                                  👤 {inst1}{conflict1 && isDCOrAbove ? ' ⚠' : ''}{inst2 ? ` + ${inst2}${conflict2 && isDCOrAbove ? ' ⚠' : ''}` : ''}
                                </span>
                              )}
                              {entry.Location && <span>📍 {entry.Location}</span>}
                              {entry.DressCode && <span>👕 {entry.DressCode}</span>}
                            </div>
                          )}
                          {entry.Notes && !isUserCadet && (
                            <p className="mt-1 text-muted-foreground italic truncate">{entry.Notes}</p>
                          )}
                          {hasConflict && isDCOrAbove && (
                            <Badge variant="destructive" className="text-xs mt-1">Availability Conflict</Badge>
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
}

// ─── Month block ──────────────────────────────────────────────────────────────
function MonthBlock({ monthKey, dates, groupedByDate, canEdit, onEdit, onDelete, personnelMap, availability, lockedMonths, myPNumber, accessLevel, eventsByDate }) {
  const [collapsed, setCollapsed] = useState(false);
  const monthStr = dates[0]?.slice(0, 7);
  const isLocked = lockedMonths.has(monthStr);

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
          {isLocked && <Badge variant="outline" className="text-xs border-primary/40 text-primary gap-1"><Lock className="w-3 h-3" />Locked</Badge>}
        </div>
      </button>

      {!collapsed && (
        <div className="space-y-3 p-3">
          {dates.map(date => (
            <NightCard
              key={date}
              date={date}
              entries={groupedByDate[date]}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
              personnelMap={personnelMap}
              availability={availability}
              isLocked={isLocked}
              myPNumber={myPNumber}
              accessLevel={accessLevel}
              dayNotes={eventsByDate[date]?.Notes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ScheduleView({ schedule, isLoading, canEdit, onEdit, onDelete, trainingMonths = [], myPNumber, accessLevel = 0 }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({ completed: true });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: trainingNightEvents = [] } = useQuery({
    queryKey: ['calendar-events-training-nights'],
    queryFn: () => base44.entities.CalendarEvent.filter({ IsTrainingNight: true }),
  });

  const { availability } = useAvailability();

  const personnelMap = useMemo(() => {
    const m = {}; allPersonnel.forEach(p => { m[p.PNumber] = p; }); return m;
  }, [allPersonnel]);

  const eventsByDate = useMemo(() => {
    const m = {}; trainingNightEvents.forEach(ev => { m[ev.Date] = ev; }); return m;
  }, [trainingNightEvents]);

  // Build set of locked month strings (YYYY-MM)
  const lockedMonths = useMemo(() => {
    const s = new Set();
    trainingMonths.forEach(m => { if (m.IsLocked && m.MonthDate) s.add(m.MonthDate.slice(0, 7)); });
    return s;
  }, [trainingMonths]);

  const today = new Date();
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);

  const groupedByDate = useMemo(() => _.groupBy(schedule, 'Date'), [schedule]);

  const { currentDates, draftDates, completedDates } = useMemo(() => {
    const allDates = Object.keys(groupedByDate).sort();
    const current = [], draft = [], completed = [];
    allDates.forEach(dateStr => {
      const d = parseISO(dateStr);
      if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) current.push(dateStr);
      else if (isAfter(d, thisMonthEnd)) draft.push(dateStr);
      else completed.push(dateStr);
    });
    return { currentDates: current, draftDates: draft, completedDates: completed };
  }, [groupedByDate, thisMonthStart, thisMonthEnd]);

  function groupByMonth(dates) {
    const months = {};
    dates.forEach(date => {
      const key = format(parseISO(date), 'MMMM yyyy');
      if (!months[key]) months[key] = [];
      months[key].push(date);
    });
    return months;
  }

  const sections = [
    { ...SECTIONS[0], datesByMonth: groupByMonth(currentDates),   totalNights: currentDates.length   },
    { ...SECTIONS[1], datesByMonth: groupByMonth(draftDates),     totalNights: draftDates.length     },
    { ...SECTIONS[2], datesByMonth: groupByMonth(completedDates), totalNights: completedDates.length },
  ];

  function toggleSection(key) {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const isDCOrAbove = accessLevel >= ACCESS_LEVELS.DET_2IC;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>
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
    <div className="flex gap-4 items-start">
      {/* Main plan grid */}
      <div className="flex-1 min-w-0 space-y-4">
        {sections.map(section => {
          const { key, label, icon: Icon, badgeClass, headerClass, datesByMonth, totalNights } = section;
          const isCollapsed = !!collapsedSections[key];
          if (totalNights === 0) return null;

          return (
            <div key={key} className={`rounded-xl border-2 overflow-hidden ${headerClass}`}>
              <button
                className={`w-full flex items-center justify-between px-4 py-3 hover:opacity-90 transition-opacity text-left ${headerClass}`}
                onClick={() => toggleSection(key)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <Icon className="w-4 h-4" />
                  <span className="font-bold text-sm">{label}</span>
                  <Badge className={`text-xs ${badgeClass}`}>
                    {totalNights} night{totalNights !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-3 space-y-3 bg-background">
                  {Object.entries(datesByMonth).map(([monthKey, dates]) => (
                    <MonthBlock
                      key={monthKey}
                      monthKey={monthKey}
                      dates={dates}
                      groupedByDate={groupedByDate}
                      canEdit={canEdit}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      personnelMap={personnelMap}
                      availability={availability}
                      lockedMonths={lockedMonths}
                      myPNumber={myPNumber}
                      accessLevel={accessLevel}
                      eventsByDate={eventsByDate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resource / Conflict sidebar — DC/2IC+ only */}
      {isDCOrAbove && (
        <ConflictSidebar
          schedule={schedule}
          availability={availability}
          personnelMap={personnelMap}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
        />
      )}
    </div>
  );
}