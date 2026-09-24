import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Search, Users, Loader2, UserPlus, Download } from 'lucide-react';
import { toast } from 'sonner';
import EventManualCadetModal from '@/components/event/EventManualCadetModal';
import { buildNominalRollTemplateCsv, buildPartialCompletionsTemplateCsv, downloadTextFile, parseNominalRollText, parsePartialCompletionsText, getExtension } from '@/lib/eventCsvTemplate';

export default function EventNominalRollSection({ event }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const fileRef1 = useRef(null);
  const fileRef2 = useRef(null);

  const { data: roll = [] } = useQuery({
    queryKey: ['event-nominal-roll', event.id],
    queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }),
  });
  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const { data: platoons = [] } = useQuery({
    queryKey: ['event-platoons', event.id],
    queryFn: () => base44.entities.EventPlatoon.filter({ EventID: event.id }),
  });
  const { data: sections = [] } = useQuery({
    queryKey: ['event-sections', event.id],
    queryFn: () => base44.entities.EventSection.filter({ EventID: event.id }),
  });

  const filtered = useMemo(() => roll.filter((r) => {
    const q = search.toLowerCase();
    return r.PNumber?.toLowerCase().includes(q) || r.Surname?.toLowerCase().includes(q) || r.FirstName?.toLowerCase().includes(q);
  }), [roll, search]);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventNominalRoll.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      for (const r of roll) await base44.entities.EventNominalRoll.delete(r.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] }); toast.success('Nominal roll cleared'); },
  });

  async function readText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function handleUpload1(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = getExtension(file.name);
      let records;
      if (ext === 'csv' || ext === 'json') {
        const text = await readText(file);
        records = parseNominalRollText(text, ext);
      } else {
        // xlsx or unknown — fall back to AI extraction
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: 'object',
            properties: {
              records: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    PNumber: { type: 'string' }, Rank: { type: 'string' }, Surname: { type: 'string' },
                    FirstName: { type: 'string' }, Detachment: { type: 'string' }, Gender: { type: 'string' },
                    CurrentStarLevel: { type: 'string' }, WHTAirRifle: { type: 'string' }, WHTGPRifle: { type: 'string' },
                    SubjectCompletions: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        });
        const raw = result.output?.records || result.output || [];
        records = raw.map((r) => ({
          PNumber: r.PNumber || '', Rank: r.Rank || '', Surname: r.Surname || '', FirstName: r.FirstName || '',
          Detachment: r.Detachment || '', Gender: r.Gender || '', CurrentStarLevel: r.CurrentStarLevel || 'Basic',
          WHTAirRifle: r.WHTAirRifle || '', WHTGPRifle: r.WHTGPRifle || '', SubjectCompletions: r.SubjectCompletions || [],
        }));
      }

      if (!records.length) { toast.error('No cadet rows found in the file'); setUploading(false); e.target.value = ''; return; }

      const payload = records.map((r) => {
        const existing = personnel.find((p) => p.PNumber === r.PNumber);
        return {
          EventID: event.id, PNumber: r.PNumber, Rank: r.Rank, Surname: r.Surname, FirstName: r.FirstName,
          Detachment: r.Detachment, Gender: r.Gender, CurrentStarLevel: r.CurrentStarLevel,
          WHTAirRifle: r.WHTAirRifle, WHTGPRifle: r.WHTGPRifle,
          SubjectCompletions: r.SubjectCompletions, LinkedPersonnelID: existing?.id || '',
          DetachmentID: event.DetachmentID,
        };
      });
      await base44.entities.EventNominalRoll.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
      toast.success(`${payload.length} cadets imported`);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
    e.target.value = '';
  }

  async function handleUpload2(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = getExtension(file.name);
      let records;
      if (ext === 'csv' || ext === 'json') {
        const text = await readText(file);
        records = parsePartialCompletionsText(text, ext);
      } else {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: 'object',
            properties: {
              records: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { PNumber: { type: 'string' }, PartialCompletions: { type: 'array', items: { type: 'string' } } },
                },
              },
            },
          },
        });
        const raw = result.output?.records || result.output || [];
        records = raw.map((r) => ({ PNumber: r.PNumber || '', PartialCompletions: r.PartialCompletions || [] }));
      }

      let updated = 0;
      for (const r of records) {
        const existing = roll.find((x) => x.PNumber === r.PNumber);
        if (existing) {
          await base44.entities.EventNominalRoll.update(existing.id, { PartialCompletions: r.PartialCompletions || [] });
          updated++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['event-nominal-roll', event.id] });
      toast.success(`${updated} partial completions updated`);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowManual(true)}><UserPlus className="w-4 h-4 mr-1.5" />Add Cadet</Button>
            <Button size="sm" variant="outline" onClick={() => downloadTextFile('nominal_roll_template.csv', buildNominalRollTemplateCsv())}>
              <Download className="w-4 h-4 mr-1.5" />CSV Template
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef1.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              Upload Nominal Roll (CSV 1)
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef2.current?.click()} disabled={uploading || roll.length === 0}>
              <Upload className="w-4 h-4 mr-1.5" />Upload Partial Completions (CSV 2)
            </Button>
            {roll.length > 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => clearMutation.mutate()}><Trash2 className="w-4 h-4 mr-1.5" />Clear All</Button>}
            <input ref={fileRef1} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleUpload1} />
            <input ref={fileRef2} type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={handleUpload2} />
          </div>
          <p className="text-xs text-muted-foreground">Download the template for the correct column order and an example row. CSV 1 columns: PNumber, Rank, Surname, FirstName, Detachment, Gender, CurrentStarLevel, WHTAirRifle, WHTGPRifle, SubjectCompletions (pipe-separated). Auto-links to existing personnel records.</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search cadets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Badge variant="outline" className="text-xs">{filtered.length} / {roll.length}</Badge>
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{[c.Rank, c.FirstName, c.Surname].filter(Boolean).join(' ')}</p>
                <p className="text-xs text-muted-foreground">{c.PNumber} · {c.CurrentStarLevel} · {c.Gender || '—'}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.PlatoonID && platoons.find((p) => p.id === c.PlatoonID) && <Badge variant="outline" className="text-xs">{platoons.find((p) => p.id === c.PlatoonID).PlatoonName}</Badge>}
                  {c.SectionID && sections.find((s) => s.id === c.SectionID) && <Badge variant="outline" className="text-xs">Sec {sections.find((s) => s.id === c.SectionID).SectionName}</Badge>}
                  {c.WHTAirRifle && <Badge variant="outline" className="text-xs">AR: {c.WHTAirRifle}</Badge>}
                  {c.WHTGPRifle && <Badge variant="outline" className="text-xs">GP: {c.WHTGPRifle}</Badge>}
                  {(c.SubjectCompletions || []).length > 0 && <Badge variant="outline" className="text-xs">{c.SubjectCompletions.length} completed</Badge>}
                  {c.LinkedPersonnelID && <Badge className="text-xs bg-chart-2/10 text-chart-2">Linked</Badge>}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">{roll.length === 0 ? 'No cadets on nominal roll. Upload a CSV or add manually to begin.' : 'No cadets match your search.'}</p>}
      </div>

      <EventManualCadetModal event={event} open={showManual} onOpenChange={setShowManual} />
    </div>
  );
}