import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, Upload, Loader2, FileText, Activity, ClipboardCheck, Trophy, Users, Package, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildKAScoresCsv, buildLessonCompletionsCsv, buildStanceAttendanceCsv, buildAwardPointsCsv, buildStoresCsv, buildNominalRollCheckInCsv,
  generateKAScoresPdf, generateLessonCompletionsPdf, generateStanceAttendancePdf, generateAwardPointsPdf, generateStoresPdf, generateNominalRollPdf,
  parseKAScoresText, parseLessonCompletionsText, parseStanceAttendanceText, parseAwardPointsText, parseStoresText,
} from '@/lib/eventOfflineSheets';
import { downloadTextFile } from '@/lib/eventCsvTemplate';

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export default function EventOfflineSheetsSection({ event }) {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState('');
  const fileRefs = useRef({});

  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });
  const { data: platoons = [] } = useQuery({ queryKey: ['event-platoons', event.id], queryFn: () => base44.entities.EventPlatoon.filter({ EventID: event.id }) });
  const { data: sections = [] } = useQuery({ queryKey: ['event-sections', event.id], queryFn: () => base44.entities.EventSection.filter({ EventID: event.id }) });

  const safeTitle = (event.Title || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');

  function triggerImport(key) { fileRefs.current[key]?.click(); }

  async function handleImport(e, key) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(key);
    try {
      const text = await readText(file);
      if (key === 'ka') {
        const records = parseKAScoresText(text);
        if (!records.length) { toast.error('No score rows found'); return; }
        const groups = {};
        records.forEach((r) => {
          if (!r.PNumber || !r.StanceLabel || !r.Date) return;
          const gk = `${r.Date}|${r.StartTime}|${r.StanceLabel}`;
          if (!groups[gk]) groups[gk] = { Date: r.Date, StartTime: r.StartTime, EndTime: r.EndTime, StanceLabel: r.StanceLabel, scores: [] };
          const stance = stances.find((s) => s.StanceLabel === r.StanceLabel);
          const cadet = roll.find((c) => c.PNumber === r.PNumber);
          groups[gk].scores.push({ PNumber: r.PNumber, CadetID: cadet?.id, StanceID: stance?.id, data: r });
        });
        let count = 0;
        for (const g of Object.values(groups)) {
          const stance = stances.find((s) => s.StanceLabel === g.StanceLabel);
          if (!stance) continue;
          const scores = {};
          const attendees = [];
          const cadets = [];
          g.scores.forEach((s) => {
            attendees.push(s.PNumber);
            if (s.CadetID) cadets.push(s.CadetID);
            scores[s.PNumber] = { BJ1: Number(s.data.BJ1) || null, BJ2: Number(s.data.BJ2) || null, BJ3: Number(s.data.BJ3) || null, Squats: Number(s.data.Squats) || null, PressUps: Number(s.data.PressUps) || null, Shuttle: Number(s.data.Shuttle) || null, MSFT: Number(s.data.MSFT) || null };
          });
          const dur = g.EndTime ? Math.round((new Date(`${g.Date}T${g.EndTime}`) - new Date(`${g.Date}T${g.StartTime}`)) / 60000) : Number(g.scores[0]?.data.DurationMinutes) || 30;
          await base44.entities.KASession.create({
            Date: g.Date, StartTime: g.StartTime, EndTime: g.EndTime, DurationMinutes: dur > 0 ? dur : 30,
            AssignedStarLevels: [...new Set(cadets.map((id) => roll.find((c) => c.id === id)?.CurrentStarLevel).filter(Boolean))],
            Attendees: attendees, Scores: scores, EventID: event.id, StanceID: stance.id, DetachmentID: event.DetachmentID,
          });
          count++;
        }
        queryClient.invalidateQueries({ queryKey: ['event-ka-sessions', event.id] });
        toast.success(`${count} KA sessions imported`);
      } else if (key === 'lessons') {
        const records = parseLessonCompletionsText(text);
        if (!records.length) { toast.error('No completion rows found'); return; }
        let count = 0;
        for (const r of records) {
          const cadet = roll.find((c) => c.PNumber === r.PNumber);
          const stance = stances.find((s) => s.StanceLabel === r.StanceLabel);
          if (!cadet || !stance || !r.LessonCode || !r.Status) continue;
          const status = ['pass', 'p'].includes(r.Status.toLowerCase()) ? 'Pass' : ['reval', 'rv', 'r'].includes(r.Status.toLowerCase()) ? 'REVAL' : 'Stance';
          await base44.entities.EventLessonCompletion.create({ EventID: event.id, StanceID: stance.id, CadetID: cadet.id, LessonCode: r.LessonCode, Status: status, DetachmentID: event.DetachmentID }).catch(() => {});
          count++;
        }
        queryClient.invalidateQueries({ queryKey: ['event-lesson-completions', event.id] });
        toast.success(`${count} completion records imported`);
      } else if (key === 'attendance') {
        const records = parseStanceAttendanceText(text);
        if (!records.length) { toast.error('No attendance rows found'); return; }
        const byStance = {};
        records.forEach((r) => {
          if (!r.StanceLabel) return;
          if (!byStance[r.StanceLabel]) byStance[r.StanceLabel] = [];
          if (r.Attended && r.Attended.toUpperCase().startsWith('Y')) byStance[r.StanceLabel].push(r.PNumber);
        });
        let count = 0;
        for (const [label, pnums] of Object.entries(byStance)) {
          const stance = stances.find((s) => s.StanceLabel === label);
          if (!stance) continue;
          const cadetIds = pnums.map((pn) => roll.find((c) => c.PNumber === pn)?.id).filter(Boolean);
          await base44.entities.EventTrainingStance.update(stance.id, { CadetIDs: cadetIds });
          count++;
        }
        queryClient.invalidateQueries({ queryKey: ['event-stances', event.id] });
        toast.success(`${count} stances updated from attendance`);
      } else if (key === 'points') {
        const records = parseAwardPointsText(text);
        if (!records.length) { toast.error('No points rows found'); return; }
        let count = 0;
        for (const r of records) {
          const cadet = roll.find((c) => c.PNumber === r.PNumber);
          const stance = stances.find((s) => s.StanceLabel === r.StanceLabel);
          if (!cadet || !stance || !r.Points) continue;
          const bonus = r.Bonus && r.Bonus.toUpperCase().startsWith('Y');
          await base44.entities.EventScoreEntry.create({ EventID: event.id, StanceID: stance.id, CadetID: cadet.id, Points: Number(r.Points) || 0, Bonus: bonus, DetachmentID: event.DetachmentID }).catch(() => {});
          count++;
        }
        queryClient.invalidateQueries({ queryKey: ['event-scores', event.id] });
        toast.success(`${count} point entries imported`);
      } else if (key === 'stores') {
        const records = parseStoresText(text);
        if (!records.length) { toast.error('No stores rows found'); return; }
        const existing = await base44.entities.EventLessonStores.filter({ EventID: event.id });
        let count = 0;
        for (const r of records) {
          const stance = stances.find((s) => s.StanceLabel === r.StanceLabel);
          if (!stance || !r.LessonCode) continue;
          const ex = existing.find((s) => s.StanceID === stance.id && s.LessonCode === r.LessonCode);
          const data = { Location: r.Location, Dress: r.Dress, Welfare: r.Welfare, Notes: r.Notes, StoresRequest: r.StoresRequest, OwnStores: r.OwnStores };
          if (ex) await base44.entities.EventLessonStores.update(ex.id, data);
          else await base44.entities.EventLessonStores.create({ EventID: event.id, StanceID: stance.id, LessonCode: r.LessonCode, ...data, DetachmentID: event.DetachmentID });
          count++;
        }
        queryClient.invalidateQueries({ queryKey: ['event-lesson-stores', event.id] });
        toast.success(`${count} stores entries imported`);
      }
    } catch (err) { toast.error(err.message); }
    setImporting('');
    e.target.value = '';
  }

  const sheets = [
    {
      key: 'ka', icon: Activity, title: 'KA Score Sheet',
      desc: 'Cadet × activity grid (BJ, Squats, PressUps, Shuttle, MSFT) for field scoring.',
      count: `${roll.length} cadets`,
      onPdf: () => generateKAScoresPdf(event, roll, stances),
      onCsv: () => downloadTextFile(`${safeTitle}_KA_Scores.csv`, buildKAScoresCsv(roll, stances)),
      canImport: true,
    },
    {
      key: 'lessons', icon: ClipboardCheck, title: 'Lesson Completion Grid',
      desc: 'Per-stance cadet × lesson code grid with Pass / Stance / REVAL tick boxes.',
      count: `${stances.length} stances`,
      onPdf: () => generateLessonCompletionsPdf(event, roll, stances, syllabus),
      onCsv: () => downloadTextFile(`${safeTitle}_Lesson_Completions.csv`, buildLessonCompletionsCsv(roll, stances)),
      canImport: true,
    },
    {
      key: 'attendance', icon: Users, title: 'Stance Attendance Roster',
      desc: 'Per-stance roll with present tick box and notes column for field check-in.',
      count: `${stances.length} stances`,
      onPdf: () => generateStanceAttendancePdf(event, roll, stances),
      onCsv: () => downloadTextFile(`${safeTitle}_Attendance.csv`, buildStanceAttendanceCsv(roll, stances)),
      canImport: true,
    },
    {
      key: 'points', icon: Trophy, title: 'Competition Points Tally',
      desc: 'Stance × cadet points sheet with bonus column for live competition scoring.',
      count: `${stances.length} stances`,
      onPdf: () => generateAwardPointsPdf(event, roll, stances),
      onCsv: () => downloadTextFile(`${safeTitle}_Award_Points.csv`, buildAwardPointsCsv(roll, stances)),
      canImport: true,
    },
    {
      key: 'nominal', icon: FileText, title: 'Nominal Roll — Check In / Out',
      desc: 'Full cadet list with platoon, section, check-in and check-out time columns.',
      count: `${roll.length} cadets`,
      onPdf: () => generateNominalRollPdf(event, roll, platoons, sections),
      onCsv: () => downloadTextFile(`${safeTitle}_Nominal_Roll_CheckIn.csv`, buildNominalRollCheckInCsv(roll, platoons, sections)),
      canImport: false,
      note: 'Import new cadets via the Nominal Roll tab.',
    },
    {
      key: 'stores', icon: Package, title: 'Stores & Kit Issue Sheet',
      desc: 'Per-lesson stores request, location, dress, welfare and own-stores fields.',
      count: `${stances.length} stances`,
      onPdf: () => generateStoresPdf(event, stances, syllabus),
      onCsv: () => downloadTextFile(`${safeTitle}_Stores.csv`, buildStoresCsv(stances, syllabus)),
      canImport: true,
    },
  ];

  return (
    <div className="space-y-4 pb-20">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Offline Field Sheets</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Download printable PDFs (A4) or CSV templates before deploying to the field. Fill by hand or on a laptop offline, then either re-key manually into the relevant tab, or use Import CSV to bulk-upload the filled file once back in signal.
          </p>
        </CardContent>
      </Card>

      {sheets.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.key}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5"><Icon className="w-5 h-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    <Badge variant="outline" className="text-xs mt-1.5">{s.count}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="default" onClick={s.onPdf}>
                  <FileDown className="w-4 h-4 mr-1.5" />Download PDF
                </Button>
                <Button size="sm" variant="outline" onClick={s.onCsv}>
                  <FileDown className="w-4 h-4 mr-1.5" />Download CSV
                </Button>
                {s.canImport && (
                  <Button size="sm" variant="outline" onClick={() => triggerImport(s.key)} disabled={importing === s.key}>
                    {importing === s.key ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                    Import CSV
                  </Button>
                )}
                <input ref={(el) => (fileRefs.current[s.key] = el)} type="file" accept=".csv,.json" className="hidden" onChange={(e) => handleImport(e, s.key)} />
              </div>
              {s.note && <p className="text-xs text-muted-foreground italic">{s.note}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}