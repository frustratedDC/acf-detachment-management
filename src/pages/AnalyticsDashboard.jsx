import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { getAuditInfo } from '@/lib/FeatureAuditLog';
import AccessGate from '@/components/shared/AccessGate';
import BriefingBar from '@/components/shared/BriefingBar';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, AlertTriangle, Clock, ClipboardList, AlertCircle, BookOpen,
  Calendar, Zap, BarChart2, RefreshCw
} from 'lucide-react';
import { format, subDays, differenceInDays, parseISO } from 'date-fns';
import { ACCESS_LEVELS, isCadet, isAdultInstructor } from '@/lib/accessLevels';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

function getStatusColor(status) {
  switch (status) {
    case 'green':
      return 'bg-chart-2/10 border-chart-2/30 text-chart-2';
    case 'amber':
      return 'bg-amber-100/30 border-amber-300/50 text-amber-700';
    case 'red':
      return 'bg-destructive/10 border-destructive/30 text-destructive';
    default:
      return 'bg-card border-border';
  }
}

function MetricCard({ title, value, status = 'green', icon: Icon, onClick, details = [] }) {
  return (
    <Card className={`cursor-pointer border-2 transition-all hover:shadow-md ${getStatusColor(status)}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" />}
            <p className="text-xs font-semibold uppercase tracking-wide">{title}</p>
          </div>
          {status === 'amber' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {status === 'red' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        </div>
        <p className="text-3xl font-bold mb-2">{value}</p>
        {details.length > 0 && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {details.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const { personnel: me } = usePersonnel();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissedBriefing, setDismissedBriefing] = useState(false);
  const auditInfo = getAuditInfo('/analytics');

  const { data: allPersonnel = [], isLoading: loadingPersonnel } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: instructorAttendance = [] } = useQuery({
    queryKey: ['instructor-attendance'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.filter({}),
  });

  const { data: qualifications = [] } = useQuery({
    queryKey: ['qualifications'],
    queryFn: () => base44.entities.QualificationMatrix.filter({}),
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['policy-registry'],
    queryFn: () => base44.entities.PolicyRegistry.filter({}),
  });

  const { data: trainingMonths = [] } = useQuery({
    queryKey: ['training-months'],
    queryFn: () => base44.entities.TrainingMonth.filter({}),
  });

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  // ROW 1: Operational Readiness
  const activeCadets = useMemo(() => 
    allPersonnel.filter(p => isCadet(p.AccessLevel) && p.PersonnelStatus === 'Active'),
    [allPersonnel]
  );

  const activeInstructors = useMemo(() =>
    allPersonnel.filter(p => isAdultInstructor(p.AccessLevel) && p.PersonnelStatus === 'Active'),
    [allPersonnel]
  );

  const instructorAttendanceRate = useMemo(() => {
    if (activeInstructors.length === 0) return { rate: 0, status: 'green' };
    const recentAttendance = instructorAttendance.filter(a => a.Date >= format(thirtyDaysAgo, 'yyyy-MM-dd'));
    const present = recentAttendance.filter(a => a.AttendanceStatus === 'Present').length;
    const total = recentAttendance.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const status = rate >= 80 ? 'green' : rate >= 60 ? 'amber' : 'red';
    return { rate, status };
  }, [activeInstructors, instructorAttendance, thirtyDaysAgo]);

  const expiringQualifications = useMemo(() => {
    return qualifications.filter(q => {
      if (!q.ExpiryDate) return false;
      const daysUntilExpiry = differenceInDays(parseISO(q.ExpiryDate), today);
      return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
    });
  }, [qualifications, today]);

  const expiredQualifications = useMemo(() => {
    return qualifications.filter(q => {
      if (!q.ExpiryDate) return false;
      return new Date(q.ExpiryDate) < today;
    });
  }, [qualifications, today]);

  const qualStatus = expiredQualifications.length > 0 ? 'red' : expiringQualifications.length > 0 ? 'amber' : 'green';

  // ROW 2: Pending Actions
  const pendingApprovals = useMemo(() => {
    // Placeholder for access requests, course requests, etc.
    return 0;
  }, []);

  const attendanceDiscrepancies = useMemo(() => {
    // Instructors marked unavailable but showed up, or vice versa
    return 0;
  }, []);

  const expiredPolicies = useMemo(() => {
    return policies.filter(p => {
      if (!p.ExpiryDate) return false;
      return new Date(p.ExpiryDate) < today;
    });
  }, [policies, today]);

  const expiringPolicies = useMemo(() => {
    return policies.filter(p => {
      if (!p.ExpiryDate) return false;
      const daysUntilExpiry = differenceInDays(parseISO(p.ExpiryDate), today);
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    });
  }, [policies, today]);

  const governanceStatus = expiredPolicies.length > 0 ? 'red' : expiringPolicies.length > 0 ? 'amber' : 'green';

  // ROW 3: Training Progress
  const currentMonthTraining = useMemo(() => {
    const currentMonth = format(today, 'yyyy-MM-01');
    const trainingMonth = trainingMonths.find(m => m.MonthDate === currentMonth);
    return {
      locked: trainingMonth?.IsLocked || false,
      status: trainingMonth?.IsLocked ? 'amber' : 'green',
    };
  }, [trainingMonths, today]);

  const upcomingEvents = useMemo(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return calendarEvents.filter(e => {
      const eventDate = parseISO(e.Date);
      return eventDate >= today && eventDate <= nextWeek;
    });
  }, [calendarEvents, today]);

  const handleRefresh = async () => {
    await queryClient.refetchQueries();
  };

  if (loadingPersonnel) {
    return (
      <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
        <PageHeader
          title="Executive Dashboard"
          description="At-a-glance operational status"
          icon={BarChart2}
        />
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AccessGate>
    );
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      {!dismissedBriefing && auditInfo && (
        <BriefingBar
          reason={auditInfo.reason}
          details={auditInfo.details}
          estimatedCompletion={auditInfo.estimatedCompletion}
          onDismiss={() => setDismissedBriefing(true)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground text-sm">At-a-glance operational status</p>
        </div>
        <Button onClick={handleRefresh} size="sm" variant="outline" className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* ROW 1: Operational Readiness */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Active Cadets"
          value={activeCadets.length}
          status="green"
          icon={Users}
          onClick={() => navigate('/personnel')}
          details={['Cadets on strength']}
        />

        <MetricCard
          title="Detachment Readiness"
          value={`${instructorAttendanceRate.rate}%`}
          status={instructorAttendanceRate.status}
          icon={AlertTriangle}
          onClick={() => navigate('/staff-availability')}
          details={['Last 30 days', activeInstructors.length > 0 ? `${activeInstructors.length} instructors` : 'No data']}
        />

        <MetricCard
          title="Qualification Alerts"
          value={expiringQualifications.length + expiredQualifications.length}
          status={qualStatus}
          icon={Clock}
          onClick={() => navigate('/instructor-quals')}
          details={[
            `${expiringQualifications.length} expiring soon`,
            `${expiredQualifications.length} expired`,
          ]}
        />
      </div>

      {/* ROW 2: Pending Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Pending Approvals"
          value={pendingApprovals}
          status={pendingApprovals > 0 ? 'amber' : 'green'}
          icon={ClipboardList}
          onClick={() => navigate('/tasks')}
          details={['Course requests, CE hours']}
        />

        <MetricCard
          title="Attendance Discrepancies"
          value={attendanceDiscrepancies}
          status={attendanceDiscrepancies > 0 ? 'red' : 'green'}
          icon={AlertCircle}
          onClick={() => navigate('/attendance')}
          details={['Availability vs. actual']}
        />

        <MetricCard
          title="Governance Review"
          value={expiredPolicies.length}
          status={governanceStatus}
          icon={BookOpen}
          onClick={() => navigate('/cfav-governance')}
          details={[
            `${expiringPolicies.length} due soon`,
            `${expiredPolicies.length} overdue`,
          ]}
        />
      </div>

      {/* ROW 3: Training Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="Training Plan Status"
          value={currentMonthTraining.locked ? 'LOCKED' : 'ACTIVE'}
          status={currentMonthTraining.status}
          icon={Calendar}
          onClick={() => navigate('/plan-generator')}
          details={[format(today, 'MMMM yyyy')]}
        />

        <MetricCard
          title="Upcoming Events (Next 7 Days)"
          value={upcomingEvents.length}
          status={upcomingEvents.length > 0 ? 'green' : 'amber'}
          icon={Zap}
          onClick={() => navigate('/calendar')}
          details={upcomingEvents.slice(0, 2).map(e => e.Title)}
        />
      </div>
    </AccessGate>
  );
}