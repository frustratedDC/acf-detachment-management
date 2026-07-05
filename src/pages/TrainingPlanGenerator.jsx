import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Wand2, ChevronDown, ChevronRight, Info, Lock, LockOpen, Archive, AlertTriangle, CalendarCheck2 } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isAdultInstructor } from '@/lib/accessLevels';
import { sortLessons } from '@/lib/lessonSort';

const STAR_LEVELS = ['Admin', 'Basic', '1 Star', '2 Star', '3 Star', '4 Star'];
const STAR_COLORS = {
  'Admin': 'bg-slate-500 text-white',
  'Basic': 'bg-emerald-900 text-white',
  '1 Star': 'bg-emerald-600 text-white',
  '2 Star': 'bg-blue-500 text-white',
  '3 Star': 'bg-orange-500 text-white',
  '4 Star': 'bg-red-500 text-white',
};

function generatePlan(trainingNights, lessonsByLevel) {
  const cursors = {};
  Object.keys(lessonsByLevel).forEach(sl => { cursors[sl] = 0; });

  return trainingNights.map(night => {
    const plans = [];
    const activeLevels = Object.keys(lessonsByLevel).filter(sl => lessonsByLevel[sl].length > 0);
    for (const sl of activeLevels) {
      const lessons = lessonsByLevel[sl];
      for (let period = 1; period <= 2; period++) {
        const idx = cursors[sl] % lessons.length;
        plans.push({ starLevel: sl, period, lesson: lessons[idx], cycleNum: Math.floor(cursors[sl] / lessons.length) + 1 });
        cursors[sl]++;
      }
    }
    return { date: night.Date, title: night.Title, plans };
  });
}

