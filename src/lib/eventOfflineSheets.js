import { jsPDF } from 'jspdf';
import { downloadTextFile } from '@/lib/eventCsvTemplate';

// === CSV Utilities ===
function escapeCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const headerLine = headers.join(',');
  const dataLines = rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(','));
  return [headerLine, ...dataLines].join('\n') + '\n';
}

function parseCsv(text) {
  const rows = [];
  let cur = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cur.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); rows.push(cur); cur = []; field = '';
    } else field += ch;
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeHeader(h) { return h.trim().toLowerCase().replace(/[\s_-]+/g, ''); }

function buildHeaderMap(headers, expected) {
  const norm = headers.map(normalizeHeader);
  const map = {};
  expected.forEach((field) => {
    const idx = norm.findIndex((h) => h === normalizeHeader(field));
    if (idx >= 0) map[field] = idx;
  });
  return map;
}

function rowsToObjects(rows, expected) {
  if (rows.length < 2) return [];
  const headerMap = buildHeaderMap(rows[0], expected);
  return rows.slice(1).map((r) => {
    const obj = {};
    expected.forEach((field) => { const idx = headerMap[field]; obj[field] = idx != null ? (r[idx] || '').trim() : ''; });
    return obj;
  });
}

// === CSV Builders ===

export function buildKAScoresCsv(roll, stances) {
  const headers = ['PNumber', 'Surname', 'FirstName', 'StanceLabel', 'Date', 'StartTime', 'EndTime', 'BJ1', 'BJ2', 'BJ3', 'Squats', 'PressUps', 'Shuttle', 'MSFT', 'DurationMinutes'];
  const rows = roll.map((c) => {
    const stance = stances.find((s) => (s.CadetIDs || []).includes(c.id));
    return { PNumber: c.PNumber, Surname: c.Surname, FirstName: c.FirstName, StanceLabel: stance?.StanceLabel || '',
      Date: '', StartTime: '', EndTime: '', BJ1: '', BJ2: '', BJ3: '', Squats: '', PressUps: '', Shuttle: '', MSFT: '', DurationMinutes: '' };
  });
  return toCsv(headers, rows);
}

export function buildLessonCompletionsCsv(roll, stances) {
  const headers = ['PNumber', 'Surname', 'StanceLabel', 'LessonCode', 'Status'];
  const rows = [];
  for (const s of [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0))) {
    for (const c of (s.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean)) {
      for (const lc of (s.LessonCodes || [])) {
        rows.push({ PNumber: c.PNumber, Surname: c.Surname, StanceLabel: s.StanceLabel, LessonCode: lc, Status: '' });
      }
    }
  }
  return toCsv(headers, rows);
}

export function buildStanceAttendanceCsv(roll, stances) {
  const headers = ['PNumber', 'Surname', 'FirstName', 'StanceLabel', 'Attended'];
  const rows = [];
  for (const s of [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0))) {
    for (const c of (s.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean)) {
      rows.push({ PNumber: c.PNumber, Surname: c.Surname, FirstName: c.FirstName, StanceLabel: s.StanceLabel, Attended: 'Y' });
    }
  }
  return toCsv(headers, rows);
}

export function buildAwardPointsCsv(roll, stances) {
  const headers = ['PNumber', 'Surname', 'StanceLabel', 'Points', 'Bonus'];
  const rows = [];
  for (const s of [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0))) {
    for (const c of (s.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean)) {
      rows.push({ PNumber: c.PNumber, Surname: c.Surname, StanceLabel: s.StanceLabel, Points: '', Bonus: 'N' });
    }
  }
  return toCsv(headers, rows);
}

export function buildStoresCsv(stances, syllabus) {
  const headers = ['StanceLabel', 'LessonCode', 'LessonName', 'Location', 'Dress', 'Welfare', 'Notes', 'StoresRequest', 'OwnStores'];
  const rows = [];
  for (const s of [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0))) {
    for (const lc of (s.LessonCodes || [])) {
      const lesson = syllabus.find((x) => x.LessonCode === lc);
      rows.push({ StanceLabel: s.StanceLabel, LessonCode: lc, LessonName: lesson?.LessonName || '',
        Location: '', Dress: '', Welfare: '', Notes: '', StoresRequest: '', OwnStores: '' });
    }
  }
  return toCsv(headers, rows);
}

