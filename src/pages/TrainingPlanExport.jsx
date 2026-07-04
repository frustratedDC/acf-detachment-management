import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileDown, Printer, Calendar, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { jsPDF } from 'jspdf';

// ── Gold / Burgundy / ACUK Green Palette ──────────────────────────────────────
const PALETTE = {
  burgundy: [92, 15, 30],     // #5C0F1E
  gold:     [197, 160, 60],   // #C5A03C
  green:    [43, 87, 51],     // #2B5733 (Army Cadets UK green)
  white:    [255, 255, 255],
  cream:    [250, 246, 238],
  silver:   [180, 175, 165],
};

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function TrainingPlanExport() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [generating, setGenerating] = useState(false);

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });
  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events-all'],
    queryFn: () => base44.entities.CalendarEvent.filter({}),
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const { data: settings = [] } = useQuery({
    queryKey: ['det-settings'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });

  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });
  const detName = settings.find(s => s.Key === 'detachment_name')?.Value || 'Leigh Detachment';

  function getDateRange() {
    const base = parseISO(selectedMonth + '-01');
    return { start: format(startOfMonth(base), 'yyyy-MM-dd'), end: format(endOfMonth(base), 'yyyy-MM-dd') };
  }

  function getPeriodDescription() {
    return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
  }

  function getInstructorDisplay(pNumber) {
    const p = personnelMap[pNumber];
    if (!p) return pNumber || '—';
    return [p.Rank, p.Surname].filter(Boolean).join(' ');
  }

  function getTrainingDates() {
    const { start, end } = getDateRange();
    return [...new Set(schedule.filter(s => s.Date >= start && s.Date <= end).map(s => s.Date))].sort();
  }

  function sortByStarLevel(rows) {
    return [...rows].sort((a, b) => STAR_LEVELS.indexOf(a.AssignedStarLevel) - STAR_LEVELS.indexOf(b.AssignedStarLevel));
  }

  // ── Page header ──────────────────────────────────────────────────────────
  function drawPageHeader(doc, pageW, periodDesc, subtitle = '') {
    doc.setFillColor(...PALETTE.green);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setFillColor(...PALETTE.gold);
    doc.rect(0, 20, pageW, 2, 'F');
    doc.setFillColor(...PALETTE.burgundy);
    doc.rect(0, 22, pageW, 1, 'F');

    doc.setTextColor(...PALETTE.gold);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(detName.toUpperCase(), pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.white);
    doc.text(`TRAINING PROGRAMME  ·  ${periodDesc.toUpperCase()}${subtitle ? '  ·  ' + subtitle : ''}`, pageW / 2, 16, { align: 'center' });
  }

  function drawPageFooter(doc, pageW, pageH, pageNum, totalPages, integrityDate) {
    doc.setFillColor(...PALETTE.green);
    doc.rect(0, pageH - 7, pageW, 7, 'F');
    doc.setFillColor(...PALETTE.gold);
    doc.rect(0, pageH - 7, pageW, 1, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.silver);
    doc.text(
      `${detName}  ·  Issued ${format(new Date(), 'dd/MM/yyyy HH:mm')}  ·  Data verified as of ${integrityDate}  ·  OFFICIAL  ·  Page ${pageNum} of ${totalPages}`,
      pageW / 2, pageH - 2.5, { align: 'center' }
    );
  }

  // ── Draw a single lesson entry block within a column ────────────────────
  function drawEntry(doc, x, y, w, row) {
    const lines = [];
    if (row) {
      lines.push({ text: row.AssignedStarLevel, bold: true, color: PALETTE.gold.map((v, i) => Math.round(v * 0.55)), size: 7.5 });
      lines.push({ text: `${row.SubjectName || row.LessonCode || 'Subject TBC'}`, bold: true, color: PALETTE.green, size: 8.5 });
      lines.push({ text: row.LessonName || 'Untitled Lesson', bold: false, color: [40, 40, 40], size: 7.5 });
      const instr = `Instructor: ${getInstructorDisplay(row.InstructorPNumber)}${row.Instructor2PNumber ? '  /  ' + getInstructorDisplay(row.Instructor2PNumber) : ''}`;
      lines.push({ text: instr, bold: false, color: [80, 80, 80], size: 6.8 });
      lines.push({ text: `Dress: ${row.DressCode || 'TBC'}`, bold: false, color: [80, 80, 80], size: 6.8 });
    } else {
      lines.push({ text: 'No Lesson Scheduled', bold: false, color: [150, 150, 150], size: 7.5 });
    }

    let cy = y + 4;
    const padding = 3;
    let contentH = 4;
    lines.forEach(l => {
      const wrapped = doc.splitTextToSize(l.text, w - padding * 2);
      contentH += wrapped.length * (l.size / 2.2) + 1.3;
    });
    const boxH = Math.max(contentH + 2, 22);

    // Card border
    doc.setDrawColor(...PALETTE.green);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, boxH, 1.2, 1.2, 'S');
    doc.setFillColor(...PALETTE.cream);
    doc.roundedRect(x, y, w, boxH, 1.2, 1.2, 'F');
    doc.setDrawColor(...PALETTE.gold);
    doc.roundedRect(x, y, w, boxH, 1.2, 1.2, 'S');

    lines.forEach(l => {
      doc.setFontSize(l.size);
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
      doc.setTextColor(...l.color);
      const wrapped = doc.splitTextToSize(l.text, w - padding * 2);
      doc.text(wrapped, x + padding, cy);
      cy += wrapped.length * (l.size / 2.2) + 1.3;
    });

    return boxH;
  }

  // ── Main generator: chronological, 2-column (P1 left / P2 right) ────────
  async function generateProgramme() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const margin = 10;
    const usableW = pageW - margin * 2;
    const gutter = 4;
    const colW = (usableW - gutter) / 2;
    const periodDesc = getPeriodDescription();
    const trainingDates = getTrainingDates();
    const { start, end } = getDateRange();

    drawPageHeader(doc, pageW, periodDesc);
    let y = 27;

    function ensureSpace(needed) {
      if (y + needed > pageH - 12) {
        doc.addPage();
        drawPageHeader(doc, pageW, periodDesc, 'CONT.');
        y = 27;
      }
    }

    if (trainingDates.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('No training nights scheduled for this period.', pageW / 2, y + 15, { align: 'center' });
    }

    for (const date of trainingDates) {
      const p1 = sortByStarLevel(schedule.filter(s => s.Date === date && s.Period === 1));
      const p2 = sortByStarLevel(schedule.filter(s => s.Date === date && s.Period === 2));
      const dateLabel = format(parseISO(date), 'EEEE dd MMMM yyyy').toUpperCase();
      const rowCount = Math.max(p1.length, p2.length, 1);

      ensureSpace(10 + rowCount * 24);

      // Date banner
      doc.setFillColor(...PALETTE.green);
      doc.roundedRect(margin, y, usableW, 8, 1.5, 1.5, 'F');
      doc.setFillColor(...PALETTE.gold);
      doc.rect(margin, y + 6, usableW, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.gold);
      doc.text(dateLabel, margin + 3, y + 5.5);
      y += 11;

      // Column labels
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.burgundy);
      doc.text('PERIOD 1', margin + 2, y);
      doc.text('PERIOD 2', margin + colW + gutter + 2, y);
      y += 2;

      for (let i = 0; i < rowCount; i++) {
        ensureSpace(28);
        const rowY = y;
        const h1 = drawEntry(doc, margin, rowY, colW, p1[i]);
        const h2 = drawEntry(doc, margin + colW + gutter, rowY, colW, p2[i]);
        y = rowY + Math.max(h1, h2) + 3;
      }
      y += 3;
    }

    // Calendar events for the month
    const monthEvents = events.filter(ev => ev.Date >= start && ev.Date <= end);
    if (monthEvents.length > 0) {
      ensureSpace(12);
      doc.setFillColor(...PALETTE.burgundy);
      doc.roundedRect(margin, y, usableW, 8, 1.5, 1.5, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.gold);
      doc.text('CALENDAR EVENTS THIS MONTH', margin + 3, y + 5.5);
      y += 11;

      const sortedEvents = [...monthEvents].sort((a, b) => a.Date.localeCompare(b.Date));
      for (const ev of sortedEvents) {
        ensureSpace(8);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PALETTE.green);
        doc.text(format(parseISO(ev.Date), 'dd MMM'), margin + 2, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(`${ev.Title}${ev.EventType ? '  (' + ev.EventType + ')' : ''}${ev.Location ? '  ·  ' + ev.Location : ''}`, margin + 22, y + 4);
        doc.setDrawColor(...PALETTE.silver);
        doc.setLineWidth(0.1);
        doc.line(margin, y + 6, margin + usableW, y + 6);
        y += 7;
      }
    }

    // Footers
    const totalPages = doc.getNumberOfPages();
    const integrityDate = format(new Date(), 'dd/MM/yyyy HH:mm');
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawPageFooter(doc, pageW, pageH, p, totalPages, integrityDate);
    }

    doc.save(`Training_Programme_${periodDesc.replace(/\s+/g, '_')}.pdf`);
  }

  async function handleExport() {
    setGenerating(true);
    try {
      await generateProgramme();
    } finally {
      setGenerating(false);
    }
  }

  const trainingDates = getTrainingDates();
  const { start, end } = getDateRange();
  const previewSchedule = schedule.filter(s => s.Date >= start && s.Date <= end);
  const previewEvents = events.filter(ev => ev.Date >= start && ev.Date <= end);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Training Programme Export"
        description="Generate the monthly training programme PDF"
        icon={FileDown}
        actions={
          <Button onClick={handleExport} disabled={generating} style={{ background: '#5C0F1E' }}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            {generating ? 'Generating…' : 'Export PDF'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Settings panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Export Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Month</Label>
              <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>

            <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: '#5C0F1E', color: '#C5A03C' }}>
              <p className="font-bold">Monthly Training Programme</p>
              <p style={{ color: 'rgba(197,160,60,0.75)' }}>Chronological, two-column layout (Period 1 left / Period 2 right), lowest star level first per period. Includes subject, lesson name, instructors and dress state, plus all calendar events for the month.</p>
              <p style={{ color: 'rgba(197,160,60,0.5)' }}>{trainingDates.length} training night{trainingDates.length !== 1 ? 's' : ''} in period</p>
            </div>
          </CardContent>
        </Card>

        {/* Preview panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview — {getPeriodDescription()}</CardTitle>
          </CardHeader>
          <CardContent>
            {previewEvents.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Calendar Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewEvents.map(ev => (
                    <Badge key={ev.id} variant="outline" className="text-xs">
                      {format(parseISO(ev.Date), 'dd MMM')} · {ev.Title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {trainingDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No training nights scheduled.</p>
            ) : (
              <div className="space-y-4">
                {trainingDates.map(date => {
                  const daySchedule = previewSchedule.filter(s => s.Date === date).sort((a, b) => a.Period - b.Period);
                  return (
                    <div key={date}>
                      <p className="text-xs font-bold mb-1 px-2 py-1 rounded" style={{ background: '#5C0F1E', color: '#C5A03C' }}>
                        {format(parseISO(date), 'EEE dd MMM yyyy').toUpperCase()}
                      </p>
                      <div className="space-y-1">
                        {daySchedule.map(row => (
                          <div key={row.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                            <Badge variant="outline" className="text-xs shrink-0 h-5">P{row.Period}</Badge>
                            <Badge variant="secondary" className="text-xs shrink-0 h-5">{row.AssignedStarLevel}</Badge>
                            <span className="flex-1 truncate">{row.SubjectName || row.LessonCode} — {row.LessonName}</span>
                            <span className="text-muted-foreground shrink-0">{getInstructorDisplay(row.InstructorPNumber)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}