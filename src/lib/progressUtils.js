/**
 * Shared progression logic.
 * Checks if a cadet has completed all mandatory lessons for their current star level
 * and promotes them if so.
 */

import { base44 } from '@/api/base44Client';

const STAR_ORDER = ['Basic', '1 Star', '2 Star'];

/**
 * Given a cadet's PNumber and current star level, checks if all mandatory lessons
 * for that level are approved. If so, promotes the cadet to the next star level.
 * Returns the new star level if promoted, or null.
 */
export async function checkAndPromoteCadet(cadetPNumber, currentStarLevel, syllabus, allProgress) {
  const mandatory = syllabus.filter(l => l.StarLevel === currentStarLevel && l.IsMandatory);
  if (mandatory.length === 0) return null;

  const approvedCodes = new Set(
    allProgress
      .filter(p => p.CadetPNumber === cadetPNumber && p.Status === 'Approved')
      .map(p => p.LessonCode)
  );

  const allDone = mandatory.every(l => approvedCodes.has(l.LessonCode));
  if (!allDone) return null;

  const currentIdx = STAR_ORDER.indexOf(currentStarLevel);
  if (currentIdx === -1 || currentIdx >= STAR_ORDER.length - 1) return null;

  const nextLevel = STAR_ORDER[currentIdx + 1];

  // Find and update the personnel record
  const records = await base44.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
  if (records.length > 0 && records[0].CurrentStarLevel === currentStarLevel) {
    await base44.entities.PersonnelManager.update(records[0].id, { CurrentStarLevel: nextLevel });
    return nextLevel;
  }
  return null;
}