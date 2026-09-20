import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Package, ClipboardCheck, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportCadrePlanPDF, exportStoresPDF, exportWMCompletionsPDF, exportMELPDF } from '@/lib/eventPdfExport';

export default function EventPaperworkSection({ event }) {
  const [exporting, setExporting] = useState('');

  const { data: stances = [] } = useQuery({ queryKey: ['event-stances', event.id], queryFn: () => base44.entities.EventTrainingStance.filter({ EventID: event.id }) });
  const { data: staff = [] } = useQuery({ queryKey: ['event-staff', event.id], queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }) });
  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: awards = [] } = useQuery({ queryKey: ['event-awards', event.id], queryFn: () => base44.entities.EventAward.filter({ EventID: event.id }) });
  const { data: scores = [] } = useQuery({ queryKey: ['event-scores', event.id], queryFn: () => base44.entities.EventScoreEntry.filter({ EventID: event.id }) });
  const { data: completions = [] } = useQuery({ queryKey: ['event-lesson-completions', event.id], queryFn: () => base44.entities.EventLessonCompletion.filter({ EventID: event.id }) });
  const { data: lessonStores = [] } = useQuery({ queryKey: ['event-lesson-stores', event.id], queryFn: () => base44.entities.EventLessonStores.filter({ EventID: event.id }) });
  const { data: itinerary = [] } = useQuery({ queryKey: ['event-itinerary', event.id], queryFn: () => base44.entities.EventItinerarySlot.filter({ EventID: event.id }) });
  const { data: syllabus = [] } = useQuery({ queryKey: ['syllabus-master-all'], queryFn: () => base44.entities.SyllabusMaster.filter({}) });

  const data = { stances, staff, roll, awards, scoreEntries: scores, completions, lessonStores, itinerary, syllabus };

  function run(label, fn) {
    setExporting(label);
    try { fn(event, data); toast.success(`${label} PDF generated`); }
    catch (err) { toast.error(err.message); }
    setExporting('');
  }

  const docs = [
    { key: 'cadre', label: 'Recruit Cadre Plan', desc: 'Command structure, schedule, stance allocation, competition rules', icon: FileText, fn: () => run('Cadre Plan', exportCadrePlanPDF) },
    { key: 'stores', label: 'Stores & Equipment', desc: 'Per-lesson stores table + aggregate totals', icon: Package, fn: () => run('Stores & Equipment', exportStoresPDF) },
    { key: 'wm', label: 'WM Completions Plan', desc: 'Cadet × subject pass/stance/REVAL matrix', icon: ClipboardCheck, fn: () => run('WM Completions', exportWMCompletionsPDF) },
    { key: 'mel', label: 'MEL (Master Event List)', desc: 'Minute-by-minute schedule with cadet names', icon: CalendarDays, fn: () => run('MEL', exportMELPDF) },
  ];

  return (
    <div className="space-y-3 pb-20">
      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-1">Chain of Command Paperwork</h3>
          <p className="text-xs text-muted-foreground mb-3">Generate the four standard event documents as PDF.</p>
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.key} className="flex items-center gap-3 p-3 rounded-lg border">
                <d.icon className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.desc}</p>
                </div>
                <Button size="sm" onClick={d.fn} disabled={exporting === d.label}>
                  {exporting === d.label ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                  PDF
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {stances.length === 0 && <p className="text-center text-xs text-muted-foreground">Tip: add training stances first — the exports draw from them.</p>}
    </div>
  );
}