import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, BookOpen, Users, CheckSquare, AlertCircle, Swords } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

const SOURCES = [
  { key: 'syllabus', label: 'Syllabus Update', icon: BookOpen, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { key: 'personnel', label: 'Personnel Change', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { key: 'approval', label: 'Approval', icon: CheckSquare, color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'issue', label: 'Issue Reported', icon: AlertCircle, color: 'text-destructive bg-destructive/5 border-destructive/20' },
  { key: 'discipline', label: 'Discipline / SG Entry', icon: Swords, color: 'text-red-700 bg-red-50 border-red-200' },
];

export default function AuditLog() {
  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const { data: progressLedger = [] } = useQuery({
    queryKey: ['progress-ledger-approved'],
    queryFn: () => base44.entities.ProgressLedger.filter({ Status: 'Approved' }),
  });
  const { data: issueReports = [] } = useQuery({
    queryKey: ['issue-reports'],
    queryFn: () => base44.entities.IssueReport.filter({}),
  });
  const { data: disciplineLogs = [] } = useQuery({
    queryKey: ['discipline-logs'],
    queryFn: () => base44.entities.DisciplineLog.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {}; personnel.forEach(p => { m[p.PNumber] = p; }); return m;
  }, [personnel]);

  const entries = useMemo(() => {
    const list = [];

    syllabus.forEach(s => {
      const ts = s.updated_date || s.created_date;
      if (!ts) return;
      list.push({
        source: 'syllabus',
        timestamp: ts,
        description: `${s.LessonCode} — ${s.LessonName} (${s.StarLevel})`,
      });
    });

    personnel.forEach(p => {
      const ts = p.StatusChangedDate ? `${p.StatusChangedDate}T00:00:00` : p.updated_date;
      if (!ts) return;
      list.push({
        source: 'personnel',
        timestamp: ts,
        description: `${p.Rank ? p.Rank + ' ' : ''}${p.FirstName || ''} ${p.Surname} — ${p.PersonnelStatus || 'Updated'}${p.StatusNotes ? ` (${p.StatusNotes})` : ''}`,
      });
    });

    progressLedger.forEach(pl => {
      const ts = pl.updated_date || pl.created_date;
      if (!ts) return;
      const p = personnelMap[pl.CadetPNumber];
      const cadetName = p ? `${p.Rank ? p.Rank + ' ' : ''}${p.Surname}` : pl.CadetPNumber;
      list.push({
        source: 'approval',
        timestamp: ts,
        description: `${cadetName} — ${pl.LessonCode} approved by ${pl.InstructorPNumber || 'instructor'}`,
      });
    });

    issueReports.forEach(i => {
      const ts = i.updated_date || i.created_date;
      if (!ts) return;
      list.push({
        source: 'issue',
        timestamp: ts,
        description: `${i.Title} (${i.Category}) — ${i.Status}`,
      });
    });

    disciplineLogs.forEach(d => {
      const ts = d.created_date;
      if (!ts) return;
      list.push({
        source: 'discipline',
        timestamp: ts,
        description: `UIN: ${d.UIN}`,
      });
    });

    return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);
  }, [syllabus, personnel, progressLedger, issueReports, disciplineLogs, personnelMap]);

  return (
    <AccessGate level={ACCESS_LEVELS.SYSTEM_ADMIN}>
      <PageHeader
        title="System Audit Log"
        description="Recent system-wide actions: syllabus updates, personnel changes, and approvals"
        icon={ShieldCheck}
      />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No recent activity found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => {
            const src = SOURCES.find(s => s.key === e.source);
            const Icon = src?.icon;
            return (
              <Card key={i} className={`border ${src?.color || ''}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{e.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline" className="text-xs mb-0.5">{src?.label}</Badge>
                    <p className="text-xs text-muted-foreground">{format(parseISO(e.timestamp), 'd MMM yyyy, HH:mm')}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccessGate>
  );
}