/**
 * Shared progression logic.
 * Handles star-level promotion and JCIC/SCIC access-level upgrades.
 */
import { base44 } from '@/api/base44Client';

const STAR_ORDER = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

// Qualifications that grant Cadet Instructor access (L2)
const INSTRUCTOR_QUALS = ['JCIC', 'SCIC'];

/**
 * Checks if a cadet should be promoted to the next star level.
 * Also checks if they've earned a JCIC/SCIC qualification → upgrades to L2.
 * Returns { newStarLevel, newAccessLevel } — null values mean no change.
 */
export async function checkAndPromoteCadet(cadetPNumber, currentStarLevel, syllabus, allProgress) {
  const mandatory = syllabus.filter(l => l.StarLevel === currentStarLevel && l.IsMandatory);

  const approvedCodes = new Set(
    allProgress
      .filter(p => p.CadetPNumber === cadetPNumber && p.Status === 'Approved')
      .map(p => p.LessonCode)
  );

  // Check for JCIC/SCIC qualification grants
  let earnedQual = null;
  const completedLessons = syllabus.filter(l => approvedCodes.has(l.LessonCode));
  for (const lesson of completedLessons) {
    if (lesson.GrantsQualification && INSTRUCTOR_QUALS.includes(lesson.GrantsQualification)) {
      earnedQual = lesson.GrantsQualification;
      break;
    }
  }

  // Star level promotion — only if all mandatory lessons complete
  let newStarLevel = null;
  if (mandatory.length > 0 && mandatory.every(l => approvedCodes.has(l.LessonCode))) {
    const currentIdx = STAR_ORDER.indexOf(currentStarLevel);
    if (currentIdx !== -1 && currentIdx < STAR_ORDER.length - 1) {
      newStarLevel = STAR_ORDER[currentIdx + 1];
    }
  }

  if (!newStarLevel && !earnedQual) return null;

  // Fetch and update the personnel record
  const records = await base44.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
  if (records.length === 0) return null;

  const rec = records[0];
  const updates = {};

  if (newStarLevel && rec.CurrentStarLevel === currentStarLevel) {
    updates.CurrentStarLevel = newStarLevel;
  }

  // Upgrade to Cadet Instructor (L2) if currently below L2 and earned JCIC/SCIC
  if (earnedQual && (rec.AccessLevel ?? 0) < 2) {
    updates.AccessLevel = 2;
    updates.RoleName = 'Cadet Instructor';
  }

  if (Object.keys(updates).length > 0) {
    await base44.entities.PersonnelManager.update(rec.id, updates);
  }

  return {
    newStarLevel: updates.CurrentStarLevel || null,
    newAccessLevel: updates.AccessLevel || null,
    earnedQual,
  };
}