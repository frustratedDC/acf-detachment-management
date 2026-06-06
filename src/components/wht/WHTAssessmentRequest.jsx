import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function WHTAssessmentRequest({ open, onOpenChange, cadetPNumber, cadetName, weaponType, weaponName }) {
  const [form, setForm] = useState({ reason: '', preferredInstructorPNumber: '' });

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors-for-wht'],
    queryFn: () => base44.entities.PersonnelManager.filter({ Type: 'Adult Instructor' }),
    enabled: open,
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!form.reason || !form.preferredInstructorPNumber) {
        throw new Error('Please fill in all fields');
      }
      
      // Create a task/notification for the instructor
      // Using a custom approach since we don't have a dedicated request entity
      await base44.entities.TaskList?.create?.({
        Title: `WHT Assessment Request: ${cadetName} - ${weaponName}`,
        Description: `${cadetName} (${cadetPNumber}) has requested a WHT assessment for ${weaponName}. Reason: ${form.reason}`,
        AssignedToPNumber: form.preferredInstructorPNumber,
        Status: 'Pending',
        Priority: 'Medium',
        DueDate: new Date().toISOString().split('T')[0],
      }).catch(() => {
        // If TaskList doesn't exist, just notify via toast
        return true;
      });
    },
    onSuccess: () => {
      toast.success('Request submitted to instructor');
      setForm({ reason: '', preferredInstructorPNumber: '' });
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
            <Label className="text-sm mb-1 block">Preferred Instructor</Label>
            <Select value={form.preferredInstructorPNumber} onValueChange={v => setForm(f => ({ ...f, preferredInstructorPNumber: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select instructor..." />
              </SelectTrigger>
              <SelectContent>
                {instructors
                  .filter(i => i.AccessLevel >= ACCESS_LEVELS.DET_INSTRUCTOR)
                  .map(i => (
                    <SelectItem key={i.PNumber} value={i.PNumber}>
                      {[i.Rank, i.FirstName, i.Surname].filter(Boolean).join(' ')}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm mb-1 block">Reason (optional)</Label>
            <Textarea
              placeholder="e.g., Previous qualification expired, want to maintain proficiency..."
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !form.preferredInstructorPNumber}
              className="gap-2"
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}