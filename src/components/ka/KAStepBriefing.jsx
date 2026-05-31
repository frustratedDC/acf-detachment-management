import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Clock } from "lucide-react";

export default function KAStepBriefing({ sessionStartTime, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleConfirm() {
    const ts = new Date();
    setConfirmedAt(ts);
    setConfirmed(true);
    onConfirm(ts);
  }

  const elapsed = sessionStartTime
    ? Math.floor((now - sessionStartTime.getTime()) / 1000)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Session Safety Briefing Delivery Confirmation</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Before proceeding to scoring, confirm that a full safety briefing has been delivered to all attendees.
          This includes warm-up protocols, injury reporting procedures, and emergency stop signals.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-3">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Session started at</p>
          <p className="text-sm font-semibold tabular-nums">
            {sessionStartTime?.toLocaleTimeString('en-GB')} — {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
          </p>
        </div>
      </div>

      {confirmed ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <p className="text-sm font-semibold text-green-600">✓ Briefing confirmed at {confirmedAt?.toLocaleTimeString('en-GB')}</p>
          <Button className="mt-3 w-full" onClick={() => onConfirm(confirmedAt, true)}>
            Proceed to Scoring →
          </Button>
        </div>
      ) : (
        <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleConfirm}>
          <ShieldCheck className="w-4 h-4" /> Confirm Briefing Delivered
        </Button>
      )}
    </div>
  );
}