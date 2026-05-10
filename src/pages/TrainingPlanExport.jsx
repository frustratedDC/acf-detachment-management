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
import { format, addDays, startOfWeek } from 'date-fns';
import { ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';
import { jsPDF } from 'jspdf';

export default function TrainingPlanExport() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-for-export', selectedDate],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: selectedDate }),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const starLevels = ['Basic', '1 Star', '2 Star'];
  const grouped = {};
  starLevels.forEach(sl => {
    grouped[sl] = schedule.filter(s => s.AssignedStarLevel === sl).sort((a, b) => a.Period - b.Period);
  });

  function getInstructorDisplay(pNumber) {
    const p = personnelMap[pNumber];
    if (!p) return pNumber;
    return [p.Rank, p.Surname].filter(Boolean).join(' ');
  }

  async function generatePDF() {
    setGenerating(true);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const dateStr = format(new Date(selectedDate + 'T00:00:00'), 'EEEE dd MMMM yyyy');

    // Header
    doc.setFillColor(30, 41, 59); // dark navy
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ACF TRAINING NIGHT PLAN', 148.5, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr.toUpperCase(), 148.5, 17, { align: 'center' });

    doc.setTextColor(0, 0, 0);

    let y = 28;

    starLevels.forEach((sl, idx) => {
      const rows = grouped[sl];

      // Section heading
      const colors = { 'Basic': [59, 130, 246], '1 Star': [16, 185, 129], '2 Star': [245, 158, 11] };
      const [r, g, b] = colors[sl];
      doc.setFillColor(r, g, b);
      doc.rect(10, y, 277, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(sl.toUpperCase() + ' STAR TRAINING', 148.5, y + 4.8, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      y += 9;

      if (rows.length === 0) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text('No lessons scheduled.', 14, y + 4);
        doc.setTextColor(0, 0, 0);
        y += 10;
      } else {
        // Column widths (landscape A4 = 277mm usable)
        const cols = [14, 20, 65, 40, 35, 30, 63];
        const headers = ['Period', 'Code', 'Lesson', 'Instructor', 'Location', 'Dress', 'Notes'];
        const rowH = 7;
        const startX = 10;

        // Header row
        doc.setFillColor(248, 250, 252);
        doc.rect(startX, y, 277, rowH, 'F');
        doc.setDrawColor(200, 200, 200);
        let cx = startX;
        headers.forEach((h, i) => {
          doc.rect(cx, y, cols[i], rowH, 'S');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(h, cx + 2, y + 4.8);
          cx += cols[i];
        });
        y += rowH;

        // Data rows
        rows.forEach(row => {
          const cells = [
            `P${row.Period}`,
            row.LessonCode || '—',
            row.LessonName || '—',
            getInstructorDisplay(row.InstructorPNumber),
            row.Location || '—',
            row.DressCode || '—',
            row.Notes || '—',
          ];
          cx = startX;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          cells.forEach((cell, i) => {
            doc.rect(cx, y, cols[i], rowH, 'S');
            const txt = doc.splitTextToSize(String(cell), cols[i] - 4);
            doc.text(txt[0] || '', cx + 2, y + 4.8);
            cx += cols[i];
          });
          y += rowH;
        });
        y += 5;
      }
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')} · OFFICIAL`, 148.5, 200, { align: 'center' });

    doc.save(`Training_Plan_${selectedDate}.pdf`);
    setGenerating(false);
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Training Plan Export"
        description="Generate PDF training plans for notice-board display"
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
              Select Training Night
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {schedule.length} lesson{schedule.length !== 1 ? 's' : ''} scheduled
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Preview — {format(new Date(selectedDate + 'T00:00:00'), 'EEE dd MMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            {schedule.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No lessons scheduled for this date.</p>
            ) : (
              <div className="space-y-3">
                {starLevels.map(sl => {
                  const rows = grouped[sl];
                  if (rows.length === 0) return null;
                  return (
                    <div key={sl}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{sl}</p>
                      <div className="space-y-1">
                        {rows.map(row => (
                          <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                            <Badge variant="outline" className="text-xs shrink-0">P{row.Period}</Badge>
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