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
import { FileDown, Printer, Calendar, Loader2, LayoutList, FileText } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { jsPDF } from 'jspdf';

// ── KRH / ACF Palette ─────────────────────────────────────────────────────────
const KRH = {
  navy:   [0, 33, 71],      // #002147
  gold:   [255, 215, 0],    // #FFD700
  red:    [200, 16, 46],    // #C8102E
  white:  [255, 255, 255],
  black:  [0, 0, 0],
  silver: [180, 188, 196],
  light:  [240, 244, 248],
};

const STAR_LEVEL_COLORS = {
  'Basic':  [45, 120, 67],
  '1 Star': [21, 120, 180],
  '2 Star': [100, 60, 160],
  '3 Star': [200, 100, 30],
  '4 Star': KRH.red,
};

const STAR_LEVELS = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function TrainingPlanExport() {
  const [rangeMode, setRangeMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [exportFormat, setExportFormat] = useState('condensed'); // 'condensed' | 'detailed'
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
    if (rangeMode === 'month') {
      const base = parseISO(selectedMonth + '-01');
      return { start: format(startOfMonth(base), 'yyyy-MM-dd'), end: format(endOfMonth(base), 'yyyy-MM-dd') };
    }
    return { start: startDate, end: endDate };
  }

  function getPeriodDescription() {
    if (rangeMode === 'month') return format(parseISO(selectedMonth + '-01'), 'MMMM yyyy');
    return `${format(parseISO(startDate + 'T00:00:00'), 'dd MMM yyyy')} – ${format(parseISO(endDate + 'T00:00:00'), 'dd MMM yyyy')}`;
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

  // ── SHARED: draw KRH page header ─────────────────────────────────────────
  function drawPageHeader(doc, pageW, periodDesc, subtitle = '') {
    doc.setFillColor(...KRH.navy);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setFillColor(...KRH.gold);
    doc.rect(0, 18, pageW, 2.5, 'F');
    doc.setFillColor(...KRH.red);
    doc.rect(0, 20.5, pageW, 1.5, 'F');

    doc.setTextColor(...KRH.gold);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TRAINING PROGRAMME', pageW / 2, 8, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...KRH.white);
    doc.text(`${detName.toUpperCase()}  ·  ${periodDesc.toUpperCase()}${subtitle ? '  ·  ' + subtitle : ''}`, pageW / 2, 14.5, { align: 'center' });
  }

  // ── SHARED: draw KRH page footer ─────────────────────────────────────────
  function drawPageFooter(doc, pageW, pageH, pageNum, totalPages) {
    doc.setFillColor(...KRH.navy);
    doc.rect(0, pageH - 7, pageW, 7, 'F');
    doc.setFillColor(...KRH.gold);
    doc.rect(0, pageH - 7, pageW, 1.2, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...KRH.silver);
    doc.text(
      `${detName}  ·  Issued ${format(new Date(), 'dd/MM/yyyy')}  ·  OFFICIAL  ·  Page ${pageNum} of ${totalPages}`,
      pageW / 2, pageH - 2.5, { align: 'center' }
    );
  }

  // ── CONDENSED: 1-page grid ────────────────────────────────────────────────
  async function generateCondensed() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const margin = 6;
    const usableW = pageW - margin * 2;
    const periodDesc = getPeriodDescription();
    const trainingDates = getTrainingDates();
    const { start, end } = getDateRange();

    drawPageHeader(doc, pageW, periodDesc);
    let y = 27;

    // Column definitions: Date | Star Level | P | Code | Subject/Lesson | Lead Instructor | Location
    const cols = [28, 20, 8, 20, 80, 45, 0]; // last col fills remainder
    cols[6] = usableW - cols.slice(0, 6).reduce((a, b) => a + b, 0);
    const headers = ['Date', 'Star Level', 'P', 'Code', 'Lesson / Topic', 'Lead Instructor', 'Room / Location'];
    const rowH = 5.5;

    // Table header row
    doc.setFillColor(...KRH.navy);
    doc.rect(margin, y, usableW, rowH + 0.5, 'F');
    let cx = margin;
    headers.forEach((h, i) => {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...KRH.gold);
      doc.text(h.toUpperCase(), cx + 1.5, y + 3.8);
      cx += cols[i];
    });
    y += rowH + 0.5;

    let rowCount = 0;
    if (trainingDates.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('No training nights scheduled for this period.', pageW / 2, y + 15, { align: 'center' });
    }

    for (const date of trainingDates) {
      const daySchedule = schedule.filter(s => s.Date === date).sort((a, b) => a.Period - b.Period || STAR_LEVELS.indexOf(a.AssignedStarLevel) - STAR_LEVELS.indexOf(b.AssignedStarLevel));
      const dateLabel = format(parseISO(date), 'EEE dd MMM yyyy').toUpperCase();

      for (let di = 0; di < daySchedule.length; di++) {
        const row = daySchedule[di];
        const isFirst = di === 0;

        if (y + rowH > pageH - 10) {
          // Footer for current page (patched later)
          doc.addPage();
          drawPageHeader(doc, pageW, periodDesc, 'CONT.');
          y = 27;
          // Repeat column header
          doc.setFillColor(...KRH.navy);
          doc.rect(margin, y, usableW, rowH + 0.5, 'F');
          cx = margin;
          headers.forEach((h, i) => {
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...KRH.gold);
            doc.text(h.toUpperCase(), cx + 1.5, y + 3.8);
            cx += cols[i];
          });
          y += rowH + 0.5;
        }

        const slColor = STAR_LEVEL_COLORS[row.AssignedStarLevel] || KRH.navy;
        const isEven = rowCount % 2 === 0;
        if (isEven) {
          doc.setFillColor(...KRH.light);
          doc.rect(margin, y, usableW, rowH, 'F');
        }

        cx = margin;
        const cells = [
          isFirst ? dateLabel : '',
          row.AssignedStarLevel,
          `P${row.Period}`,
          row.LessonCode || '—',
          row.LessonName || '—',
          getInstructorDisplay(row.InstructorPNumber),
          row.Location || '—',
        ];

        cells.forEach((cell, i) => {
          doc.setFontSize(6.5);
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
          if (i === 1) {
            // Star level pill
            doc.setFillColor(...slColor);
            doc.roundedRect(cx + 0.5, y + 0.8, cols[i] - 2, rowH - 1.5, 1, 1, 'F');
            doc.setTextColor(...KRH.white);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'bold');
            doc.text(cell, cx + 1.5, y + 3.5);
          } else {
            doc.setTextColor(...KRH.navy);
            const txt = doc.splitTextToSize(String(cell), cols[i] - 2.5);
            doc.text(txt, cx + 1.5, y + 3.8);
          }
          cx += cols[i];
        });

        // Thin divider
        doc.setDrawColor(...KRH.silver);
        doc.setLineWidth(0.1);
        doc.line(margin, y + rowH, margin + usableW, y + rowH);

        y += rowH;
        rowCount++;
      }

      // Date separator
      if (trainingDates.indexOf(date) < trainingDates.length - 1) {
        doc.setDrawColor(...KRH.gold);
        doc.setLineWidth(0.4);
        doc.line(margin, y + 0.5, margin + usableW, y + 0.5);
        y += 2;
      }
    }

    // Footers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawPageFooter(doc, pageW, pageH, p, totalPages);
    }

    doc.save(`Training_Condensed_${periodDesc.replace(/\s+/g, '_')}.pdf`);
  }

  // ── DETAILED: full lesson breakdown ──────────────────────────────────────
  async function generateDetailed() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 12;
    const usableW = pageW - margin * 2;
    const periodDesc = getPeriodDescription();
    const trainingDates = getTrainingDates();

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
      doc.text('No training nights scheduled for this period.', pageW / 2, y + 20, { align: 'center' });
    }

    for (const date of trainingDates) {
      const daySchedule = schedule.filter(s => s.Date === date).sort((a, b) => a.Period - b.Period);
      const dateLabel = format(parseISO(date), 'EEEE dd MMMM yyyy').toUpperCase();

      // Date banner
      ensureSpace(12);
      doc.setFillColor(...KRH.navy);
      doc.roundedRect(margin, y, usableW, 9, 2, 2, 'F');
      doc.setFillColor(...KRH.gold);
      doc.roundedRect(margin, y + 9 - 2, 4, 2, 0, 0, 'F'); // gold left tab
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...KRH.gold);
      doc.text(dateLabel, margin + 6, y + 6);
      y += 12;

      for (const row of daySchedule) {
        const slColor = STAR_LEVEL_COLORS[row.AssignedStarLevel] || KRH.navy;

        ensureSpace(60);

        // Lesson card header
        doc.setFillColor(...slColor);
        doc.roundedRect(margin, y, usableW, 8, 1.5, 1.5, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...KRH.white);
        doc.text(`P${row.Period}  ·  ${row.AssignedStarLevel}  ·  ${row.LessonCode || ''}`, margin + 3, y + 5.5);
        doc.setFontSize(8.5);
        doc.text(row.LessonName || 'Untitled Lesson', margin + 80, y + 5.5);
        y += 9;

        // Sub-section rows
        const sections = [
          {
            label: 'SUBJECT TITLE & SCOPE',
            value: `${row.LessonName || '—'}  |  Star Level: ${row.AssignedStarLevel}  |  Period: ${row.Period}  |  Code: ${row.LessonCode || '—'}`,
          },
          {
            label: 'LEARNING OBJECTIVES',
            value: row.Notes
              ? row.Notes
              : 'Cadets will be able to demonstrate understanding of the subject matter as defined in the ACF Cadet Training Programme (CTP). Objectives are delivered IAW the relevant star level syllabus requirements.',
          },
          {
            label: 'INSTRUCTOR REQUIREMENTS & RESOURCES',
            value: `Lead: ${getInstructorDisplay(row.InstructorPNumber)}${row.Instructor2PNumber ? '  |  Support: ' + getInstructorDisplay(row.Instructor2PNumber) : ''}  |  Location: ${row.Location || 'TBC'}  |  Dress: ${row.DressCode || 'TBC'}  |  Resources: Lesson plan, any required training aids per CTP.`,
          },
          {
            label: 'SAFETY & RISK ASSESSMENT NOTES',
            value: 'Instructor to conduct Dynamic Risk Assessment (DRA) prior to lesson commencement. Ensure all cadets are briefed on safety precautions relevant to this subject. Any concerns to be escalated to the Detachment Commander immediately. Standard ACF safety protocols apply.',
          },
        ];

        for (const sec of sections) {
          const valueLines = doc.splitTextToSize(sec.value, usableW - 5);
          const secH = 5 + valueLines.length * 4.5 + 3;
          ensureSpace(secH);

          // Label bar
          doc.setFillColor(235, 240, 248);
          doc.rect(margin, y, usableW, 5, 'F');
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...KRH.navy);
          doc.text(sec.label, margin + 2, y + 3.5);
          y += 5;

          // Value
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(40, 40, 60);
          doc.text(valueLines, margin + 2, y + 4);
          y += valueLines.length * 4.5 + 3;

          // Thin divider
          doc.setDrawColor(...KRH.silver);
          doc.setLineWidth(0.1);
          doc.line(margin, y, margin + usableW, y);
        }

        // Gold accent bottom border for lesson card
        doc.setDrawColor(...KRH.gold);
        doc.setLineWidth(0.5);
        doc.line(margin, y + 1, margin + usableW, y + 1);
        y += 5;
      }
      y += 4;
    }

    // Footers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawPageFooter(doc, pageW, pageH, p, totalPages);
    }

    doc.save(`Training_Detailed_${periodDesc.replace(/\s+/g, '_')}.pdf`);
  }

  async function handleExport() {
    setGenerating(true);
    try {
      if (exportFormat === 'condensed') await generateCondensed();
      else await generateDetailed();
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
        description="Generate condensed or detailed PDF training programmes"
        icon={FileDown}
        actions={
          <Button onClick={handleExport} disabled={generating} style={{ background: '#002147' }}>
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

            {/* Format toggle */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">Export Format</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportFormat('condensed')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs ${
                    exportFormat === 'condensed'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <LayoutList className="w-5 h-5" />
                  <span className="font-semibold">Condensed</span>
                  <span className="text-center leading-tight opacity-70">At-a-glance grid · Notice board</span>
                </button>
                <button
                  onClick={() => setExportFormat('detailed')}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-xs ${
                    exportFormat === 'detailed'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-semibold">Detailed</span>
                  <span className="text-center leading-tight opacity-70">Full lesson plans · Governance</span>
                </button>
              </div>
            </div>

            {/* Range mode */}
            <div>
              <Label className="text-xs">Period Mode</Label>
              <Select value={rangeMode} onValueChange={setRangeMode}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">By Month</SelectItem>
                  <SelectItem value="range">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {rangeMode === 'month' ? (
              <div>
                <Label className="text-xs">Month</Label>
                <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
              </>
            )}

            {/* Format description */}
            <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: '#002147', color: '#FFD700' }}>
              {exportFormat === 'condensed' ? (
                <>
                  <p className="font-bold">Condensed (Landscape A4)</p>
                  <p style={{ color: 'rgba(255,215,0,0.7)' }}>Single-table grid: Date · Star Level · Period · Code · Lesson · Instructor · Location. Ideal for notice boards and briefings.</p>
                </>
              ) : (
                <>
                  <p className="font-bold">Detailed (Portrait A4)</p>
                  <p style={{ color: 'rgba(255,215,0,0.7)' }}>Per-lesson cards with Subject Title, Learning Objectives, Instructor Requirements and Safety/Risk Assessment notes. Compliant with detachment governance.</p>
                </>
              )}
              <p style={{ color: 'rgba(255,215,0,0.5)' }}>{trainingDates.length} training night{trainingDates.length !== 1 ? 's' : ''} in period</p>
            </div>
          </CardContent>
        </Card>

        {/* Preview panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview — {getPeriodDescription()}</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <p className="text-xs font-bold mb-1 px-2 py-1 rounded" style={{ background: '#002147', color: '#FFD700' }}>
                        {format(parseISO(date), 'EEE dd MMM yyyy').toUpperCase()}
                      </p>
                      <div className="space-y-1">
                        {daySchedule.map(row => (
                          <div key={row.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                            <Badge variant="outline" className="text-xs shrink-0 h-5">P{row.Period}</Badge>
                            <Badge variant="secondary" className="text-xs shrink-0 h-5">{row.AssignedStarLevel}</Badge>
                            <span className="font-mono text-muted-foreground">{row.LessonCode}</span>
                            <span className="flex-1 truncate">{row.LessonName}</span>
                            <span className="text-muted-foreground shrink-0">{getInstructorDisplay(row.InstructorPNumber)}</span>
                            {row.Location && <span className="text-muted-foreground shrink-0 hidden sm:block">{row.Location}</span>}
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