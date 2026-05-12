import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart2, Users, ShieldAlert, Star, UserCheck } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { ACCESS_LEVELS, isCadet, isAdultInstructor } from '@/lib/accessLevels';

const COLORS = ['#2D8E43','#159DC4','#EC6223','#E61C3B','#083F30','#6FB043'];
const STAR_LEVELS = ['Basic','1 Star','2 Star','3 Star','4 Star'];
const MANDATORY_GOVERNANCE = ['First Aid','Data Protection','Safeguarding'];

export default function AnalyticsDashboard() {
  const { personnel: me } = usePersonnel();

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: parade = [] } = useQuery({
    queryKey: ['parade-all'],
    queryFn: () => base44.entities.DailyParadeState.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: governance = [] } = useQuery({
    queryKey: ['cfav-governance'],
    queryFn: () => base44.entities.CFAVGovernance.filter({}),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['staff-availability'],
    queryFn: () => base44.entities.StaffAvailability.filter({}),
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  // ── Personnel splits
  const activeCadets = useMemo(() => allPersonnel.filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'), [allPersonnel]);
  const activeInstructors = useMemo(() => allPersonnel.filter(p => isAdultInstructor(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'), [allPersonnel]);

  // ── Attendance: last 30 days unique present days per person
  const recentParade = useMemo(() => parade.filter(p => p.AttendanceStatus === 'Present' && p.Date >= thirtyDaysAgo), [parade, thirtyDaysAgo]);
  const paradeDates = useMemo(() => [...new Set(parade.map(p => p.Date))].filter(d => d >= thirtyDaysAgo).sort(), [parade, thirtyDaysAgo]);

  // Cadet attendance rate per star level
  const cadetAttendanceByLevel = useMemo(() => {
    return STAR_LEVELS.map(sl => {
      const cadetsInLevel = activeCadets.filter(c => c.CurrentStarLevel === sl);
      if (cadetsInLevel.length === 0) return null;
      const totalPossible = cadetsInLevel.length * paradeDates.length;
      const attended = recentParade.filter(p => cadetsInLevel.some(c => c.PNumber === p.UserPNumber)).length;
      return { name: sl, rate: totalPossible > 0 ? Math.round((attended / totalPossible) * 100) : 0, count: cadetsInLevel.length };
    }).filter(Boolean);
  }, [activeCadets, recentParade, paradeDates]);

  // Adult attendance rate (last 30 days)
  const adultAttendance = useMemo(() => {
    return activeInstructors.map(inst => {
      const nights = recentParade.filter(p => p.UserPNumber === inst.PNumber).length;
      return { name: `${inst.Rank || ''} ${inst.Surname}`.trim(), nights, total: paradeDates.length };
    }).sort((a, b) => b.nights - a.nights).slice(0, 10);
  }, [activeInstructors, recentParade, paradeDates]);

  // ── Star level completion (mandatory lessons at CURRENT star level)
  const cadetCompletionByLevel = useMemo(() => {
    return STAR_LEVELS.map(sl => {
      const mandatoryLessons = syllabus.filter(l => l.StarLevel === sl && l.IsMandatory);
      if (mandatoryLessons.length === 0) return null;
      const cadetsInLevel = activeCadets.filter(c => c.CurrentStarLevel === sl);
      if (cadetsInLevel.length === 0) return null;

      const approvedSet = new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`));
      const completionRates = cadetsInLevel.map(c => {
        const done = mandatoryLessons.filter(l => approvedSet.has(`${c.PNumber}::${l.LessonCode}`)).length;
        return (done / mandatoryLessons.length) * 100;
      });
      const avg = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;
      const fullyComplete = completionRates.filter(r => r === 100).length;
      return { name: sl, avgCompletion: Math.round(avg), fullyComplete, total: cadetsInLevel.length, mandatoryCount: mandatoryLessons.length };
    }).filter(Boolean);
  }, [activeCadets, syllabus, progress]);

  // ── Adults failing mandatory governance
  const failingGovernance = useMemo(() => {
    return activeInstructors.map(inst => {
      const missing = MANDATORY_GOVERNANCE.filter(course => {
        const rec = governance.find(g => g.PNumber === inst.PNumber && g.CourseType === course);
        if (!rec) return true;
        if (!rec.ExpiryDate) return false;
        return new Date(rec.ExpiryDate) < new Date();
      });
      return { person: inst, missing };
    }).filter(r => r.missing.length > 0);
  }, [activeInstructors, governance]);

  // ── Staff availability trend (last 6 training nights)
  const availTrend = useMemo(() => {
    const nights = [...new Set(availability.map(a => a.EventDate))].sort().slice(-8);
    return nights.map(d => {
      const avail = availability.filter(a => a.EventDate === d && a.IsAvailable).length;
      const unavail = availability.filter(a => a.EventDate === d && !a.IsAvailable).length;
      return { date: format(parseISO(d), 'dd MMM'), available: avail, unavailable: unavail };
    });
  }, [availability]);

  // ── Quick summary stats
  const totalApproved = useMemo(() => new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`)).size, [progress]);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Analytics Dashboard"
        description="Training, attendance and compliance insights"
        icon={BarChart2}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-4 h-4 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Active Cadets</p><p className="text-2xl font-bold">{activeCadets.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-chart-2/10 flex items-center justify-center"><UserCheck className="w-4 h-4 text-chart-2" /></div>
          <div><p className="text-xs text-muted-foreground">Active Instructors</p><p className="text-2xl font-bold">{activeInstructors.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center"><Star className="w-4 h-4 text-accent-foreground" /></div>
          <div><p className="text-xs text-muted-foreground">Lessons Approved</p><p className="text-2xl font-bold">{totalApproved}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center"><ShieldAlert className="w-4 h-4 text-destructive" /></div>
          <div><p className="text-xs text-muted-foreground">Governance Issues</p><p className="text-2xl font-bold">{failingGovernance.length}</p></div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cadet attendance by star level */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4" />Cadet Attendance Rate — Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            {paradeDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No parade data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cadetAttendanceByLevel} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="rate" name="Attendance %" fill="#2D8E43" radius={[4,4,0,0]}>
                    {cadetAttendanceByLevel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Staff availability trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="w-4 h-4" />Staff Availability Trend</CardTitle></CardHeader>
          <CardContent>
            {availTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No availability data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={availTrend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="available" name="Available" fill="#2D8E43" radius={[4,4,0,0]} stackId="a" />
                  <Bar dataKey="unavailable" name="Unavailable" fill="#E61C3B" radius={[4,4,0,0]} stackId="a" />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Star level completion */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4" />Mandatory Lesson Completion — Current Star Level</CardTitle></CardHeader>
          <CardContent>
            {cadetCompletionByLevel.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {cadetCompletionByLevel.map(sl => (
                  <div key={sl.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold">{sl.name}</span>
                      <span className="text-muted-foreground">{sl.fullyComplete}/{sl.total} fully complete · Avg {sl.avgCompletion}%</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${sl.avgCompletion}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Governance failures */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><ShieldAlert className="w-4 h-4" />Adults Failing Mandatory Compliance</CardTitle></CardHeader>
          <CardContent>
            {failingGovernance.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-sm text-muted-foreground">All instructors compliant.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {failingGovernance.map(({ person, missing }) => (
                  <div key={person.PNumber} className="flex items-start justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="text-sm font-semibold">{[person.Rank, person.Surname].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-muted-foreground">{person.PNumber}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                      {missing.map(m => <Badge key={m} variant="destructive" className="text-xs py-0 h-5">{m}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Adult attendance table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Adult Instructor Attendance — Last 30 Days ({paradeDates.length} nights)</CardTitle></CardHeader>
        <CardContent>
          {adultAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No attendance data yet.</p>
          ) : (
            <div className="space-y-1.5">
              {adultAttendance.map(a => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-36 truncate">{a.name}</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-4 rounded-full transition-all"
                      style={{
                        width: a.total > 0 ? `${Math.round((a.nights / a.total) * 100)}%` : '0%',
                        background: a.total > 0 && (a.nights / a.total) >= 0.75 ? '#2D8E43' : '#EC6223'
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">{a.nights}/{a.total} nights</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AccessGate>
  );
}