import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserCog, LayoutGrid, CheckCircle2, ArrowRight, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PHASES = [
  {
    phase: 2,
    title: 'Add Cadets',
    icon: Users,
    directive: 'Bring your cadets onto the system so attendance and progress can be tracked.',
    action: { label: 'Open Cadet Records', to: '/personnel' },
    walkthrough: [
      'Go to Personnel (Cadet Profiles).',
      'Add each cadet with their PNumber, rank and star level.',
      'Set an accurate Unit Start Date for attendance tracking.',
    ],
    criteriaLabel: (count) => `${count} cadet(s) added (need 5+)`,
    met: (count) => count >= 5,
  },
  {
    phase: 3,
    title: 'Add Instructors',
    icon: UserCog,
    directive: 'Add your adult instructors (CFAV) and set their qualified subjects.',
    action: { label: 'Open CFAV Nominal Roll', to: '/cfav-roll' },
    walkthrough: [
      'Go to the CFAV Nominal Roll.',
      'Add each instructor and assign their Access Level.',
      'Record their Qualified Subjects so they can be assigned lessons.',
    ],
    criteriaLabel: (count) => `${count} instructor(s) added (need 1+)`,
    met: (count) => count >= 1,
  },
  {
    phase: 4,
    title: 'Everything Else',
    icon: LayoutGrid,
    directive: 'You now have the full toolset unlocked — NAAFI, reporting, discipline logs and more.',
    action: { label: 'Explore Admin Controls', to: '/admin' },
    walkthrough: [
      'Set up NAAFI stock in NAAFI Management.',
      'Review Admin Controls for detachment-wide settings.',
      'Check the Help Wiki any time you need a refresher.',
    ],
    criteriaLabel: () => 'Manual finish — mark complete when ready.',
    met: () => true,
  },
];

export default function SetupCommandCenter({ status }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPhase = status?.CurrentPhase || 1;
  const phaseInfo = PHASES.find(p => p.phase === currentPhase);

  const { data: cadetCount = 0 } = useQuery({
    queryKey: ['onboarding-cadet-count'],
    queryFn: async () => (await base44.entities.PersonnelManager.filter({ Type: 'Cadet' })).length,
    enabled: currentPhase === 2,
  });

  const { data: instructorCount = 0 } = useQuery({
    queryKey: ['onboarding-instructor-count'],
    queryFn: async () => (await base44.entities.PersonnelManager.filter({ Type: 'Adult Instructor' })).length,
    enabled: currentPhase === 3,
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const updates = { [`Phase${currentPhase}Complete`]: true };
      if (currentPhase < 4) updates.CurrentPhase = currentPhase + 1;
      return base44.entities.OnboardingStatus.update(status.id, updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] }),
  });

  if (!phaseInfo) return null;

  const countForPhase = { 2: cadetCount, 3: instructorCount, 4: 1 }[currentPhase];
  const criteriaMet = phaseInfo.met(countForPhase);
  const Icon = phaseInfo.icon;

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Detachment Setup — Phase {currentPhase} of 4
            </CardTitle>
            <div className="flex gap-1.5">
              {PHASES.map(p => (
                <Badge
                  key={p.phase}
                  className={
                    p.phase < currentPhase || (p.phase === currentPhase && status?.[`Phase${p.phase}Complete`])
                      ? 'bg-chart-2 text-white border-0'
                      : p.phase === currentPhase
                      ? 'bg-primary text-primary-foreground border-0'
                      : 'bg-muted text-muted-foreground border-0'
                  }
                >
                  {p.phase}. {p.title}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {phaseInfo.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{phaseInfo.directive}</p>
            <Button onClick={() => navigate(phaseInfo.action.to)} className="gap-2">
              <ArrowRight className="w-4 h-4" />{phaseInfo.action.label}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Walkthrough</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
              {phaseInfo.walkthrough.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {criteriaMet ? (
              <CheckCircle2 className="w-5 h-5 text-chart-2" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
            )}
            <span className="text-sm font-medium">{phaseInfo.criteriaLabel(countForPhase)}</span>
          </div>
          <Button
            disabled={!criteriaMet || advanceMutation.isPending}
            onClick={() => advanceMutation.mutate()}
          >
            {currentPhase < 4 ? 'Complete Phase & Continue' : 'Finish Setup'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}