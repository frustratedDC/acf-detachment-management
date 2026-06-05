/**
 * Sort lessons: Mandatory first, then by SubjectName (alphabetical),
 * then assessments/tests last within subject, then by LessonCode.
 */
export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => {
    // 1. Mandatory first
    const mandatoryDiff = (b.IsMandatory ? 1 : 0) - (a.IsMandatory ? 1 : 0);
    if (mandatoryDiff !== 0) return mandatoryDiff;
    // 2. Subject alphabetical
    const subjectDiff = (a.SubjectName || '').localeCompare(b.SubjectName || '');
    if (subjectDiff !== 0) return subjectDiff;
    // 3. Assessments last within subject
    const isAssessA = /assess|practical\s*test|wht|weapon handling test/i.test((a.LessonName || '') + (a.LessonCode || ''));
    const isAssessB = /assess|practical\s*test|wht|weapon handling test/i.test((b.LessonName || '') + (b.LessonCode || ''));
    if (isAssessA !== isAssessB) return isAssessA ? 1 : -1;
    // 4. Lesson code ascending
    return (a.LessonCode || '').localeCompare(b.LessonCode || '');
  });
}