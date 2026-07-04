// Rank progression ladder and promotion requirements
export const RANK_ORDER = ['Cdt', 'Cdt LCpl', 'Cdt Cpl', 'Cdt Sgt', 'Cdt SSgt', 'Cdt WO2', 'Cdt WO1'];

export const RANK_REQUIREMENTS = {
  'Cdt LCpl': { requiredStarLevel: '1 Star', timeInRankMonths: 4, extraStarLevel: '2 Star', extraSubject: 'Fieldcraft', manualCriteria: [] },
  'Cdt Cpl': { requiredStarLevel: '2 Star', manualCriteria: [] },
  'Cdt Sgt': { requiredStarLevel: '3 Star', manualCriteria: [{ label: 'OC Sgt Interview', field: 'OCSgtInterviewComplete' }] },
  'Cdt SSgt': { requiredStarLevel: '4 Star', manualCriteria: [{ label: 'OC SSgt Interview', field: 'OCSSgtInterviewComplete' }] },
  'Cdt WO2': { manualCriteria: [{ label: 'OC CSM Interview', field: 'OCCSMInterviewComplete' }] },
  'Cdt WO1': { manualCriteria: [{ label: 'Commandant RSM Interview', field: 'CommandantRSMInterviewComplete' }] },
};

export function monthsSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

// Derives the date a cadet completed a star level from their ProgressLedger history:
// the latest CompletionDate among the mandatory lessons for that level, once all are approved.
export function getStarLevelCompletionDate(levelLessons, approvedLessons) {
  if (!levelLessons || levelLessons.length === 0) return null;
  const approvedByCode = {};
  approvedLessons.forEach(a => { approvedByCode[a.LessonCode] = a.CompletionDate; });
  const allApproved = levelLessons.every(l => approvedByCode[l.LessonCode]);
  if (!allApproved) return null;
  const dates = levelLessons.map(l => new Date(approvedByCode[l.LessonCode]).getTime());
  return new Date(Math.max(...dates)).toISOString().split('T')[0];
}

export function computeAttendancePct(paradeRecords, pNumber, sinceDate) {
  const records = paradeRecords.filter(p => p.UserPNumber === pNumber && (!sinceDate || new Date(p.Date) >= sinceDate));
  if (records.length === 0) return null;
  const present = records.filter(r => r.AttendanceStatus === 'Present').length;
  return Math.round((present / records.length) * 100);
}

export function countDisciplineRecords(disciplineLogs, pNumber, sinceDate) {
  return disciplineLogs.filter(d => (d.PersonnelInvolved || []).includes(pNumber) && (!sinceDate || new Date(d.Date) >= sinceDate)).length;
}