export function buildNominalRollCheckInCsv(roll, platoons, sections) {
  const headers = ['PNumber', 'Rank', 'Surname', 'FirstName', 'StarLevel', 'Platoon', 'Section', 'CheckIn', 'CheckOut', 'Notes'];
  const rows = roll.map((c) => {
    const plt = platoons.find((p) => p.id === c.PlatoonID);
    const sec = sections.find((s) => s.id === c.SectionID);
    return { PNumber: c.PNumber, Rank: c.Rank, Surname: c.Surname, FirstName: c.FirstName,
      StarLevel: c.CurrentStarLevel, Platoon: plt?.PlatoonName || '', Section: sec?.SectionName || '',
      CheckIn: '', CheckOut: '', Notes: '' };
  });
  return toCsv(headers, rows);
}

// === CSV Parsers (for import) ===

export function parseKAScoresText(text) {
  const rows = parseCsv(text);
  return rowsToObjects(rows, ['PNumber', 'Surname', 'Date', 'StartTime', 'EndTime', 'StanceLabel', 'BJ1', 'BJ2', 'BJ3', 'Squats', 'PressUps', 'Shuttle', 'MSFT', 'DurationMinutes']);
}

export function parseLessonCompletionsText(text) {
  const rows = parseCsv(text);
  return rowsToObjects(rows, ['PNumber', 'StanceLabel', 'LessonCode', 'Status']);
}

export function parseStanceAttendanceText(text) {
  const rows = parseCsv(text);
  return rowsToObjects(rows, ['PNumber', 'StanceLabel', 'Attended']);
}

export function parseAwardPointsText(text) {
  const rows = parseCsv(text);
  return rowsToObjects(rows, ['PNumber', 'StanceLabel', 'Points', 'Bonus']);
}

export function parseStoresText(text) {
  const rows = parseCsv(text);
  return rowsToObjects(rows, ['StanceLabel', 'LessonCode', 'Location', 'Dress', 'Welfare', 'Notes', 'StoresRequest', 'OwnStores']);
}

// === PDF Helpers ===

function pdfHeader(doc, event, subtitle, pageWidth) {
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(event.Title || 'Event', 14, 16);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const dateStr = [event.StartDateTime?.slice(0, 10), event.EndDateTime?.slice(0, 10)].filter(Boolean).join(' → ');
  if (dateStr) doc.text(dateStr, 14, 22);
  if (event.Location) doc.text(`Location: ${event.Location}`, 14, 27);
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text(subtitle, pageWidth - 14, 16, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 22, { align: 'right' });
  doc.setLineWidth(0.3); doc.line(14, 30, pageWidth - 14, 30);
}

function drawGridHeader(doc, cols, colWidths, y) {
  let x = 14;
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  cols.forEach((c, i) => { doc.rect(x, y, colWidths[i], 8, 'S'); doc.text(c, x + 1.5, y + 5.5); x += colWidths[i]; });
  return y + 8;
}

// === PDF Generators ===

export function generateKAScoresPdf(event, roll, stances) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297;
  pdfHeader(doc, event, 'KA Score Sheet', pw);
  const cols = ['#', 'PNo', 'Name', 'Stance', 'BJ1', 'BJ2', 'BJ3', 'Sq', 'PU', 'Sh', 'MSFT', 'Min', 'Inits'];
  const cw = [8, 18, 50, 18, 14, 14, 14, 14, 14, 14, 16, 14, 18];
  let y = drawGridHeader(doc, cols, cw, 35);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  roll.forEach((c, i) => {
    if (y > 195) { doc.addPage(); pdfHeader(doc, event, 'KA Score Sheet', pw); y = drawGridHeader(doc, cols, cw, 35); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); }
    const stance = stances.find((s) => (s.CadetIDs || []).includes(c.id));
    const vals = [String(i + 1), c.PNumber || '', `${c.Surname || ''}, ${c.FirstName || ''}`, stance?.StanceLabel || '', '', '', '', '', '', '', '', '', ''];
    let x = 14;
    vals.forEach((v, j) => { doc.rect(x, y, cw[j], 10, 'S'); if (v) doc.text(v, x + 1.5, y + 6.5); x += cw[j]; });
    y += 10;
  });
  doc.save(`${event.Title || 'event'}_KA_Scores.pdf`);
}

