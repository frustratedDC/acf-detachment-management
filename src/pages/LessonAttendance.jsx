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
import { FileCheck, Send, Search, Users, Pencil } from 'lucide-react';
import { isCadet, ACCESS_LEVELS } from '@/lib/accessLevels';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const activeLesson = myLessons[activeLessonIdx];

  const presentPNumbers = new Set(paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber));

  const { data: existingProgress = [] } = useQuery({
    queryKey: ['progress-for-lesson', activeLesson?.LessonCode],
    queryFn: () => base44.entities.ProgressLedger.filter({ LessonCode: activeLesson?.LessonCode }),
    enabled: !!activeLesson?.LessonCode,
  });
  const alreadyCompletedPNumbers = new Set(existingProgress.filter(p => p.Status === 'Approved').map(p => p.CadetPNumber));

  const eligibleCadets = allPersonnel.filter(p =>
    isCadet(p.AccessLevel) &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    p.CurrentStarLevel === activeLesson?.AssignedStarLevel &&
    presentPNumbers.has(p.PNumber) &&
    !alreadyCompletedPNumbers.has(p.PNumber)
  );

  const filteredCadets = eligibleCadets.filter(c =>
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

          {/* Cadet List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Eligible Cadets ({eligibleCadets.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-48"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 mb-4">
                {filteredCadets.map(cadet => (
                  <label
                    key={cadet.PNumber}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedCadets.includes(cadet.PNumber)}
                      onCheckedChange={() => toggleCadet(cadet.PNumber)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cadet.Surname}</p>
                      <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{cadet.CurrentStarLevel}</Badge>
                  </label>
                ))}
                {filteredCadets.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground text-sm">No eligible cadets found.</p>
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
    </AccessGate>
  );
}