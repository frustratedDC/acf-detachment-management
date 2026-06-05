import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import { Dumbbell, ChevronRight, BookOpen, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { ACCESS_LEVELS, hasAccess } from "@/lib/accessLevels";
import { format } from "date-fns";
import KAStepAttendance from "@/components/ka/KAStepAttendance";
import KAStepActivities from "@/components/ka/KAStepActivities";
import KAStepBriefing from "@/components/ka/KAStepBriefing";
import KAStepScoring from "@/components/ka/KAStepScoring";
import KAStepReview from "@/components/ka/KAStepReview";
import KALogBookEntry from "@/components/ka/KALogBookEntry";
import { bjMax } from "@/lib/kaScoring";

const STEPS = [
  { num: 1, label: "Attendance" },
  { num: 2, label: "Activities" },
  { num: 3, label: "Briefing" },
  { num: 4, label: "Scoring" },
  { num: 5, label: "Review" },
];

const DEFAULT_ACTIVITIES = ["WarmUp", "BroadJump", "Squats", "PressUps", "Shuttle", "CoolDown"];

export default function KeepingActiveTracker() {
  // ── ALL hooks must be at the top, unconditionally ──────────────────────────
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  // Access gate state
  const [existingRequest, setExistingRequest] = useState(null);
  const [checkingRequest, setCheckingRequest] = useState(true);

  // Session state
  const [mode, setMode] = useState("session");
  const [step, setStep] = useState(1);
  const [personnel, setPersonnel] = useState([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [selectedActivities, setSelectedActivities] = useState(DEFAULT_ACTIVITIES);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [briefingConfirmedAt, setBriefingConfirmedAt] = useState(null);
  const [scores, setScores] = useState({});
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historicalSessions, setHistoricalSessions] = useState([]);

  const myLevel = me?.AccessLevel ?? 0;
  const hasKAAccess = hasAccess(myLevel, ACCESS_LEVELS.CADET_NCO) || me?.KeepingActiveAccess === true;

  // Check for existing access request (only relevant when access is denied)
  useEffect(() => {
    if (!me?.PNumber || hasKAAccess) { setCheckingRequest(false); return; }
    base44.entities.AccessRequest.filter({ RequesterPNumber: me.PNumber, FeatureKey: 'KeepingActiveAccess' })
      .then(reqs => {
        const pending = reqs.find(r => r.Status === 'Pending');
        const approved = reqs.find(r => r.Status === 'Approved');
        setExistingRequest(pending || approved || null);
      })
      .finally(() => setCheckingRequest(false));
  }, [me?.PNumber, hasKAAccess]);

  // Load personnel + historical sessions (only needed when access is granted)
  useEffect(() => {
    if (!hasKAAccess) { setLoadingPersonnel(false); return; }
    Promise.all([
      base44.entities.PersonnelManager.list(),
      base44.entities.KA_Session.filter({}),
    ]).then(([pRecords, kaSessions]) => {
      setPersonnel(pRecords);
      setHistoricalSessions(kaSessions);
    }).finally(() => setLoadingPersonnel(false));
  }, [hasKAAccess]);

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

  const requestAccessMutation = useMutation({
    mutationFn: () => base44.entities.AccessRequest.create({
      RequesterPNumber: me.PNumber,
      RequesterName: [me.Rank, me.FirstName, me.Surname].filter(Boolean).join(' '),
      FeatureKey: 'KeepingActiveAccess',
      FeatureLabel: 'Keeping Active Tracker',
      Status: 'Pending',
    }),
    onSuccess: (req) => {
      setExistingRequest(req);
      toast.success('Access request submitted to the DC/Adult Instructor task list.');
    },
    onError: () => toast.error('Failed to submit request.'),
  });

  // ── Helper functions ───────────────────────────────────────────────────────
  function handleStartSession() {
    setSessionStartTime(new Date());
    setStep(3);
  }

  function handleBriefingConfirm(ts, proceed) {
    setBriefingConfirmedAt(ts);
    if (proceed) setStep(4);
  }

  function handleEndSession() {
    setSessionEndTime(new Date());
    setStep(5);
  }

  async function handleSubmit(rows, roundedMinutes, participationPts) {
    setSubmitting(true);
    const date = sessionStartTime?.toISOString().split('T')[0];

    const attendeeScores = rows.map(row => ({
      PNumber: row.pnum,
      BroadJump1: row.s.BJ1 ?? null,
      BroadJump2: row.s.BJ2 ?? null,
      BroadJump3: row.s.BJ3 ?? null,
      Squats: row.s.Squats ?? null,
      PressUps: row.s.PressUps ?? null,
      ShuttleRun: row.s.Shuttle ?? null,
    }));

    await base44.entities.KAFitnessSession.create({
      Date: date,
      StartTime: sessionStartTime?.toTimeString().slice(0, 5),
      EndTime: sessionEndTime?.toTimeString().slice(0, 5),
      DurationMinutes: roundedMinutes,
      AttendeeScores: attendeeScores,
    });

    for (const row of rows) {
      const p = personnelMap[row.pnum];
      const msftVal = row.s.MSFT_level ? parseFloat(row.s.MSFT_level) + (row.s.MSFT_shuttle ? parseFloat(row.s.MSFT_shuttle) / 10 : 0) : null;
      await base44.entities.KA_Session.create({
        Date: date,
        Name: row.pnum,
        Det: p?.RoleName || "—",
        Session_Status: "Completed",
        Duration_Minutes: roundedMinutes,
        BJ1: row.s.BJ_skip ? null : (row.s.BJ1 ?? null),
        BJ2: row.s.BJ_skip ? null : (row.s.BJ2 ?? null),
        BJ3: row.s.BJ_skip ? null : (row.s.BJ3 ?? null),
        Squats: row.s.Squats_skip ? null : (row.s.Squats ?? null),
        PressUps: row.s.PressUps_skip ? null : (row.s.PressUps ?? null),
        Shuttle: row.s.Shuttle_skip ? null : (row.s.Shuttle ?? null),
        MSFT: row.s.MSFT_skip ? null : msftVal,
      });

      const bonuses = row.bonuses || { sessionHighs: 0, pbsBroken: 0 };
      const finalTotal = row.activityTotal + participationPts + bonuses.sessionHighs + bonuses.pbsBroken;

      await base44.entities.KA_LogBook.create({
        Date: date,
        Name: row.pnum,
        Points: finalTotal,
        Notes: `Session auto-score: ${roundedMinutes}min | Activity: ${row.activityTotal} | Part: +${participationPts} | Session Highs: +${bonuses.sessionHighs} | PBs: +${bonuses.pbsBroken}`,
        Entered_By: "system",
      });
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  function handleReset() {
    setStep(1);
    setSelectedLevels([]);
    setAttendees([]);
    setSelectedActivities(DEFAULT_ACTIVITIES);
    setSessionStartTime(null);
    setBriefingConfirmedAt(null);
    setScores({});
    setSessionEndTime(null);
    setSubmitted(false);
  }

  // ── Access Gate (conditional render AFTER all hooks) ───────────────────────
  if (!hasKAAccess) {
    if (checkingRequest) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div>
        <PageHeader title="Keeping Active Tracker" description="Log and score KA fitness sessions" icon={Dumbbell} />
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Access Restricted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The Keeping Active Tracker is available to Cadet NCOs and above, or cadets with explicit instructor approval.
              </p>
            </div>
            {existingRequest?.Status === 'Pending' && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 text-sm text-accent-foreground">
                ⏳ Your access request is pending review by an Adult Instructor.
              </div>
            )}
            {existingRequest?.Status === 'Approved' && (
              <div className="rounded-lg bg-chart-2/10 border border-chart-2/30 p-3 text-sm text-chart-2">
                ✓ Your request was approved — please refresh the page.
              </div>
            )}
            {!existingRequest && (
              <Button
                onClick={() => requestAccessMutation.mutate()}
                disabled={requestAccessMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {requestAccessMutation.isPending ? 'Submitting...' : 'Request Access'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main tracker UI ────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Keeping Active Tracker"
        description="Log and score KA fitness sessions"
        icon={Dumbbell}
      />

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("session")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === "session" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          <Dumbbell className="w-4 h-4" />Session Tracker
        </button>
        <button
          onClick={() => setMode("logbook")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${mode === "logbook" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          <BookOpen className="w-4 h-4" />Log Book Entry
        </button>
      </div>

      {/* Log Book Entry mode */}
      {mode === "logbook" && (
        <div className="max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>Log Book Entry</CardTitle>
              <CardDescription>Manually award KA Log Book points to cadets for activities outside a formal session.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPersonnel ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <KALogBookEntry personnel={personnel} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Tracker mode */}
      {mode === "session" && <>
        {/* Step Indicator */}
        <div className="flex items-center gap-1 mb-6 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                step === s.num ? 'bg-primary text-primary-foreground' :
                step > s.num ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                'bg-muted text-muted-foreground'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s.num ? 'bg-white/20' : step > s.num ? 'bg-green-500 text-white' : 'bg-border'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>{STEPS[step - 1].label}</CardTitle>
              <CardDescription>
                {step === 1 && "Select which cadets are attending this KA session."}
                {step === 2 && "Choose activities to evaluate and record the session start time."}
                {step === 3 && "Deliver the safety briefing and confirm before proceeding."}
                {step === 4 && "Enter scores for each cadet across all selected activities."}
                {step === 5 && "Review calculated points and submit to the database."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPersonnel ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <KAStepAttendance
                      personnel={personnel}
                      selectedLevels={selectedLevels}
                      setSelectedLevels={setSelectedLevels}
                      attendees={attendees}
                      setAttendees={setAttendees}
                      onNext={() => setStep(2)}
                    />
                  )}
                  {step === 2 && (
                    <KAStepActivities
                      selectedActivities={selectedActivities}
                      setSelectedActivities={setSelectedActivities}
                      onStart={handleStartSession}
                    />
                  )}
                  {step === 3 && (
                    <KAStepBriefing
                      sessionStartTime={sessionStartTime}
                      onConfirm={handleBriefingConfirm}
                    />
                  )}
                  {step === 4 && (
                    <KAStepScoring
                      attendees={attendees}
                      personnelMap={personnelMap}
                      selectedActivities={selectedActivities}
                      scores={scores}
                      setScores={setScores}
                      onEnd={handleEndSession}
                    />
                  )}
                  {step === 5 && (
                    <KAStepReview
                      attendees={attendees}
                      personnelMap={personnelMap}
                      scores={scores}
                      sessionStartTime={sessionStartTime}
                      sessionEndTime={sessionEndTime}
                      selectedActivities={selectedActivities}
                      historicalSessions={historicalSessions}
                      onSubmit={handleSubmit}
                      submitting={submitting}
                      submitted={submitted}
                      onReset={handleReset}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </>}
    </div>
  );
}