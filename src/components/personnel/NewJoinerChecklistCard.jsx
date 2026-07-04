import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shirt, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CHECK_ITEMS = [
  { key: 'InformalChatInvited', label: 'Invite for Informal Chat' },
  { key: 'InformalChatAttended', label: 'Attended Informal Chat' },
  { key: 'InductionInvited', label: 'Invited to Induction' },
  { key: 'InductionAttended', label: 'Attended Induction' },
  { key: 'OnboardedTrainingNights', label: 'Attends Training Nights (Bring onto Cdt Numbers)' },
  { key: 'UniformMeasured', label: 'Measure for Uniform' },
  { key: 'SixTrainingNightsComplete', label: 'Attends 6 Training Nights (auto-tracked)' },
  { key: 'UniformIssued', label: 'Uniform Issued' },
];

export default function NewJoinerChecklistCard({ person, checklist, onOpenUniformForm }) {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: (data) => base44.entities.NewJoinerChecklist.update(checklist.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['new-joiner-checklists'] }),
  });

  const enrolMutation = useMutation({
    mutationFn: () => base44.entities.PersonnelManager.update(person.id, {
      CurrentStarLevel: 'Basic',
      Rank: 'Cdt',
      RoleName: 'Cadet',
      UnitStartDate: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success(`${person.FirstName} ${person.Surname} enrolled as Cdt`);
      setEnrolling(false);
    },
  });

  const allComplete = CHECK_ITEMS.every(item => checklist?.[item.key]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{person.FirstName} {person.Surname}</p>
          {person.IsTransferee && <Badge variant="secondary">Transferee</Badge>}
        </div>
        <div className="space-y-2">
          {CHECK_ITEMS.map(item => (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm flex-1 cursor-pointer">
                <Checkbox
                  checked={!!checklist?.[item.key]}
                  onCheckedChange={(v) => toggleMutation.mutate({ [item.key]: !!v })}
                />
                {item.label}
              </label>
              {item.key === 'UniformMeasured' && (
                <Button size="sm" variant="outline" onClick={() => onOpenUniformForm(person)}>
                  <Shirt className="w-3.5 h-3.5 mr-1" /> Log Measurements
                </Button>
              )}
              {item.key === 'SixTrainingNightsComplete' && (
                <span className="text-xs text-muted-foreground shrink-0">{checklist?.TrainingNightsCount || 0}/6 nights</span>
              )}
            </div>
          ))}
        </div>
        <Button
          className="w-full"
          disabled={!allComplete || enrolling}
          onClick={() => { setEnrolling(true); enrolMutation.mutate(); }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          {allComplete ? 'Enrol as Cdt' : 'Complete checklist to enrol'}
        </Button>
      </CardContent>
    </Card>
  );
}