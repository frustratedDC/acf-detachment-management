import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileCheck, Send, Search, Users, Pencil, AlertTriangle, UserX, EyeOff, Eye, ClipboardList } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { format } from 'date-fns';
import { toast } from 'sonner';
import QuickAssignModal from '@/components/attendance/QuickAssignModal';

export default function LessonAttendance() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [selectedCadets, setSelectedCadets] = useState([]);
  const [search, setSearch] = useState('');
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeRequestLesson, setChangeRequestLesson] = useState(null);
  const [changeRequestText, setChangeRequestText] = useState('');
  const [changeRequestReason, setChangeRequestReason] = useState('');
  const [selectedUnassigned, setSelectedUnassigned] = useState([]);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const isL4 = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;

  // L4+ see all lessons for the night; others see only their own
  const { data: myLessons = [] } = useQuery({
    queryKey: ['my-schedule', isL4 ? 'all' : me?.PNumber, date],
    queryFn: () => isL4
      ? base44.entities.NightlySchedule.filter({ Date: date })
      : base44.entities.NightlySchedule.filter({ InstructorPNumber: me?.PNumber, Date: date }),
    enabled: !!me?.PNumber,
  });

  const { data: paradeState = [] } = useQuery({
    queryKey: ['parade', date],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: date }),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
    enabled: isL4,
  });

  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const activeLesson = myLessons[activeLessonIdx];

  const presentPNumbers = new Set(paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber));

  const { data: existingProgress = [] } = useQuery({
    queryKey: ['progress-for-lesson', activeLesson?.LessonCode],
    queryFn: () => base44.entities.ProgressLedger.filter({ LessonCode: activeLesson?.LessonCode }),
    enabled: !!activeLesson?.LessonCode,
  });
  const alreadyCompletedPNumbers = new Set(existingProgress.filter(p => p.Status === 'Approved').map(p => p.CadetPNumber));
  const pendingPNumbers = new Set(existingProgress.filter(p => p.Status === 'Pending').map(p => p.CadetPNumber));

  const [hideCompleted, setHideCompleted] = useState(false);

  // All cadets at the right star level who are present (including already completed, for display)
  const nominalRollCadets = allPersonnel.filter(p =>
    p.Type === 'Cadet' &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    p.CurrentStarLevel === activeLesson?.AssignedStarLevel &&
    presentPNumbers.has(p.PNumber)
  );

  const eligibleCadets = nominalRollCadets.filter(p => !alreadyCompletedPNumbers.has(p.PNumber));

  const displayCadets = hideCompleted
    ? nominalRollCadets.filter(p => !alreadyCompletedPNumbers.has(p.PNumber))
    : nominalRollCadets;

  // Cadets present tonight with no lesson assigned (already completed all lessons for their level, or star level not scheduled)
  const scheduledStarLevels = new Set(myLessons.map(l => l.AssignedStarLevel));
  const unassignedPresentCadets = isL4 ? allPersonnel.filter(p =>
    p.Type === 'Cadet' &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    presentPNumbers.has(p.PNumber) &&
    !scheduledStarLevels.has(p.CurrentStarLevel)
  ) : [];

  // Instructors present tonight
  const presentInstructorPNumbers = new Set(
    allPersonnel
      .filter(p => p.Type === 'Adult Instructor' && (p.PersonnelStatus || 'Active') === 'Active' && presentPNumbers.has(p.PNumber))
      .map(p => p.PNumber)
  );
  const assignedInstructorPNumbers = new Set(myLessons.map(l => l.InstructorPNumber).filter(Boolean));
  const unassignedPresentInstructors = isL4 ? allPersonnel.filter(p =>
    p.Type === 'Adult Instructor' &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    presentPNumbers.has(p.PNumber) &&
    !assignedInstructorPNumbers.has(p.PNumber)
  ) : [];

  const filteredCadets = displayCadets.filter(c =>
    c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.PNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const isAutoApproved = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;
      const records = selectedCadets.map(pnum => ({
        CadetPNumber: pnum,
        LessonCode: activeLesson.LessonCode,
        Status: isAutoApproved ? 'Approved' : 'Pending',
        CompletionDate: date,
        InstructorPNumber: me.PNumber,
      }));
      await base44.entities.ProgressLedger.bulkCreate(records);
    },
    onSuccess: () => {
      toast.success('Attendance submitted');
      setSelectedCadets([]);
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  const quickAssignMutation = useMutation({
    mutationFn: async ({ lessonCode, notes }) => {
      const isAutoApproved = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;
      const records = selectedUnassigned.map(pnum => ({
        CadetPNumber: pnum,
        LessonCode: lessonCode,
        Status: isAutoApproved ? 'Approved' : 'Pending',
        CompletionDate: date,
        InstructorPNumber: me.PNumber,
        ActivityNotes: notes,
      }));
      await base44.entities.ProgressLedger.bulkCreate(records);
    },
    onSuccess: () => {
      toast.success('Cadets assigned');
      setSelectedUnassigned([]);
      setQuickAssignOpen(false);
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  const changeRequestMutation = useMutation({
    mutationFn: (data) => base44.entities.LessonChangeRequest.create(data),
    onSuccess: () => {
      toast.success('Change request submitted to L4+ task list');
      setChangeRequestOpen(false);
      setChangeRequestText('');
      setChangeRequestReason('');
    },
  });

  function toggleCadet(pnum) {
    setSelectedCadets(prev =>
      prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]
    );
  }

  function toggleUnassigned(pnum) {
    setSelectedUnassigned(prev =>
      prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]
    );
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Lesson Attendance"
        description="Record cadet attendance for your assigned lessons"
        icon={FileCheck}
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
            max={me?.AccessLevel >= ACCESS_LEVELS.DET_INSTRUCTOR ? undefined : today}
          />
        }
      />

      {myLessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No lessons assigned to you for this date.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Lesson Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 flex-wrap">
            {myLessons.map((lesson, idx) => (
              <div key={lesson.id} className="flex items-center gap-1">
                <Button
                  variant={idx === activeLessonIdx ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveLessonIdx(idx); setSelectedCadets([]); }}
                >
                  P{lesson.Period} · {lesson.AssignedStarLevel} · {lesson.LessonCode}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  title="Request lesson change"
                  onClick={() => { setChangeRequestLesson(lesson); setChangeRequestText(''); setChangeRequestReason(''); setChangeRequestOpen(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Lesson Details */}
          <Card className="mb-4 border-primary/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Lesson:</span> <strong>{activeLesson.LessonName || activeLesson.LessonCode}</strong></div>
                <div><span className="text-muted-foreground">Star Level:</span> <strong>{activeLesson.AssignedStarLevel}</strong></div>
                <div><span className="text-muted-foreground">Dress:</span> <strong>{activeLesson.DressCode || 'N/A'}</strong></div>
                <div><span className="text-muted-foreground">Location:</span> <strong>{activeLesson.Location || 'N/A'}</strong></div>
              </div>
            </CardContent>
          </Card>

          {/* Cadet Nominal Roll */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Nominal Roll ({nominalRollCadets.length})
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {alreadyCompletedPNumbers.size} completed · {eligibleCadets.length} eligible
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs ${hideCompleted ? 'border-primary text-primary' : ''}`}
                    onClick={() => setHideCompleted(v => !v)}
                  >
                    {hideCompleted ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
                    {hideCompleted ? 'Show All' : 'Hide Completed'}
                  </Button>
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-36 h-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 mb-4">
                {filteredCadets.map(cadet => {
                  const isApproved = alreadyCompletedPNumbers.has(cadet.PNumber);
                  const isPending = !isApproved && pendingPNumbers.has(cadet.PNumber);
                  return (
                    <label
                      key={cadet.PNumber}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isApproved
                          ? 'bg-chart-2/5 cursor-default'
                          : 'hover:bg-muted/50 cursor-pointer'
                      }`}
                    >
                      {isApproved ? (
                        <span className="text-chart-2 text-lg w-5 text-center" title="Already approved">✓</span>
                      ) : isPending ? (
                        <span className="text-yellow-500 text-lg w-5 text-center" title="Pending approval">⏳</span>
                      ) : (
                        <Checkbox
                          checked={selectedCadets.includes(cadet.PNumber)}
                          onCheckedChange={() => toggleCadet(cadet.PNumber)}
                        />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isApproved ? 'text-muted-foreground line-through' : ''}`}>
                          {cadet.Surname}{cadet.FirstName ? `, ${cadet.FirstName}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
                      </div>
                      {isApproved && <Badge className="text-xs bg-chart-2/20 text-chart-2 border-0">Completed</Badge>}
                      {isPending && <Badge className="text-xs bg-yellow-100 text-yellow-700 border-0">Pending</Badge>}
                      {!isApproved && !isPending && <Badge variant="outline" className="text-xs">{cadet.CurrentStarLevel}</Badge>}
                    </label>
                  );
                })}
                {filteredCadets.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground text-sm">
                    {hideCompleted ? 'All present cadets have already completed this lesson.' : 'No cadets found.'}
                  </p>
                )}
              </div>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={selectedCadets.length === 0 || submitMutation.isPending}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Attendance ({selectedCadets.length} cadets)
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Unassigned Present Cadets — L4+ only */}
      {isL4 && unassignedPresentCadets.length > 0 && (
        <Card className="mt-4 border-amber-500/30 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Unassigned Present Cadets ({unassignedPresentCadets.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">These cadets are present but their star level has no lesson scheduled tonight. Select cadets and assign them below.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 mb-3">
              {unassignedPresentCadets.map(c => (
                <label key={c.PNumber} className="flex items-center gap-3 p-2 rounded-lg hover:bg-amber-100/40 cursor-pointer">
                  <Checkbox
                    checked={selectedUnassigned.includes(c.PNumber)}
                    onCheckedChange={() => toggleUnassigned(c.PNumber)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{[c.Rank, c.Surname, c.FirstName].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">{c.PNumber}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">{c.CurrentStarLevel}</Badge>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              disabled={selectedUnassigned.length === 0}
              onClick={() => setQuickAssignOpen(true)}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Assign Selected ({selectedUnassigned.length})
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Present Instructors — L4+ only */}
      {isL4 && unassignedPresentInstructors.length > 0 && (
        <Card className="mt-4 border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <UserX className="w-4 h-4" />
              Unassigned Present Instructors ({unassignedPresentInstructors.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">These instructors are present but not assigned to any lesson tonight. Consider assigning them as a second instructor or to cover a gap.</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedPresentInstructors.map(i => (
                <Badge key={i.PNumber} variant="outline" className="text-xs border-destructive/40 text-destructive">
                  {[i.Rank, i.Surname].filter(Boolean).join(' ')} · L{i.AccessLevel}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Request Dialog */}
      <Dialog open={changeRequestOpen} onOpenChange={setChangeRequestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request Lesson Change</DialogTitle></DialogHeader>
          {changeRequestLesson && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">{changeRequestLesson.LessonCode}</span> — {changeRequestLesson.LessonName || 'Lesson'}
              </p>
              <div>
                <label className="text-xs font-medium mb-1 block">Requested Change</label>
                <Input
                  value={changeRequestText}
                  onChange={e => setChangeRequestText(e.target.value)}
                  placeholder="e.g. Change to MAP-201 Navigation"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Reason</label>
                <Textarea
                  value={changeRequestReason}
                  onChange={e => setChangeRequestReason(e.target.value)}
                  placeholder="Explain why the change is needed..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setChangeRequestOpen(false)}>Cancel</Button>
                <Button
                  disabled={!changeRequestText}
                  onClick={() => changeRequestMutation.mutate({
                    RequestedByPNumber: me?.PNumber,
                    Date: date,
                    CurrentLessonCode: changeRequestLesson.LessonCode,
                    CurrentLessonName: changeRequestLesson.LessonName || '',
                    RequestedChange: changeRequestText,
                    Reason: changeRequestReason,
                    Status: 'Pending',
                  })}
                >
                  Submit Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuickAssignModal
        open={quickAssignOpen}
        onOpenChange={setQuickAssignOpen}
        cadetCount={selectedUnassigned.length}
        myLessons={myLessons}
        syllabus={syllabus}
        isPending={quickAssignMutation.isPending}
        onConfirm={({ lessonCode, notes }) => quickAssignMutation.mutate({ lessonCode, notes })}
      />
    </AccessGate>
  );
}