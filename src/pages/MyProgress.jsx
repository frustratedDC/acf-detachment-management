import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Shield, Clock, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

const KA_BENCHMARKS = { '1 Star': 12, '2 Star': 16, '3 Star': 31 };

function StatBox({ label, value, sub, color = 'text-primary' }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function MyProgress() {
  const { personnel } = usePersonnel();
  const pnum = personnel?.PNumber;
  const isAdult = personnel?.Type === 'Adult Instructor';
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['my-progress', pnum],
    queryFn: () => base44.entities.ProgressLedger.filter({ CadetPNumber: pnum }),
    enabled: !!pnum,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['my-attendance', pnum],
    queryFn: () => base44.entities.DailyParadeState.filter({ UserPNumber: pnum }),
    enabled: !!pnum,
  });

  const { data: myWHTs = [] } = useQuery({
    queryKey: ['wht-mine', pnum],
    queryFn: () => base44.entities.WeaponHandlingTest.filter({ PNumber: pnum }),
    enabled: !!pnum,
  });

  const { data: kaSessions = [] } = useQuery({
    queryKey: ['ka-sessions-mine', pnum],
    queryFn: () => base44.entities.KA_Session.filter({ Name: pnum }),
    enabled: !!pnum,
  });

  const { data: kaLogbook = [] } = useQuery({
    queryKey: ['ka-logbook-mine', pnum],
    queryFn: () => base44.entities.KA_LogBook.filter({ Name: pnum }),
    enabled: !!pnum,
  });

  // KA total (simple sum from logbook + sessions duration-based participation for now)
  const kaTotalPts = useMemo(() => {
    const lb = kaLogbook.reduce((s, e) => s + (e.Points || 0), 0);
    // session total = floor(duration/30)*2 per session (participation only without full scoring here)
    const sess = kaSessions.reduce((s, e) => s + Math.floor((e.Duration_Minutes || 0) / 30) * 2, 0);
    return lb + sess;
  }, [kaLogbook, kaSessions]);

  const kaStarLevel = personnel?.CurrentStarLevel;
  const kaBenchmark = KA_BENCHMARKS[kaStarLevel] ?? null;

  // Attendance %
  const attendanceRate = useMemo(() => {
    if (!attendance.length) return null;
    const present = attendance.filter(a => a.AttendanceStatus === 'Present').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  // WHT expiry
  const expiringWHTs = myWHTs.filter(w => {
    if (!w.ExpiryDate) return false;
    const days = Math.ceil((new Date(w.ExpiryDate) - new Date()) / 86400000);
    return days <= 60;
  });

  // Syllabus grouped
  const approvedLessons = new Set(progress.filter(p => p.Status === 'Approved').map(p => p.LessonCode));
  const pendingLessons = new Set(progress.filter(p => p.Status === 'Pending').map(p => p.LessonCode));

  const sylByLevel = useMemo(() => {
    const out = {};
    STAR_LEVELS.forEach(sl => {
      const lessons = syllabus.filter(s => s.StarLevel === sl);
      if (!lessons.length) return;
      const subjects = {};
      lessons.forEach(l => {
        if (!subjects[l.SubjectName]) subjects[l.SubjectName] = [];
        subjects[l.SubjectName].push(l);
      });
      out[sl] = subjects;
    });
    return out;
  }, [syllabus]);

  const [expandedLevels, setExpandedLevels] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});

  function toggleLevel(sl) { setExpandedLevels(p => ({ ...p, [sl]: !p[sl] })); }
  function toggleSubject(key) { setExpandedSubjects(p => ({ ...p, [key]: !p[key] })); }

  function levelStatus(sl) {
    const subjects = sylByLevel[sl];
    if (!subjects) return 'Not Started';
    const allLessons = Object.values(subjects).flat();
    if (!allLessons.length) return 'Not Started';
    const done = allLessons.filter(l => approvedLessons.has(l.LessonCode)).length;
    if (done === allLessons.length) return 'Completed';
    if (done > 0 || allLessons.some(l => pendingLessons.has(l.LessonCode))) return 'In Progress';
    return 'Not Started';
  }

  function subjectStatus(lessons) {
    const done = lessons.filter(l => approvedLessons.has(l.LessonCode)).length;
    if (done === lessons.length) return 'Completed';
    if (done > 0 || lessons.some(l => pendingLessons.has(l.LessonCode))) return 'In Progress';
    return 'Not Started';
  }

  const statusColors = {
    'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    'Not Started': 'bg-red-100 text-red-700 border-red-200',
  };

  const lessonCardColor = (code) => {
    if (approvedLessons.has(code)) return 'bg-emerald-50 border-emerald-200';
    if (pendingLessons.has(code)) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Progress"
        description={`${personnel?.Rank || ''} ${personnel?.FirstName || ''} ${personnel?.Surname || ''} — ${personnel?.CurrentStarLevel || ''}`}
        icon={TrendingUp}
      />

      {/* Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label="KA Points"
          value={kaTotalPts}
          sub={kaBenchmark ? `${kaBenchmark} req. for ${kaStarLevel}` : undefined}
          color="text-primary"
        />
        <StatBox
          label="Attendance"
          value={attendanceRate != null ? `${attendanceRate}%` : '—'}
          sub={`${attendance.length} parades recorded`}
          color="text-chart-2"
        />
        <StatBox
          label="WHT Expiries"
          value={expiringWHTs.length}
          sub={expiringWHTs.length ? 'within 60 days' : 'All current'}
          color={expiringWHTs.length ? 'text-destructive' : 'text-emerald-600'}
        />
        <StatBox
          label="KA Sessions"
          value={kaSessions.length}
          sub={`${kaLogbook.length} log book entries`}
          color="text-accent-foreground"
        />
      </div>

      {/* WHT Alert */}
      {expiringWHTs.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> WHT Expiry Warning
            </p>
            {expiringWHTs.map(w => {
              const days = Math.ceil((new Date(w.ExpiryDate) - new Date()) / 86400000);
              return (
                <div key={w.id} className="flex justify-between text-sm py-1 border-b border-amber-200 last:border-0">
                  <span>{w.WeaponType}</span>
                  <span className={days < 0 ? 'text-destructive font-bold' : 'text-amber-700'}>
                    {days < 0 ? 'EXPIRED' : `${days} days remaining`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Syllabus Completion */}
      {!isAdult && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Syllabus Completion
          </h2>
          <div className="space-y-2">
            {STAR_LEVELS.filter(sl => sylByLevel[sl]).map(sl => {
              const ls = levelStatus(sl);
              const subjects = sylByLevel[sl];
              const allLessons = Object.values(subjects).flat();
              const doneCnt = allLessons.filter(l => approvedLessons.has(l.LessonCode)).length;
              const pct = allLessons.length ? Math.round((doneCnt / allLessons.length) * 100) : 0;
              const isOpen = !!expandedLevels[sl];
              return (
                <div key={sl} className="border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-left transition-colors"
                    onClick={() => toggleLevel(sl)}
                  >
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-semibold">{sl}</span>
                      <Badge className={`text-xs ${statusColors[ls]}`}>{ls}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{doneCnt}/{allLessons.length}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-3 space-y-2">
                      {Object.entries(subjects).sort().map(([subject, lessons]) => {
                        const ss = subjectStatus(lessons);
                        const sk = `${sl}-${subject}`;
                        const isSubOpen = !!expandedSubjects[sk];
                        const sdone = lessons.filter(l => approvedLessons.has(l.LessonCode)).length;
                        const spct = Math.round((sdone / lessons.length) * 100);
                        return (
                          <div key={subject} className="border rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 text-left text-sm transition-colors"
                              onClick={() => toggleSubject(sk)}
                            >
                              <div className="flex items-center gap-2">
                                {isSubOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span className="font-medium">{subject}</span>
                                <Badge className={`text-xs ${statusColors[ss]}`}>{ss}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${spct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{sdone}/{lessons.length}</span>
                              </div>
                            </button>
                            {isSubOpen && (
                              <div className="p-2 space-y-1">
                                {lessons.sort((a, b) => a.LessonCode.localeCompare(b.LessonCode)).map(lesson => {
                                  const approved = approvedLessons.has(lesson.LessonCode);
                                  const pending = pendingLessons.has(lesson.LessonCode);
                                  const myEntry = progress.find(p => p.LessonCode === lesson.LessonCode);
                                  return (
                                    <div key={lesson.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${lessonCardColor(lesson.LessonCode)}`}>
                                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{lesson.LessonCode}</span>
                                      <span className="flex-1 truncate">{lesson.LessonName}</span>
                                      {lesson.IsMandatory && <Badge variant="outline" className="text-xs border-destructive/40 text-destructive shrink-0">M</Badge>}
                                      <span className="text-xs shrink-0">
                                        {approved ? (
                                          <span className="text-emerald-700 font-medium">
                                            ✓ {myEntry?.CompletionDate ? format(new Date(myEntry.CompletionDate + 'T00:00:00'), 'd MMM yy') : 'Done'}
                                          </span>
                                        ) : pending ? (
                                          <span className="text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>
                                        ) : (
                                          <span className="text-red-600">Not completed</span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}