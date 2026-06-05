import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function KALogBookEntry({ personnel }) {
  const { personnel: me } = usePersonnel();

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entries, setEntries] = useState([{ pnum: "", points: "", notes: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkPoints, setBulkPoints] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");

  const cadets = useMemo(
    () => personnel
      .filter(p => p.Type === "Cadet" && p.PersonnelStatus === "Active")
      .sort((a, b) => (a.Surname || "").localeCompare(b.Surname || "")),
    [personnel]
  );

  function addRow() {
    setEntries(prev => [...prev, { pnum: "", points: "", notes: "" }]);
  }

  function removeRow(i) {
    setEntries(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i, field, value) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function toggleBulkCadet(pnum) {
    setBulkSelected(prev => prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]);
  }

  async function handleSubmit() {
    const toSave = bulkMode
      ? bulkSelected.map(pnum => ({ pnum, points: parseFloat(bulkPoints), notes: bulkNotes }))
      : entries.filter(e => e.pnum && e.points !== "");

    if (toSave.length === 0) { toast.error("No valid entries to save."); return; }
    if (toSave.some(e => isNaN(parseFloat(e.points)))) { toast.error("All points must be valid numbers."); return; }

    setSubmitting(true);
    for (const e of toSave) {
      await base44.entities.KA_LogBook.create({
        Date: date,
        Name: e.pnum,
        Points: parseFloat(e.points),
        Notes: e.notes || "",
        Entered_By: me?.PNumber || "manual",
      });
    }
    setSubmitting(false);
    setSubmitted(true);
    toast.success(`${toSave.length} log book entr${toSave.length === 1 ? "y" : "ies"} saved.`);
  }

  function handleReset() {
    setDate(format(new Date(), "yyyy-MM-dd"));
    setEntries([{ pnum: "", points: "", notes: "" }]);
    setBulkSelected([]);
    setBulkPoints("");
    setBulkNotes("");
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle2 className="w-14 h-14 text-green-500" />
        <h3 className="text-lg font-bold">Log Book Entries Saved</h3>
        <p className="text-sm text-muted-foreground">Points have been recorded in the KA Log Book.</p>
        <Button onClick={handleReset}>Add More Entries</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <Label>Entry Date</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={!bulkMode ? "default" : "outline"} onClick={() => setBulkMode(false)}>
          Individual Entries
        </Button>
        <Button size="sm" variant={bulkMode ? "default" : "outline"} onClick={() => setBulkMode(true)}>
          Bulk Award
        </Button>
      </div>

      {!bulkMode ? (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end p-3 rounded-lg border bg-muted/30">
              <div className="flex-1 min-w-0">
                <Label className="text-xs mb-1 block">Cadet</Label>
                <select
                  value={entry.pnum}
                  onChange={e => updateRow(i, "pnum", e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select cadet…</option>
                  {cadets.map(c => (
                    <option key={c.PNumber} value={c.PNumber}>
                      {c.Rank ? `${c.Rank} ` : ""}{c.FirstName} {c.Surname} ({c.PNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <Label className="text-xs mb-1 block">Points</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={entry.points}
                  onChange={e => updateRow(i, "points", e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-xs mb-1 block">Notes (optional)</Label>
                <Input
                  value={entry.notes}
                  onChange={e => updateRow(i, "notes", e.target.value)}
                  placeholder="e.g. Personal fitness challenge"
                />
              </div>
              {entries.length > 1 && (
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive shrink-0" onClick={() => removeRow(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Add Another
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="w-28">
              <Label>Points Each</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={bulkPoints}
                onChange={e => setBulkPoints(e.target.value)}
                placeholder="e.g. 5"
                className="mt-1"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Notes (optional)</Label>
              <Input
                value={bulkNotes}
                onChange={e => setBulkNotes(e.target.value)}
                placeholder="e.g. Athletics competition attendance"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Select Cadets <Badge variant="secondary">{bulkSelected.length} selected</Badge></p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkSelected(cadets.map(c => c.PNumber))}>All</Button>
                <Button size="sm" variant="outline" onClick={() => setBulkSelected([])}>None</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto rounded-lg border p-3">
              {cadets.map(c => (
                <div
                  key={c.PNumber}
                  onClick={() => toggleBulkCadet(c.PNumber)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${bulkSelected.includes(c.PNumber) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'}`}
                >
                  <Checkbox checked={bulkSelected.includes(c.PNumber)} onCheckedChange={() => toggleBulkCadet(c.PNumber)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.Rank && `${c.Rank} `}{c.FirstName} {c.Surname}</p>
                    <p className="text-xs text-muted-foreground">{c.CurrentStarLevel || "—"} · {c.PNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={submitting || (bulkMode ? bulkSelected.length === 0 || !bulkPoints : entries.every(e => !e.pnum || e.points === ""))}
      >
        <BookOpen className="w-4 h-4 mr-2" />
        {submitting ? "Saving…" : "Save Log Book Entries"}
      </Button>
    </div>
  );
}