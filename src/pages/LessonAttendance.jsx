import React, { useState, useEffect } from 'react';
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
import { FileCheck, Send, Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function LessonAttendance() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [selectedCadets, setSelectedCadets] = useState([]);
  const [search, setSearch] = useState('');

  const { data: myLessons = [] } = useQuery({
    queryKey: ['my-schedule', me?.PNumber, date],
    queryFn: () => base44.entities.NightlySchedule.filter({ InstructorPNumber: me?.PNumber, Date: date }),
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

  // Filter cadets: match star level + present + Active status only
  const presentPNumbers = new Set(paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber));
  const eligibleCadets = allPersonnel.filter(p =>
    p.CurrentStarLevel === activeLesson?.AssignedStarLevel &&
    presentPNumbers.has(p.PNumber) &&
    (p.PersonnelStatus || 'Active') === 'Active'
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
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {myLessons.map((lesson, idx) => (
              <Button
                key={lesson.id}
                variant={idx === activeLessonIdx ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveLessonIdx(idx); setSelectedCadets([]); }}
              >
                P{lesson.Period} · {lesson.AssignedStarLevel} · {lesson.LessonCode}
              </Button>
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
    </AccessGate>
  );
}