import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, Send, Search, Star, BookOpen, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star'];

// Returns the lesson codes that will be submitted given current mode/selections
function resolveTargetLessons(mode, starLevel, subject, lessonCode, syllabus) {
  if (mode === 'star') {
    return syllabus.filter(l => l.StarLevel === starLevel);
  }
  if (mode === 'subject') {
    return syllabus.filter(l => l.StarLevel === starLevel && l.SubjectName === subject);
  }
  if (mode === 'lesson' && lessonCode) {
    return syllabus.filter(l => l.LessonCode === lessonCode);
  }
  return [];
}

export default function BulkProgressEntry() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('lesson'); // 'lesson' | 'subject' | 'star'
  const [starLevel, setStarLevel] = useState('Basic');
  const [subject, setSubject] = useState('');
  const [lessonCode, setLessonCode] = useState('');
  const [selectedCadets, setSelectedCadets] = useState([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const subjects = useMemo(() => [...new Set(syllabus.filter(l => l.StarLevel === starLevel).map(l => l.SubjectName))].sort(), [syllabus, starLevel]);
  const lessonsForSubject = useMemo(() => syllabus.filter(l => l.StarLevel === starLevel && l.SubjectName === subject), [syllabus, starLevel, subject]);
  const targetLessons = useMemo(() => resolveTargetLessons(mode, starLevel, subject, lessonCode, syllabus), [mode, starLevel, subject, lessonCode, syllabus]);

  // Cadets at this star level (active only)
  const cadets = personnel.filter(p => isCadet(p.AccessLevel) && p.CurrentStarLevel === starLevel && (p.PersonnelStatus || 'Active') === 'Active');
  const filteredCadets = cadets.filter(c =>
    c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.PNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const approvedSet = useMemo(() => new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`)), [progress]);

  // A cadet is "already done" if ALL target lessons are approved
  function isFullyDone(pNumber) {
    return targetLessons.length > 0 && targetLessons.every(l => approvedSet.has(`${pNumber}::${l.LessonCode}`));
  }

  // Count how many target lessons a cadet still needs
  function pendingCount(pNumber) {
    return targetLessons.filter(l => !approvedSet.has(`${pNumber}::${l.LessonCode}`)).length;
  }

  function toggleCadet(pnum) {
    setSelectedCadets(prev => prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]);
  }

  function toggleAll() {
    const eligible = filteredCadets.filter(c => !isFullyDone(c.PNumber));
    const allSelected = eligible.every(c => selectedCadets.includes(c.PNumber));
    setSelectedCadets(allSelected ? [] : eligible.map(c => c.PNumber));
  }

  const isReady = targetLessons.length > 0 && selectedCadets.length > 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const isAutoApproved = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;
      const records = [];
      for (const pnum of selectedCadets) {
        for (const lesson of targetLessons) {
          // Skip already approved
          if (approvedSet.has(`${pnum}::${lesson.LessonCode}`)) continue;
          records.push({
            CadetPNumber: pnum,
            LessonCode: lesson.LessonCode,
            Status: isAutoApproved ? 'Approved' : 'Pending',
            CompletionDate: date,
            InstructorPNumber: me?.PNumber,
          });
        }
      }
      if (records.length === 0) throw new Error('All selected cadets already have these lessons approved.');
      for (let i = 0; i < records.length; i += 50) {
        await base44.entities.ProgressLedger.bulkCreate(records.slice(i, i + 50));
      }
      return records.length;
    },
    onSuccess: (count) => {
      toast.success(`Submitted ${count} progress record${count !== 1 ? 's' : ''}`);
      setSelectedCadets([]);
      queryClient.invalidateQueries({ queryKey: ['progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['all-progress'] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Summary of what will be submitted
  const summaryLabel = mode === 'star'
    ? `All lessons — ${starLevel}`
    : mode === 'subject'
    ? `${subject || '—'} (${lessonsForSubject.length} lessons)`
    : lessonCode
    ? targetLessons[0] ? `${targetLessons[0].LessonCode} — ${targetLessons[0].LessonName}` : '—'
    : '—';

  function handleModeChange(v) {
    setMode(v);
    setSelectedCadets([]);
    setLessonCode('');
    setSubject('');
  }

  function handleStarChange(v) {
    setStarLevel(v);
    setSelectedCadets([]);
    setLessonCode('');
    setSubject('');
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Bulk Progress Entry"
        description="Mark completions for multiple cadets at once"
        icon={ClipboardCheck}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Step 1 */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Step 1 — What to Mark</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {/* Mode picker */}
            <div>
              <Label className="mb-1 block">Completion Mode</Label>
              <Tabs value={mode} onValueChange={handleModeChange}>
                <TabsList className="w-full">
                  <TabsTrigger value="lesson" className="flex-1 gap-1 text-xs"><FileText className="w-3 h-3" />Lesson</TabsTrigger>
                  <TabsTrigger value="subject" className="flex-1 gap-1 text-xs"><BookOpen className="w-3 h-3" />Subject</TabsTrigger>
                  <TabsTrigger value="star" className="flex-1 gap-1 text-xs"><Star className="w-3 h-3" />Star Level</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Star Level — always shown */}
            <div>
              <Label>Star Level</Label>
              <Select value={starLevel} onValueChange={handleStarChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Subject — shown for subject + lesson modes */}
            {(mode === 'subject' || mode === 'lesson') && (
              <div>
                <Label>Subject</Label>
                <Select value={subject} onValueChange={v => { setSubject(v); setLessonCode(''); setSelectedCadets([]); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject..." /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Lesson — shown for lesson mode only */}
            {mode === 'lesson' && (
              <div>
                <Label>Lesson</Label>
                <Select value={lessonCode} onValueChange={v => { setLessonCode(v); setSelectedCadets([]); }} disabled={!subject}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select lesson..." /></SelectTrigger>
                  <SelectContent>
                    {lessonsForSubject.map(l => (
                      <SelectItem key={l.LessonCode} value={l.LessonCode}>
                        {l.LessonCode} — {l.LessonName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Completion Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>

            {/* Summary */}
            {targetLessons.length > 0 && (
              <div className="p-2 rounded-lg bg-muted/50 text-xs space-y-1">
                <p className="font-medium">Will mark:</p>
                <p className="text-muted-foreground">{summaryLabel}</p>
                <p className="text-muted-foreground">{targetLessons.length} lesson{targetLessons.length !== 1 ? 's' : ''} total</p>
                {mode === 'star' && (
                  <p className="text-yellow-700 font-medium">⚠ Marks ALL {targetLessons.length} lessons in {starLevel}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">Step 2 — Select Cadets ({selectedCadets.length} selected)</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={!isReady && targetLessons.length === 0}>
                  {selectedCadets.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-36" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto mb-4">
              {filteredCadets.map(cadet => {
                const done = isFullyDone(cadet.PNumber);
                const remaining = pendingCount(cadet.PNumber);
                return (
                  <label
                    key={cadet.PNumber}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${done ? 'opacity-40' : 'hover:bg-muted/50'}`}
                  >
                    <Checkbox
                      checked={selectedCadets.includes(cadet.PNumber)}
                      onCheckedChange={() => !done && toggleCadet(cadet.PNumber)}
                      disabled={done}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{[cadet.Rank, cadet.FirstName, cadet.Surname].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
                    </div>
                    {done
                      ? <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">All done</Badge>
                      : targetLessons.length > 1 && remaining < targetLessons.length
                        ? <Badge variant="outline" className="text-xs">{remaining} remaining</Badge>
                        : null
                    }
                  </label>
                );
              })}
              {filteredCadets.length === 0 && (
                <p className="text-center py-6 text-muted-foreground text-sm">No active cadets at {starLevel} level.</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => submitMutation.mutate()}
              disabled={!isReady || submitMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit for {selectedCadets.length} Cadet{selectedCadets.length !== 1 ? 's' : ''}
              {targetLessons.length > 1 ? ` (${targetLessons.length} lessons each)` : ''}
              {(me?.AccessLevel ?? 0) < ACCESS_LEVELS.DET_2IC ? ' — Pending Approval' : ' — Auto-Approved'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}