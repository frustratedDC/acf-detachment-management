import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle, TrendingUp, MessageSquare } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { format, parseISO } from 'date-fns';

const LOW_THRESHOLD = 60; // % below which is flagged

export default function InstructorEngagement() {
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ['instructor-attendance-ledger'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.filter({}),
  });

  const instructors = useMemo(() =>
    allPersonnel.filter(p => p.Type === 'Adult Instructor' && (p.PersonnelStatus || 'Active') === 'Active'),
    [allPersonnel]
  );

  const stats = useMemo(() => {
    return instructors.map(inst => {
      const records = ledger.filter(l => l.InstructorPNumber === inst.PNumber);
      const total = records.length;
      const present = records.filter(r => r.AttendanceStatus === 'Present').length;
      const absent = records.filter(r => r.AttendanceStatus === 'Absent').length;
      const excused = records.filter(r => r.AttendanceStatus === 'Excused').length;
      const score = total > 0 ? Math.round((present / total) * 100) : null;
      const recentNotes = records
        .filter(r => r.EngagementNotes || (r.QuickTags?.length > 0))
        .sort((a, b) => (b.Date || '').localeCompare(a.Date || ''))
        .slice(0, 3);
      return { inst, total, present, absent, excused, score, recentNotes };
    }).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  }, [instructors, ledger]);

  const flagged = stats.filter(s => s.score !== null && s.score < LOW_THRESHOLD);
  const totalSessions = ledger.length > 0 ? Math.max(...ledger.map(l => {
    const byDate = new Set(ledger.map(x => x.Date));
    return byDate.size;
  })) : 0;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Instructor Engagement"
        description="DC-only attendance and engagement tracking for Adult Instructors"
        icon={Users}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Instructors Tracked</p>
            <p className="text-2xl font-bold">{instructors.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-destructive" />Flagged
            </p>
            <p className="text-2xl font-bold text-destructive">{flagged.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Records Logged</p>
            <p className="text-2xl font-bold">{ledger.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">With Notes</p>
            <p className="text-2xl font-bold">{ledger.filter(l => l.EngagementNotes).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Flagged section */}
      {flagged.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-destructive flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4" />Low Attendance — Below {LOW_THRESHOLD}%
          </h2>
          <div className="space-y-2">
            {flagged.map(({ inst, total, present, absent, score, recentNotes }) => (
              <InstructorRow key={inst.PNumber} inst={inst} total={total} present={present} absent={absent} score={score} recentNotes={recentNotes} flagged />
            ))}
          </div>
        </div>
      )}

      {/* All instructors */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Instructors</h2>
      <div className="space-y-2">
        {stats.map(({ inst, total, present, absent, score, recentNotes }) => (
          <InstructorRow key={inst.PNumber} inst={inst} total={total} present={present} absent={absent} score={score} recentNotes={recentNotes} />
        ))}
        {stats.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">No instructor records yet.</p>
        )}
      </div>
    </AccessGate>
  );
}

function InstructorRow({ inst, total, present, absent, score, recentNotes, flagged }) {
  const [expanded, setExpanded] = React.useState(false);
  const name = [inst.Rank, inst.FirstName, inst.Surname].filter(Boolean).join(' ');
  const scoreColor = score === null ? 'text-muted-foreground' : score >= 80 ? 'text-chart-2' : score >= 60 ? 'text-accent-foreground' : 'text-destructive';

  return (
    <Card className={flagged ? 'border-destructive/30 bg-destructive/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${flagged ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
              {inst.Surname?.[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-muted-foreground">{inst.PNumber} · {inst.RoleName || 'Instructor'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-center">
              <p className={`text-lg font-bold ${scoreColor}`}>{score !== null ? `${score}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">{present}/{total}</p>
              <p className="text-xs text-muted-foreground">Present</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-destructive">{absent}</p>
              <p className="text-xs text-muted-foreground">Absent</p>
            </div>
            {recentNotes.length > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />{recentNotes.length}
              </button>
            )}
          </div>
        </div>

        {expanded && recentNotes.length > 0 && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {recentNotes.map(note => (
              <div key={note.id} className="bg-muted/40 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{note.Date ? format(parseISO(note.Date), 'd MMM yyyy') : '—'}</span>
                  {note.Reason && <Badge variant="outline" className="text-[10px] py-0">{note.Reason}</Badge>}
                  {note.QuickTags?.map(t => <Badge key={t} variant="secondary" className="text-[10px] py-0">{t}</Badge>)}
                </div>
                {note.EngagementNotes && <p className="text-muted-foreground">{note.EngagementNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}