// Rank progression ladder and promotion requirements
export const RANK_ORDER = ['Cdt', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'WO2', 'WO1'];

export const RANK_REQUIREMENTS = {
  LCpl: { requiredStarLevel: '1 Star', timeInRankMonths: 4, extraStarLevel: '2 Star', extraSubject: 'Fieldcraft', manualCriteria: [] },
  Cpl: { requiredStarLevel: '2 Star', manualCriteria: [] },
  Sgt: { requiredStarLevel: '3 Star', manualCriteria: ['OC interview with recommendation for promotion'] },
  SSgt: { requiredStarLevel: '4 Star', manualCriteria: ['OC interview with recommendation for promotion'] },
  WO2: { manualCriteria: ['OC directed (CSM)'] },
  WO1: { manualCriteria: ['OC directed (RSM)'] },
};

export function monthsSince(dateStr) {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
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