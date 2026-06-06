import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { format, startOfMonth, endOfMonth } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { month, year } = await req.json();

    if (!month || !year) {
      return Response.json({ error: 'Missing month or year' }, { status: 400 });
    }

    // Fetch required data
    const [personnel, attendanceLedger, qualifications, trainingHistory, progress] = await Promise.all([
      base44.asServiceRole.entities.PersonnelManager.filter({}),
      base44.asServiceRole.entities.InstructorAttendanceLedger.filter({}),
      base44.asServiceRole.entities.QualificationMatrix.filter({}),
      base44.asServiceRole.entities.TrainingHistory.filter({}),
      base44.asServiceRole.entities.ProgressLedger.filter({}),
    ]);

    const startDate = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

    // Calculate metrics
    const cadets = personnel.filter(p => p.Type === 'Cadet' && p.PersonnelStatus === 'Active');
    const instructors = personnel.filter(p => p.Type === 'Adult Instructor' && p.PersonnelStatus === 'Active');

    // Attendance calculations
    const monthAttendance = attendanceLedger.filter(a => a.Date >= startDate && a.Date <= endDate);
    const cadetAttendanceDates = [...new Set(monthAttendance.filter(a => a.UserPNumber && cadets.some(c => c.PNumber === a.UserPNumber)).map(a => a.Date))];
    const instructorAttendanceDates = [...new Set(monthAttendance.filter(a => a.UserPNumber && instructors.some(i => i.PNumber === a.UserPNumber)).map(a => a.Date))];

    const cadetPresent = monthAttendance.filter(a => a.AttendanceStatus === 'Present' && cadets.some(c => c.PNumber === a.UserPNumber)).length;
    const cadetTotal = cadetAttendanceDates.length * cadets.length;
    const cadetAttendanceRate = cadetTotal > 0 ? Math.round((cadetPresent / cadetTotal) * 100) : 0;

    const instructorPresent = monthAttendance.filter(a => a.AttendanceStatus === 'Present' && instructors.some(i => i.PNumber === a.UserPNumber)).length;
    const instructorTotal = instructorAttendanceDates.length * instructors.length;
    const instructorAttendanceRate = instructorTotal > 0 ? Math.round((instructorPresent / instructorTotal) * 100) : 0;

    // Subject completion
    const monthProgress = progress.filter(p => p.created_date >= startDate && p.created_date <= endDate && p.Status === 'Approved');
    const subjectBreakdown = {};
    monthProgress.forEach(p => {
      if (p.SubjectName) {
        subjectBreakdown[p.SubjectName] = (subjectBreakdown[p.SubjectName] || 0) + 1;
      }
    });

    // Engagement
    const cadetEngagement = monthProgress.length;
    const expiringQuals = qualifications.filter(q => q.ExpiryDate && new Date(q.ExpiryDate) <= endOfMonth(new Date(year, month - 1, 1)) && new Date(q.ExpiryDate) >= startOfMonth(new Date(year, month - 1, 1))).length;

    const report = {
      month,
      year,
      monthName: format(new Date(year, month - 1, 1), 'MMMM yyyy'),
      generatedDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      summary: {
        totalCadets: cadets.length,
        totalInstructors: instructors.length,
        cadetAttendanceRate,
        instructorAttendanceRate,
        lessonsApproved: monthProgress.length,
        expiringQualifications: expiringQuals,
      },
      subjectBreakdown,
      trainingDates: cadetAttendanceDates.length,
      staffAvailable: instructorAttendanceDates.length,
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});