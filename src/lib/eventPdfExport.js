import jsPDF from 'jspdf';
import { format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────
const PAGE = { w: 210, h: 297, margin: 15, usableW: 180 };

function header(doc, title, subtitle) {
  doc.setFillColor(8, 63, 48);
  doc.rect(0, 0, PAGE.w, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(title, PAGE.w / 2, 10, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(subtitle, PAGE.w / 2, 17, { align: 'center' });
  doc.setFontSize(8);
  doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), PAGE.w / 2, 24, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function footer(doc) {
  doc.setFillColor(8, 63, 48);
  doc.rect(0, 287, PAGE.w, 10, 'F');
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 220, 190);
  doc.text('OFFICIAL · Chain of Command', PAGE.w / 2, 293, { align: 'center' });
}

function newPage(doc, y) {
  if (y > 275) { doc.addPage(); return 20; }
  return y;
}

function sectionTitle(doc, text, y) {
  y = newPage(doc, y);
  doc.setFillColor(220, 235, 225);
  doc.rect(PAGE.margin, y, PAGE.usableW, 7, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(8, 63, 48);
  doc.text(text, PAGE.margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  return y + 9;
}

function cell(doc, x, y, w, h, text, opts = {}) {
  doc.setFontSize(opts.size || 7);
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setTextColor(...(opts.color || [0, 0, 0]));
  const lines = doc.splitTextToSize(String(text || ''), w - 3);
  doc.text(lines.slice(0, Math.max(1, Math.floor(h / 3.2))), x + 1.5, y + 4, { maxWidth: w - 3 });
}

function rowBg(doc, y, h, i) {
  if (i % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(PAGE.margin, y, PAGE.usableW, h, 'F'); }
}

function gridLine(doc, y, h) {
  doc.setDrawColor(210, 225, 215); doc.setLineWidth(0.1);
  doc.line(PAGE.margin, y + h, PAGE.margin + PAGE.usableW, y + h);
}

function cadetName(c) {
  return [c.Surname, c.FirstName].filter(Boolean).join(', ');
}

// ── 1. Recruit Cadre Plan ────────────────────────────────────────────
export function exportCadrePlanPDF(event, { stances, staff, roll, awards, scoreEntries }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 34;
  header(doc, event.Title.toUpperCase(), 'RECRUIT TRAINING CADRE PLAN');

  // Command structure
  y = sectionTitle(doc, 'COMMAND STRUCTURE', y);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  const oc = staff.find((s) => s.CommandRole === 'Platoon Commander') || {};
  doc.text(`Platoon Commander: ${[oc.Rank, oc.Name].filter(Boolean).join(' ') || '—'}`, PAGE.margin + 2, y); y += 5;
  doc.text(`Total Staff: ${staff.length}   Total Cadets: ${roll.length}`, PAGE.margin + 2, y); y += 7;

  // Training schedule
  y = sectionTitle(doc, 'TRAINING SCHEDULE (STANCES)', y);
  const sCols = [20, 30, 30, 55, 45];
  const sHeads = ['Stance', 'Start', 'End', 'Subject', 'Instructors'];
  doc.setFillColor(220, 235, 225); doc.rect(PAGE.margin, y, PAGE.usableW, 7, 'F');
  let cx = PAGE.margin;
  sHeads.forEach((h, i) => { doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text(h, cx + 2, y + 5); cx += sCols[i]; });
  y += 7;
  stances.forEach((s, i) => {
    y = newPage(doc, y);
    const instructors = (s.StaffIDs || []).map((id) => staff.find((x) => x.id === id)).filter(Boolean)
      .map((x) => [x.Rank, x.Name].filter(Boolean).join(' ')).join('; ');
    const rh = 7;
    rowBg(doc, y, rh, i);
    cx = PAGE.margin;
    const cells = [s.StanceLabel, s.StartTime ? format(new Date(s.StartTime), 'dd MMM HH:mm') : '—', s.EndTime ? format(new Date(s.EndTime), 'dd MMM HH:mm') : '—', s.SubjectName || '—', instructors || '—'];
    cells.forEach((c, i) => { cell(doc, cx, y, sCols[i], rh, c, { size: 6.5 }); cx += sCols[i]; });
    gridLine(doc, y, rh);
    y += rh;
  });
  y += 4;

  // Stance allocation — cadet lists per stance
  y = sectionTitle(doc, 'STANCE ALLOCATION (CADETS)', y);
  stances.forEach((s) => {
    y = newPage(doc, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(`${s.StanceLabel} (${(s.CadetIDs || []).length}) — ${s.SubjectName || ''}`, PAGE.margin + 2, y);
    y += 5;
    const names = (s.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean).map(cadetName);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    const cols = 4; const colW = PAGE.usableW / cols;
    names.forEach((n, i) => {
      const col = i % cols; const row = Math.floor(i / cols);
      if (col === 0 && row > 0) y += 5;
      y = newPage(doc, y);
      doc.text(n, PAGE.margin + col * colW + 2, y);
    });
    y += 8;
  });

  // Competition & awards
  y = sectionTitle(doc, 'SECTION COMPETITION', y);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  const sc = event.CompetitionScoring || { pointsPerRank: [3, 2, 1], bonusPoints: 1 };
  doc.text(`Scoring: ${sc.pointsPerRank?.join('/')} pts per stance + ${sc.bonusPoints} bonus point.`, PAGE.margin + 2, y); y += 6;
  awards.forEach((a) => {
    y = newPage(doc, y);
    doc.setFont('helvetica', 'bold'); doc.text(a.AwardName, PAGE.margin + 2, y); y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Prize: ${a.Prize || '—'}`, PAGE.margin + 2, y); y += 4;
    if (a.Description) { const dl = doc.splitTextToSize(a.Description, PAGE.usableW - 4); doc.text(dl, PAGE.margin + 2, y); y += dl.length * 4; }
    y += 2;
  });

  // Live leaderboard (top 10)
  if (scoreEntries.length > 0) {
    y = sectionTitle(doc, 'POINTS TALLY (LIVE)', y);
    const tally = {};
    scoreEntries.forEach((e) => { tally[e.CadetID] = (tally[e.CadetID] || 0) + (e.Points || 0); });
    const ranked = Object.entries(tally).map(([id, pts]) => ({ name: cadetName(roll.find((x) => x.id === id) || {}), pts }))
      .sort((a, b) => b.pts - a.pts).slice(0, 10);
    ranked.forEach((r, i) => {
      y = newPage(doc, y);
      rowBg(doc, y, 6, i);
      doc.setFontSize(7); doc.setFont('helvetica', i < 3 ? 'bold' : 'normal');
      doc.text(`${i + 1}.`, PAGE.margin + 2, y + 4);
      doc.text(r.name, PAGE.margin + 12, y + 4);
      doc.text(String(r.pts), PAGE.margin + PAGE.usableW - 10, y + 4);
      gridLine(doc, y, 6); y += 6;
    });
  }

  footer(doc);
  doc.save(`${event.Title.replace(/\s+/g, '_')}_CadrePlan.pdf`);
}

// ── 2. Stores & Equipment ────────────────────────────────────────────
export function exportStoresPDF(event, { stances, lessonStores, syllabus }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const lw = 297, lm = 15, uw = 267;
  let y = 34;
  doc.setFillColor(8, 63, 48); doc.rect(0, 0, lw, 28, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(event.Title.toUpperCase(), lw / 2, 10, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text('STORES AND EQUIPMENT', lw / 2, 17, { align: 'center' });
  doc.setFontSize(8); doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), lw / 2, 24, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const cols = [35, 55, 30, 30, 30, 40, 45];
  const heads = ['Subject', 'Lesson', 'Location', 'Dress', 'Welfare', 'Stores Request', 'Own Stores'];
  const drawHeads = () => {
    doc.setFillColor(220, 235, 225); doc.rect(lm, y, uw, 7, 'F');
    let cx = lm;
    heads.forEach((h, i) => { doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.text(h, cx + 2, y + 5); cx += cols[i]; });
    y += 7;
  };
  drawHeads();

  const totals = {};
  lessonStores.forEach((s, i) => {
    if (y > 195) { doc.addPage(); y = 20; drawHeads(); }
    if (i % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(lm, y, uw, 9, 'F'); }
    const lesson = syllabus.find((x) => x.LessonCode === s.LessonCode);
    const subj = lesson?.SubjectName || '';
    const lName = lesson?.LessonName || s.LessonCode;
    const cells = [subj, lName, s.Location, s.Dress, s.Welfare, s.StoresRequest, s.OwnStores];
    let cx = lm;
    cells.forEach((c, i) => { cell(doc, cx, y, cols[i], 9, c, { size: 6.5 }); cx += cols[i]; });
    // crude totals: count StoresRequest items
    (s.StoresRequest || '').split(/[,;+]/).map((x) => x.trim()).filter(Boolean).forEach((item) => {
      const m = item.match(/(\d+)\s*x\s*(.+)/i) || item.match(/(.+)\s*x\s*(\d+)/i);
      if (m) { const name = (m[2] || m[1]).trim(); const qty = parseInt(m[1] || m[2], 10) || 1; totals[name] = (totals[name] || 0) + qty; }
      else totals[item] = (totals[item] || 0) + 1;
    });
    doc.setDrawColor(210, 225, 215); doc.setLineWidth(0.1); doc.line(lm, y + 9, lm + uw, y + 9);
    y += 9;
  });

  y += 6;
  if (y > 195) { doc.addPage(); y = 20; }
  doc.setFillColor(220, 235, 225); doc.rect(lm, y, uw, 7, 'F');
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(8, 63, 48);
  doc.text('AGGREGATE STORES TOTALS', lm + 2, y + 5); doc.setTextColor(0, 0, 0); y += 9;
  Object.entries(totals).forEach(([name, qty], i) => {
    if (y > 200) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(lm, y, uw, 6, 'F'); }
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`${qty}x ${name}`, lm + 2, y + 4);
    doc.line(lm, y + 6, lm + uw, y + 6); y += 6;
  });

  doc.setFillColor(8, 63, 48); doc.rect(0, 200, lw, 10, 'F');
  doc.setFontSize(6.5); doc.setTextColor(180, 220, 190);
  doc.text('OFFICIAL · Chain of Command', lw / 2, 206, { align: 'center' });
  doc.save(`${event.Title.replace(/\s+/g, '_')}_StoresEquipment.pdf`);
}

// ── 3. WM Completions Plan ───────────────────────────────────────────
export function exportWMCompletionsPDF(event, { stances, roll, completions, syllabus }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const lw = 297, lm = 10, uw = 277;
  let y = 30;
  doc.setFillColor(8, 63, 48); doc.rect(0, 0, lw, 24, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(event.Title.toUpperCase(), lw / 2, 9, { align: 'center' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('WM COMPLETIONS PLAN', lw / 2, 16, { align: 'center' });
  doc.setFontSize(7); doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), lw / 2, 22, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Build subject columns from all unique subjects across stances
  const subjects = [...new Set(stances.map((s) => s.SubjectName).filter(Boolean))];
  const nameW = 55;
  const colW = Math.max(18, (uw - nameW) / Math.max(subjects.length, 1));

  // header
  doc.setFillColor(220, 235, 225); doc.rect(lm, y, uw, 7, 'F');
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('Cadet', lm + 2, y + 5);
  subjects.forEach((subj, i) => { doc.text(subj.slice(0, 8), lm + nameW + i * colW + 2, y + 5); });
  y += 7;

  roll.forEach((c, ri) => {
    if (y > 205) { doc.addPage(); y = 16;
      doc.setFillColor(220, 235, 225); doc.rect(lm, y, uw, 7, 'F');
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text('Cadet', lm + 2, y + 5);
      subjects.forEach((subj, i) => { doc.text(subj.slice(0, 8), lm + nameW + i * colW + 2, y + 5); });
      y += 7;
    }
    if (ri % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(lm, y, uw, 6, 'F'); }
    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.text(cadetName(c).slice(0, 30), lm + 2, y + 4);
    subjects.forEach((subj, i) => {
      // find completions for this cadet in any stance with this subject
      const stanceIds = stances.filter((s) => s.SubjectName === subj).map((s) => s.id);
      const comp = completions.find((x) => x.CadetID === c.id && stanceIds.includes(x.StanceID) && x.Status);
      const val = comp?.Status === 'Pass' ? 'P' : comp?.Status === 'Stance' ? comp.StanceLabel || 'S' : comp?.Status === 'REVAL' ? 'REVAL' : '';
      doc.setTextColor(comp?.Status === 'REVAL' ? 200 : 0, comp?.Status === 'REVAL' ? 40 : 0, 0);
      doc.text(val, lm + nameW + i * colW + 2, y + 4);
      doc.setTextColor(0, 0, 0);
    });
    doc.setDrawColor(210, 225, 215); doc.setLineWidth(0.1); doc.line(lm, y + 6, lm + uw, y + 6);
    y += 6;
  });

  doc.setFillColor(8, 63, 48); doc.rect(0, 205, lw, 10, 'F');
  doc.setFontSize(6.5); doc.setTextColor(180, 220, 190);
  doc.text('OFFICIAL · Chain of Command', lw / 2, 211, { align: 'center' });
  doc.save(`${event.Title.replace(/\s+/g, '_')}_WMCompletions.pdf`);
}

// ── 4. MEL (Master Event List / minute-by-minute) ────────────────────
export function exportMELPDF(event, { stances, roll, staff, itinerary, syllabus }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 34;
  header(doc, event.Title.toUpperCase(), 'MASTER EVENT LIST (MEL)');

  // Group stances by day
  const byDay = {};
  stances.forEach((s) => {
    if (!s.StartTime) return;
    const day = format(new Date(s.StartTime), 'EEEE dd MMM');
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  });
  // itinerary slots also
  (itinerary || []).forEach((it) => {
    if (!it.StartTime) return;
    const day = format(new Date(it.StartTime), 'EEEE dd MMM');
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push({ _isSlot: true, ...it });
  });

  Object.entries(byDay).forEach(([day, items]) => {
    y = newPage(doc, y);
    y = sectionTitle(doc, day.toUpperCase(), y);
    items.sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime)).forEach((item) => {
      y = newPage(doc, y);
      const isSlot = item._isSlot;
      const time = format(new Date(item.StartTime), 'HH:mm');
      const endT = item.EndTime ? format(new Date(item.EndTime), 'HH:mm') : '';
      const label = isSlot ? `${item.SlotType}${item.Label ? ' — ' + item.Label : ''}` : `${item.StanceLabel} — ${item.SubjectName || ''}`;
      doc.setFillColor(isSlot ? 240 : 220, isSlot ? 245 : 235, isSlot ? 250 : 225);
      doc.rect(PAGE.margin, y, PAGE.usableW, 7, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(8, 63, 48);
      doc.text(`${time}${endT ? '-' + endT : ''}`, PAGE.margin + 2, y + 5);
      doc.text(label, PAGE.margin + 25, y + 5);
      doc.setTextColor(0, 0, 0);
      if (!isSlot) {
        const instructors = (item.StaffIDs || []).map((id) => staff.find((x) => x.id === id)).filter(Boolean).map((x) => x.Name).join(', ');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
        if (instructors) doc.text(`Staff: ${instructors}`, PAGE.margin + 25, y + 5.5);
        const names = (item.CadetIDs || []).map((id) => roll.find((x) => x.id === id)).filter(Boolean).map(cadetName).join(', ');
        if (names) { const nl = doc.splitTextToSize(`Cadets: ${names}`, PAGE.usableW - 27); doc.text(nl, PAGE.margin + 25, y + 9); y += nl.length * 3.5; }
        const lessons = (item.LessonCodes || []).map((c) => syllabus.find((x) => x.LessonCode === c)?.LessonName || c).join(', ');
        if (lessons) { const ll = doc.splitTextToSize(`Lessons: ${lessons}`, PAGE.usableW - 4); y += 2; doc.text(ll, PAGE.margin + 2, y + 4); y += ll.length * 3.5; }
      }
      y += 9;
    });
    y += 3;
  });

  footer(doc);
  doc.save(`${event.Title.replace(/\s+/g, '_')}_MEL.pdf`);
}