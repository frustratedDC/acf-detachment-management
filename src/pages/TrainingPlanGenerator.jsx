import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Wand2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { format, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { sortLessons } from '@/lib/lessonSort';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];
const STAR_COLORS = {
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
  const [startMonth, setStartMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [duration, setDuration] = useState('3');
  const [selectedLevels, setSelectedLevels] = useState(['Basic', '1 Star', '2 Star']);
  const [mandatoryOnly, setMandatoryOnly] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  const startDate = format(startOfMonth(parseISO(startMonth + '-01')), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(addMonths(parseISO(startMonth + '-01'), parseInt(duration) - 1)), 'yyyy-MM-dd');

  const trainingNights = useMemo(() =>
    calendarEvents
      .filter(ev => ev.IsTrainingNight && ev.Date >= startDate && ev.Date <= endDate)
      .sort((a, b) => a.Date.localeCompare(b.Date)),
    [calendarEvents, startDate, endDate]
  );

  const lessonsByLevel = useMemo(() => {
    const byLevel = {};
    selectedLevels.forEach(sl => {
      const all = syllabus.filter(l => l.StarLevel === sl && (!mandatoryOnly || l.IsMandatory));
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

  function toggleLevel(sl) {
    setSelectedLevels(prev => prev.includes(sl) ? prev.filter(l => l !== sl) : [...prev, sl]);
    setGenerated(false);
  }

  const totalLessons = Object.values(lessonsByLevel).reduce((s, l) => s + l.length, 0);
  const cycleNights = selectedLevels.length > 0 ? Math.ceil(Math.max(...selectedLevels.map(sl => (lessonsByLevel[sl]?.length || 0))) / 2) : 0;

  // Group plan by month for overview
  const planByMonth = useMemo(() => {
    const months = {};
    plan.forEach(night => {
      const m = format(parseISO(night.date), 'MMMM yyyy');
      if (!months[m]) months[m] = [];
      months[m].push(night);
    });
    return months;
  }, [plan]);

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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {generated
                ? `Overview — ${format(parseISO(startDate), 'MMM yyyy')} to ${format(parseISO(endDate), 'MMM yyyy')} (${plan.length} nights)`
                : 'Generated Plan'}
            </CardTitle>
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
                {Object.entries(planByMonth).map(([month, nights]) => (
                  <div key={month}>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">{month}</p>
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
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}