export function generateLessonCompletionsPdf(event, roll, stances, syllabus) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297;
  const sorted = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
  let firstPage = true;
  for (const stance of sorted) {
    const cadets = (stance.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean);
    const lessons = (stance.LessonCodes || []).map((lc) => syllabus.find((x) => x.LessonCode === lc)).filter(Boolean);
    if (cadets.length === 0 || lessons.length === 0) continue;
    if (!firstPage) doc.addPage();
    firstPage = false;
    const subjects = (stance.SubjectNames && stance.SubjectNames.length ? stance.SubjectNames : stance.SubjectName ? [stance.SubjectName] : []).join(', ');
    pdfHeader(doc, event, `Lesson Completion — ${stance.StanceLabel}`, pw);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Subjects: ${subjects || '—'}`, 14, 34);
    const nameW = 45;
    const availW = pw - 14 - 14 - nameW;
    const lessonW = Math.min(16, availW / lessons.length);
    let y = 40;
    // Header
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.rect(14, y, nameW, 8, 'S'); doc.text('Cadet', 16, y + 5.5);
    let x = 14 + nameW;
    lessons.forEach((l) => { doc.rect(x, y, lessonW, 8, 'S'); doc.text(l.LessonCode, x + 1, y + 5.5); x += lessonW; });
    y += 8;
    // Rows
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    cadets.forEach((c) => {
      if (y > 195) { doc.addPage(); pdfHeader(doc, event, `Lesson Completion — ${stance.StanceLabel}`, pw); y = 40; doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.rect(14, y, nameW, 8, 'S'); doc.text('Cadet', 16, y + 5.5); let hx = 14 + nameW; lessons.forEach((l) => { doc.rect(hx, y, lessonW, 8, 'S'); doc.text(l.LessonCode, hx + 1, y + 5.5); hx += lessonW; }); y += 8; doc.setFont('helvetica', 'normal'); doc.setFontSize(7); }
      doc.rect(14, y, nameW, 10, 'S'); doc.text(`${c.Surname || ''}, ${c.FirstName || ''}`, 16, y + 6.5);
      x = 14 + nameW;
      lessons.forEach(() => { doc.rect(x, y, lessonW, 10, 'S'); x += lessonW; });
      y += 10;
    });
    // Legend
    y += 4;
    doc.setFontSize(7); doc.setTextColor(100);
    doc.text('Key: P = Pass · S = Stance (write stance label) · RV = Revalidation needed', 14, y);
    doc.setTextColor(0);
  }
  if (firstPage) { pdfHeader(doc, event, 'Lesson Completion', pw); doc.setFontSize(9); doc.text('No stances with cadets and lessons assigned yet.', 14, 40); }
  doc.save(`${event.Title || 'event'}_Lesson_Completions.pdf`);
}

export function generateStanceAttendancePdf(event, roll, stances) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  const sorted = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
  let firstPage = true;
  for (const stance of sorted) {
    const cadets = (stance.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean);
    if (cadets.length === 0) continue;
    if (!firstPage) doc.addPage();
    firstPage = false;
    const subjects = (stance.SubjectNames && stance.SubjectNames.length ? stance.SubjectNames : stance.SubjectName ? [stance.SubjectName] : []).join(', ');
    pdfHeader(doc, event, `Attendance — ${stance.StanceLabel}`, pw);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Subjects: ${subjects || '—'}`, 14, 34);
    const cols = ['#', 'PNo', 'Rank', 'Surname, First', 'Star', 'Present', 'Notes'];
    const cw = [8, 18, 14, 55, 18, 18, 70];
    let y = drawGridHeader(doc, cols, cw, 40);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    cadets.forEach((c, i) => {
      if (y > 275) { doc.addPage(); pdfHeader(doc, event, `Attendance — ${stance.StanceLabel}`, pw); y = drawGridHeader(doc, cols, cw, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); }
      const vals = [String(i + 1), c.PNumber || '', c.Rank || '', `${c.Surname || ''}, ${c.FirstName || ''}`, c.CurrentStarLevel || '', '', ''];
      let x = 14;
      vals.forEach((v, j) => { doc.rect(x, y, cw[j], 10, 'S'); if (v) doc.text(v, x + 1.5, y + 6.5); x += cw[j]; });
      y += 10;
    });
  }
  if (firstPage) { pdfHeader(doc, event, 'Attendance Roster', pw); doc.setFontSize(9); doc.text('No stances with cadets assigned yet.', 14, 40); }
  doc.save(`${event.Title || 'event'}_Attendance.pdf`);
}

