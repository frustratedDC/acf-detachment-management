import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, FileDown, Loader2, ChevronDown } from 'lucide-react';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';
import { RANK_ORDER, RANK_REQUIREMENTS, monthsSince, computeAttendancePct, countDisciplineRecords, getStarLevelCompletionDate } from '@/lib/rankUtils';
import CadetCriteriaDetails from '@/components/promotion/CadetCriteriaDetails';
import { jsPDF } from 'jspdf';
import _ from 'lodash';

export default function PromotionReadiness() {
  const [starFilter, setStarFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [expandedCadet, setExpandedCadet] = useState(null);

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });
  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });
  const { data: paradeRecords = [] } = useQuery({
    queryKey: ['parade-state-all'],
    queryFn: () => base44.entities.DailyParadeState.filter({}),
  });
  const { data: disciplineLogs = [] } = useQuery({
    queryKey: ['discipline-logs-all'],
    queryFn: () => base44.entities.DisciplineLog.filter({}),
  });
  const { data: milestones = [] } = useQuery({
    queryKey: ['star-level-milestones-all'],
    queryFn: () => base44.entities.StarLevelMilestone.filter({}),
  });

  const cadets = personnel.filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active');
  const approvedByCadet = _.groupBy(progress.filter(p => p.Status === 'Approved'), 'CadetPNumber');
  const pendingByCadet = _.groupBy(progress.filter(p => p.Status === 'Pending'), 'CadetPNumber');
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const cadetRows = cadets.map(cadet => {
    const approved = approvedByCadet[cadet.PNumber] || [];
    const pending = pendingByCadet[cadet.PNumber] || [];
    const approvedCodes = new Set(approved.map(a => a.LessonCode));
    const pendingCodes = new Set(pending.map(a => a.LessonCode));

    const currentRank = cadet.Rank || 'Cdt';
    const currentIdx = RANK_ORDER.indexOf(currentRank);
    const nextRank = currentIdx !== -1 && currentIdx < RANK_ORDER.length - 1 ? RANK_ORDER[currentIdx + 1] : null;
    const reqs = nextRank ? RANK_REQUIREMENTS[nextRank] : null;

    // Syllabus only ever gates promotion via the required star level and, where defined, the extra Fieldcraft star level
    const levelLessons = reqs?.requiredStarLevel ? syllabus.filter(l => l.StarLevel === reqs.requiredStarLevel && l.IsMandatory) : [];
    const fieldcraftLessons = reqs?.extraStarLevel ? syllabus.filter(l => l.StarLevel === reqs.extraStarLevel && l.SubjectName?.toLowerCase().includes(reqs.extraSubject.toLowerCase())) : [];
    const allLessons = [...levelLessons, ...fieldcraftLessons];
    const completedCount = allLessons.filter(l => approvedCodes.has(l.LessonCode)).length;
    const pct = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 100;

    // Time-in-rank is measured from when the cadet actually completed their required star level.
    // Prefer the logged StarLevelMilestone date, then fall back to the ProgressLedger-derived date, then PromotionDate.
    const loggedMilestone = reqs?.requiredStarLevel
      ? milestones.find(m => m.CadetPNumber === cadet.PNumber && m.StarLevel === reqs.requiredStarLevel)
      : null;
    const levelCompletionDate = reqs?.requiredStarLevel ? getStarLevelCompletionDate(levelLessons, approved) : null;
    const timeInRankMonths = monthsSince(loggedMilestone?.DateAchieved || levelCompletionDate || cadet.PromotionDate);
    const attendancePct = computeAttendancePct(paradeRecords, cadet.PNumber, twelveMonthsAgo);
    const disciplineCount = countDisciplineRecords(disciplineLogs, cadet.PNumber, twelveMonthsAgo);
    const disciplineClean = disciplineCount === 0;

    const syllabusMet = allLessons.length === 0 || completedCount === allLessons.length;
    const timeMet = reqs?.timeInRankMonths == null || timeInRankMonths >= reqs.timeInRankMonths;
    const attendanceMet = attendancePct != null && attendancePct >= 80;
    const manualOutstanding = (reqs?.manualCriteria || []).some(m => !cadet[m.field]);

    const ready = !!nextRank && syllabusMet && timeMet && attendanceMet && disciplineClean && !manualOutstanding;
    const status = ready ? 'Ready' : syllabusMet && timeMet && attendanceMet && disciplineClean ? 'Near Ready' : 'In Progress';

    return {
      cadet, pct, completedCount, total: allLessons.length, nextLevel: nextRank, status,
      approvedCodes, pendingCodes, timeInRankMonths, attendancePct, disciplineClean, disciplineCount,
    };
  });

  const filteredRows = cadetRows.filter(r => starFilter === 'all' || r.cadet.CurrentStarLevel === starFilter);
  const sortedRows = _.orderBy(filteredRows, ['pct'], ['desc']);

  const readyCount = cadetRows.filter(r => r.status === 'Ready').length;
  const nearCount = cadetRows.filter(r => r.status === 'Near Ready').length;
  const inProgressCount = cadetRows.filter(r => r.status === 'In Progress').length;

  function statusBadgeVariant(status) {
    if (status === 'Ready') return 'default';
    if (status === 'Near Ready') return 'secondary';
    return 'outline';
  }

  async function handleExport() {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297;
      const margin = 10;
      let y = 18;

      doc.setFillColor(43, 87, 51);
      doc.rect(0, 0, pageW, 16, 'F');
      doc.setTextColor(197, 160, 60);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('PROMOTION READINESS REPORT', pageW / 2, 10, { align: 'center' });

      doc.setTextColor(20, 20, 20);
      doc.setFontSize(13);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.text('Rank / Surname', margin, y);
      doc.text('Current Level', margin + 80, y);
      doc.text('Progress', margin + 130, y);
      doc.text('Status', margin + 170, y);
      doc.text('Next Level', margin + 210, y);
      y += 2;
      doc.setDrawColor(180, 175, 165);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      sortedRows.forEach(row => {
        if (y > 195) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(13);
        doc.text(`${row.cadet.Rank || ''} ${row.cadet.Surname}`.trim(), margin, y);
        doc.text(row.cadet.CurrentStarLevel || '—', margin + 80, y);
        doc.text(`${row.pct}% (${row.completedCount}/${row.total})`, margin + 130, y);
        doc.text(row.status, margin + 170, y);
        doc.text(row.nextLevel || '—', margin + 210, y);
        y += 8;
      });

      doc.save(`Promotion_Readiness_${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Promotion Readiness Dashboard"
        description="Overview of cadet progress against promotion milestones"
        icon={TrendingUp}
        actions={
          <div className="flex items-center gap-2">
            <Select value={starFilter} onValueChange={setStarFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
                <SelectItem value="1 Star">1 Star</SelectItem>
                <SelectItem value="2 Star">2 Star</SelectItem>
                <SelectItem value="3 Star">3 Star</SelectItem>
                <SelectItem value="4 Star">4 Star</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={generating} style={{ background: '#5C0F1E' }}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
              {generating ? 'Generating…' : 'Export PDF'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Ready for Promotion</p>
            <p className="text-2xl font-bold text-chart-2 mt-1">{readyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">Near Ready (80%+)</p>
            <p className="text-2xl font-bold text-chart-3 mt-1">{nearCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-bold">In Progress</p>
            <p className="text-2xl font-bold text-muted-foreground mt-1">{inProgressCount}</p>
          </CardContent>
        </Card>
      </div>

      {sortedRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No cadets found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedRows.map(row => {
            const isExpanded = expandedCadet === row.cadet.PNumber;
            return (
              <Card key={row.cadet.PNumber}>
                <CardContent
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedCadet(isExpanded ? null : row.cadet.PNumber)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {row.cadet.Surname?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{row.cadet.Rank} {row.cadet.Surname}</p>
                        <p className="text-xs text-muted-foreground">{row.cadet.PNumber} · {row.cadet.CurrentStarLevel}{row.nextLevel ? ` → ${row.nextLevel}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      <Badge variant="outline">{row.pct}% ({row.completedCount}/{row.total})</Badge>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-500"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  {isExpanded && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <CadetCriteriaDetails
                        cadet={row.cadet}
                        syllabus={syllabus}
                        approvedCodes={row.approvedCodes}
                        nextRank={row.nextLevel}
                        timeInRankMonths={row.timeInRankMonths}
                        attendancePct={row.attendancePct}
                        disciplineClean={row.disciplineClean}
                        disciplineCount={row.disciplineCount}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccessGate>
  );
}