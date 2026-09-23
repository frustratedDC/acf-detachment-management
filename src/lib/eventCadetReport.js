// Aggregates per-cadet event data from the live entities for both the Cadet Records
// live view and the frozen EventCadetSnapshot written on completion.

export function cadetDisplayName(c) {
  return [c.Surname, c.FirstName].filter(Boolean).join(', ');
}

// Build per-cadet records sorted by surname. Each record holds aggregated counts and detail.
export function buildPerCadetRecords({ roll, stances, completions, scores, awards, kaSessions, syllabus }) {
  const stanceById = (id) => stances.find((s) => s.id === id);

  const records = roll.map((c) => {
    const cadetCompletions = completions.filter((x) => x.CadetID === c.id);
    const passed = cadetCompletions.filter((x) => x.Status === 'Pass').map((x) => x.LessonCode);
    const inStance = cadetCompletions.filter((x) => x.Status === 'Stance').map((x) => x.LessonCode);
    const reval = cadetCompletions.filter((x) => x.Status === 'REVAL').map((x) => x.LessonCode);

    // subjects completed = subjects of passed lessons
    const subjectsCompleted = [...new Set(
      passed.map((lc) => syllabus.find((s) => s.LessonCode === lc)?.SubjectName).filter(Boolean)
    )];

    // competition points
    const points = scores
      .filter((s) => s.CadetID === c.id)
      .reduce((sum, s) => sum + (s.Points || 0), 0);

    // awards won
    const awardsWon = awards
      .filter((a) => a.WinnerCadetID === c.id)
      .map((a) => a.AwardName);

    // KA sessions attended (by PNumber in Attendees, or ad-hoc by name match)
    const kaAttended = kaSessions.filter((s) => (s.Attendees || []).includes(c.PNumber));
    const kaSessionsCount = kaAttended.length;
    // aggregate scores across attended sessions
    const kaScores = {};
    kaAttended.forEach((s) => {
      const cadetScore = s.Scores?.[c.PNumber];
      if (cadetScore && typeof cadetScore === 'object') {
        Object.entries(cadetScore).forEach(([k, v]) => {
          if (typeof v === 'number') kaScores[k] = (kaScores[k] || 0) + v;
        });
      }
    });

    // per-subject breakdown for the detail view
    const bySubject = {};
    cadetCompletions.forEach((x) => {
      const lesson = syllabus.find((s) => s.LessonCode === x.LessonCode);
      const subj = lesson?.SubjectName || x.LessonCode;
      if (!bySubject[subj]) bySubject[subj] = { Pass: 0, Stance: 0, REVAL: 0, total: 0 };
      bySubject[subj][x.Status] = (bySubject[subj][x.Status] || 0) + 1;
      bySubject[subj].total++;
    });

    return {
      cadet: c,
      id: c.id,
      PNumber: c.PNumber,
      Rank: c.Rank,
      Name: cadetDisplayName(c),
      StarLevel: c.CurrentStarLevel,
      subjectsCompleted,
      lessonsPassed: passed,
      lessonsStance: inStance,
      lessonsREVAL: reval,
      kaSessionsAttended: kaSessionsCount,
      kaScores,
      competitionPoints: points,
      awardsWon,
      bySubject,
    };
  });

  records.sort((a, b) => a.Name.localeCompare(b.Name));
  return records;
}

// Build EventCadetSnapshot records ready for bulkCreate, from the live per-cadet records.
export function buildSnapshotRecords(eventId, detachmentId, records, nowIso) {
  return records.map((r) => ({
    EventID: eventId,
    CadetID: r.id,
    PNumber: r.PNumber,
    Rank: r.Rank,
    Name: r.Name,
    StarLevel: r.StarLevel,
    SubjectsCompleted: r.subjectsCompleted,
    LessonsPassed: r.lessonsPassed,
    LessonsStance: r.lessonsStance,
    LessonsREVAL: r.lessonsREVAL,
    KASessionsAttended: r.kaSessionsAttended,
    KAScores: r.kaScores,
    CompetitionPoints: r.competitionPoints,
    AwardsWon: r.awardsWon,
    SnapshotDate: nowIso,
    DetachmentID: detachmentId,
  }));
}

