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

    const startDate = format(startOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

    // Fetch all required data in parallel
    const [
      personnel,
      cadetParade,         // DailyParadeState: cadet attendance (UserPNumber)
      instructorLedger,    // InstructorAttendanceLedger: instructor attendance (InstructorPNumber)
      qualifications,
      syllabusMaster,      // SyllabusMaster: LessonCode -> SubjectName lookup for breakdown
      progressLedger,      // ProgressLedger: lesson approvals (CompletionDate)
      nightlySchedule,     // NightlySchedule: source of truth for expected training nights
    ] = await Promise.all([
      base44.asServiceRole.entities.PersonnelManager.filter({}),
      base44.asServiceRole.entities.DailyParadeState.filter({}),
      base44.asServiceRole.entities.InstructorAttendanceLedger.filter({}),
      base44.asServiceRole.entities.QualificationMatrix.filter({}),
      base44.asServiceRole.entities.SyllabusMaster.filter({}),
      base44.asServiceRole.entities.ProgressLedger.filter({}),
      base44.asServiceRole.entities.NightlySchedule.filter({}),
    ]);

    // Segment active personnel
    const cadets = personnel.filter(p => p.Type === 'Cadet' && p.PersonnelStatus === 'Active');
    const instructors = personnel.filter(p => p.Type === 'Adult Instructor' && p.PersonnelStatus === 'Active');
    const cadetPNumbers = new Set(cadets.map(c => c.PNumber));
    const instructorPNumbers = new Set(instructors.map(i => i.PNumber));

    // Training nights from NightlySchedule — source of truth for expected attendance
    const trainingNights = [
      ...new Set(
        nightlySchedule
          .filter(s => s.Date >= startDate && s.Date <= endDate)
          .map(s => s.Date)
      ),
    ];
    const trainingNightCount = trainingNights.length;

    // --- CADET ATTENDANCE (DailyParadeState, field: UserPNumber) ---
    const monthCadetParade = cadetParade.filter(
      a => a.Date >= startDate && a.Date <= endDate && cadetPNumbers.has(a.UserPNumber)
    );
    const cadetPresent = monthCadetParade.filter(a => a.AttendanceStatus === 'Present').length;
    const expectedCadetAttendance = trainingNightCount * cadets.length;
    const cadetAttendanceRate = expectedCadetAttendance > 0
      ? Math.round((cadetPresent / expectedCadetAttendance) * 100)
      : 0;
    const cadetDataMissing = monthCadetParade.length === 0 && trainingNightCount > 0;

    // --- INSTRUCTOR ATTENDANCE (InstructorAttendanceLedger, field: InstructorPNumber) ---
    const monthInstructorLedger = instructorLedger.filter(
      a => a.Date >= startDate && a.Date <= endDate && instructorPNumbers.has(a.InstructorPNumber)
    );
    const instructorPresent = monthInstructorLedger.filter(a => a.AttendanceStatus === 'Present').length;
    const expectedInstructorAttendance = trainingNightCount * instructors.length;
    const instructorAttendanceRate = expectedInstructorAttendance > 0
      ? Math.round((instructorPresent / expectedInstructorAttendance) * 100)
      : 0;
    const instructorDataMissing = monthInstructorLedger.length === 0 && trainingNightCount > 0;

    // --- LESSONS APPROVED + SUBJECT BREAKDOWN (ProgressLedger, joined to SyllabusMaster for SubjectName) ---
    const lessonCodeToSubject = {};
    syllabusMaster.forEach(l => { lessonCodeToSubject[l.LessonCode] = l.SubjectName; });

    const monthApprovedProgress = progressLedger.filter(
      p => p.CompletionDate >= startDate && p.CompletionDate <= endDate && p.Status === 'Approved'
    );
    const lessonsApproved = monthApprovedProgress.length;

    const subjectBreakdown = {};
    monthApprovedProgress.forEach(p => {
      const subject = lessonCodeToSubject[p.LessonCode];
      if (subject) {
        subjectBreakdown[subject] = (subjectBreakdown[subject] || 0) + 1;
      }
    });

    // --- EXPIRING QUALIFICATIONS ---
    const expiringQuals = qualifications.filter(
      q => q.ExpiryDate && q.ExpiryDate >= startDate && q.ExpiryDate <= endDate
    ).length;

    const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

    const report = {
      month,
      year,
      monthName: monthLabel,
      generatedDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      summary: {
        totalCadets: cadets.length,
        totalInstructors: instructors.length,
        cadetAttendanceRate,
        instructorAttendanceRate,
        cadetPresent,
        expectedCadetAttendance,
        instructorPresent,
        expectedInstructorAttendance,
        lessonsApproved,
        expiringQualifications: expiringQuals,
      },
      // Data quality flags for UI tooltips
      dataFlags: {
        cadetDataMissing,
        instructorDataMissing,
        noTrainingNights: trainingNightCount === 0,
        monthLabel,
      },
      subjectBreakdown,
      trainingDates: trainingNightCount,
      staffAvailable: instructorPresent,
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});