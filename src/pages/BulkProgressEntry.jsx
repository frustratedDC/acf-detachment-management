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
import { ClipboardCheck, Search, Save } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';
import { sortLessons } from '@/lib/lessonSort';
import { checkAndPromoteCadet } from '@/lib/progressUtils';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function BulkProgressEntry() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  const [starLevel, setStarLevel] = useState('1 Star');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // pending[pnum][lessonCode] = true means "tick to submit"
  const [pending, setPending] = useState({});

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

  const approvedSet = useMemo(() =>
    new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`)),
    [progress]
  );
  const pendingDbSet = useMemo(() =>
    new Set(progress.filter(p => p.Status === 'Pending').map(p => `${p.CadetPNumber}::${p.LessonCode}`)),
    [progress]
  );

  const isAutoApproved = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;

  // Lessons for selected star level + subject filter
  const subjectsForLevel = useMemo(() =>
    [...new Set(syllabus.filter(l => l.StarLevel === starLevel).map(l => l.SubjectName))].sort(),
    [syllabus, starLevel]
  );
  const displayLessons = useMemo(() =>
    sortLessons(syllabus.filter(l =>
      l.StarLevel === starLevel &&
      (subjectFilter === 'all' || l.SubjectName === subjectFilter)
    )),
    [syllabus, starLevel, subjectFilter]
  );

  // Cadets — active, matching search
  const cadets = useMemo(() =>
    personnel
      .filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active')
      .filter(c =>
        !search ||
        c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
        c.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
        c.PNumber?.toLowerCase().includes(search.toLowerCase())
      ),
    [personnel, search]
  );

  function isChecked(pnum, lessonCode) {
    return !!(pending[pnum]?.[lessonCode]);
  }

  function isDone(pnum, lessonCode) {
    return approvedSet.has(`${pnum}::${lessonCode}`);
  }

  function isPendingDb(pnum, lessonCode) {
    return pendingDbSet.has(`${pnum}::${lessonCode}`);
  }

  function toggle(pnum, lessonCode) {
    if (isDone(pnum, lessonCode)) return; // already approved, can't change
    setPending(prev => {
      const row = { ...(prev[pnum] || {}) };
      if (row[lessonCode]) delete row[lessonCode];
      else row[lessonCode] = true;
      return { ...prev, [pnum]: row };
    });
  }

  // Toggle all cadets for a specific lesson
  function toggleLesson(lessonCode) {
    const eligible = cadets.filter(c => !isDone(c.PNumber, lessonCode));
    const allChecked = eligible.every(c => isChecked(c.PNumber, lessonCode));
    setPending(prev => {
      const next = { ...prev };
      eligible.forEach(c => {
        const row = { ...(next[c.PNumber] || {}) };
        if (allChecked) delete row[lessonCode];
        else row[lessonCode] = true;
        next[c.PNumber] = row;
      });
      return next;
    });
  }

  // Toggle all lessons for a specific cadet
  function toggleCadet(pnum) {
    const eligible = displayLessons.filter(l => !isDone(pnum, l.LessonCode));
    const allChecked = eligible.every(l => isChecked(pnum, l.LessonCode));
    setPending(prev => {
      const row = { ...(prev[pnum] || {}) };
      eligible.forEach(l => {
        if (allChecked) delete row[l.LessonCode];
        else row[l.LessonCode] = true;
      });
      return { ...prev, [pnum]: row };
    });
  }

  // Count total pending ticks
  const totalTicked = useMemo(() =>
    Object.values(pending).reduce((sum, row) => sum + Object.values(row).filter(Boolean).length, 0),
    [pending]
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const records = [];
      for (const [pnum, lessons] of Object.entries(pending)) {
        for (const [lessonCode, ticked] of Object.entries(lessons)) {
          if (!ticked) continue;
          if (approvedSet.has(`${pnum}::${lessonCode}`)) continue;
          records.push({
            CadetPNumber: pnum,
            LessonCode: lessonCode,
            Status: isAutoApproved ? 'Approved' : 'Pending',
            CompletionDate: date,
            InstructorPNumber: me?.PNumber,
          });
        }
      }
      if (records.length === 0) throw new Error('No new completions to submit.');
      for (let i = 0; i < records.length; i += 50) {
        await base44.entities.ProgressLedger.bulkCreate(records.slice(i, i + 50));
      }
      return records;
    },
    onSuccess: async (records) => {
      toast.success(`${isAutoApproved ? 'Approved' : 'Submitted'} ${records.length} completion${records.length !== 1 ? 's' : ''}`);
      setPending({});
      await queryClient.invalidateQueries({ queryKey: ['progress-all'] });

      if (isAutoApproved) {
        const updatedProgress = await base44.entities.ProgressLedger.filter({});
        const pnums = [...new Set(records.map(r => r.CadetPNumber))];
        for (const pnum of pnums) {
          const cadet = personnel.find(p => p.PNumber === pnum);
          if (!cadet) continue;
          const result = await checkAndPromoteCadet(pnum, cadet.CurrentStarLevel, syllabus, updatedProgress);
          if (result?.newStarLevel) toast.success(`🎖 ${cadet.Surname} promoted to ${result.newStarLevel}!`);
          if (result?.newAccessLevel) toast.success(`⭐ ${cadet.Surname} is now a Cadet Instructor!`);
        }
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Bulk Progress Entry"
        description="Tick off lesson completions per cadet"
        icon={ClipboardCheck}
      />

      {/* Filters bar */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <Label className="text-xs mb-1 block">Star Level</Label>
          <Select value={starLevel} onValueChange={v => { setStarLevel(v); setSubjectFilter('all'); setPending({}); }}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Subject</Label>
          <Select value={subjectFilter} onValueChange={v => { setSubjectFilter(v); setPending({}); }}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjectsForLevel.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Completion Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 w-36 text-xs" />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search cadets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-40 text-xs" />
        </div>
        {subjectFilter !== 'all' && (
          <Button size="sm" variant="outline" onClick={() => {
            // Tick all incomplete lessons for subject across all cadets
            setPending(prev => {
              const next = { ...prev };
              cadets.forEach(c => {
                const row = { ...(next[c.PNumber] || {}) };
                displayLessons.forEach(l => {
                  if (!approvedSet.has(`${c.PNumber}::${l.LessonCode}`) && !pendingDbSet.has(`${c.PNumber}::${l.LessonCode}`)) {
                    row[l.LessonCode] = true;
                  }
                });
                next[c.PNumber] = row;
              });
              return next;
            });
          }}>
            ✓ Complete Whole Subject
          </Button>
        )}
        <div className="ml-auto">
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={totalTicked === 0 || submitMutation.isPending}
            size="sm"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {submitMutation.isPending ? 'Saving...' : `Save ${totalTicked} Completion${totalTicked !== 1 ? 's' : ''}`}
            {isAutoApproved ? ' (Auto-Approved)' : ' (Pending)'}
          </Button>
        </div>
      </div>

      {displayLessons.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No lessons found for selected filters.</p>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted border-b">
                  {/* Cadet column */}
                  <th className="text-left p-3 font-semibold sticky left-0 bg-muted z-10 min-w-[160px]">Cadet</th>
                  {/* One column per lesson */}
                  {displayLessons.map(lesson => (
                    <th key={lesson.LessonCode} className="p-2 text-center font-semibold min-w-[80px] max-w-[100px]">
                      <button
                        className="flex flex-col items-center gap-0.5 hover:text-primary transition-colors w-full"
                        onClick={() => toggleLesson(lesson.LessonCode)}
                        title={`Toggle all — ${lesson.LessonName}`}
                      >
                        <span className="font-mono text-xs">{lesson.LessonCode}</span>
                        <span className="text-muted-foreground font-normal leading-tight text-center" style={{ fontSize: '0.65rem', maxWidth: 80 }}>
                          {lesson.LessonName.length > 20 ? lesson.LessonName.slice(0, 18) + '…' : lesson.LessonName}
                        </span>
                        {lesson.IsMandatory && <span className="text-destructive font-bold text-xs">*</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cadets.map(cadet => {
                  const rowTicked = displayLessons.filter(l => isChecked(cadet.PNumber, l.LessonCode)).length;
                  return (
                    <tr key={cadet.PNumber} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 sticky left-0 bg-card z-10">
                        <button
                          className="flex flex-col items-start text-left hover:text-primary transition-colors w-full"
                          onClick={() => toggleCadet(cadet.PNumber)}
                          title="Toggle all lessons for this cadet"
                        >
                          <span className="font-medium">{[cadet.Rank, cadet.Surname].filter(Boolean).join(' ')}</span>
                          <span className="text-muted-foreground">{cadet.FirstName}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-xs py-0 h-4">{cadet.CurrentStarLevel}</Badge>
                            {rowTicked > 0 && <Badge className="text-xs py-0 h-4 bg-primary/20 text-primary border-0">{rowTicked} ticked</Badge>}
                          </div>
                        </button>
                      </td>
                      {displayLessons.map(lesson => {
                        const done = isDone(cadet.PNumber, lesson.LessonCode);
                        const pendingDb = isPendingDb(cadet.PNumber, lesson.LessonCode);
                        const ticked = isChecked(cadet.PNumber, lesson.LessonCode);
                        return (
                          <td key={lesson.LessonCode} className="p-2 text-center">
                            {done ? (
                              <span className="text-chart-2 text-sm" title="Already approved">✓</span>
                            ) : pendingDb ? (
                              <span className="text-yellow-500 text-sm" title="Pending approval">⏳</span>
                            ) : (
                              <Checkbox
                                checked={ticked}
                                onCheckedChange={() => toggle(cadet.PNumber, lesson.LessonCode)}
                                className={ticked ? 'border-primary' : ''}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {cadets.length === 0 && (
                  <tr>
                    <td colSpan={displayLessons.length + 1} className="text-center py-8 text-muted-foreground">No cadets found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span><span className="text-chart-2">✓</span> Already approved</span>
        <span><span className="text-yellow-500">⏳</span> Pending approval</span>
        <span className="text-destructive">* = Mandatory lesson</span>
        <span>Click cadet name to toggle all their lessons · Click lesson header to toggle all cadets</span>
      </div>
    </AccessGate>
  );
}