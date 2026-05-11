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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Printer, Calendar, Loader2 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { jsPDF } from 'jspdf';

// ACF Brand Palette
const ACF = {
  darkGreen:  [8, 63, 48],      // #083F30
  greenWash:  [101, 137, 124],  // #65897C
  green:      [45, 142, 67],    // #2D8E43
  lightGreen: [111, 176, 67],   // #6FB043
  yellow:     [244, 233, 17],   // #F4E911
  orange:     [236, 98, 35],    // #EC6223
  red:        [230, 28, 59],    // #E61C3B
  blue:       [21, 157, 196],   // #159DC4
  white:      [255, 255, 255],
  black:      [0, 0, 0],
};

const STAR_LEVEL_COLORS = {
  'Basic':  ACF.darkGreen,
  '1 Star': ACF.green,
  '2 Star': ACF.blue,
};

const EVENT_TYPE_COLORS = {
  'Camp':        ACF.orange,
  'Competition': ACF.blue,
  'Admin':       ACF.greenWash,
  'Other':       ACF.greenWash,
};

export default function TrainingPlanExport() {
  const [mode, setMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
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
  const detName = settings.find(s => s.Key === 'detachment_name')?.Value || 'ACF DETACHMENT';

  function getDateRange() {
    if (mode === 'month') {
      const base = parseISO(selectedMonth + '-01');
      return { start: format(startOfMonth(base), 'yyyy-MM-dd'), end: format(endOfMonth(base), 'yyyy-MM-dd') };
    }
    return { start: startDate, end: endDate };
  }

  function getInstructorDisplay(pNumber) {
    const p = personnelMap[pNumber];
    if (!p) return pNumber || '—';
    return [p.Rank, p.Surname].filter(Boolean).join(' ');
  }

  function getTrainingDates() {
    const { start, end } = getDateRange();
    const schedDates = [...new Set(schedule.filter(s => s.Date >= start && s.Date <= end).map(s => s.Date))];
    return schedDates.sort();
  }

  function getPeriodDescription() {
    if (mode === 'month') return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
    return `${format(parseISO(startDate + 'T00:00:00'), 'dd MMM yyyy')} – ${format(parseISO(endDate + 'T00:00:00'), 'dd MMM yyyy')}`;
  }

  async function generatePDF() {
    setGenerating(true);
    // Always landscape A4 for maximum content per page
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const margin = 5; // narrow margins for shrink-to-fit
    const usableW = pageW - margin * 2;
    const periodDesc = getPeriodDescription();
    const trainingDates = getTrainingDates();
    const { start, end } = getDateRange();

    // All calendar events in range (training nights + non-training)
    const calEventsInRange = events.filter(ev => ev.Date >= start && ev.Date <= end).sort((a, b) => a.Date.localeCompare(b.Date));
    const starLevels = ['Basic', '1 Star', '2 Star'];

    // ── HEADER ──────────────────────────────────────────────────────
    doc.setFillColor(...ACF.darkGreen);
    doc.rect(0, 0, pageW, 20, 'F');

    // Red accent bar
    doc.setFillColor(...ACF.red);
    doc.rect(0, 20, pageW, 3, 'F');

    doc.setTextColor(...ACF.white);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TRAINING PROGRAMME', pageW / 2, 9, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${detName.toUpperCase()}  ·  ${periodDesc.toUpperCase()}`, pageW / 2, 16, { align: 'center' });

    doc.setTextColor(...ACF.black);
    let y = 28;

    // ── CALENDAR EVENTS SECTION (closures, camps, etc.) ──────────────
    const nonTrainingEvents = calEventsInRange.filter(ev => !ev.IsTrainingNight);
    if (nonTrainingEvents.length > 0) {
      // Section header
      doc.setFillColor(...ACF.greenWash);
      doc.rect(margin, y, usableW, 6, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ACF.white);
      doc.text('CALENDAR EVENTS & NOTICES', margin + 3, y + 4.2);
      y += 7;

      // Events in a compact horizontal strip
      const evChunkSize = Math.floor(usableW / 65);
      let ex = margin;
      let evRowY = y;
      nonTrainingEvents.forEach((ev, idx) => {
        if (idx > 0 && idx % evChunkSize === 0) {
          evRowY += 8;
          ex = margin;
          y = evRowY;
        }
        const evCol = EVENT_TYPE_COLORS[ev.EventType] || ACF.greenWash;
        doc.setFillColor(...evCol);
        doc.roundedRect(ex, evRowY, 62, 6, 2, 2, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ACF.white);
        const evLabel = `${format(parseISO(ev.Date), 'dd MMM')}  ${ev.Title}`;
        doc.text(evLabel.substring(0, 28), ex + 2, evRowY + 4.2);
        ex += 64;
      });
      y = evRowY + 10;
    }

    if (trainingDates.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('No training nights scheduled for this period.', pageW / 2, y + 10, { align: 'center' });
    }

    for (const date of trainingDates) {
      const dateStr = format(parseISO(date), 'EEEE dd MMMM yyyy').toUpperCase();
      const daySchedule = schedule.filter(s => s.Date === date).sort((a, b) => a.Period - b.Period);

      // Estimate height
      let estimatedH = 10;
      for (const sl of starLevels) {
        const rows = daySchedule.filter(s => s.AssignedStarLevel === sl);
        if (rows.length > 0) estimatedH += 7 + 6 + rows.length * 7;
      }

      if (y + estimatedH > pageH - 8) {
        doc.addPage();
        // Repeat header
        doc.setFillColor(...ACF.darkGreen);
        doc.rect(0, 0, pageW, 20, 'F');
        doc.setFillColor(...ACF.red);
        doc.rect(0, 20, pageW, 3, 'F');
        doc.setTextColor(...ACF.white);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TRAINING PROGRAMME', pageW / 2, 9, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${detName.toUpperCase()}  ·  ${periodDesc.toUpperCase()} (cont.)`, pageW / 2, 16, { align: 'center' });
        doc.setTextColor(...ACF.black);
        y = 28;
      }

      // Date banner — ACF light green background, dark green text
      doc.setFillColor(...ACF.lightGreen);
      doc.roundedRect(margin, y, usableW, 8, 3, 3, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ACF.darkGreen);
      doc.text(dateStr, margin + 4, y + 5.5);
      y += 10;

      for (const sl of starLevels) {
        const rows = daySchedule.filter(s => s.AssignedStarLevel === sl);
        if (rows.length === 0) continue;

        const slColor = STAR_LEVEL_COLORS[sl] || ACF.darkGreen;

        // Star level pill
        doc.setFillColor(...slColor);
        doc.roundedRect(margin, y, usableW, 6, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...ACF.white);
        doc.text(`${sl.toUpperCase()}`, margin + 3, y + 4.2);
        y += 7;

        // Column widths — optimised for landscape A4 with narrow margins
        const cols = [10, 18, 80, 42, 38, 28, 71];
        const headers = ['Per.', 'Code', 'Lesson', 'Instructor', 'Location', 'Dress', 'Notes'];
        const rowH = 6;

        // Header row
        doc.setFillColor(240, 244, 240);
        doc.roundedRect(margin, y, usableW, rowH, 1, 1, 'F');
        let cx = margin;
        headers.forEach((h, i) => {
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...ACF.darkGreen);
          doc.text(h, cx + 1.5, y + 4.2);
          cx += cols[i];
        });
        y += rowH;

        rows.forEach((row, ri) => {
          const cells = [
            `P${row.Period}`,
            row.LessonCode || '—',
            row.LessonName || '—',
            getInstructorDisplay(row.InstructorPNumber),
            row.Location || '—',
            row.DressCode || '—',
            row.Notes || '',
          ];

          doc.setFontSize(7);
          const noteLines = doc.splitTextToSize(cells[6], cols[6] - 3);
          const lessonLines = doc.splitTextToSize(cells[2], cols[2] - 3);
          const lines = Math.max(noteLines.length, lessonLines.length, 1);
          const rh = Math.max(rowH, lines * 4.2 + 2.5);

          if (ri % 2 === 0) {
            doc.setFillColor(250, 253, 250);
            doc.roundedRect(margin, y, usableW, rh, 1, 1, 'F');
          }

          cx = margin;
          cells.forEach((cell, i) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...ACF.darkGreen);
            const txt = doc.splitTextToSize(String(cell || ''), cols[i] - 3);
            doc.text(txt, cx + 1.5, y + 4.2);
            cx += cols[i];
          });

          doc.setDrawColor(200, 220, 210);
          doc.setLineWidth(0.15);
          doc.line(margin, y + rh, margin + usableW, y + rh);
          y += rh;
        });
        y += 2;
      }
      y += 3;
    }

    // ── FOOTER ──────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...ACF.darkGreen);
      doc.rect(0, pageH - 7, pageW, 7, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...ACF.lightGreen);
      doc.text(
        `Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')}  ·  ${detName}  ·  OFFICIAL  ·  Page ${p} of ${totalPages}`,
        pageW / 2, pageH - 2.5, { align: 'center' }
      );
    }

    doc.save(`Training_Programme_${periodDesc.replace(/\s+/g, '_').replace(/–/g, '-')}.pdf`);
    setGenerating(false);
  }

  const trainingDates = getTrainingDates();
  const { start, end } = getDateRange();
  const previewSchedule = schedule.filter(s => s.Date >= start && s.Date <= end);
  const previewEvents = events.filter(ev => ev.Date >= start && ev.Date <= end);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Training Programme Export"
        description="Generate PDF training programmes for display"
        icon={FileDown}
        actions={
          <Button onClick={generatePDF} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
            {generating ? 'Generating...' : 'Export PDF'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Export Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Export Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="range">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'month' ? (
              <div>
                <Label>Month</Label>
                <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>{trainingDates.length} training night{trainingDates.length !== 1 ? 's' : ''} in period</p>
              <p>{previewEvents.filter(e => !e.IsTrainingNight).length} other calendar events</p>
              <p className="text-primary font-medium">Output: Landscape A4 · ACF branding</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview — {getPeriodDescription()}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Calendar events preview */}
            {previewEvents.filter(e => !e.IsTrainingNight).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Calendar Events</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewEvents.filter(e => !e.IsTrainingNight).map(ev => (
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
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                        {format(parseISO(date), 'EEE dd MMM yyyy')}
                      </p>
                      <div className="space-y-1">
                        {daySchedule.map(row => (
                          <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm px-3">
                            <Badge variant="outline" className="text-xs shrink-0">P{row.Period}</Badge>
                            <Badge variant="secondary" className="text-xs shrink-0">{row.AssignedStarLevel}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">{row.LessonCode}</span>
                            <span className="flex-1 truncate text-xs">{row.LessonName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{getInstructorDisplay(row.InstructorPNumber)}</span>
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