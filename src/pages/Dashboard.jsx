import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, Users, Calendar, ClipboardList, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

function StatCard({ title, value, icon: Icon, color, to }) {
  const content = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const { personnel } = usePersonnel();
  const level = personnel?.AccessLevel ?? 0;
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todaySchedule = [] } = useQuery({
    queryKey: ['schedule-today', today],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: today }),
  });

  const { data: todayParade = [] } = useQuery({
    queryKey: ['parade-today', today],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: today }),
    enabled: hasAccess(level, ACCESS_LEVELS.CADET_NCO),
  });

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['pending-tasks'],
    queryFn: () => base44.entities.ProgressLedger.filter({ Status: 'Pending' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['personnel-count'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_COMMANDER),
  });

  const presentCount = todayParade.filter(p => p.AttendanceStatus === 'Present').length;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${personnel?.Surname || 'User'}`}
        description={`${format(new Date(), 'EEEE, d MMMM yyyy')} — ${personnel?.RoleName || ''}`}
        icon={LayoutDashboard}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Tonight's Lessons"
          value={todaySchedule.length}
          icon={Calendar}
          color="bg-primary/10 text-primary"
          to="/schedule"
        />
        {hasAccess(level, ACCESS_LEVELS.CADET_NCO) && (
          <StatCard
            title="Present Tonight"
            value={presentCount}
            icon={ClipboardList}
            color="bg-chart-2/10 text-chart-2"
            to="/parade"
          />
        )}
        {hasAccess(level, ACCESS_LEVELS.DET_2IC) && (
          <StatCard
            title="Pending Approvals"
            value={pendingTasks.length}
            icon={CheckCircle2}
            color="bg-accent/20 text-accent-foreground"
            to="/tasks"
          />
        )}
        {hasAccess(level, ACCESS_LEVELS.DET_COMMANDER) && (
          <StatCard
            title="Personnel"
            value={`${allPersonnel.length}/999`}
            icon={Users}
            color="bg-chart-5/10 text-chart-5"
            to="/personnel"
          />
        )}
      </div>

      {/* Tonight's Schedule Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            Tonight's Training Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySchedule.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No lessons scheduled for tonight.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySchedule.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Badge variant="outline" className="shrink-0">
                    Period {entry.Period}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary border-0 shrink-0">
                    {entry.AssignedStarLevel}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{entry.LessonName || entry.LessonCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.Location && `${entry.Location} · `}{entry.DressCode || ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts for L4+ */}
      {hasAccess(level, ACCESS_LEVELS.DET_2IC) && todaySchedule.length > 0 && (
        <Card className="mt-4 border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" />
              Exception Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const scheduledInstructors = [...new Set(todaySchedule.map(s => s.InstructorPNumber))];
              const absentInstructors = scheduledInstructors.filter(ip =>
                todayParade.some(p => p.UserPNumber === ip && p.AttendanceStatus !== 'Present')
              );
              if (absentInstructors.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-chart-2" />
                    All scheduled instructors are present.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  {absentInstructors.map(ip => (
                    <div key={ip} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-sm">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <span>Instructor <strong>{ip}</strong> is absent but has scheduled lessons.</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}