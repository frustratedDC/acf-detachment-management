import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Download, Loader2, BarChart2, AlertCircle } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, isAfter } from 'date-fns';
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

  // onLoad: pre-fetch attendance to warm the cache
  useEffect(() => {
    base44.entities.DailyParadeState.list().catch(() => {});
    base44.entities.InstructorAttendanceLedger.list().catch(() => {});
  }, []);

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
        <h2>Cadets</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Total On Strength</div>
            <div class="metric-value">${data.cadets.totalOnStrength}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Attendance</div>
            <div class="metric-value">${data.cadets.attendanceRate}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">New Enrolled</div>
            <div class="metric-value">${data.cadets.newEnrolled}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Strike Offs</div>
            <div class="metric-value">${data.cadets.strikeOffs}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Status Changes</div>
            <div class="metric-value">${data.cadets.statusChanges}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Subjects Completed</div>
            <div class="metric-value">${data.cadets.totalSubjectsCompleted}</div>
          </div>
        </div>
        <table>
          <tr><th>Rank</th><th>Qty</th></tr>
          ${Object.entries(data.cadets.rankBreakdown).map(([rank, count]) => `<tr><td>${rank}</td><td>${count}</td></tr>`).join('')}
        </table>
        <table>
          <tr><th>Star Level</th><th>Subject</th><th>Assessments Completed</th></tr>
          ${Object.entries(data.cadets.assessmentBreakdown).map(([starLevel, subjects]) =>
            Object.entries(subjects).map(([subject, count], i) => `
              <tr><td>${i === 0 ? starLevel : ''}</td><td>${subject}</td><td>${count}</td></tr>
            `).join('')
          ).join('')}
        </table>
      </div>

      <div class="section">
        <h2>Adults</h2>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Total On Strength</div>
            <div class="metric-value">${data.adults.totalOnStrength}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Attendance</div>
            <div class="metric-value">${data.adults.attendanceRate}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">New Enrolled</div>
            <div class="metric-value">${data.adults.newEnrolled}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Strike Offs</div>
            <div class="metric-value">${data.adults.strikeOffs}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Status Changes</div>
            <div class="metric-value">${data.adults.statusChanges}</div>
          </div>
        </div>
        <table>
          <tr><th>Rank</th><th>Qty</th></tr>
          ${Object.entries(data.adults.rankBreakdown).map(([rank, count]) => `<tr><td>${rank}</td><td>${count}</td></tr>`).join('')}
        </table>
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
            <td>Expiring Qualifications</td>
            <td>${data.expiringQualifications}</td>
          </tr>
          <tr>
            <td>Monthly NAAFI Total</td>
            <td>£${data.naafiTotal.toFixed(2)}</td>
          </tr>
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
            {/* Data quality warnings */}
            {reportData.dataFlags?.noTrainingNights && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No training nights found in NightlySchedule for {reportData.dataFlags.monthLabel}. Attendance % cannot be calculated.
              </div>
            )}

            <TooltipProvider>
              {/* Cadets Section */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Cadets</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Total On Strength</p>
                      <p className="text-2xl font-bold">{reportData.cadets.totalOnStrength}</p>
                    </CardContent>
                  </Card>
                  <Card className={reportData.dataFlags?.cadetDataMissing ? 'border-amber-300' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">Attendance</p>
                        {reportData.dataFlags?.cadetDataMissing && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Data missing for {reportData.dataFlags.monthLabel}</p>
                              <p className="text-xs opacity-70">No parade records found in DailyParadeState</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-chart-2">{reportData.cadets.attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reportData.cadets.present} / {reportData.cadets.expectedAttendance} expected
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">New Enrolled</p>
                      <p className="text-2xl font-bold">{reportData.cadets.newEnrolled}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Strike Offs</p>
                      <p className="text-2xl font-bold text-destructive">{reportData.cadets.strikeOffs}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Status Changes</p>
                      <p className="text-2xl font-bold">{reportData.cadets.statusChanges}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Subjects Completed</p>
                      <p className="text-2xl font-bold text-accent-foreground">{reportData.cadets.totalSubjectsCompleted}</p>
                    </CardContent>
                  </Card>
                </div>

                <p className="text-xs font-semibold text-muted-foreground mb-2">Rank Breakdown</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(reportData.cadets.rankBreakdown).map(([rank, count]) => (
                    <Badge key={rank} variant="outline">{rank}: {count}</Badge>
                  ))}
                </div>

                {Object.keys(reportData.cadets.assessmentBreakdown).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Assessments Completed</p>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 pr-2 font-semibold">Star Level</th>
                          <th className="text-left py-1 pr-2 font-semibold">Subject</th>
                          <th className="text-right py-1 font-semibold">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(reportData.cadets.assessmentBreakdown).map(([starLevel, subjects]) =>
                          Object.entries(subjects).map(([subject, count], i) => (
                            <tr key={`${starLevel}-${subject}`} className="border-b last:border-0">
                              <td className="py-1 pr-2 text-muted-foreground">{i === 0 ? starLevel : ''}</td>
                              <td className="py-1 pr-2">{subject}</td>
                              <td className="py-1 text-right">{count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Adults Section */}
              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-3">Adults</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Total On Strength</p>
                      <p className="text-2xl font-bold">{reportData.adults.totalOnStrength}</p>
                    </CardContent>
                  </Card>
                  <Card className={reportData.dataFlags?.instructorDataMissing ? 'border-amber-300' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-1">
                        <p className="text-xs text-muted-foreground">Attendance</p>
                        {reportData.dataFlags?.instructorDataMissing && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Data missing for {reportData.dataFlags.monthLabel}</p>
                              <p className="text-xs opacity-70">No records found in InstructorAttendanceLedger</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-chart-2">{reportData.adults.attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reportData.adults.present} / {reportData.adults.expectedAttendance} expected
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">New Enrolled</p>
                      <p className="text-2xl font-bold">{reportData.adults.newEnrolled}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Strike Offs</p>
                      <p className="text-2xl font-bold text-destructive">{reportData.adults.strikeOffs}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Status Changes</p>
                      <p className="text-2xl font-bold">{reportData.adults.statusChanges}</p>
                    </CardContent>
                  </Card>
                </div>

                <p className="text-xs font-semibold text-muted-foreground mb-2">Rank Breakdown</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(reportData.adults.rankBreakdown).map(([rank, count]) => (
                    <Badge key={rank} variant="outline">{rank}: {count}</Badge>
                  ))}
                </div>
              </div>

              {/* Operational Details */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Training Nights</p>
                    <p className="text-2xl font-bold">{reportData.trainingDates}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Expiring Quals</p>
                    <p className="text-2xl font-bold text-destructive">{reportData.expiringQualifications}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Monthly NAAFI Total</p>
                    <p className="text-2xl font-bold">£{reportData.naafiTotal.toFixed(2)}</p>
                  </CardContent>
                </Card>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </AccessGate>
  );
}