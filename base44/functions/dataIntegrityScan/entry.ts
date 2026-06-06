import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all data for reconciliation
    const [
      allPersonnel,
      attendanceLedger,
      progressLedger,
      qualifications,
      trainingHistory,
    ] = await Promise.all([
      base44.asServiceRole.entities.PersonnelManager.filter({}),
      base44.asServiceRole.entities.InstructorAttendanceLedger.filter({}),
      base44.asServiceRole.entities.ProgressLedger.filter({}),
      base44.asServiceRole.entities.QualificationMatrix.filter({}),
      base44.asServiceRole.entities.TrainingHistory.filter({}),
    ]);

    const cadets = allPersonnel.filter(p => p.Type === 'Cadet');
    const instructors = allPersonnel.filter(p => p.Type === 'Adult Instructor');

    const scanResults = {
      timestamp: new Date().toISOString(),
      totalPersonnel: allPersonnel.length,
      cadets: cadets.length,
      instructors: instructors.length,
      attendanceRecords: attendanceLedger.length,
      progressRecords: progressLedger.length,
      qualificationRecords: qualifications.length,
      trainingHistoryRecords: trainingHistory.length,
      issues: [],
      recommendations: [],
    };

    // Check for orphaned records
    const attendanceWithMissingPersonnel = attendanceLedger.filter(a =>
      !allPersonnel.some(p => p.PNumber === a.UserPNumber || a.InstructorPNumber === p.PNumber)
    );

    if (attendanceWithMissingPersonnel.length > 0) {
      scanResults.issues.push({
        type: 'orphaned_attendance',
        count: attendanceWithMissingPersonnel.length,
        description: 'Attendance records reference non-existent personnel',
      });
      scanResults.recommendations.push('Review and archive orphaned attendance records');
    }

    // Check for missing training history
    const progressWithoutHistory = progressLedger.filter(p => p.Status === 'Approved' && !trainingHistory.some(h => h.CadetPNumber === p.CadetPNumber && h.LessonCode === p.LessonCode));
    if (progressWithoutHistory.length > 0) {
      scanResults.issues.push({
        type: 'missing_training_history',
        count: progressWithoutHistory.length,
        description: 'Approved progress entries missing corresponding training history',
      });
      scanResults.recommendations.push(`Migrate ${progressWithoutHistory.length} approved progress records to training history`);
    }

    // Check for missing qualifications
    const instructorsWithoutQuals = instructors.filter(i => !qualifications.some(q => q.InstructorPNumber === i.PNumber));
    if (instructorsWithoutQuals.length > 0) {
      scanResults.issues.push({
        type: 'missing_qualifications',
        count: instructorsWithoutQuals.length,
        description: 'Instructors with no qualification records',
      });
      scanResults.recommendations.push('Audit instructor qualifications and populate QualificationMatrix');
    }

    // Data integrity score
    const totalChecks = 3;
    const passedChecks = totalChecks - scanResults.issues.length;
    scanResults.integrityScore = Math.round((passedChecks / totalChecks) * 100);

    return Response.json(scanResults);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});