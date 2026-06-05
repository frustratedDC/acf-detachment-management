import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, AlertTriangle, CheckCircle2, Users, Lightbulb,
  Loader2, PlusCircle, Search, TrendingUp, BookOpen, SortAsc
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';
import _ from 'lodash';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function TrainingManager() {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [filterStar, setFilterStar] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [addingLesson, setAddingLesson] = useState(null); // lessonCode being added
  const [planDate, setPlanDate] = useState(today);
  const [prioritized, setPrioritized] = useState(true); // mandatory-first toggle

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  const { data: paradeState = [] } = useQuery({
    queryKey: ['parade', today],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: today }),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const all = await base44.entities.PersonnelManager.filter({});
      return all.filter(p => p.AccessLevel >= 2 && (p.PersonnelStatus || 'Active') === 'Active');
    },
  });

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

  const approvedSet = useMemo(() =>
    new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`)),
    [progress]
  );

  // --- Cadet progression gap analysis ---
  const cadets = useMemo(() => personnel.filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'), [personnel]);

  // For each lesson in syllabus, count how many active cadets at that star level are missing it
  const lessonGaps = useMemo(() => {
    return syllabus.map(lesson => {
      const cadetsAtLevel = cadets.filter(c => c.CurrentStarLevel === lesson.StarLevel);
      const missing = cadetsAtLevel.filter(c => !approvedSet.has(`${c.PNumber}::${lesson.LessonCode}`));
      return {
        ...lesson,
        missingCount: missing.length,
        totalAtLevel: cadetsAtLevel.length,
        missingCadets: missing,
        pct: cadetsAtLevel.length > 0 ? Math.round(((cadetsAtLevel.length - missing.length) / cadetsAtLevel.length) * 100) : 100,
      };
    }).filter(l => l.missingCount > 0).sort((a, b) => b.missingCount - a.missingCount);
  }, [syllabus, cadets, approvedSet]);

  const allSubjects = useMemo(() => [...new Set(lessonGaps.map(l => l.SubjectName))].sort(), [lessonGaps]);

  const filteredGaps = useMemo(() => {
    const filtered = lessonGaps.filter(l => {
      if (filterStar !== 'all' && l.StarLevel !== filterStar) return false;
      if (filterSubject !== 'all' && l.SubjectName !== filterSubject) return false;
      if (search && !l.LessonName.toLowerCase().includes(search.toLowerCase()) &&
          !l.LessonCode.toLowerCase().includes(search.toLowerCase()) &&
          !l.SubjectName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (prioritized) {
      filtered.sort((a, b) => (b.IsMandatory ? 1 : 0) - (a.IsMandatory ? 1 : 0) || b.missingCount - a.missingCount);
    }
    return filtered;
  }, [lessonGaps, filterStar, filterSubject, search, prioritized]);

  // --- Exception monitor ---
  const presentPNumbers = new Set(paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber));
  const todaySchedule = schedule.filter(s => s.Date === today);
  const scheduledInstructors = [...new Set([
    ...todaySchedule.map(s => s.InstructorPNumber),
    ...todaySchedule.map(s => s.Instructor2PNumber)
  ].filter(Boolean))];
  const absentInstructors = scheduledInstructors.filter(ip => paradeState.some(p => p.UserPNumber === ip && p.AttendanceStatus !== 'Present'));
  const presentInstructors = instructors.filter(p => presentPNumbers.has(p.PNumber));

  // --- Add to Training Plan ---
  const addToPlanMutation = useMutation({
    mutationFn: async ({ lesson, instructorPNumber }) => {
      // Find next available period for this star level on the selected date
      const existing = schedule.filter(s => s.Date === planDate && s.AssignedStarLevel === lesson.StarLevel);
      const usedPeriods = new Set(existing.map(s => s.Period));
      const nextPeriod = [1, 2].find(p => !usedPeriods.has(p));
      if (!nextPeriod) throw new Error(`Both periods for ${lesson.StarLevel} on ${planDate} are taken.`);

      await base44.entities.NightlySchedule.create({
        Date: planDate,
        Period: nextPeriod,
        AssignedStarLevel: lesson.StarLevel,
        LessonCode: lesson.LessonCode,
        LessonName: lesson.LessonName,
        InstructorPNumber: instructorPNumber || '',
      });
      return nextPeriod;
    },
    onSuccess: (period, vars) => {
      toast.success(`Added ${vars.lesson.LessonCode} to training plan on ${planDate} (Period ${period})`);
      queryClient.invalidateQueries({ queryKey: ['schedule-all'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-date'] });
      setAddingLesson(null);
    },
    onError: (err) => toast.error(err.message),
  });

  async function getAiSuggestions() {
    setLoadingAi(true);
    const topGaps = lessonGaps.slice(0, 20);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an ACF Training Manager AI assistant. Based on cadet progression gaps, suggest training priorities.

Available instructors tonight: ${presentInstructors.map(i => `${i.Surname}`).join(', ') || 'None marked present'}

Top cadet syllabus gaps (lesson — cadets missing):
${topGaps.map(g => `${g.LessonCode} ${g.LessonName} (${g.StarLevel}): ${g.missingCount} cadets missing`).join('\n')}

Provide 3-5 prioritized recommendations for upcoming training nights. Be concise and military-style.`,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priority: { type: "number" },
                lesson: { type: "string" },
                reasoning: { type: "string" },
                suggestedInstructor: { type: "string" },
              }
            }
          }
        }
      }
    });
    setAiSuggestion(result);
    setLoadingAi(false);
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Training Manager"
        description="Cadet progression gaps and training plan builder"
        icon={Brain}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Exception Monitor */}
        <Card className="border-accent/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" />Tonight's Exceptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {absentInstructors.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-chart-2">
                <CheckCircle2 className="w-4 h-4" />All scheduled instructors present.
              </div>
            ) : (
              <div className="space-y-1">
                {absentInstructors.map(ip => (
                  <div key={ip} className="p-2 rounded bg-destructive/10 text-xs">
                    <span className="font-semibold">{personnelMap[ip]?.Surname || ip}</span> absent —{' '}
                    {todaySchedule.filter(s => s.InstructorPNumber === ip).map(s => s.LessonCode).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Present Instructors */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />Present Instructors ({presentInstructors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {presentInstructors.length === 0 && <p className="text-xs text-muted-foreground">No instructors marked present.</p>}
            {presentInstructors.map(inst => {
              const isAssigned = scheduledInstructors.includes(inst.PNumber);
              const assignedLessons = todaySchedule.filter(s => s.InstructorPNumber === inst.PNumber);
              return (
                <div key={inst.PNumber} className={`flex items-center justify-between rounded px-2 py-1 text-xs ${isAssigned ? 'bg-chart-2/10' : 'bg-destructive/10'}`}>
                  <span className="font-medium">{inst.Rank ? `${inst.Rank} ` : ''}{inst.Surname}</span>
                  {isAssigned
                    ? <span className="text-chart-2 text-xs">{assignedLessons.map(l => l.LessonCode).join(', ')}</span>
                    : <span className="text-destructive font-semibold">UNASSIGNED</span>
                  }
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-accent" />AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={getAiSuggestions} disabled={loadingAi} size="sm" className="w-full mb-2">
              {loadingAi ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
              {loadingAi ? 'Analysing...' : 'Get AI Suggestions'}
            </Button>
            {aiSuggestion?.recommendations?.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="p-2 rounded bg-muted/50 border mb-1.5 text-xs">
                <span className="font-semibold">{rec.priority}. {rec.lesson}</span>
                <p className="text-muted-foreground mt-0.5">{rec.reasoning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Progression Gap Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Cadet Progression Gaps ({filteredGaps.length} lessons need covering)
            </CardTitle>
            {/* Add to plan controls */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                size="sm"
                variant={prioritized ? "default" : "outline"}
                className="h-8 text-xs gap-1"
                onClick={() => setPrioritized(p => !p)}
              >
                <SortAsc className="w-3.5 h-3.5" />
                {prioritized ? 'Prioritized' : 'Default Sort'}
              </Button>
              <Input
                type="date"
                value={planDate}
                onChange={e => setPlanDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search lesson..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-44 text-xs" />
            </div>
            <Select value={filterStar} onValueChange={setFilterStar}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Star Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredGaps.length === 0 && (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No gaps found for current filters.</p>
              </div>
            )}
            {filteredGaps.map(lesson => {
              const isAdding = addingLesson === lesson.LessonCode;
              return (
                <div key={lesson.LessonCode} className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 border transition-colors ${lesson.IsMandatory ? 'border-l-2 border-l-destructive border-r-transparent border-t-transparent border-b-transparent hover:border-r-border hover:border-t-border hover:border-b-border bg-destructive/5' : 'border-transparent hover:border-border'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{lesson.LessonName}</span>
                      <span className="text-xs text-muted-foreground font-mono">{lesson.LessonCode}</span>
                      {lesson.IsMandatory && <Badge variant="outline" className="text-xs py-0 h-4 text-destructive border-destructive/30">Mandatory</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{lesson.StarLevel}</Badge>
                      <span className="text-xs text-muted-foreground">{lesson.SubjectName}</span>
                      <span className="text-xs font-semibold text-destructive">{lesson.missingCount}/{lesson.totalAtLevel} cadets missing</span>
                      {/* Progress bar */}
                      <div className="flex-1 max-w-[80px] bg-muted rounded-full h-1.5">
                        <div className="bg-primary rounded-full h-1.5" style={{ width: `${lesson.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{lesson.pct}%</span>
                    </div>
                  </div>

                  {/* Add to plan */}
                  {isAdding ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select onValueChange={(instructorPNumber) => addToPlanMutation.mutate({ lesson, instructorPNumber })}>
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign instructor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>No instructor</SelectItem>
                          {instructors.map(i => (
                            <SelectItem key={i.PNumber} value={i.PNumber}>
                              {i.Rank ? `${i.Rank} ` : ''}{i.Surname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setAddingLesson(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 text-xs gap-1"
                      onClick={() => setAddingLesson(lesson.LessonCode)}
                      disabled={addToPlanMutation.isPending}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />Add to Plan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </AccessGate>
  );
}