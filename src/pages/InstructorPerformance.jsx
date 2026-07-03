import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function InstructorPerformance() {
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['instructor-attendance-ledger'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.filter({}),
  });

  // Only Adult Instructors and Cadet Instructors (RoleName contains "Instructor")
  const instructors = useMemo(() =>
    allPersonnel.filter(p =>
      (p.PersonnelStatus || 'Active') === 'Active' &&
      (p.Type === 'Adult Instructor' || (p.RoleName || '').toLowerCase().includes('instructor'))
    ),
    [allPersonnel]
  );

  const stats = useMemo(() => {
    return instructors.map(inst => {
      const sessions = schedule.filter(s => s.InstructorPNumber === inst.PNumber || s.Instructor2PNumber === inst.PNumber);
      const coverageByStar = {};
      STAR_LEVELS.forEach(sl => {
        coverageByStar[sl] = sessions.filter(s => s.AssignedStarLevel === sl).length;
      });
      const attendanceRecords = ledger.filter(l => l.InstructorPNumber === inst.PNumber);
      const present = attendanceRecords.filter(r => r.AttendanceStatus === 'Present').length;
      const total = attendanceRecords.length;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;
      return { inst, totalSessions: sessions.length, coverageByStar, attendanceRate, total, present };
    }).sort((a, b) => b.totalSessions - a.totalSessions);
  }, [instructors, schedule, ledger]);

  const totalSessionsCovered = stats.reduce((sum, s) => sum + s.totalSessions, 0);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Instructor Performance"
        description="Session coverage and attendance history for Adult and Cadet Instructors across all star levels"
        icon={TrendingUp}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Instructors Tracked</p>
            <p className="text-2xl font-bold">{instructors.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Sessions Covered</p>
            <p className="text-2xl font-bold">{totalSessionsCovered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Attendance Records</p>
            <p className="text-2xl font-bold">{ledger.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {stats.map(({ inst, totalSessions, coverageByStar, attendanceRate, present, total }) => {
          const name = [inst.Rank, inst.FirstName, inst.Surname].filter(Boolean).join(' ');
          const rateColor = attendanceRate === null ? 'text-muted-foreground' : attendanceRate >= 80 ? 'text-chart-2' : attendanceRate >= 60 ? 'text-amber-600' : 'text-destructive';
          return (
            <Card key={inst.PNumber}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">{inst.PNumber} · {inst.RoleName || inst.Type}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold">{totalSessions}</p>
                      <p className="text-xs text-muted-foreground">Sessions</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${rateColor}`}>{attendanceRate !== null ? `${attendanceRate}%` : '—'}</p>
                      <p className="text-xs text-muted-foreground">Attendance ({present}/{total})</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STAR_LEVELS.map(sl => (
                    <Badge key={sl} variant={coverageByStar[sl] > 0 ? 'default' : 'outline'} className="text-xs">
                      {sl}: {coverageByStar[sl]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {stats.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">No instructor records yet.</p>
        )}
      </div>
    </AccessGate>
  );
}