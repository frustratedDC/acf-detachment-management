import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Flag } from "lucide-react";

export default function KAStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState([]);
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsed(baseRef.current + (Date.now() - startRef.current));
      }, 50);
    } else {
      clearInterval(intervalRef.current);
      baseRef.current = elapsed;
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  function reset() {
    setRunning(false);
    setElapsed(0);
    baseRef.current = 0;
    setLaps([]);
  }

  function lap() {
    setLaps(prev => [...prev, elapsed]);
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Stopwatch</p>
      <div className="text-3xl font-mono font-bold text-center tabular-nums text-foreground py-2">
        {fmt(elapsed)}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setRunning(r => !r)}>
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Stop' : 'Start'}
        </Button>
        <Button size="sm" variant="outline" onClick={lap} disabled={!running}>
          <Flag className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>
      {laps.length > 0 && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Lap {i + 1}</span>
              <span className="font-mono">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}