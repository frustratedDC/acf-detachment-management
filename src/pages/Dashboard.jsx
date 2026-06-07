import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS, isCadet, isAdultInstructor } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, Calendar, ClipboardList, BookOpen,
  AlertTriangle, CheckCircle2, Megaphone, CalendarDays, ArrowRight, Check, HeartHandshake
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import MyInspections from '@/components/dashboard/MyInspections';
import KADashboardWidget from '@/components/dashboard/KADashboardWidget';

const PRIORITY_COLORS = {
  Urgent: 'border-l-4 border-destructive bg-destructive/5',
  High:   'border-l-4 border-accent bg-accent/5',
  Normal: 'border-l-4 border-primary/30 bg-muted/30',
  Low:    'border-l-4 border-muted bg-muted/10',
};

const PRIORITY_BADGE = {
  Urgent: 'bg-destructive text-destructive-foreground',
  High:   'bg-accent text-accent-foreground',
  Normal: 'bg-primary/10 text-primary',
  Low:    'bg-muted text-muted-foreground',
};

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const level = personnel?.AccessLevel ?? 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  const in60Days = format(addDays(new Date(), 60), 'yyyy-MM-dd');

  const { data: todaySchedule = [] } = useQuery({
    queryKey: ['schedule-today', today],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: today }),
  });

  const { data: todayParade = [] } = useQuery({
    queryKey: ['parade-today', today],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: today }),
    enabled: hasAccess(level, ACCESS_LEVELS.CADET_NCO),
  });

  const { data: pendingProgress = [] } = useQuery({
    queryKey: ['pending-tasks'],
    queryFn: () => base44.entities.ProgressLedger.filter({ Status: 'Pending' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: pendingCE = [] } = useQuery({
    queryKey: ['pending-ce-dash'],
    queryFn: () => base44.entities.CommunityEngagementLedger.filter({ Status: 'Pending' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: pendingAccess = [] } = useQuery({
    queryKey: ['pending-access-dash'],
    queryFn: () => base44.entities.AccessRequest.filter({ Status: 'Pending' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: pendingCourses = [] } = useQuery({
    queryKey: ['pending-courses-dash'],
    queryFn: () => base44.entities.CourseRequest.filter({ Status: 'Pending' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: openIssues = [] } = useQuery({
    queryKey: ['open-issues-dash'],
    queryFn: () => base44.entities.IssueReport.filter({ Status: 'Open' }),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_2IC),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['personnel-count'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
    enabled: hasAccess(level, ACCESS_LEVELS.DET_COMMANDER),
  });

  // Upcoming events (next 60 days)
  const { data: allEvents = [] } = useQuery({
    queryKey: ['calendar-events-upcoming'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });

  // Important notices
  const { data: notices = [] } = useQuery({
    queryKey: ['important-notices'],
    queryFn: () => base44.entities.ImportantNotice.filter({ IsActive: true }),
  });

  const presentCount = todayParade.filter(p => p.AttendanceStatus === 'Present').length;

  const upcomingEvents = allEvents
    .filter(ev => ev.Date >= today && ev.Date <= in60Days)
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .slice(0, 8);

  const activeNotices = notices
    .filter(n => !n.ExpiryDate || n.ExpiryDate >= today)
    .sort((a, b) => {
      const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
      return (order[a.Priority] ?? 2) - (order[b.Priority] ?? 2);
    });

  const acknowledgeMutation = useMutation({
    mutationFn: ({ notice }) => {
      const current = notice.AcknowledgedBy || [];
      if (current.includes(personnel?.PNumber)) return Promise.resolve();
      return base44.entities.ImportantNotice.update(notice.id, {
        AcknowledgedBy: [...current, personnel?.PNumber],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['important-notices'] }),
  });

  const isAcknowledged = (notice) =>
    (notice.AcknowledgedBy || []).includes(personnel?.PNumber);

  // CE hours (cadets only)
  const { data: myCEEntries = [] } = useQuery({
    queryKey: ['ce-mine', personnel?.PNumber],
    queryFn: () => base44.entities.CommunityEngagementLedger.filter({ CadetPNumber: personnel?.PNumber }),
    enabled: !!personnel?.PNumber && isCadet(level),
  });

  const myCETotalHours = myCEEntries
    .filter(e => e.Status === 'Approved')
    .reduce((s, e) => s + (e.Hours || 0), 0);

  const pendingTaskCount = pendingProgress.length + pendingCE.length + pendingAccess.length + pendingCourses.length + openIssues.length;

  // My WHT records
  const { data: myWHTs = [] } = useQuery({
    queryKey: ['wht-mine', personnel?.PNumber],
    queryFn: () => base44.entities.WeaponHandlingTest.filter({ PNumber: personnel?.PNumber }),
    enabled: !!personnel?.PNumber,
  });

  const expiringWHTs = myWHTs.filter(w => {
    if (!w.ExpiryDate) return false;
    const daysLeft = Math.ceil((new Date(w.ExpiryDate) - new Date()) / 86400000);
    return daysLeft <= 60;
  });

  // My assigned lessons today (for instructors/cadets)
  const myLessonsToday = todaySchedule.filter(s =>
    isAdultInstructor(level)
      ? s.InstructorPNumber === personnel?.PNumber
      : isCadet(level) && s.AssignedStarLevel === personnel?.CurrentStarLevel
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${personnel?.Surname || 'User'}`}
        description={`${format(new Date(), 'EEEE, d MMMM yyyy')} — ${personnel?.RoleName || ''}`}
        icon={LayoutDashboard}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasAccess(level, ACCESS_LEVELS.CADET_NCO) && (
          <StatCard title="Present Tonight" value={presentCount} icon={ClipboardList} color="bg-chart-2/10 text-chart-2" to="/parade" />
        )}
        {hasAccess(level, ACCESS_LEVELS.DET_2IC) && (
          <StatCard title="Pending Approvals" value={pendingTaskCount} icon={CheckCircle2} color="bg-accent/20 text-accent-foreground" to="/tasks" />
        )}
        {hasAccess(level, ACCESS_LEVELS.DET_COMMANDER) && (
          <StatCard title="Personnel" value={allPersonnel.length} icon={Users} color="bg-chart-5/10 text-chart-5" to="/personnel" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Tonight + My Lessons */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tonight's Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Tonight's Training Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaySchedule.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <BookOpen className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No lessons scheduled for tonight.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySchedule.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <Badge variant="outline" className="shrink-0">P{entry.Period}</Badge>
                      <Badge className="bg-primary/10 text-primary border-0 shrink-0">{entry.AssignedStarLevel}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{entry.LessonName || entry.LessonCode}</p>
                        <p className="text-xs text-muted-foreground">{entry.Location && `${entry.Location} · `}{entry.DressCode || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Assigned Lessons */}
          {myLessonsToday.length > 0 && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  My Lessons Tonight
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myLessonsToday.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Badge variant="outline" className="shrink-0">P{entry.Period}</Badge>
                    <Badge className="bg-primary/10 text-primary border-0 shrink-0">{entry.AssignedStarLevel}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{entry.LessonName || entry.LessonCode}</p>
                      <p className="text-xs text-muted-foreground">{entry.Location || ''}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="shrink-0"
                      onClick={() => navigate('/attendance')}
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />Attendance
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Community Engagement widget (cadets only) */}
          {isCadet(level) && (
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-primary" />
                    Community Engagement
                  </CardTitle>
                  <Link to="/community-engagement">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      View <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-bold">{myCETotalHours.toFixed(1)}h</span>
                  <span className="text-xs text-muted-foreground">approved hours</span>
                </div>
                {['1 Star', '2 Star'].map(sl => {
                  const req = sl === '1 Star' ? 4 : 8;
                  const met = myCETotalHours >= req;
                  return (
                    <div key={sl} className="mb-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                        <span>{sl}: {req}h (Required)</span>
                        <span>{met ? '✓ Met' : `${Math.max(0, req - myCETotalHours).toFixed(1)}h remaining`}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`rounded-full h-1.5 ${met ? 'bg-chart-2' : 'bg-primary'}`}
                          style={{ width: `${Math.min(100, (myCETotalHours / req) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* KA Points widget (cadets only) */}
          {isCadet(level) && <KADashboardWidget personnel={personnel} />}

          {/* My Inspections (Cadets only) */}
          {isCadet(level) && <MyInspections />}

          {/* WHT Expiry Alert */}
          {expiringWHTs.length > 0 && (
            <Card className="border-yellow-400/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="w-4 h-4" />WHT Expiry Warning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {expiringWHTs.map(w => {
                  const daysLeft = Math.ceil((new Date(w.ExpiryDate) - new Date()) / 86400000);
                  return (
                    <div key={w.id} className="flex items-center justify-between text-sm p-2 rounded bg-yellow-50">
                      <span className="font-medium">{w.WeaponType}</span>
                      <span className={`text-xs font-semibold ${daysLeft < 0 ? 'text-destructive' : 'text-yellow-700'}`}>
                        {daysLeft < 0 ? 'EXPIRED' : `${daysLeft}d remaining`}
                      </span>
                    </div>
                  );
                })}
                <Link to="/wht" className="block">
                  <Button variant="outline" size="sm" className="w-full mt-1 text-xs">View WHT Records</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Exception Monitor for L4+ */}
          {hasAccess(level, ACCESS_LEVELS.DET_2IC) && todaySchedule.length > 0 && (() => {
            const scheduledInstructors = [...new Set(todaySchedule.map(s => s.InstructorPNumber))];
            const absentInstructors = scheduledInstructors.filter(ip =>
              todayParade.some(p => p.UserPNumber === ip && p.AttendanceStatus !== 'Present')
            );
            if (absentInstructors.length === 0) return null;
            return (
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-4 h-4" />Exception Monitor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {absentInstructors.map(ip => (
                    <div key={ip} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      <span>Instructor <strong>{ip}</strong> is absent but has scheduled lessons.</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Right column — Notices + Upcoming Events */}
        <div className="space-y-4">
          {/* Important Notices */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-destructive" />
                  Important Notices
                </CardTitle>
                {hasAccess(level, ACCESS_LEVELS.DET_2IC) && (
                  <Link to="/notices">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      Manage <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeNotices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No active notices.</p>
              ) : (
                <div className="space-y-2">
                  {activeNotices.slice(0, 5).map(n => {
                    const acked = isAcknowledged(n);
                    return (
                      <div key={n.id} className={`p-2.5 rounded-lg ${PRIORITY_COLORS[n.Priority] || PRIORITY_COLORS.Normal} ${acked ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${acked ? '' : 'font-semibold'}`}>{n.Title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={`text-xs ${PRIORITY_BADGE[n.Priority]}`}>{n.Priority}</Badge>
                            {!acked && (
                              <button
                                onClick={() => acknowledgeMutation.mutate({ notice: n })}
                                className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center hover:bg-black/10 transition-colors"
                                title="Acknowledge"
                              >
                                <Check className="w-2.5 h-2.5" />
                              </button>
                            )}
                            {acked && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.Body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Upcoming Events
                </CardTitle>
                <Link to="/calendar">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No upcoming events.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="shrink-0 text-center bg-primary/10 rounded-lg p-1.5 min-w-[44px]">
                        <p className="text-xs font-bold text-primary">{format(parseISO(ev.Date), 'dd')}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(ev.Date), 'MMM')}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ev.Title}</p>
                        <p className="text-xs text-muted-foreground">{ev.EventType}{ev.Location ? ` · ${ev.Location}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}