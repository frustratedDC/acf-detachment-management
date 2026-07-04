import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import NewJoinerChecklistCard from '@/components/personnel/NewJoinerChecklistCard';
import UniformRequestForm from '@/components/forms/UniformRequestForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

const emptyForm = { FirstName: '', Surname: '', PNumber: '', IsTransferee: false };

export default function NewJoiners() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uniformTarget, setUniformTarget] = useState(null);

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const { data: checklists = [] } = useQuery({
    queryKey: ['new-joiner-checklists'],
    queryFn: () => base44.entities.NewJoinerChecklist.filter({}),
  });

  const newJoiners = personnel.filter(p => p.CurrentStarLevel === 'New Joiner' && !p.IsArchived);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const person = await base44.entities.PersonnelManager.create({
        FirstName: data.FirstName,
        Surname: data.Surname,
        PNumber: data.PNumber,
        Type: 'Cadet',
        AccessLevel: 0,
        RoleName: 'New Joiner',
        CurrentStarLevel: 'New Joiner',
        IsTransferee: data.IsTransferee,
        PersonnelStatus: 'Active',
        IsLinked: false,
      });
      await base44.entities.NewJoinerChecklist.create({ CadetPNumber: data.PNumber });
      return person;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      queryClient.invalidateQueries({ queryKey: ['new-joiner-checklists'] });
      toast.success('New Joiner added');
      setOpen(false);
      setForm(emptyForm);
    },
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="New Joiners"
        description="Applicants working through the pre-enrolment checklist"
        icon={UserPlus}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(emptyForm)}>
                <Plus className="w-4 h-4 mr-2" />Add New Joiner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Joiner</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={form.FirstName} onChange={(e) => setForm(p => ({ ...p, FirstName: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Surname</Label>
                    <Input value={form.Surname} onChange={(e) => setForm(p => ({ ...p, Surname: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>PNumber</Label>
                  <Input value={form.PNumber} onChange={(e) => setForm(p => ({ ...p, PNumber: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Transferee</p>
                    <p className="text-xs text-muted-foreground">Transferring in from another detachment</p>
                  </div>
                  <Switch checked={form.IsTransferee} onCheckedChange={(v) => setForm(p => ({ ...p, IsTransferee: v }))} />
                </div>
                <Button
                  className="w-full"
                  disabled={!form.FirstName || !form.Surname || !form.PNumber}
                  onClick={() => createMutation.mutate(form)}
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {newJoiners.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No New Joiners currently in progress.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {newJoiners.map(person => {
            const checklist = checklists.find(c => c.CadetPNumber === person.PNumber);
            if (!checklist) return null;
            return (
              <NewJoinerChecklistCard
                key={person.id}
                person={person}
                checklist={checklist}
                onOpenUniformForm={setUniformTarget}
              />
            );
          })}
        </div>
      )}

      {uniformTarget && (
        <UniformRequestForm
          open={!!uniformTarget}
          onClose={() => setUniformTarget(null)}
          targetPersonnel={uniformTarget}
        />
      )}
    </AccessGate>
  );
}