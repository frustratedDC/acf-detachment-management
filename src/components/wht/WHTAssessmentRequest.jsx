import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { format } from 'date-fns';

export default function WHTAssessmentRequest({ open, onOpenChange, cadetPNumber, cadetName, weaponType, weaponName }) {
  const { personnel: me } = usePersonnel();
  const [preferredInstructor, setPreferredInstructor] = useState('');
  const [notes, setNotes] = useState('');

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors-for-wht'],
    queryFn: () => base44.entities.PersonnelManager.filter({ Type: 'Adult Instructor' }),
    enabled: open,
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const instructorName = instructors.find(i => i.PNumber === preferredInstructor);
      const nameStr = instructorName ? [instructorName.Rank, instructorName.FirstName, instructorName.Surname].filter(Boolean).join(' ') : preferredInstructor;
      await base44.entities.CourseRequest.create({
        PNumber: cadetPNumber || me?.PNumber,
        RequestorName: cadetName || [me?.Rank, me?.FirstName, me?.Surname].filter(Boolean).join(' '),
        CourseName: `WHT Assessment — ${weaponName}`,
        PreferredSemester: '',
        Reason: [
          `WHT assessment request for ${cadetName || me?.PNumber}.`,
          `Weapon: ${weaponName}`,
          preferredInstructor ? `Preferred assessor: ${nameStr}` : '',
          notes ? `Notes: ${notes}` : '',
        ].filter(Boolean).join('\n'),
        Status: 'Pending',
        DateRequested: format(new Date(), 'yyyy-MM-dd'),
      });
    },
    onSuccess: () => {
      toast.success('Assessment request submitted — an instructor will be in contact.');
      setPreferredInstructor('');
      setNotes('');
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request WHT Assessment</DialogTitle>
          <DialogDescription>
            Request a new {weaponName} assessment from an instructor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-xs text-muted-foreground">Cadet</Label>
            <p className="font-semibold text-sm">{cadetName}</p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Weapon</Label>
            <p className="font-semibold text-sm">{weaponName}</p>
          </div>

          <div>
            <Label className="text-sm mb-1 block">Preferred Instructor <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={preferredInstructor} onValueChange={setPreferredInstructor}>
              <SelectTrigger>
                <SelectValue placeholder="Any available instructor" />
              </SelectTrigger>
              <SelectContent>
                {instructors
                  .filter(i => i.AccessLevel >= ACCESS_LEVELS.DET_INSTRUCTOR && (i.PersonnelStatus || 'Active') === 'Active')
                  .map(i => (
                    <SelectItem key={i.PNumber} value={i.PNumber}>
                      {[i.Rank, i.FirstName, i.Surname].filter(Boolean).join(' ')}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm mb-1 block">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="e.g. Previous qualification expired, want to maintain proficiency..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="gap-2"
            >
              {requestMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="w-4 h-4" />Submit Request</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}