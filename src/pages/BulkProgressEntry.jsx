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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, Search, Save, Zap, EyeOff, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';
import { sortLessons } from '@/lib/lessonSort';
import { checkAndPromoteCadet, STAR_ORDER } from '@/lib/progressUtils';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

// ─── Hierarchical Award Engine ──────────────────────────────────────────────
/**
 * Given a target star level, returns all mandatory lesson codes for that level
 * AND all preceding levels (inclusive), as per hierarchical award rules.
 */
function getMandatoryLessonsUpTo(targetLevel, syllabus) {
  const targetIdx = STAR_ORDER.indexOf(targetLevel);
  if (targetIdx === -1) return [];
  const levelsToAward = STAR_ORDER.slice(0, targetIdx + 1);
  return syllabus.filter(l =>
    levelsToAward.includes(l.StarLevel) && l.IsMandatory
  );
}

/**
 * Given a target star level, returns all optional lesson codes for that level
 * AND all preceding levels (inclusive).
 */
function getOptionalLessonsUpTo(targetLevel, syllabus) {
  const targetIdx = STAR_ORDER.indexOf(targetLevel);
  if (targetIdx === -1) return [];
  const levelsToAward = STAR_ORDER.slice(0, targetIdx + 1);
  return syllabus.filter(l =>
    levelsToAward.includes(l.StarLevel) && !l.IsMandatory
  );
}

// ─── Sequence Safety ─────────────────────────────────────────────────────────
/**
 * Returns the highest star level a cadet has fully completed mandatory elements for.
 * Used to prevent out-of-sequence awards.
 */
function getHighestEligibleLevel(cadetPNum, syllabus, approvedSet) {
  let highest = null;
  for (const level of STAR_ORDER) {
    const mandatory = syllabus.filter(l => l.StarLevel === level && l.IsMandatory);
    if (mandatory.length === 0) { highest = level; continue; }
    const allDone = mandatory.every(l => approvedSet.has(`${cadetPNum}::${l.LessonCode}`));
    if (allDone) highest = level;
    else break;
  }
  return highest;
}

