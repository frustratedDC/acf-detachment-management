/**
 * Sort lessons: by SubjectName, then within each subject:
 * regular lessons first (by LessonCode), assessments/tests last.
 */
export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => {
    const subjectDiff = (a.SubjectName || '').localeCompare(b.SubjectName || '');
    if (subjectDiff !== 0) return subjectDiff;
    const isAssessA = /assess|practical\s*test|wht|weapon handling test/i.test((a.LessonName || '') + (a.LessonCode || ''));
    const isAssessB = /assess|practical\s*test|wht|weapon handling test/i.test((b.LessonName || '') + (b.LessonCode || ''));
    if (isAssessA !== isAssessB) return isAssessA ? 1 : -1;
    return (a.LessonCode || '').localeCompare(b.LessonCode || '');
  });
}