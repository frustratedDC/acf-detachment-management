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
      naafiSales,          // NafiiSale: NAAFI transactions
    ] = await Promise.all([
      base44.asServiceRole.entities.PersonnelManager.filter({}),
      base44.asServiceRole.entities.DailyParadeState.filter({}),
      base44.asServiceRole.entities.InstructorAttendanceLedger.filter({}),
      base44.asServiceRole.entities.QualificationMatrix.filter({}),
      base44.asServiceRole.entities.SyllabusMaster.filter({}),
      base44.asServiceRole.entities.ProgressLedger.filter({}),
      base44.asServiceRole.entities.NightlySchedule.filter({}),
      base44.asServiceRole.entities.NafiiSale.filter({}),
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

    // --- INSTRUCTOR ATTENDANCE (DailyParadeState, field: UserPNumber) ---
    const monthInstructorLedger = cadetParade.filter(
      a => a.Date >= startDate && a.Date <= endDate && instructorPNumbers.has(a.UserPNumber)
    );
    const instructorPresent = monthInstructorLedger.filter(a => a.AttendanceStatus === 'Present').length;
    const expectedInstructorAttendance = trainingNightCount * instructors.length;
    const instructorAttendanceRate = expectedInstructorAttendance > 0
      ? Math.round((instructorPresent / expectedInstructorAttendance) * 100)
      : 0;
    const instructorDataMissing = monthInstructorLedger.length === 0 && trainingNightCount > 0;

    // --- ASSESSMENTS (SUBJECT COMPLETIONS) COMPLETED, BROKEN DOWN BY STAR LEVEL ---
    // Assessment lesson codes end in "-A##" (e.g. DRILL-A01). Only these count as subject completions.
    const lessonCodeToInfo = {};
    syllabusMaster.forEach(l => { lessonCodeToInfo[l.LessonCode] = l; });

    const monthApprovedProgress = progressLedger.filter(
      p => p.CompletionDate >= startDate && p.CompletionDate <= endDate && p.Status === 'Approved'
    );

    // Structure: { [StarLevel]: { [SubjectName]: count } }
    const assessmentBreakdown = {};
    let totalSubjectsCompleted = 0;
    monthApprovedProgress.forEach(p => {
      if (!/-A\d+$/.test(p.LessonCode)) return;
      const lessonInfo = lessonCodeToInfo[p.LessonCode];
      if (!lessonInfo) return;
      const { StarLevel, SubjectName } = lessonInfo;
      if (!assessmentBreakdown[StarLevel]) assessmentBreakdown[StarLevel] = {};
      assessmentBreakdown[StarLevel][SubjectName] = (assessmentBreakdown[StarLevel][SubjectName] || 0) + 1;
      totalSubjectsCompleted += 1;
    });

    // --- EXPIRING QUALIFICATIONS ---
    const expiringQuals = qualifications.filter(
      q => q.ExpiryDate && q.ExpiryDate >= startDate && q.ExpiryDate <= endDate
    ).length;

    // --- RANK BREAKDOWN ---
    function rankBreakdown(list) {
      const breakdown = {};
      list.forEach(p => {
        const rank = p.Rank || 'Unspecified';
        breakdown[rank] = (breakdown[rank] || 0) + 1;
      });
      return breakdown;
    }

    // --- STRIKE OFFS / STATUS CHANGES / NEW ENROLLMENTS ---
    function personnelChanges(type) {
      const typePersonnel = personnel.filter(p => p.Type === type);
      const strikeOffs = typePersonnel.filter(
        p => p.PersonnelStatus === 'Leaver' && p.StatusChangedDate >= startDate && p.StatusChangedDate <= endDate
      ).length;
      const statusChanges = typePersonnel.filter(
        p => p.StatusChangedDate && p.StatusChangedDate >= startDate && p.StatusChangedDate <= endDate
      ).length;
      const newEnrolled = typePersonnel.filter(
        p => p.created_date && format(new Date(p.created_date), 'yyyy-MM-dd') >= startDate && format(new Date(p.created_date), 'yyyy-MM-dd') <= endDate
      ).length;
      return { strikeOffs, statusChanges, newEnrolled };
    }

    const cadetChanges = personnelChanges('Cadet');
    const adultChanges = personnelChanges('Adult Instructor');

    // --- NAAFI MONTHLY TOTAL ---
    const monthNaafiSales = naafiSales.filter(s => s.SaleDate >= startDate && s.SaleDate <= endDate);
    const naafiTotal = monthNaafiSales.reduce((sum, s) => sum + (s.TotalAmount || 0), 0);

    const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy');

    const report = {
      month,
      year,
      monthName: monthLabel,
      generatedDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      cadets: {
        totalOnStrength: cadets.length,
        rankBreakdown: rankBreakdown(cadets),
        ...cadetChanges,
        attendanceRate: cadetAttendanceRate,
        present: cadetPresent,
        expectedAttendance: expectedCadetAttendance,
        assessmentBreakdown,
        totalSubjectsCompleted,
      },
      adults: {
        totalOnStrength: instructors.length,
        rankBreakdown: rankBreakdown(instructors),
        ...adultChanges,
        attendanceRate: instructorAttendanceRate,
        present: instructorPresent,
        expectedAttendance: expectedInstructorAttendance,
      },
      naafiTotal,
      expiringQualifications: expiringQuals,
      // Data quality flags for UI tooltips
      dataFlags: {
        cadetDataMissing,
        instructorDataMissing,
        noTrainingNights: trainingNightCount === 0,
        monthLabel,
      },
      trainingDates: trainingNightCount,
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});