export default function TrainingPlanGenerator() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const [startMonth, setStartMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [duration, setDuration] = useState('3');
  const [selectedLevels, setSelectedLevels] = useState(['Basic', '1 Star', '2 Star']);
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedArchive, setExpandedArchive] = useState(false);
  const [verifyAvailability, setVerifyAvailability] = useState(false);

  const isInstructor = isAdultInstructor(me?.AccessLevel ?? 0);

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  const { data: trainingMonths = [] } = useQuery({
    queryKey: ['training-months'],
    queryFn: () => base44.entities.TrainingMonth.list(),
  });

  const { data: staffAvailability = [] } = useQuery({
    queryKey: ['staff-availability-all'],
    queryFn: () => base44.entities.StaffAvailability.filter({}),
    enabled: verifyAvailability,
  });

  const applyToScheduleMutation = useMutation({
    mutationFn: async () => {
      const records = plan.flatMap(night => night.plans.map(p => ({
        Date: night.date,
        Period: p.period,
        LessonCode: p.lesson.LessonCode,
        LessonName: p.lesson.LessonName,
        AssignedStarLevel: p.starLevel,
      })));
      return base44.entities.NightlySchedule.bulkCreate(records);
    },
    onSuccess: (res) => {
      toast.success(`Applied ${res?.length || 0} lessons to the Training Schedule`);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (monthId, isLocked) => {
      await base44.entities.TrainingMonth.update(monthId, { IsLocked: !isLocked });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-months'] });
      toast.success('Month lock status updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const startDate = format(startOfMonth(parseISO(startMonth + '-01')), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(addMonths(parseISO(startMonth + '-01'), parseInt(duration) - 1)), 'yyyy-MM-dd');

  const currentMonthStr = format(new Date(), 'yyyy-MM');

  const trainingNights = useMemo(() =>
    calendarEvents
      .filter(ev => ev.IsTrainingNight && ev.Date >= startDate && ev.Date <= endDate)
      .sort((a, b) => a.Date.localeCompare(b.Date)),
    [calendarEvents, startDate, endDate]
  );

  const monthsMap = useMemo(() => {
    const map = {};
    trainingMonths.forEach(m => {
      const monthStr = m.MonthDate.substring(0, 7); // YYYY-MM
      map[monthStr] = m;
    });
    return map;
  }, [trainingMonths]);

  // Helper to determine if cadet can see this month
  function canSeeMonth(monthStr) {
    if (isInstructor) return true; // Instructors see all
    const monthData = monthsMap[monthStr];
    if (!monthData) return true; // If no TrainingMonth record, default to visible
    return monthData.IsLocked === false && monthData.IsArchived === false;
  }

  const lessonsByLevel = useMemo(() => {
    const byLevel = {};
    selectedLevels.forEach(sl => {
      const all = syllabus.filter(l => l.StarLevel === sl && l.LessonType !== 'Auto-Assessment' && (!mandatoryOnly || l.IsMandatory));
      const mandatory = sortLessons(all.filter(l => l.IsMandatory));
      const optional = sortLessons(all.filter(l => !l.IsMandatory));
      byLevel[sl] = [...mandatory, ...optional];
    });
    return byLevel;
  }, [syllabus, selectedLevels, mandatoryOnly]);

  const plan = useMemo(() => {
    if (!generated) return [];
    return generatePlan(trainingNights, lessonsByLevel);
  }, [generated, trainingNights, lessonsByLevel]);

  // Group plan by month for overview (must be computed before monthsByType uses it)
  const planByMonth = useMemo(() => {
    const months = {};
    plan.forEach(night => {
      const m = format(parseISO(night.date), 'MMMM yyyy');
      if (!months[m]) months[m] = [];
      months[m].push(night);
    });
    return months;
  }, [plan]);

  // Split months into current/upcoming and archived
  const monthsByType = useMemo(() => {
    if (!generated) return { current: {}, archived: {} };
    const current = {}, archived = {};
    Object.entries(planByMonth).forEach(([month, nights]) => {
      const monthStr = nights[0] ? format(parseISO(nights[0].date), 'yyyy-MM') : null;
      if (!monthStr) return;
      const monthData = monthsMap[monthStr];
      if (monthData?.IsArchived) {
        archived[month] = nights;
      } else {
        current[month] = nights;
      }
    });
    return { current, archived };
  }, [generated, planByMonth, monthsMap]);

  function toggleLevel(sl) {
    setSelectedLevels(prev => prev.includes(sl) ? prev.filter(l => l !== sl) : [...prev, sl]);
    setGenerated(false);
  }

  const availableCountByDate = useMemo(() => {
    const map = {};
    staffAvailability.forEach(a => {
      if (a.IsAvailable) map[a.EventDate] = (map[a.EventDate] || 0) + 1;
    });
    return map;
  }, [staffAvailability]);

  const totalLessons = Object.values(lessonsByLevel).reduce((s, l) => s + l.length, 0);
  const cycleNights = selectedLevels.length > 0 ? Math.ceil(Math.max(...selectedLevels.map(sl => (lessonsByLevel[sl]?.length || 0))) / 2) : 0;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Training Plan Generator"
        description="Generate a structured 3, 6 or 12 month training overview"
        icon={Wand2}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Config panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" />Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Start Month</Label>
              <Input type="month" value={startMonth} onChange={e => { setStartMonth(e.target.value); setGenerated(false); }} className="mt-1" />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={duration} onValueChange={v => { setDuration(v); setGenerated(false); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Month</SelectItem>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Star Levels</Label>
              <div className="space-y-2">
                {STAR_LEVELS.map(sl => (
                  <label key={sl} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={selectedLevels.includes(sl)} onCheckedChange={() => toggleLevel(sl)} />
                    <span className="text-sm">{sl}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1 border-t">
              <Checkbox checked={mandatoryOnly} onCheckedChange={v => { setMandatoryOnly(v); setGenerated(false); }} />
              <span className="text-sm">Mandatory lessons only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={verifyAvailability} onCheckedChange={setVerifyAvailability} />
              <span className="text-sm">Verify instructor availability</span>
            </label>
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p>{trainingNights.length} training nights in period</p>
              <p>{totalLessons} lessons per full cycle</p>
              {cycleNights > 0 && <p className="font-medium text-primary">{cycleNights} nights to complete one full cycle</p>}
              {trainingNights.length === 0 && (
                <p className="text-destructive flex items-center gap-1">
                  <Info className="w-3 h-3" />No training nights — add them in the Calendar first.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => { setGenerated(true); const all = {}; trainingNights.forEach(n => { all[n.Date] = true; }); setExpandedDates(all); }}
              disabled={selectedLevels.length === 0 || trainingNights.length === 0}
            >
              <Wand2 className="w-4 h-4 mr-2" />Generate Plan
            </Button>
          </CardContent>
        </Card>

        {/* Plan output */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between gap-2 flex-wrap space-y-0">
            <CardTitle className="text-sm">
              {generated
                ? `Overview — ${format(parseISO(startDate), 'MMM yyyy')} to ${format(parseISO(endDate), 'MMM yyyy')} (${plan.length} nights)`
                : 'Generated Plan'}
            </CardTitle>
            {generated && plan.length > 0 && isInstructor && (
              <Button
                size="sm"
                onClick={() => applyToScheduleMutation.mutate()}
                disabled={applyToScheduleMutation.isPending}
              >
                <CalendarCheck2 className="w-4 h-4 mr-2" />
                {applyToScheduleMutation.isPending ? 'Applying…' : 'Apply to Schedule'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!generated && (
              <div className="text-center py-16 text-muted-foreground">
                <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Configure options and click Generate Plan.</p>
              </div>
            )}
            {generated && plan.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No training nights found. Add Training Night events in the Training Calendar first.</p>
            )}
            {generated && plan.length > 0 && (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {/* Current/Upcoming Section */}
                {Object.entries(monthsByType.current).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider px-1">Current / Upcoming</h3>
                    {Object.entries(monthsByType.current)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([month, nights]) => {
                        const monthStr = format(parseISO(nights[0].date), 'yyyy-MM');
                        const monthData = monthsMap[monthStr];
                        const isCurrentMonth = monthStr === currentMonthStr;
                        const canView = canSeeMonth(monthStr);

                        return (
                          <div key={month}>
                            <div className="flex items-center gap-2 px-1 mb-1">
                              {isCurrentMonth && <Badge className="text-xs py-0 h-4 bg-accent text-accent-foreground">THIS MONTH</Badge>}
                              <p className={`text-xs font-bold ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'} uppercase tracking-wider`}>{month}</p>
                              {monthData?.IsLocked && (
                                <Lock className="w-3 h-3 text-destructive" title="Month locked for cadets" />
                              )}
                              {isInstructor && monthData && (
                                <button
                                  onClick={() => toggleLockMutation.mutate(monthData.id, monthData.IsLocked)}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  title={monthData.IsLocked ? 'Unlock month' : 'Lock month for cadets'}
                                >
                                  {monthData.IsLocked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                            {!canView ? (
                              <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30 italic">Month locked for your view</div>
                            ) : (
                              <div className="space-y-1.5">
                                {nights.map(night => {
                                  const expanded = expandedDates[night.date];
                                  return (
                                    <div key={night.date} className="border rounded-lg overflow-hidden">
                                      <button
                                        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                                        onClick={() => setExpandedDates(prev => ({ ...prev, [night.date]: !prev[night.date] }))}
                                      >
                                        <div className="flex items-center gap-2">
                                          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                          <span className="text-sm font-semibold">{format(parseISO(night.date), 'EEE dd MMM yyyy')}</span>
                                        </div>
                                        <div className="flex gap-1 flex-wrap items-center">
                                          {verifyAvailability && !availableCountByDate[night.date] && (
                                            <Badge variant="outline" className="text-xs py-0 h-5 border-destructive/50 text-destructive gap-1">
                                              <AlertTriangle className="w-3 h-3" />No availability logged
                                            </Badge>
                                          )}
                                          {selectedLevels.filter(sl => night.plans.some(p => p.starLevel === sl)).map(sl => (
                                            <Badge key={sl} className={`text-xs py-0 h-5 ${STAR_COLORS[sl]}`}>{sl}</Badge>
                                          ))}
                                        </div>
                                      </button>
                                      {expanded && (
                                        <div className="divide-y">
                                          {night.plans.map((p, idx) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20">
                                              <span className="text-muted-foreground w-5 shrink-0">P{p.period}</span>
                                              <Badge className={`text-xs py-0 h-4 shrink-0 ${STAR_COLORS[p.starLevel]}`}>{p.starLevel}</Badge>
                                              <span className="font-mono text-muted-foreground shrink-0 w-20">{p.lesson.LessonCode}</span>
                                              <span className="flex-1 truncate">{p.lesson.LessonName}</span>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {p.lesson.IsMandatory && <Badge variant="outline" className="text-xs py-0 h-4 border-destructive/40 text-destructive">M</Badge>}
                                                {p.cycleNum > 1 && <Badge variant="secondary" className="text-xs py-0 h-4">Cycle {p.cycleNum}</Badge>}
                                                <span className="text-muted-foreground text-xs">{p.lesson.SubjectName}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Archive Section (instructors only) */}
                {isInstructor && Object.entries(monthsByType.archived).length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <button
                      onClick={() => setExpandedArchive(!expandedArchive)}
                      className="flex items-center gap-2 px-1 mb-2 hover:text-primary transition-colors"
                    >
                      {expandedArchive ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Archive ({Object.keys(monthsByType.archived).length})</h3>
                    </button>
                    {expandedArchive && (
                      <div className="space-y-2">
                        {Object.entries(monthsByType.archived).map(([month, nights]) => (
                          <div key={month}>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">{month}</p>
                            <div className="space-y-1.5 opacity-60">
                              {nights.map(night => {
                                const expanded = expandedDates[night.date];
                                return (
                                  <div key={night.date} className="border rounded-lg overflow-hidden">
                                    <button
                                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                                      onClick={() => setExpandedDates(prev => ({ ...prev, [night.date]: !prev[night.date] }))}
                                    >
                                      <div className="flex items-center gap-2">
                                        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                        <span className="text-sm font-semibold">{format(parseISO(night.date), 'EEE dd MMM yyyy')}</span>
                                      </div>
                                      <div className="flex gap-1 flex-wrap">
                                        {selectedLevels.filter(sl => night.plans.some(p => p.starLevel === sl)).map(sl => (
                                          <Badge key={sl} className={`text-xs py-0 h-5 ${STAR_COLORS[sl]}`}>{sl}</Badge>
                                        ))}
                                      </div>
                                    </button>
                                    {expanded && (
                                      <div className="divide-y">
                                        {night.plans.map((p, idx) => (
                                          <div key={idx} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/20">
                                            <span className="text-muted-foreground w-5 shrink-0">P{p.period}</span>
                                            <Badge className={`text-xs py-0 h-4 shrink-0 ${STAR_COLORS[p.starLevel]}`}>{p.starLevel}</Badge>
                                            <span className="font-mono text-muted-foreground shrink-0 w-20">{p.lesson.LessonCode}</span>
                                            <span className="flex-1 truncate">{p.lesson.LessonName}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {p.lesson.IsMandatory && <Badge variant="outline" className="text-xs py-0 h-4 border-destructive/40 text-destructive">M</Badge>}
                                              {p.cycleNum > 1 && <Badge variant="secondary" className="text-xs py-0 h-4">Cycle {p.cycleNum}</Badge>}
                                              <span className="text-muted-foreground text-xs">{p.lesson.SubjectName}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}