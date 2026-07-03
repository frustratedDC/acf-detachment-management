import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS } from '@/lib/accessLevels';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import ScheduleEntryForm from '@/components/schedule/ScheduleEntryForm';
import ScheduleView from '@/components/schedule/ScheduleView';
import PlanLockBar from '@/components/schedule/PlanLockBar';
import EventCreateDialog from '@/components/schedule/EventCreateDialog';
import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TrainingSchedule() {
  const { personnel } = usePersonnel();
  const level = personnel?.AccessLevel ?? 0;
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.list('-Date', 200),
  });

  const { data: trainingMonths = [] } = useQuery({
    queryKey: ['training-months'],
    queryFn: () => base44.entities.TrainingMonth.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (date) => {
      const entries = schedule.filter(s => s.Date === date);
      for (const entry of entries) {
        await base44.entities.NightlySchedule.delete(entry.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-all'] });
      toast.success('Training night deleted');
    },
  });

  const canEdit = hasAccess(level, ACCESS_LEVELS.DET_2IC);
  const isDC = hasAccess(level, ACCESS_LEVELS.DET_COMMANDER);
  const currentMonthStr = format(new Date(), 'yyyy-MM');

  return (
    <AccessGate level={0}>
      <PageHeader
        title="Training Plan"
        description="Nightly schedule management"
        icon={Calendar}
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEventDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
              <Button onClick={() => { setEditingDate(null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                New Night
              </Button>
            </div>
          )
        }
      />

      <EventCreateDialog
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        myPNumber={personnel?.PNumber}
      />

      {/* DC-only Lock Controls */}
      <PlanLockBar
        trainingMonths={trainingMonths}
        currentMonthStr={currentMonthStr}
        isDC={isDC}
      />

      {showForm && (
        <ScheduleEntryForm
          date={editingDate || selectedDate}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['schedule-all'] });
          }}
        />
      )}

      <ScheduleView
        schedule={schedule}
        isLoading={isLoading}
        canEdit={canEdit}
        onEdit={(date) => { setEditingDate(date); setShowForm(true); }}
        onDelete={(date) => deleteMutation.mutate(date)}
        trainingMonths={trainingMonths}
        myPNumber={personnel?.PNumber}
        accessLevel={level}
      />
    </AccessGate>
  );
}