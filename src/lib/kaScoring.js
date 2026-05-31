// KA Scoring Engine — all calculations are pure functions

export function bjMax(s) {
  const vals = [s.BJ1, s.BJ2, s.BJ3].filter(v => v != null && !isNaN(v));
  return vals.length > 0 ? Math.max(...vals) : null;
}

export function bjPoints(bj) {
  if (bj == null || bj < 100) return 0;
  if (bj >= 200) return 5;
  if (bj >= 170) return 4;
  if (bj >= 150) return 3;
  if (bj >= 130) return 2;
  return 1; // 100-129
}

export function squatPoints(v) {
  if (v == null || v < 5) return 0;
  if (v >= 28) return 5;
  if (v >= 21) return 4;
  if (v >= 15) return 3;
  if (v >= 10) return 2;
  return 1; // 5-9
}

export function pressUpPoints(v) {
  if (v == null || v < 5) return 0;
  if (v >= 28) return 5;
  if (v >= 20) return 4;
  if (v >= 17) return 3;
  if (v >= 11) return 2;
  return 1; // 5-10
}

export function shuttlePoints(v) {
  if (v == null || v >= 46) return 0;
  if (v <= 23) return 5;
  if (v <= 25) return 4;
  if (v <= 29) return 3;
  if (v <= 35) return 2;
  return 1; // 36-45
}

export function msftPoints(v) {
  if (v == null || v < 5.0) return 0;
  if (v >= 10.1) return 5;
  if (v >= 9.0) return 4;
  if (v >= 8.1) return 3;
  if (v >= 7.0) return 2;
  return 1; // 5.0-6.10
}

export function participationPoints(durationMinutes) {
  if (!durationMinutes) return 0;
  // 2pts per 30 minutes
  return Math.floor(durationMinutes / 30) * 2;
}

// Round duration up to next 30-min bracket
export function roundUpToNearest30(minutes) {
  if (!minutes) return 0;
  return Math.ceil(minutes / 30) * 30;
}

export function activityTotal(s) {
  const bj = bjMax(s);
  return bjPoints(bj) + squatPoints(s.Squats) + pressUpPoints(s.PressUps) + shuttlePoints(s.Shuttle) + msftPoints(s.MSFT);
}

/**
 * Calculates bonus points for a session given all sessions on the same date (sessionDay)
 * and all historical sessions for the same cadet (history — must exclude current session).
 *
 * Returns { bj_h, bj_i, sq_h, sq_i, pu_h, pu_i, sh_h, sh_i, msft_h, msft_i, total }
 */
export function calcBonuses(session, sessionDay, history) {
  const bj = bjMax(session);

  // --- Highest performer bonuses ---
  function isHighest(val, dayVals, higherIsBetter = true) {
    if (val == null) return false;
    const others = dayVals.filter(v => v != null);
    if (others.length === 0) return false;
    return higherIsBetter
      ? val >= Math.max(...others)
      : val <= Math.min(...others);
  }

  const dayBJs = sessionDay.map(s => bjMax(s)).filter(v => v != null);
  const daySQ = sessionDay.map(s => s.Squats).filter(v => v != null);
  const dayPU = sessionDay.map(s => s.PressUps).filter(v => v != null);
  const daySH = sessionDay.map(s => s.Shuttle).filter(v => v != null);
  const dayMSFT = sessionDay.map(s => s.MSFT).filter(v => v != null);

  const bj_h = (bj != null && dayBJs.length > 0 && bj >= Math.max(...dayBJs)) ? 1 : 0;
  const sq_h = (session.Squats != null && daySQ.length > 0 && session.Squats >= Math.max(...daySQ)) ? 1 : 0;
  const pu_h = (session.PressUps != null && dayPU.length > 0 && session.PressUps >= Math.max(...dayPU)) ? 1 : 0;
  const sh_h = (session.Shuttle != null && daySH.length > 0 && session.Shuttle <= Math.min(...daySH)) ? 1 : 0;
  const msft_h = (session.MSFT != null && dayMSFT.length > 0 && session.MSFT >= Math.max(...dayMSFT)) ? 1 : 0;

  // --- Personal improvement bonuses ---
  const histBJs = history.map(s => bjMax(s)).filter(v => v != null);
  const histSQ = history.map(s => s.Squats).filter(v => v != null);
  const histPU = history.map(s => s.PressUps).filter(v => v != null);
  const histSH = history.map(s => s.Shuttle).filter(v => v != null);
  const histMSFT = history.map(s => s.MSFT).filter(v => v != null);

  const bj_i = (bj != null && histBJs.length > 0 && bj > Math.max(...histBJs)) ? 1 : 0;
  const sq_i = (session.Squats != null && histSQ.length > 0 && session.Squats > Math.max(...histSQ)) ? 1 : 0;
  const pu_i = (session.PressUps != null && histPU.length > 0 && session.PressUps > Math.max(...histPU)) ? 1 : 0;
  const sh_i = (session.Shuttle != null && histSH.length > 0 && session.Shuttle < Math.min(...histSH)) ? 1 : 0;
  const msft_i = (session.MSFT != null && histMSFT.length > 0 && session.MSFT > Math.max(...histMSFT)) ? 1 : 0;

  const total = bj_h + bj_i + sq_h + sq_i + pu_h + pu_i + sh_h + sh_i + msft_h + msft_i;

  return { bj_h, bj_i, sq_h, sq_i, pu_h, pu_i, sh_h, sh_i, msft_h, msft_i, total };
}

/**
 * Compute the full score for a session, given all sessions in the system.
 */
export function scoreSession(session, allSessions) {
  const bj = bjMax(session);
  const at = activityTotal(session);
  const pp = participationPoints(session.Duration_Minutes);

  // Same-date sessions (including self for highest comparison)
  const sessionDay = allSessions.filter(s => s.Date === session.Date);
  // Historical sessions for same cadet BEFORE this session's date
  const history = allSessions.filter(
    s => s.Name === session.Name && s.Date < session.Date
  );

  const bonuses = calcBonuses(session, sessionDay, history);

  return {
    bj_max: bj,
    bj_points: bjPoints(bj),
    sq_points: squatPoints(session.Squats),
    pu_points: pressUpPoints(session.PressUps),
    sh_points: shuttlePoints(session.Shuttle),
    msft_points: msftPoints(session.MSFT),
    activity_total: at,
    participation: pp,
    ...bonuses,
    session_total: at + pp + bonuses.total,
  };
}

/**
 * Build leaderboard from all sessions + logbook entries
 */
export function buildLeaderboard(allSessions, logbookEntries) {
  const map = {};

  for (const s of allSessions) {
    const scored = scoreSession(s, allSessions);
    if (!map[s.Name]) map[s.Name] = { name: s.Name, ka_total: 0, logbook_total: 0, sessions: 0, bonus_total: 0 };
    map[s.Name].ka_total += scored.session_total;
    map[s.Name].sessions += 1;
    map[s.Name].bonus_total += scored.total ?? 0;
  }

  for (const lb of logbookEntries) {
    if (!map[lb.Name]) map[lb.Name] = { name: lb.Name, ka_total: 0, logbook_total: 0, sessions: 0, bonus_total: 0 };
    map[lb.Name].logbook_total += lb.Points || 0;
  }

  return Object.values(map)
    .map(r => ({
      ...r,
      final_total: r.ka_total + r.logbook_total,
      avg_score: r.sessions > 0 ? r.ka_total / r.sessions : 0,
    }))
    .sort((a, b) => b.final_total - a.final_total || b.avg_score - a.avg_score);
}