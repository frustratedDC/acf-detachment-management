export const ACCESS_LEVELS = {
  GENERAL: 0,
  CADET_NCO: 1,
  CADET_INSTRUCTOR: 2,
  DET_INSTRUCTOR: 3,
  DET_2IC: 4,
  DET_COMMANDER: 5,
  SYSTEM_ADMIN: 6,
};

export const LEVEL_NAMES = {
  0: 'General',
  1: 'Cadet NCO',
  2: 'Cadet Instructor',
  3: 'Detachment Instructor',
  4: 'Detachment 2IC',
  5: 'Detachment Commander',
  6: 'System Administrator',
};

// L3+ are Adult Instructors and do NOT require syllabus completion
export function isCadet(accessLevel) {
  return accessLevel < 3;
}

export function isAdultInstructor(accessLevel) {
  return accessLevel >= 3;
}

export function hasAccess(userLevel, requiredLevel) {
  return userLevel >= requiredLevel;
}