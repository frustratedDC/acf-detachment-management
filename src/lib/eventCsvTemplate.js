// CSV templates and native parser for the Event Nominal Roll and Partial Completions uploads.
// Deterministic header-matching parse for .csv/.json; .xlsx falls back to AI extraction.

const NOMINAL_HEADERS = [
  'PNumber', 'Rank', 'Surname', 'FirstName', 'Detachment', 'Gender',
  'CurrentStarLevel', 'WHTAirRifle', 'WHTGPRifle', 'SubjectCompletions',
];

const PARTIAL_HEADERS = ['PNumber', 'PartialCompletions'];

// One complete, fully-populated example row users can see and replace.
export const NOMINAL_ROLL_EXAMPLE_ROW = {
  PNumber: '30123456',
  Rank: 'Cdt',
  Surname: 'Smith',
  FirstName: 'James',
  Detachment: 'A Detachment',
  Gender: 'M',
  CurrentStarLevel: 'Basic',
  WHTAirRifle: '15/03/2026',
  WHTGPRifle: '',
  SubjectCompletions: 'BASIC-01|BASIC-03',
};

export const PARTIAL_COMPLETIONS_EXAMPLE_ROW = {
  PNumber: '30123456',
  PartialCompletions: '1STAR-02|1STAR-05',
};

function escapeCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildNominalRollTemplateCsv() {
  const header = NOMINAL_HEADERS.join(',');
  const row = NOMINAL_HEADERS.map((h) => escapeCsv(NOMINAL_ROLL_EXAMPLE_ROW[h])).join(',');
  return `${header}\n${row}\n`;
}

export function buildPartialCompletionsTemplateCsv() {
  const header = PARTIAL_HEADERS.join(',');
  const row = PARTIAL_HEADERS.map((h) => escapeCsv(PARTIAL_COMPLETIONS_EXAMPLE_ROW[h])).join(',');
  return `${header}\n${row}\n`;
}

export function downloadTextFile(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Minimal CSV parser supporting quoted fields and embedded commas/newlines.
function parseCsv(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
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

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const HEADER_ALIASES = {
  pnumber: ['pnumber', 'pno', 'pnum', 'service', 'cadetno', 'armynumber'],
  rank: ['rank'],
  surname: ['surname', 'lastname', 'familyname'],
  firstname: ['firstname', 'forename', 'givenname', 'name'],
  detachment: ['detachment', 'det', 'unit'],
  gender: ['gender', 'sex'],
  currentstarlevel: ['currentstarlevel', 'starlevel', 'star', 'level'],
  whtairrifle: ['whtairrifle', 'whtair', 'airrifle', 'whtar'],
  whtgprifle: ['whtgprifle', 'whtgp', 'gprifle', 'whtgp'],
  subjectcompletions: ['subjectcompletions', 'completions', 'completed', 'subjectsdone'],
  partialcompletions: ['partialcompletions', 'partial', 'partials'],
};

function buildHeaderMap(headers, expected) {
  const norm = headers.map(normalizeHeader);
  const map = {};
  expected.forEach((field) => {
    const aliases = HEADER_ALIASES[field] || [normalizeHeader(field)];
    const idx = norm.findIndex((h) => aliases.includes(h) || h === normalizeHeader(field));
    if (idx >= 0) map[field] = idx;
  });
  return map;
}

function parseList(value) {
  if (!value) return [];
  return String(value).split(/[|;,]/).map((s) => s.trim()).filter(Boolean);
}

// Parse a Nominal Roll CSV/JSON text into normalized records.
export function parseNominalRollText(text, ext) {
  if (ext === 'json') {
    const arr = JSON.parse(text);
    return (Array.isArray(arr) ? arr : arr.records || []).map(normalizeNominalRow);
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headerMap = buildHeaderMap(rows[0], NOMINAL_HEADERS);
  return rows.slice(1).map((r) => normalizeNominalRow(rowToObject(r, rows[0], headerMap, NOMINAL_HEADERS)));
}

export function parsePartialCompletionsText(text, ext) {
  if (ext === 'json') {
    const arr = JSON.parse(text);
    return (Array.isArray(arr) ? arr : arr.records || []).map((r) => ({
      PNumber: String(r.PNumber || ''),
      PartialCompletions: parseList(r.PartialCompletions),
    }));
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headerMap = buildHeaderMap(rows[0], PARTIAL_HEADERS);
  return rows.slice(1).map((r) => {
    const obj = rowToObject(r, rows[0], headerMap, PARTIAL_HEADERS);
    return { PNumber: String(obj.PNumber || ''), PartialCompletions: parseList(obj.PartialCompletions) };
  });
}

function rowToObject(row, headers, headerMap, expected) {
  const obj = {};
  expected.forEach((field) => {
    const idx = headerMap[field];
    obj[field] = idx != null ? (row[idx] || '').trim() : '';
  });
  return obj;
}

function normalizeNominalRow(obj) {
  return {
    PNumber: String(obj.PNumber || '').trim(),
    Rank: String(obj.Rank || '').trim(),
    Surname: String(obj.Surname || '').trim(),
    FirstName: String(obj.FirstName || '').trim(),
    Detachment: String(obj.Detachment || '').trim(),
    Gender: String(obj.Gender || '').trim().toUpperCase().startsWith('M') ? 'M'
      : String(obj.Gender || '').trim().toUpperCase().startsWith('F') ? 'F' : '',
    CurrentStarLevel: String(obj.CurrentStarLevel || 'Basic').trim() || 'Basic',
    WHTAirRifle: String(obj.WHTAirRifle || '').trim(),
    WHTGPRifle: String(obj.WHTGPRifle || '').trim(),
    SubjectCompletions: parseList(obj.SubjectCompletions),
  };
}

export function getExtension(filename) {
  return (filename.split('.').pop() || '').toLowerCase();
}