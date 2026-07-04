import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, Plus } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import DisciplineLogForm from '@/components/discipline/DisciplineLogForm';

export default function DisciplineLogs() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const { data: entries = [] } = useQuery({
    queryKey: ['discipline-logs'],
    queryFn: () => base44.entities.DisciplineLog.list('-Date', 200),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = {};
  allPersonnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DisciplineLog.create({ ...data, LoggedByPNumber: me?.PNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipline-logs'] });
      toast.success('Entry logged');
      setFormOpen(false);
    },
  });

  function nameFor(pnum) {
    const p = personnelMap[pnum];
    return p ? [p.Rank, p.Surname].filter(Boolean).join(' ') : pnum;
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <PageHeader
        title="Discipline / SG Log"
        description="DC-only record of discipline and safeguarding issues"
        icon={Swords}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />New Entry
          </Button>
        }
      />

      <div className="space-y-2">
        {entries.map(entry => (
          <Card key={entry.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{entry.Date ? format(parseISO(entry.Date), 'd MMM yyyy') : '—'}</span>
                    <Badge variant="outline" className="text-xs font-mono">{entry.UIN}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {entry.PersonnelInvolved?.map(nameFor).join(', ')}
                  </p>
                  <p className="text-sm">{entry.Description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && (
          <p className="text-center py-10 text-muted-foreground text-sm">No discipline or safeguarding entries logged.</p>
        )}
      </div>

      <DisciplineLogForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        personnel={allPersonnel.filter(p => (p.PersonnelStatus || 'Active') === 'Active')}
        onSave={(data) => createMutation.mutate(data)}
        isSaving={createMutation.isPending}
      />
    </AccessGate>
  );
}