// Build the default editable text sections for the final report, drawn from snapshots.
export function buildReportSections(event, snapshots, { stances, staff, awards, kaSessions, syllabus }) {
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

  const overview = [
    `Event: ${event.Title}`,
    `Type: ${event.EventType || '—'}   Status: ${event.Status}`,
    `Location: ${event.Location || '—'}`,
    `Start: ${fmt(event.StartDateTime)}   End: ${fmt(event.EndDateTime)}`,
    `Cost per cadet: £${event.EventCost ?? 0}`,
    `Total cadets: ${snapshots.length}   Total staff: ${staff.length}`,
  ].join('\n');

  const sortedStances = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
  const schedule = sortedStances.map((s) => {
    const subjects = (s.SubjectNames && s.SubjectNames.length ? s.SubjectNames : (s.SubjectName ? [s.SubjectName] : [])).join(', ') || '—';
    const instructors = (s.StaffIDs || []).map((id) => staff.find((x) => x.id === id)).filter(Boolean)
      .map((x) => [x.Rank, x.Name].filter(Boolean).join(' ')).join('; ');
    return `${s.StanceLabel} — ${fmt(s.StartTime)} to ${fmt(s.EndTime)}\n  Subjects: ${subjects}\n  Instructors: ${instructors || '—'}`;
  }).join('\n\n');

  const cadetResults = snapshots.map((r) => {
    return `${r.Rank ? r.Rank + ' ' : ''}${r.Name} (${r.PNumber}) — ${r.StarLevel}
  Subjects completed: ${r.SubjectsCompleted.join(', ') || '—'}
  Lessons: ${r.LessonsPassed.length} Pass, ${r.LessonsStance.length} Stance, ${r.LessonsREVAL.length} REVAL
  KA sessions attended: ${r.KASessionsAttended}
  Competition points: ${r.CompetitionPoints}
  Awards: ${r.AwardsWon.join(', ') || '—'}`;
  }).join('\n\n');

  const awardsText = awards.map((a) => {
    const winner = snapshots.find((s) => s.CadetID === a.WinnerCadetID);
    return `${a.AwardName}${winner ? ` — ${winner.Rank ? winner.Rank + ' ' : ''}${winner.Name}` : ' (no winner)'}\n  Prize: ${a.Prize || '—'}${a.Description ? '\n  ' + a.Description : ''}`;
  }).join('\n\n');

  const kaText = kaSessions.map((s) => {
    const attendees = (s.Attendees || []).length + (s.AdHocAttendees || []).length;
    return `${s.Date} ${s.StartTime}${s.EndTime ? '-' + s.EndTime : ''} (${s.DurationMinutes}min)\n  Attendees: ${attendees}   Star levels: ${(s.AssignedStarLevels || []).join(', ') || '—'}`;
  }).join('\n\n');

  // competition tally
  const tally = [...snapshots].sort((a, b) => b.CompetitionPoints - a.CompetitionPoints);
  const tallyText = tally.map((r, i) => `${i + 1}. ${r.Rank ? r.Rank + ' ' : ''}${r.Name} — ${r.CompetitionPoints} pts`).join('\n');

  return [
    { title: 'Event Overview', content: overview },
    { title: 'Training Schedule', content: schedule || 'No stances defined.' },
    { title: 'Per-Cadet Results', content: cadetResults || 'No cadet records.' },
    { title: 'Awards', content: awardsText || 'No awards recorded.' },
    { title: 'Keeping Active Sessions', content: kaText || 'No KA sessions recorded.' },
    { title: 'Competition Tally', content: tallyText || 'No points awarded.' },
  ];
}