export default function BulkProgressEntry() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  // ── View mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState('matrix'); // 'matrix' | 'bulk-award'
  const [starLevel, setStarLevel] = useState('');       // mandatory — table hidden until set
  const [subjectFilter, setSubjectFilter] = useState(''); // mandatory — table hidden until set
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hideCompleted, setHideCompleted] = useState(false);
  const [sortBy, setSortBy] = useState('mandatory-first'); // 'mandatory-first' | 'subject-az' | 'code-asc'

  // ── Matrix pending ticks ────────────────────────────────────────────────────
  const [pending, setPending] = useState({});

  // ── Bulk Award state ────────────────────────────────────────────────────────
  const [bulkTargetLevel, setBulkTargetLevel] = useState('1 Star');
  // optionalSelections[lessonCode] = true/false
  const [optionalSelections, setOptionalSelections] = useState({});
  const [optionalPromptOpen, setOptionalPromptOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkTargetCadets, setBulkTargetCadets] = useState([]); // pnums

  // ── Data ────────────────────────────────────────────────────────────────────
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

  const subjectsForLevel = useMemo(() =>
    starLevel ? [...new Set(syllabus.filter(l => l.StarLevel === starLevel).map(l => l.SubjectName))].sort() : [],
    [syllabus, starLevel]
  );

  const displayLessons = useMemo(() => {
    if (!starLevel || !subjectFilter) return [];
    let filtered = syllabus.filter(l =>
      l.StarLevel === starLevel && l.SubjectName === subjectFilter
    );

    if (sortBy === 'mandatory-first') {
      filtered = sortLessons(filtered);
    } else if (sortBy === 'subject-az') {
      filtered = [...filtered].sort((a, b) => a.SubjectName.localeCompare(b.SubjectName));
    } else if (sortBy === 'code-asc') {
      filtered = [...filtered].sort((a, b) => a.LessonCode.localeCompare(b.LessonCode));
    }

    return filtered;
  }, [syllabus, starLevel, subjectFilter, sortBy]);

  // Active cadets
  const allActiveCadets = useMemo(() =>
    personnel.filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'),
    [personnel]
  );

  const cadets = useMemo(() => {
    if (!starLevel || !subjectFilter) return [];
    let filtered = allActiveCadets.filter(c =>
      // Only show cadets whose current star level matches the selected level
      c.CurrentStarLevel === starLevel &&
      (!search ||
        c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
        c.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
        c.PNumber?.toLowerCase().includes(search.toLowerCase()))
    );
    if (hideCompleted) {
      filtered = filtered.filter(c =>
        displayLessons.some(l => !approvedSet.has(`${c.PNumber}::${l.LessonCode}`))
      );
    }
    return filtered;
  }, [allActiveCadets, starLevel, subjectFilter, search, hideCompleted, displayLessons, approvedSet]);

  // ── Matrix helpers ──────────────────────────────────────────────────────────
  function isChecked(pnum, lessonCode) { return !!(pending[pnum]?.[lessonCode]); }
  function isDone(pnum, lessonCode) { return approvedSet.has(`${pnum}::${lessonCode}`); }
  function isPendingDb(pnum, lessonCode) { return pendingDbSet.has(`${pnum}::${lessonCode}`); }

  function toggle(pnum, lessonCode) {
    if (isDone(pnum, lessonCode)) return;
    setPending(prev => {
      const row = { ...(prev[pnum] || {}) };
      if (row[lessonCode]) delete row[lessonCode]; else row[lessonCode] = true;
      return { ...prev, [pnum]: row };
    });
  }

  function toggleLesson(lessonCode) {
    const eligible = cadets.filter(c => !isDone(c.PNumber, lessonCode));
    const allChecked = eligible.every(c => isChecked(c.PNumber, lessonCode));
    setPending(prev => {
      const next = { ...prev };
      eligible.forEach(c => {
        const row = { ...(next[c.PNumber] || {}) };
        if (allChecked) delete row[lessonCode]; else row[lessonCode] = true;
        next[c.PNumber] = row;
      });
      return next;
    });
  }

  function toggleCadet(pnum) {
    const eligible = displayLessons.filter(l => !isDone(pnum, l.LessonCode));
    const allChecked = eligible.every(l => isChecked(pnum, l.LessonCode));
    setPending(prev => {
      const row = { ...(prev[pnum] || {}) };
      eligible.forEach(l => { if (allChecked) delete row[l.LessonCode]; else row[l.LessonCode] = true; });
      return { ...prev, [pnum]: row };
    });
  }

  const totalTicked = useMemo(() =>
    Object.values(pending).reduce((sum, row) => sum + Object.values(row).filter(Boolean).length, 0),
    [pending]
  );

  // ── Bulk Award Engine ───────────────────────────────────────────────────────
  const mandatoryForTarget = useMemo(() => getMandatoryLessonsUpTo(bulkTargetLevel, syllabus), [bulkTargetLevel, syllabus]);
  const optionalForTarget = useMemo(() => getOptionalLessonsUpTo(bulkTargetLevel, syllabus), [bulkTargetLevel, syllabus]);

  function initiateBulkAward() {
    // Determine eligible cadets: those whose current star level is at or below target
    const targetIdx = STAR_ORDER.indexOf(bulkTargetLevel);
    const eligible = allActiveCadets.filter(c => {
      const cIdx = STAR_ORDER.indexOf(c.CurrentStarLevel ?? 'Basic');
      return cIdx <= targetIdx;
    });
    setBulkTargetCadets(eligible.map(c => c.PNumber));

    // Initialise optional selections to false
    const opts = {};
    optionalForTarget.forEach(l => { opts[l.LessonCode] = false; });
    setOptionalSelections(opts);

    // Open optional prompt if there are optionals
    if (optionalForTarget.length > 0) {
      setOptionalPromptOpen(true);
    } else {
      setConfirmOpen(true);
    }
  }

  function proceedFromOptional() {
    setOptionalPromptOpen(false);
    setConfirmOpen(true);
  }

  // Build the final set of records to commit for bulk award
  const bulkAwardSummary = useMemo(() => {
    const selectedOptionals = optionalForTarget.filter(l => optionalSelections[l.LessonCode]);
    const allToAward = [...mandatoryForTarget, ...selectedOptionals];
    const records = [];
    for (const cadetPNum of bulkTargetCadets) {
      for (const lesson of allToAward) {
        if (approvedSet.has(`${cadetPNum}::${lesson.LessonCode}`)) continue;
        if (pendingDbSet.has(`${cadetPNum}::${lesson.LessonCode}`)) continue;
        records.push({ cadetPNum, lesson });
      }
    }
    return {
      mandatory: mandatoryForTarget.length,
      optionalSelected: selectedOptionals.length,
      totalRecords: records.length,
      records,
    };
  }, [bulkTargetCadets, mandatoryForTarget, optionalForTarget, optionalSelections, approvedSet, pendingDbSet]);

  // ── Submit mutations ────────────────────────────────────────────────────────
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
        }
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkAwardMutation = useMutation({
    mutationFn: async () => {
      const dbRecords = bulkAwardSummary.records.map(({ cadetPNum, lesson }) => ({
        CadetPNumber: cadetPNum,
        LessonCode: lesson.LessonCode,
        Status: isAutoApproved ? 'Approved' : 'Pending',
        CompletionDate: date,
        InstructorPNumber: me?.PNumber,
      }));
      for (let i = 0; i < dbRecords.length; i += 50) {
        await base44.entities.ProgressLedger.bulkCreate(dbRecords.slice(i, i + 50));
      }
      return dbRecords;
    },
    onSuccess: async (records) => {
      setConfirmOpen(false);
      toast.success(`Bulk award: ${records.length} completions ${isAutoApproved ? 'approved' : 'submitted'}`);
      await queryClient.invalidateQueries({ queryKey: ['progress-all'] });
      if (isAutoApproved) {
        const updatedProgress = await base44.entities.ProgressLedger.filter({});
        for (const pnum of bulkTargetCadets) {
          const cadet = personnel.find(p => p.PNumber === pnum);
          if (!cadet) continue;
          const result = await checkAndPromoteCadet(pnum, cadet.CurrentStarLevel, syllabus, updatedProgress);
          if (result?.newStarLevel) toast.success(`🎖 ${cadet.Surname} promoted to ${result.newStarLevel}!`);
        }
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Bulk Progress Entry"
        description="Tick off lesson completions or bulk award star levels"
        icon={ClipboardCheck}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'matrix' ? 'default' : 'outline'}
              onClick={() => setMode('matrix')}
            >Matrix</Button>
            <Button
              size="sm"
              variant={mode === 'bulk-award' ? 'default' : 'outline'}
              onClick={() => setMode('bulk-award')}
            >
              <Zap className="w-3.5 h-3.5 mr-1" />Bulk Award
            </Button>
          </div>
        }
      />

      {/* ── BULK AWARD MODE ─────────────────────────────────────────── */}
      {mode === 'bulk-award' && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Hierarchical Bulk Award Engine
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Select a target star level. All <strong>mandatory</strong> lessons for that level and all preceding levels will be auto-awarded. You'll then be prompted to select any optional elements.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="text-xs mb-1 block">Target Star Level</Label>
                <Select value={bulkTargetLevel} onValueChange={setBulkTargetLevel}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Completion Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 w-36 text-xs" />
              </div>
              <Button size="sm" onClick={initiateBulkAward} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Zap className="w-3.5 h-3.5 mr-1" />
                Initiate Bulk Award for {bulkTargetLevel}
              </Button>
            </div>

            {/* Preview counts */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold text-foreground">{mandatoryForTarget.length}</p>
                <p className="text-muted-foreground">Mandatory lessons (all levels up to {bulkTargetLevel})</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold text-foreground">{optionalForTarget.length}</p>
                <p className="text-muted-foreground">Optional elements available</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold text-foreground">
                  {allActiveCadets.filter(c => STAR_ORDER.indexOf(c.CurrentStarLevel ?? 'Basic') <= STAR_ORDER.indexOf(bulkTargetLevel)).length}
                </p>
                <p className="text-muted-foreground">Eligible cadets</p>
              </div>
            </div>

            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Out-of-sequence awards are prevented. Cadets whose current star level is above the target will not be included.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── MATRIX MODE FILTERS ────────────────────────────────────── */}
      {mode === 'matrix' && (
        <>
          {/* Mandatory filter bar */}
          <Card className="mb-4">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs mb-1 block font-semibold">Filter by Star Level <span className="text-destructive">*</span></Label>
                  <Select value={starLevel} onValueChange={v => { setStarLevel(v); setSubjectFilter(''); setPending({}); }}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block font-semibold">Filter by Subject <span className="text-destructive">*</span></Label>
                  <Select value={subjectFilter} onValueChange={v => { setSubjectFilter(v); setPending({}); }} disabled={!starLevel}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder={starLevel ? 'Select subject…' : 'Select star level first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectsForLevel.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 w-36 text-xs" />
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search cadets…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 w-36 text-xs" />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHideCompleted(v => !v)}
                  className={hideCompleted ? 'border-primary text-primary' : ''}
                >
                  {hideCompleted ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                  {hideCompleted ? 'Show All' : 'Hide Done'}
                </Button>
                {(starLevel || subjectFilter) && (
                  <Button size="sm" variant="ghost" onClick={() => { setStarLevel(''); setSubjectFilter(''); setSearch(''); setPending({}); setHideCompleted(false); }}>
                    ✕ Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gate: show prompt until both filters are set */}
          {(!starLevel || !subjectFilter) ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select a Star Level and Subject to load the entry table.</p>
              <p className="text-xs mt-1">Both filters are required before entries can be made.</p>
            </div>
          ) : cadets.length === 0 && displayLessons.length > 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No eligible cadets found for {starLevel} — {subjectFilter}.</p>
              <p className="text-xs mt-1">No active cadets are currently at the <strong>{starLevel}</strong> level.</p>
            </div>
          ) : displayLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No lessons found for selected filters.</p>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    {/* Bulk Action row */}
                    <tr className="bg-accent/10 border-b border-accent/30">
                      <th className="text-left p-2 sticky left-0 bg-accent/10 z-10 min-w-[160px]">
                        <span className="text-xs font-semibold text-accent-foreground">Bulk Action</span>
                      </th>
                      <th colSpan={displayLessons.length} className="p-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-accent/50"
                            onClick={() => {
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
                            }}
                          >
                            ✓ Apply Pass to All
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setPending({})}
                            disabled={totalTicked === 0}
                          >
                            ✕ Clear All
                          </Button>
                          {totalTicked > 0 && (
                            <span className="text-xs text-muted-foreground">{totalTicked} ticked</span>
                          )}
                        </div>
                      </th>
                    </tr>
                    <tr className="bg-muted border-b">
                      <th className="text-left p-3 font-semibold sticky left-0 bg-muted z-10 min-w-[160px]">
                        Cadet
                        {hideCompleted && <span className="ml-1 text-muted-foreground font-normal">(incomplete only)</span>}
                      </th>
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
                      const rowCompleted = displayLessons.filter(l => isDone(cadet.PNumber, l.LessonCode)).length;
                      const allComplete = rowCompleted === displayLessons.length;
                      return (
                        <tr key={cadet.PNumber} className={`border-b transition-colors ${allComplete ? 'bg-chart-2/5' : 'hover:bg-muted/20'}`}>
                          <td className="p-3 sticky left-0 bg-card z-10">
                            <button
                              className="flex flex-col items-start text-left hover:text-primary transition-colors w-full"
                              onClick={() => toggleCadet(cadet.PNumber)}
                              title="Toggle all lessons for this cadet"
                            >
                              <span className="font-medium flex items-center gap-1">
                                {[cadet.Rank, cadet.Surname].filter(Boolean).join(' ')}
                                {allComplete && <CheckCircle2 className="w-3 h-3 text-chart-2" />}
                              </span>
                              <span className="text-muted-foreground">{cadet.FirstName}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge variant="outline" className="text-xs py-0 h-4">{cadet.CurrentStarLevel}</Badge>
                                {rowTicked > 0 && <Badge className="text-xs py-0 h-4 bg-primary/20 text-primary border-0">{rowTicked} ticked</Badge>}
                                {rowCompleted > 0 && <Badge className="text-xs py-0 h-4 bg-chart-2/20 text-chart-2 border-0">{rowCompleted} done</Badge>}
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
                                  <span className="text-chart-2 text-base" title="Already approved">✓</span>
                                ) : pendingDb ? (
                                  <span className="text-yellow-500 text-base" title="Pending approval">⏳</span>
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
                        <td colSpan={displayLessons.length + 1} className="text-center py-8 text-muted-foreground">
                          {hideCompleted ? 'All cadets have completed the displayed lessons.' : 'No cadets found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span><span className="text-chart-2">✓</span> Approved</span>
              <span><span className="text-yellow-500">⏳</span> Pending</span>
              <span className="text-destructive">* Mandatory</span>
              <span>Tap name/header to toggle column</span>
            </div>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={totalTicked === 0 || submitMutation.isPending}
              size="sm"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {submitMutation.isPending
                ? 'Saving…'
                : `Save ${totalTicked} Entr${totalTicked !== 1 ? 'ies' : 'y'}${isAutoApproved ? ' (Auto-Approved)' : ' (Pending)'}`}
            </Button>
          </div>
        </>
      )}

      {/* ── OPTIONAL ELEMENTS PROMPT ──────────────────────────────── */}
      <Dialog open={optionalPromptOpen} onOpenChange={setOptionalPromptOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Optional Elements</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mandatory lessons for <strong>{bulkTargetLevel}</strong> and below will be auto-awarded.
              Select any optional elements to include:
            </p>
          </DialogHeader>
          <div className="space-y-1 my-2">
            {optionalForTarget.map(lesson => (
              <label key={lesson.LessonCode} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={!!optionalSelections[lesson.LessonCode]}
                  onCheckedChange={v => setOptionalSelections(prev => ({ ...prev, [lesson.LessonCode]: !!v }))}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground">{lesson.LessonCode}</span>
                  <span className="ml-2 text-sm">{lesson.LessonName}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{lesson.StarLevel}</Badge>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionalPromptOpen(false)}>Cancel</Button>
            <Button onClick={proceedFromOptional}>
              Continue to Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRMATION MODAL ────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Award</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-bold">{bulkAwardSummary.mandatory}</p>
                <p className="text-xs text-muted-foreground">Mandatory lessons</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-bold">{bulkAwardSummary.optionalSelected}</p>
                <p className="text-xs text-muted-foreground">Optional elements selected</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-lg font-bold">{bulkTargetCadets.length}</p>
                <p className="text-xs text-muted-foreground">Cadets targeted</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <p className="text-lg font-bold text-primary">{bulkAwardSummary.totalRecords}</p>
                <p className="text-xs text-muted-foreground">New records to create</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Already approved and pending records will be skipped. Status: <strong>{isAutoApproved ? 'Auto-Approved' : 'Pending'}</strong>. Date: <strong>{date}</strong>.
            </p>
            {bulkAwardSummary.totalRecords === 0 && (
              <p className="text-xs text-chart-2 font-semibold">All eligible records already exist — nothing new to create.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkAwardSummary.totalRecords === 0 || bulkAwardMutation.isPending}
              onClick={() => bulkAwardMutation.mutate()}
            >
              {bulkAwardMutation.isPending ? 'Awarding...' : `Confirm — Award ${bulkAwardSummary.totalRecords} Records`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}