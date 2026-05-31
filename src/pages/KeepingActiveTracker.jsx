import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";
import { Dumbbell, ChevronRight } from "lucide-react";
import KAStepAttendance from "@/components/ka/KAStepAttendance";
import KAStepActivities from "@/components/ka/KAStepActivities";
import KAStepBriefing from "@/components/ka/KAStepBriefing";
import KAStepScoring from "@/components/ka/KAStepScoring";
import KAStepReview from "@/components/ka/KAStepReview";

const STEPS = [
  { num: 1, label: "Attendance" },
  { num: 2, label: "Activities" },
  { num: 3, label: "Briefing" },
  { num: 4, label: "Scoring" },
  { num: 5, label: "Review" },
];

const DEFAULT_ACTIVITIES = ["WarmUp", "BroadJump", "Squats", "PressUps", "Shuttle", "CoolDown"];

export default function KeepingActiveTracker() {
  const [step, setStep] = useState(1);
  const [personnel, setPersonnel] = useState([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(true);

  // Step 1
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [attendees, setAttendees] = useState([]);

  // Step 2
  const [selectedActivities, setSelectedActivities] = useState(DEFAULT_ACTIVITIES);

  // Step 3
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [briefingConfirmedAt, setBriefingConfirmedAt] = useState(null);

  // Step 4
  const [scores, setScores] = useState({});

  // Step 5
  const [sessionEndTime, setSessionEndTime] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    base44.entities.PersonnelManager.list()
      .then(records => setPersonnel(records))
      .finally(() => setLoadingPersonnel(false));
  }, []);

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

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

    // Build attendee scores array for KASession
    const attendeeScores = rows.map(row => ({
      PNumber: row.pnum,
      BroadJump1: row.s.BJ1 ?? null,
      BroadJump2: row.s.BJ2 ?? null,
      BroadJump3: row.s.BJ3 ?? null,
      Squats: row.s.Squats ?? null,
      PressUps: row.s.PressUps ?? null,
      ShuttleRun: row.s.Shuttle ?? null,
    }));

    // Save KASession record
    await base44.entities.KAFitnessSession.create({
      Date: date,
      StartTime: sessionStartTime?.toTimeString().slice(0, 5),
      EndTime: sessionEndTime?.toTimeString().slice(0, 5),
      DurationMinutes: roundedMinutes,
      AttendeeScores: attendeeScores,
    });

    // Save individual KA_Session records per cadet
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

      // Log cumulative points to KA_LogBook
      await base44.entities.KA_LogBook.create({
        Date: date,
        Name: row.pnum,
        Points: row.total,
        Notes: `Session auto-score: ${roundedMinutes}min, ${row.activityTotal} activity pts + ${participationPts} participation pts`,
        Entered_By: "system",
      });
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div>
      <PageHeader
        title="Keeping Active Tracker"
        description="Log and score KA fitness sessions"
        icon={Dumbbell}
      />

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
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitted={submitted}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}