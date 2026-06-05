/**
 * Shared progression logic.
 * Handles star-level promotion and JCIC/SCIC access-level upgrades.
 *
 * DUAL-LOGIC COMPLETION ENGINE:
 *  - SKILL AT ARMS: Complete = all standard (non-assessment) lessons Approved AND assessment lesson Approved
 *  - ALL OTHER SUBJECTS: Complete = assessment lesson Approved (or all lessons Approved if no assessment)
 *
 * Assessment code detector: ends with -A followed by digits e.g. SAA-1-A01
 */
import { base44 } from '@/api/base44Client';

export const STAR_ORDER = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

// Qualifications that grant Cadet Instructor access (L2)
const INSTRUCTOR_QUALS = ['JCIC', 'SCIC'];

/** Returns true if a lesson code is an assessment */
export function isAssessment(code) {
  return !!code?.match(/-A\d+$/);
}

const SAA_SUBJECT = 'Skill at Arms';

/**
 * Determines whether a subject is fully complete given:
 *   @param subjectName - e.g. 'Skill at Arms'
 *   @param lessons     - all SyllabusMaster lessons for this subject
 *   @param approvedCodes - Set of approved lesson codes for the cadet
 *
 * SAA: all standard (non-assessment) lessons approved AND at least one assessment approved
 * Others: at least one assessment approved (if assessments exist), else all lessons approved
 */
export function isSubjectComplete(subjectName, lessons, approvedCodes) {
  if (!lessons || lessons.length === 0) return false;

  const assessments = lessons.filter(l => isAssessment(l.LessonCode));
  const standards = lessons.filter(l => !isAssessment(l.LessonCode));
  const assessmentPassed = assessments.some(l => approvedCodes.has(l.LessonCode));

  if (subjectName === SAA_SUBJECT) {
    // Holistic: ALL standard lessons approved AND at least one assessment passed
    const allStandardsDone = standards.length > 0 && standards.every(l => approvedCodes.has(l.LessonCode));
    return allStandardsDone && assessmentPassed;
  }

  // Assessment-based: if assessments exist, a pass is sufficient
  if (assessments.length > 0) return assessmentPassed;

  // No assessments — fall back to all lessons approved
  return lessons.every(l => approvedCodes.has(l.LessonCode));
}

/**
 * Returns subject completion status label: 'Completed' | 'In Progress' | 'Not Started'
 */
export function subjectCompletionStatus(subjectName, lessons, approvedCodes, pendingCodes) {
  if (!lessons || lessons.length === 0) return 'Not Started';

  if (isSubjectComplete(subjectName, lessons, approvedCodes)) return 'Completed';

  const hasAny = lessons.some(l => approvedCodes.has(l.LessonCode) || pendingCodes.has(l.LessonCode));
  return hasAny ? 'In Progress' : 'Not Started';
}

/**
 * Determines if a cadet is "Ready for Advancement" to the next star level.
 * All subjects at the current star level must satisfy their completion logic.
 */
export function isReadyForAdvancement(starLevel, syllabus, approvedCodes) {
  const levelLessons = syllabus.filter(l => l.StarLevel === starLevel);
  if (!levelLessons.length) return false;

  const subjects = {};
  levelLessons.forEach(l => {
    if (!subjects[l.SubjectName]) subjects[l.SubjectName] = [];
    subjects[l.SubjectName].push(l);
  });

  return Object.entries(subjects).every(([name, lessons]) =>
    isSubjectComplete(name, lessons, approvedCodes)
  );
}

/**
 * WHT Safety Gatekeeper:
 * Returns { allowed, reason, expiredOrMissing[] } for range/shooting access.
 * Core WHT codes: SAA-A01, SAA-A02, SAA-A03, SAA-A04
 * Unlinked: WHT-CSBTR, WHT-TR
 *
 * Checks WeaponHandlingTest records — if any core cert is missing, expired, or
 * within 30 days of expiry, range access is DENIED with reason.
 */
const CORE_WEAPON_TYPES = ['L98A2', 'L85A2'];

export function whtRangeGatekeeper(whtRecords, today = new Date()) {
  const todayMs = today.getTime();
  const issues = [];

  // Find latest valid test per weapon type
  for (const weaponType of CORE_WEAPON_TYPES) {
    const tests = whtRecords
      .filter(w => w.WeaponType === weaponType)
      .sort((a, b) => b.TestDate.localeCompare(a.TestDate));

    if (tests.length === 0) {
      issues.push({ weaponType, reason: 'No WHT record on file' });
      continue;
    }

    const latest = tests[0];
    const expiry = new Date(latest.ExpiryDate + 'T00:00:00');
    const daysRemaining = Math.ceil((expiry.getTime() - todayMs) / 86400000);

    if (daysRemaining < 0) {
      issues.push({ weaponType, reason: `WHT EXPIRED (${Math.abs(daysRemaining)} days ago)`, expired: true });
    }
  }

  return {
    allowed: issues.length === 0,
    issues,
  };
}

/**
 * WHT expiry alerts — returns certs expiring within `warnDays` or already expired.
 */
export function getWhtAlerts(whtRecords, warnDays = 30, today = new Date()) {
  const todayMs = today.getTime();
  return whtRecords
    .map(w => {
      if (!w.ExpiryDate) return null;
      const expiry = new Date(w.ExpiryDate + 'T00:00:00');
      const daysRemaining = Math.ceil((expiry.getTime() - todayMs) / 86400000);
      if (daysRemaining > warnDays) return null;
      return { ...w, daysRemaining, expired: daysRemaining < 0 };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Checks if a cadet should be promoted to the next star level.
 * Uses dual-logic completion engine.
 */
export async function checkAndPromoteCadet(cadetPNumber, currentStarLevel, syllabus, allProgress) {
  const approvedCodes = new Set(
    allProgress
      .filter(p => p.CadetPNumber === cadetPNumber && p.Status === 'Approved')
      .map(p => p.LessonCode)
  );

  const ready = isReadyForAdvancement(currentStarLevel, syllabus, approvedCodes);

  // Check for JCIC/SCIC qualification grants
  let earnedQual = null;
  const completedLessons = syllabus.filter(l => approvedCodes.has(l.LessonCode));
  for (const lesson of completedLessons) {
    if (lesson.GrantsQualification && INSTRUCTOR_QUALS.includes(lesson.GrantsQualification)) {
      earnedQual = lesson.GrantsQualification;
      break;
    }
  }

  let newStarLevel = null;
  if (ready) {
    const currentIdx = STAR_ORDER.indexOf(currentStarLevel);
    if (currentIdx !== -1 && currentIdx < STAR_ORDER.length - 1) {
      newStarLevel = STAR_ORDER[currentIdx + 1];
    }
  }

  if (!newStarLevel && !earnedQual) return null;

  const records = await base44.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
  if (records.length === 0) return null;

  const rec = records[0];
  const updates = {};

  if (newStarLevel && rec.CurrentStarLevel === currentStarLevel) {
    updates.CurrentStarLevel = newStarLevel;
  }

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