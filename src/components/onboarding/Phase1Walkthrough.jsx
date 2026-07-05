import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, CheckCircle2, Rocket } from 'lucide-react';
import { format } from 'date-fns';

const WALKTHROUGH_STEPS = [
  'Click "New Event" to add a training night to the calendar.',
  'Click "New Night" to schedule lessons for that date.',
  'Repeat until you have at least 3 upcoming training nights planned.',
];

export default function Phase1Walkthrough({ status }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: scheduleCount = 0 } = useQuery({
    queryKey: ['onboarding-schedule-count'],
    queryFn: async () => {
      const rows = await base44.entities.NightlySchedule.filter({});
      return new Set(rows.filter(r => r.Date >= today).map(r => r.Date)).size;
    },
  });

  const criteriaMet = scheduleCount >= 3;

  const advanceMutation = useMutation({
    mutationFn: () => base44.entities.OnboardingStatus.update(status.id, { Phase1Complete: true, CurrentPhase: 2 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }),
  });

  return (
    <Card className="border-primary/30 bg-primary/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          Setup — Phase 1 of 4: Build Your Training Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-1.5 text-sm list-decimal list-inside text-muted-foreground">
          {WALKTHROUGH_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            {criteriaMet ? (
              <CheckCircle2 className="w-5 h-5 text-chart-2" />
            ) : (
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{scheduleCount} training night(s) scheduled (need 3+)</span>
          </div>
          <Button disabled={!criteriaMet || advanceMutation.isPending} onClick={() => advanceMutation.mutate()}>
            Complete Phase & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}