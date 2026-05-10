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
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { jsPDF } from 'jspdf';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function TrainingPlanExport() {
  const [mode, setMode] = useState('month'); // 'month' | 'range'
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [orientation, setOrientation] = useState('landscape');
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

  function periodLabel(str) {
    return str === 'landscape' ? 'Landscape' : 'Portrait';
  }

  function getPeriodDescription() {
    if (mode === 'month') {
      const base = parseISO(selectedMonth + '-01');
      return format(base, 'MMMM yyyy');
    }
    return `${format(parseISO(startDate + 'T00:00:00'), 'dd MMM yyyy')} – ${format(parseISO(endDate + 'T00:00:00'), 'dd MMM yyyy')}`;
  }

  async function generatePDF() {
    setGenerating(true);
    const isLandscape = orientation === 'landscape';
    const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

    const pageW = isLandscape ? 297 : 210;
    const pageH = isLandscape ? 210 : 297;
    const margin = 8;
    const usableW = pageW - margin * 2;

    const periodDesc = getPeriodDescription();
    const trainingDates = getTrainingDates();

    // ── HEADER BAND ──────────────────────────────────────────────
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(0, 0, pageW, 26, 0, 0, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TRAINING PROGRAMME', pageW / 2, 11, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${detName.toUpperCase()}  ·  ${periodDesc.toUpperCase()}`, pageW / 2, 19, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let y = 32;

    if (trainingDates.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text('No training scheduled for this period.', pageW / 2, y + 10, { align: 'center' });
    }

    const starLevels = ['Basic', '1 Star', '2 Star'];
    const starColors = { 'Basic': [59, 130, 246], '1 Star': [16, 185, 129], '2 Star': [245, 158, 11] };

    for (const date of trainingDates) {
      const dateStr = format(parseISO(date), 'EEEE dd MMMM yyyy').toUpperCase();
      const daySchedule = schedule.filter(s => s.Date === date).sort((a, b) => a.Period - b.Period);
      const calEvents = events.filter(e => e.Date === date && !e.IsTrainingNight);

      // Check if we need a new page (rough estimate)
      const estimatedHeight = 12 + starLevels.reduce((acc, sl) => {
        const rows = daySchedule.filter(s => s.AssignedStarLevel === sl);
        return acc + (rows.length > 0 ? 8 + rows.length * 8 : 0);
      }, 0);

      if (y + estimatedHeight > pageH - 12) {
        doc.addPage();
        // Repeat header
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(0, 0, pageW, 26, 0, 0, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('TRAINING PROGRAMME', pageW / 2, 11, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${detName.toUpperCase()}  ·  ${periodDesc.toUpperCase()}`, pageW / 2, 19, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        y = 32;
      }

      // Date banner - pill shape
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(margin, y, usableW, 9, 4, 4, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(dateStr, margin + 4, y + 6);
      y += 12;

      // Calendar events for this day (non-training)
      for (const ev of calEvents) {
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, y, usableW, 7, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const evText = `📌 ${ev.Title}${ev.Notes ? '  —  ' + ev.Notes : ''}`;
        doc.text(evText.substring(0, 100), margin + 3, y + 4.8);
        y += 9;
      }

      for (const sl of starLevels) {
        const rows = daySchedule.filter(s => s.AssignedStarLevel === sl);
        if (rows.length === 0) continue;

        const [r, g, b] = starColors[sl];
        // Star level pill header
        doc.setFillColor(r, g, b);
        doc.roundedRect(margin, y, usableW, 7, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`${sl.toUpperCase()} STAR`, margin + 4, y + 5);
        y += 8;

        // Column widths
        const cols = isLandscape ? [14, 20, 70, 45, 40, 30, 58] : [14, 18, 55, 38, 30, 25, 38];
        const headers = ['Period', 'Code', 'Lesson', 'Instructor', 'Location', 'Dress', 'Notes'];
        const rowH = 7;

        // Header row
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, usableW, rowH, 2, 2, 'F');
        let cx = margin;
        headers.forEach((h, i) => {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(60, 60, 80);
          doc.text(h, cx + 2, y + 4.8);
          cx += cols[i];
        });
        y += rowH;

        // Data rows
        rows.forEach((row, ri) => {
          const cells = [
            `P${row.Period}`,
            row.LessonCode || '—',
            row.LessonName || '—',
            getInstructorDisplay(row.InstructorPNumber),
            row.Location || '—',
            row.DressCode || '—',
            row.Notes || '—',
          ];

          // Determine row height based on longest content
          doc.setFontSize(8);
          const noteLines = doc.splitTextToSize(cells[6], cols[6] - 4);
          const lessonLines = doc.splitTextToSize(cells[2], cols[2] - 4);
          const lines = Math.max(noteLines.length, lessonLines.length, 1);
          const rh = Math.max(rowH, lines * 4.5 + 3);

          // Alternating row bg
          if (ri % 2 === 0) {
            doc.setFillColor(252, 252, 253);
            doc.roundedRect(margin, y, usableW, rh, 2, 2, 'F');
          }

          cx = margin;
          cells.forEach((cell, i) => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 30, 30);
            const txt = doc.splitTextToSize(String(cell || '—'), cols[i] - 4);
            doc.text(txt, cx + 2, y + 4.8);
            cx += cols[i];
          });

          // Subtle row divider
          doc.setDrawColor(230, 230, 235);
          doc.setLineWidth(0.2);
          doc.line(margin, y + rh, margin + usableW, y + rh);
          y += rh;
        });
        y += 3;
      }
      y += 4;
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')}  ·  ${detName}  ·  OFFICIAL`,
      pageW / 2, pageH - 4, { align: 'center' }
    );

    doc.save(`Training_Programme_${periodDesc.replace(/\s+/g, '_').replace(/–/g, '-')}.pdf`);
    setGenerating(false);
  }

  const trainingDates = getTrainingDates();
  const { start, end } = getDateRange();
  const previewSchedule = schedule.filter(s => s.Date >= start && s.Date <= end);

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
              <Calendar className="w-4 h-4 text-accent" />
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
            <div>
              <Label>Orientation</Label>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape (recommended)</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{trainingDates.length} training night{trainingDates.length !== 1 ? 's' : ''} in period</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview — {getPeriodDescription()}</CardTitle>
          </CardHeader>
          <CardContent>
            {trainingDates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No training nights scheduled for this period.</p>
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
                          <div key={row.id} className="flex items-center gap-3 p-2 rounded-full bg-muted/50 text-sm px-4">
                            <Badge variant="outline" className="text-xs rounded-full shrink-0">P{row.Period}</Badge>
                            <Badge variant="secondary" className="text-xs rounded-full shrink-0">{row.AssignedStarLevel}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">{row.LessonCode}</span>
                            <span className="flex-1 truncate">{row.LessonName}</span>
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