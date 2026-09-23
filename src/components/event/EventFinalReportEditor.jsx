import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Plus, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { buildReportSections } from '@/lib/eventCadetReport';
import { exportFullEventReportPDF } from '@/lib/eventPdfExport';

export default function EventFinalReportEditor({ event, snapshots, stances, staff, awards, kaSessions, syllabus, onBack }) {
  const initial = useMemo(() => buildReportSections(event, snapshots, { stances, staff, awards, kaSessions, syllabus }), [event, snapshots, stances, staff, awards, kaSessions, syllabus]);
  const [sections, setSections] = useState(() => initial.map((s) => ({ ...s })));
  const [newTitle, setNewTitle] = useState('');
  const [exporting, setExporting] = useState(false);

  function editSection(idx, content) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, content } : s)));
  }
  function addSection() {
    if (!newTitle.trim()) return;
    setSections((prev) => [...prev, { title: newTitle.trim(), content: '' }]);
    setNewTitle('');
  }
  function removeSection(idx) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }
  function resetToDefault() {
    setSections(initial.map((s) => ({ ...s })));
    toast.success('Sections reset to auto-generated content');
  }
  function download() {
    setExporting(true);
    try {
      exportFullEventReportPDF(event, sections);
      toast.success('Final report PDF downloaded');
    } catch (err) {
      toast.error(err.message);
    }
    setExporting(false);
  }

  return (
    <div className="space-y-3 pb-20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Final Report Editor</h3>
          <p className="text-xs text-muted-foreground">Edit any section, add custom sections, then download the PDF.</p>
        </div>
        <Button size="sm" variant="outline" onClick={resetToDefault}><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset</Button>
        <Button size="sm" onClick={download} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
          Download PDF
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((sec, idx) => (
          <Card key={idx}>
            <CardContent className="pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                  <Label className="text-sm font-semibold">{sec.title}</Label>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSection(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <Textarea
                value={sec.content}
                onChange={(e) => editSection(idx, e.target.value)}
                rows={Math.min(12, Math.max(4, sec.content.split('\n').length + 1))}
                className="text-xs font-mono"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-3 space-y-2">
          <p className="text-xs font-semibold">Add Custom Section</p>
          <div className="flex gap-2">
            <Input placeholder="Section title e.g. Incident Notes, Recommendations, Next-Event Priorities" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="outline" onClick={addSection} disabled={!newTitle.trim()}><Plus className="w-4 h-4 mr-1.5" />Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}