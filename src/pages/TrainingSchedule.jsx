import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS } from '@/lib/accessLevels';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import ScheduleEntryForm from '@/components/schedule/ScheduleEntryForm';
import ScheduleView from '@/components/schedule/ScheduleView';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Plus, FileDown } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { toast } from 'sonner';

export default function TrainingSchedule() {
  const { personnel } = usePersonnel();
  const level = personnel?.AccessLevel ?? 0;
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState(null);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.list('-Date', 200),
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

  const canEdit = hasAccess(level, ACCESS_LEVELS.INSTRUCTOR);

  return (
    <AccessGate level={ACCESS_LEVELS.INSTRUCTOR}>
      <PageHeader
        title="Training Plan"
        description="Nightly schedule management"
        icon={Calendar}
        actions={
          canEdit && (
            <Button onClick={() => { setEditingDate(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Night
            </Button>
          )
        }
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
      />
    </AccessGate>
  );
}