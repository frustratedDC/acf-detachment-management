import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STAR_LEVELS = ["Basic", "1 Star", "2 Star", "3 Star", "4 Star"];

export default function KAStepAttendance({ personnel, selectedLevels, setSelectedLevels, attendees, setAttendees, onNext }) {
  const cadets = personnel.filter(p => p.Type === "Cadet" && p.PersonnelStatus === "Active");

  function toggleLevel(level) {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  }

  const eligibleCadets = selectedLevels.length === 0
    ? cadets
    : cadets.filter(c => selectedLevels.includes(c.CurrentStarLevel));

  function toggleAttendee(pnum) {
    setAttendees(prev =>
      prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]
    );
  }

  function selectAll() { setAttendees(eligibleCadets.map(c => c.PNumber)); }
  function clearAll() { setAttendees([]); }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Filter by Star Level</p>
        <div className="flex flex-wrap gap-2">
          {STAR_LEVELS.map(level => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${selectedLevels.includes(level) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
            >
              {level}
            </button>
          ))}
          {selectedLevels.length > 0 && (
            <button type="button" onClick={() => setSelectedLevels([])} className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
              Clear Filter
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">
            Select Attendees <Badge variant="secondary">{attendees.length} selected</Badge>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={selectAll}>All</Button>
            <Button size="sm" variant="outline" onClick={clearAll}>None</Button>
          </div>
        </div>

        {eligibleCadets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No active cadets match the selected star levels.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto rounded-lg border border-border p-3">
            {eligibleCadets.map(c => (
              <div
                key={c.PNumber}
                onClick={() => toggleAttendee(c.PNumber)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${attendees.includes(c.PNumber) ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'}`}
              >
                <Checkbox checked={attendees.includes(c.PNumber)} onCheckedChange={() => toggleAttendee(c.PNumber)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.Rank && `${c.Rank} `}{c.FirstName} {c.Surname}</p>
                  <p className="text-xs text-muted-foreground">{c.CurrentStarLevel || '—'} · {c.PNumber}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button className="w-full" disabled={attendees.length === 0} onClick={onNext}>
        Next: Activity Selection →
      </Button>
    </div>
  );
}