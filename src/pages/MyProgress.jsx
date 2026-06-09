import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, Shield, Clock, Activity, ChevronDown, ChevronRight,
  AlertTriangle, Star, CheckCircle2, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import MyPaymentsWidget from "@/components/accounts/MyPaymentsWidget";
import {
  isAssessment,
  isSubjectComplete,
  subjectCompletionStatus,
  isReadyForAdvancement,
  getWhtAlerts,
  whtRangeGatekeeper,
  STAR_ORDER,
} from '@/lib/progressUtils';

const KA_BENCHMARKS = { '1 Star': 12, '2 Star': 16, '3 Star': 31 };

const SAA_SUBJECT = 'Skill at Arms';

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
  const isAdult = personnel?.Type === 'Adult Instructor' || personnel?.CurrentStarLevel === 'Adult';
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

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

  const { data: ceEntries = [] } = useQuery({
    queryKey: ['ce-mine', pnum],
    queryFn: () => base44.entities.CommunityEngagementLedger.filter({ CadetPNumber: pnum }),
    enabled: !!pnum,
  });

  const { data: myQuals = [] } = useQuery({
    queryKey: ['quals-mine', pnum],
    queryFn: () => base44.entities.QualificationMatrix.filter({ InstructorPNumber: pnum }),
    enabled: !!pnum,
  });

  // KA total
  const kaTotalPts = useMemo(() => kaLogbook.reduce((s, e) => s + (e.Points || 0), 0), [kaLogbook]);
  const kaStarLevel = personnel?.CurrentStarLevel;
  const kaBenchmark = KA_BENCHMARKS[kaStarLevel] ?? null;

  // Attendance %
  const attendanceRate = useMemo(() => {
    if (!attendance.length) return null;
    const present = attendance.filter(a => a.AttendanceStatus === 'Present').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  // WHT alerts (within 30 days or expired)
  const whtAlerts = useMemo(() => getWhtAlerts(myWHTs, 30, today), [myWHTs]);
  const rangeGate = useMemo(() => whtRangeGatekeeper(myWHTs, today), [myWHTs]);

  // Approved / pending sets
  const approvedCodes = useMemo(() =>
    new Set(progress.filter(p => p.Status === 'Approved').map(p => p.LessonCode)),
    [progress]
  );
  const pendingCodes = useMemo(() =>
    new Set(progress.filter(p => p.Status === 'Pending').map(p => p.LessonCode)),
    [progress]
  );

  // Syllabus grouped by level → subject
  const sylByLevel = useMemo(() => {
    const out = {};
    STAR_ORDER.forEach(sl => {
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

  // Ready for advancement check
  const currentStarLevel = personnel?.CurrentStarLevel;
  const readyForAdvancement = useMemo(() => {
    if (!currentStarLevel || !syllabus.length) return false;
    return isReadyForAdvancement(currentStarLevel, syllabus, approvedCodes);
  }, [currentStarLevel, syllabus, approvedCodes]);

  const [expandedLevels, setExpandedLevels] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});

  function toggleLevel(sl) { setExpandedLevels(p => ({ ...p, [sl]: !p[sl] })); }
  function toggleSubject(key) { setExpandedSubjects(p => ({ ...p, [key]: !p[key] })); }

  const statusColors = {
    'Completed':   'bg-emerald-100 text-emerald-800 border-emerald-200',
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    'Not Started': 'bg-red-100 text-red-700 border-red-200',
  };

  function levelStatusLabel(sl) {
    const subjects = sylByLevel[sl];
    if (!subjects) return 'Not Started';
    const entries = Object.entries(subjects);
    const allDone = entries.every(([name, lessons]) => isSubjectComplete(name, lessons, approvedCodes));
    if (allDone) return 'Completed';
    const anyProgress = entries.some(([name, lessons]) =>
      lessons.some(l => approvedCodes.has(l.LessonCode) || pendingCodes.has(l.LessonCode))
    );
    return anyProgress ? 'In Progress' : 'Not Started';
  }

  function lessonCardColor(code) {
    if (approvedCodes.has(code)) return 'bg-emerald-50 border-emerald-200';
    if (pendingCodes.has(code)) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Progress"
        description={`${personnel?.Rank || ''} ${personnel?.FirstName || ''} ${personnel?.Surname || ''} — ${personnel?.CurrentStarLevel || ''}`}
        icon={TrendingUp}
      />

      {/* Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatBox
          label="KA Points"
          value={kaTotalPts}
          sub={kaBenchmark ? `${kaBenchmark} req.` : undefined}
          color="text-primary"
        />
        <StatBox
          label="Attendance"
          value={attendanceRate != null ? `${attendanceRate}%` : '—'}
          sub={`${attendance.length} parades`}
          color="text-chart-2"
        />
        <StatBox
          label="WHT Alerts"
          value={whtAlerts.length}
          sub={whtAlerts.length ? 'expiring/expired' : 'All current'}
          color={whtAlerts.length ? 'text-destructive' : 'text-emerald-600'}
        />
        <StatBox
          label="KA Sessions"
          value={kaSessions.length}
          sub={`${kaLogbook.length} logbook entries`}
          color="text-accent-foreground"
        />
        <StatBox
          label="CE Hours"
          value={ceEntries.filter(e => e.Status === 'Approved').reduce((s, e) => s + (e.Hours || 0), 0)}
          sub={`${ceEntries.filter(e => e.Status === 'Pending').length} pending`}
          color="text-chart-3"
        />
        <StatBox
          label="Qualifications"
          value={myQuals.length}
          sub={myQuals.filter(q => q.Status === 'Expired').length > 0 ? `${myQuals.filter(q => q.Status === 'Expired').length} expired` : 'All current'}
          color={myQuals.some(q => q.Status === 'Expired') ? 'text-destructive' : 'text-emerald-600'}
        />
      </div>

      {/* WHT Range Access Gatekeeper Banner */}
      {!rangeGate.allowed && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-destructive" />
              <p className="text-sm font-bold text-destructive uppercase tracking-wide">Range Access — DENIED</p>
            </div>
            <p className="text-xs text-destructive/80 mb-2">Your WHT certifications are missing or expired. Range/shooting activities are blocked until resolved.</p>
            {rangeGate.issues.map((issue, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-destructive/20 last:border-0">
                <span className="font-medium">{issue.weaponType}</span>
                <span className="text-destructive font-bold">{issue.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* WHT Expiry Alerts (30-day window) */}
      {whtAlerts.length > 0 && (
        <Card className={whtAlerts.some(w => w.expired) ? 'border-destructive bg-destructive/5' : 'border-amber-300 bg-amber-50'}>
          <CardContent className="p-4">
            <p className={`text-sm font-semibold mb-2 flex items-center gap-2 ${whtAlerts.some(w => w.expired) ? 'text-destructive' : 'text-amber-800'}`}>
              <Shield className="w-4 h-4" /> WHT Expiry Alert
            </p>
            {whtAlerts.map(w => (
              <div key={w.id} className="flex justify-between text-sm py-1 border-b border-amber-200 last:border-0">
                <span>{w.WeaponType}</span>
                <span className={w.expired ? 'text-destructive font-bold' : 'text-amber-700'}>
                  {w.expired
                    ? `EXPIRED ${Math.abs(w.daysRemaining)} days ago`
                    : `Expires in ${w.daysRemaining} day${w.daysRemaining !== 1 ? 's' : ''}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ready for Advancement Banner */}
      {!isAdult && readyForAdvancement && (
        <Card className="border-emerald-400 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Ready for Advancement!</p>
              <p className="text-xs text-emerald-700">
                All subjects at <strong>{currentStarLevel}</strong> are complete. You are eligible to advance to{' '}
                <strong>{STAR_ORDER[STAR_ORDER.indexOf(currentStarLevel) + 1] || '—'}</strong>.
                Speak to your instructor to confirm promotion.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Payments */}
      <MyPaymentsWidget pnum={pnum} />

      {/* Syllabus Completion */}
      {!isAdult && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Syllabus Completion
          </h2>
          <div className="space-y-2">
            {STAR_ORDER.filter(sl => sylByLevel[sl]).map(sl => {
              const ls = levelStatusLabel(sl);
              const subjects = sylByLevel[sl];
              const allLessons = Object.values(subjects).flat();
              const nonAssessmentLessons = allLessons.filter(l => !isAssessment(l.LessonCode));
              const doneCnt = nonAssessmentLessons.filter(l => approvedCodes.has(l.LessonCode)).length;
              const pct = nonAssessmentLessons.length ? Math.round((doneCnt / nonAssessmentLessons.length) * 100) : 0;
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
                      {sl === currentStarLevel && (
                        <Badge variant="outline" className="text-xs border-primary/40 text-primary">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{doneCnt}/{nonAssessmentLessons.length}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-3 space-y-2">
                      {Object.entries(subjects).sort().map(([subject, lessons]) => {
                        const ss = subjectCompletionStatus(subject, lessons, approvedCodes, pendingCodes);
                        const sk = `${sl}-${subject}`;
                        const isSubOpen = !!expandedSubjects[sk];
                        const isSAA = subject === SAA_SUBJECT;

                        // For progress bar: count non-assessment lessons done
                        const stdLessons = lessons.filter(l => !isAssessment(l.LessonCode));
                        const sdone = stdLessons.filter(l => approvedCodes.has(l.LessonCode)).length;
                        const spct = stdLessons.length ? Math.round((sdone / stdLessons.length) * 100) : 0;

                        return (
                          <div key={subject} className="border rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 bg-muted/20 hover:bg-muted/40 text-left text-sm transition-colors"
                              onClick={() => toggleSubject(sk)}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                {isSubOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span className="font-medium">{subject}</span>
                                <Badge className={`text-xs ${statusColors[ss]}`}>{ss}</Badge>
                                {isSAA && (
                                  <Badge variant="outline" className="text-xs border-blue-400/50 text-blue-700">Holistic</Badge>
                                )}
                                {!isSAA && lessons.some(l => isAssessment(l.LessonCode)) && (
                                  <Badge variant="outline" className="text-xs border-purple-400/50 text-purple-700">Assessment</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${spct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{sdone}/{stdLessons.length}</span>
                              </div>
                            </button>

                            {isSubOpen && (
                              <div className="p-2 space-y-1">
                                {/* Standard lessons */}
                                {stdLessons.length > 0 && (
                                  <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Standard Lessons</p>
                                )}
                                {stdLessons.sort((a, b) => a.LessonCode.localeCompare(b.LessonCode)).map(lesson => {
                                  const approved = approvedCodes.has(lesson.LessonCode);
                                  const pending = pendingCodes.has(lesson.LessonCode);
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

                                {/* Assessment lessons */}
                                {lessons.filter(l => isAssessment(l.LessonCode)).length > 0 && (
                                  <p className="text-xs text-muted-foreground px-2 py-1 font-medium mt-2">
                                    Assessment {isSAA ? '(required for holistic completion)' : '(required for completion)'}
                                  </p>
                                )}
                                {lessons.filter(l => isAssessment(l.LessonCode)).sort((a, b) => a.LessonCode.localeCompare(b.LessonCode)).map(lesson => {
                                  const approved = approvedCodes.has(lesson.LessonCode);
                                  const pending = pendingCodes.has(lesson.LessonCode);
                                  const myEntry = progress.find(p => p.LessonCode === lesson.LessonCode);
                                  return (
                                    <div key={lesson.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${lessonCardColor(lesson.LessonCode)}`}>
                                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${approved ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{lesson.LessonCode}</span>
                                      <span className="flex-1 truncate">{lesson.LessonName}</span>
                                      <Badge variant="outline" className="text-xs border-purple-400/50 text-purple-700 shrink-0">Assessment</Badge>
                                      <span className="text-xs shrink-0">
                                        {approved ? (
                                          <span className="text-emerald-700 font-medium">
                                            ✓ Pass {myEntry?.CompletionDate ? format(new Date(myEntry.CompletionDate + 'T00:00:00'), 'd MMM yy') : ''}
                                          </span>
                                        ) : pending ? (
                                          <span className="text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>
                                        ) : (
                                          <span className="text-red-600">Not passed</span>
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