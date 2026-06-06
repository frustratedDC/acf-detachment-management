import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, BarChart2 } from 'lucide-react';
import { format, subMonths, parseISO, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { toast } from 'sonner';

export default function MonthlyReports() {
  const { personnel: me } = usePersonnel();
  
  // Initialize with previous month (default)
  const defaultMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Parse selected month safely
  const [year, month] = selectedMonth.split('-').map(Number);
  
  // Compute the selected month's start and end dates
  const selectedMonthStart = startOfMonth(new Date(year, month - 1, 1));
  const selectedMonthEnd = endOfMonth(selectedMonthStart);
  const today = new Date();
  
  // Check if selected month is in the future
  const isFutureMonth = isAfter(selectedMonthStart, today);

  const { isLoading } = useQuery({
    queryKey: ['scan-data-integrity'],
    queryFn: async () => {
      const res = await base44.functions.invoke('dataIntegrityScan', {});
      return res.data;
    },
    enabled: false,
  });

  const handleGenerateReport = async () => {
    // Validate: prevent future months
    if (isFutureMonth) {
      toast.error('Future dates unavailable. Please select the current month or earlier.');
      setReportData(null);
      return;
    }

    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateMonthlyReport', {
        month,
        year,
      });
      setReportData(res.data);
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error(`Failed to generate report: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Memoized report title based on selected month
  const reportTitle = useMemo(() => {
    return format(new Date(year, month - 1, 1), 'MMMM yyyy');
  }, [year, month]);

  const handleExportPDF = () => {
    if (!reportData) return;

    const html = generatePDFContent(reportData);
    const element = document.createElement('a');
    const file = new Blob([html], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `Leigh_Detachment_Report_${reportData.monthName.replace(' ', '_')}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Report downloaded');
  };

  const generatePDFContent = (data) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; border-bottom: 3px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #1a1a1a; }
        .header p { margin: 5px 0; color: #666; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 2px solid #ddd; padding-bottom: 10px; color: #222; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
        .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .metric-value { font-size: 28px; font-weight: bold; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #f5f5f5; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Leigh Detachment Monthly Report</h1>
        <p>${data.monthName}</p>
        <p>Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm')}</p>
      </div>

      <div class="section">
        <h2>Executive Summary</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Total Cadets</div>
            <div class="metric-value">${data.summary.totalCadets}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Total Instructors</div>
            <div class="metric-value">${data.summary.totalInstructors}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Cadet Attendance</div>
            <div class="metric-value">${data.summary.cadetAttendanceRate}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Instructor Attendance</div>
            <div class="metric-value">${data.summary.instructorAttendanceRate}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Lessons Approved</div>
            <div class="metric-value">${data.summary.lessonsApproved}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Expiring Qualifications</div>
            <div class="metric-value">${data.summary.expiringQualifications}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Operational Details</h2>
        <table>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Training Nights Conducted</td>
            <td>${data.trainingDates}</td>
          </tr>
          <tr>
            <td>Staff Availability Submissions</td>
            <td>${data.staffAvailable}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <h2>Subject Completion Breakdown</h2>
        <table>
          <tr>
            <th>Subject</th>
            <th>Lessons Completed</th>
          </tr>
          ${Object.entries(data.subjectBreakdown).map(([subject, count]) => `
            <tr>
              <td>${subject}</td>
              <td>${count}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div class="footer">
        <p>This report was automatically generated by the ACF Training Manager system.</p>
        <p>Report ID: ${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
      </div>
    </body>
    </html>
    `;
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Monthly Reports"
        description="Generate and review detachment performance reports"
        icon={FileText}
      />

      {/* Report Generator */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Select Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerateReport}
              disabled={generating}
              className="gap-2 w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Display */}
      {reportData && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{reportTitle} Report</CardTitle>
              </div>
              <Button
                onClick={handleExportPDF}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Cadets</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalCadets}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Instructors</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalInstructors}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Cadet Attendance</p>
                  <p className="text-2xl font-bold text-chart-2">{reportData.summary.cadetAttendanceRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Instructor Attendance</p>
                  <p className="text-2xl font-bold text-chart-2">{reportData.summary.instructorAttendanceRate}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Lessons Approved</p>
                  <p className="text-2xl font-bold text-accent-foreground">{reportData.summary.lessonsApproved}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Expiring Quals</p>
                  <p className="text-2xl font-bold text-destructive">{reportData.summary.expiringQualifications}</p>
                </CardContent>
              </Card>
            </div>

            {/* Subject Breakdown */}
            {Object.keys(reportData.subjectBreakdown).length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-3">Subject Completion</h3>
                <div className="space-y-2">
                  {Object.entries(reportData.subjectBreakdown).map(([subject, count]) => (
                    <div key={subject} className="flex items-center justify-between">
                      <span className="text-sm">{subject}</span>
                      <Badge variant="secondary">{count} lesson{count !== 1 ? 's' : ''}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AccessGate>
  );
}