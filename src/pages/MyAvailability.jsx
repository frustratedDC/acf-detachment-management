import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AvailabilityCalendar from '@/components/availability/AvailabilityCalendar';

export default function MyAvailability() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  const { data: availability = [], isLoading } = useQuery({
    queryKey: ['my-availability', me?.PNumber],
    queryFn: () =>
      base44.entities.InstructorAvailability.filter({
        InstructorPNumber: me?.PNumber,
      }),
    enabled: !!me?.PNumber,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ date, status, existingId }) => {
      if (existingId) {
        // Update existing record
        return base44.entities.InstructorAvailability.update(existingId, { Status: status });
      } else {
        // Create new record
        return base44.entities.InstructorAvailability.create({
          InstructorPNumber: me?.PNumber,
          Date: date,
          Status: status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const handleDayToggle = (date, status, existingId) => {
    toggleMutation.mutate({ date, status, existingId });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <PageHeader
          title="My Availability"
          description="Manage your training night availability"
          icon={CalendarCheck}
        />
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Availability"
        description="Click days to toggle your availability for training sessions"
        icon={CalendarCheck}
      />

      {/* Calendar */}
      <AvailabilityCalendar
        availability={availability}
        onDayToggle={handleDayToggle}
        isLoading={isLoading || toggleMutation.isPending}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-chart-2">Available Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{availability.filter(a => a.Status === 'Available').length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700">Unavailable Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{availability.filter(a => a.Status === 'Unavailable').length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}