export function generateAwardPointsPdf(event, roll, stances) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297;
  pdfHeader(doc, event, 'Competition Points Tally', pw);
  const cols = ['Stance', 'PNo', 'Cadet', 'Points', 'Bonus', 'Inits'];
  const cw = [25, 18, 55, 20, 18, 25];
  let y = drawGridHeader(doc, cols, cw, 35);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  const scoring = event.CompetitionScoring || {};
  const ranks = scoring.pointsPerRank || [3, 2, 1];
  const sorted = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
  for (const s of sorted) {
    const cadets = (s.CadetIDs || []).map((id) => roll.find((c) => c.id === id)).filter(Boolean);
    for (const c of cadets) {
      if (y > 195) { doc.addPage(); pdfHeader(doc, event, 'Competition Points Tally', pw); y = drawGridHeader(doc, cols, cw, 35); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); }
      const vals = [s.StanceLabel, c.PNumber || '', `${c.Surname || ''}, ${c.FirstName || ''}`, '', '', ''];
      let x = 14;
      vals.forEach((v, j) => { doc.rect(x, y, cw[j], 10, 'S'); if (v) doc.text(v, x + 1.5, y + 6.5); x += cw[j]; });
      y += 10;
    }
  }
  y += 4;
  doc.setFontSize(7); doc.setTextColor(100);
  doc.text(`Points: 1st=${ranks[0]} · 2nd=${ranks[1]} · 3rd=${ranks[2]} · Bonus=${scoring.bonusPoints ?? 1}`, 14, y);
  doc.setTextColor(0);
  doc.save(`${event.Title || 'event'}_Award_Points.pdf`);
}

export function generateNominalRollPdf(event, roll, platoons, sections) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  pdfHeader(doc, event, 'Nominal Roll — Check In / Out', pw);
  const cols = ['#', 'PNo', 'Rank', 'Surname, First', 'Star', 'Plt', 'Sec', 'In', 'Out', 'Notes'];
  const cw = [7, 16, 12, 45, 14, 14, 10, 14, 14, 55];
  let y = drawGridHeader(doc, cols, cw, 35);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
  roll.forEach((c, i) => {
    if (y > 275) { doc.addPage(); pdfHeader(doc, event, 'Nominal Roll — Check In / Out', pw); y = drawGridHeader(doc, cols, cw, 35); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); }
    const plt = platoons.find((p) => p.id === c.PlatoonID);
    const sec = sections.find((s) => s.id === c.SectionID);
    const vals = [String(i + 1), c.PNumber || '', c.Rank || '', `${c.Surname || ''}, ${c.FirstName || ''}`, c.CurrentStarLevel || '', plt?.PlatoonName || '', sec?.SectionName || '', '', '', ''];
    let x = 14;
    vals.forEach((v, j) => { doc.rect(x, y, cw[j], 9, 'S'); if (v) doc.text(v, x + 1, y + 6); x += cw[j]; });
    y += 9;
  });
  if (roll.length === 0) { doc.setFontSize(9); doc.text('No cadets on nominal roll yet.', 14, 40); }
  doc.save(`${event.Title || 'event'}_Nominal_Roll.pdf`);
}

export function generateStoresPdf(event, stances, syllabus) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  const sorted = [...stances].sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
  let firstPage = true;
  for (const stance of sorted) {
    const lessons = (stance.LessonCodes || []).map((lc) => syllabus.find((x) => x.LessonCode === lc)).filter(Boolean);
    if (lessons.length === 0) continue;
    if (!firstPage) doc.addPage();
    firstPage = false;
    const subjects = (stance.SubjectNames && stance.SubjectNames.length ? stance.SubjectNames : stance.SubjectName ? [stance.SubjectName] : []).join(', ');
    pdfHeader(doc, event, `Stores — ${stance.StanceLabel}`, pw);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Subjects: ${subjects || '—'}`, 14, 34);
    let y = 40;
    lessons.forEach((l, i) => {
      if (y > 260) { doc.addPage(); pdfHeader(doc, event, `Stores — ${stance.StanceLabel}`, pw); y = 40; }
      if (i > 0) y += 3;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`[${l.LessonCode}] ${l.LessonName}`, 14, y);
      y += 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      const fields = [
        ['Location', 'Dress', 'Welfare'],
        ['Stores Request (CQMS)', '', ''],
        ['Own Stores (cadets)', '', ''],
        ['Notes', '', ''],
      ];
      fields.forEach(([label, f2, f3]) => {
        if (y > 275) { doc.addPage(); pdfHeader(doc, event, `Stores — ${stance.StanceLabel}`, pw); y = 40; }
        y += 4;
        doc.rect(14, y, 25, 7, 'S'); doc.text(label, 16, y + 5);
        doc.rect(39, y, pw - 14 - 39, 7, 'S');
        y += 7;
      });
    });
  }
  if (firstPage) { pdfHeader(doc, event, 'Stores Request', pw); doc.setFontSize(9); doc.text('No stances with lessons assigned yet.', 14, 40); }
  doc.save(`${event.Title || 'event'}_Stores.pdf`);
}