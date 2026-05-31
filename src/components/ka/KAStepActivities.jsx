import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Clock } from "lucide-react";

const ALL_ACTIVITIES = [
  { key: "WarmUp", label: "Warm Up", mandatory: true },
  { key: "BroadJump", label: "Broad Jump", mandatory: false },
  { key: "Squats", label: "Squats", mandatory: false },
  { key: "PressUps", label: "Press Ups", mandatory: false },
  { key: "Shuttle", label: "Shuttle Run", mandatory: false },
  { key: "MSFT", label: "MSFT (20m)", mandatory: false },
  { key: "CoolDown", label: "Cool Down", mandatory: true },
];

export default function KAStepActivities({ selectedActivities, setSelectedActivities, onStart }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function toggle(key) {
    const activity = ALL_ACTIVITIES.find(a => a.key === key);
    if (activity.mandatory) return;
    setSelectedActivities(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  const optionalSelected = selectedActivities.filter(k => {
    const a = ALL_ACTIVITIES.find(x => x.key === k);
    return !a?.mandatory;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Select Activities to Evaluate</p>
        <div className="space-y-2">
          {ALL_ACTIVITIES.map(activity => (
            <div
              key={activity.key}
              onClick={() => toggle(activity.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                selectedActivities.includes(activity.key)
                  ? 'bg-primary/10 border-primary/40'
                  : 'border-border hover:bg-muted'
              } ${activity.mandatory ? 'cursor-default' : ''}`}
            >
              <Checkbox
                checked={selectedActivities.includes(activity.key)}
                onCheckedChange={() => toggle(activity.key)}
                disabled={activity.mandatory}
              />
              <span className="text-sm font-medium">{activity.label}</span>
              {activity.mandatory && <Badge variant="secondary" className="ml-auto text-xs">Mandatory</Badge>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Session start will be recorded as</p>
          <p className="text-base font-bold text-foreground tabular-nums">
            {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {' — '}
            {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <Button className="w-full gap-2" onClick={onStart}>
        <Play className="w-4 h-4" /> Start Session
      </Button>
    </div>
  );
}