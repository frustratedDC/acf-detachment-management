import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCheck, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MyAvailability() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const isDC = me?.AccessLevel >= ACCESS_LEVELS.DET_COMMANDER;

  const [newDate, setNewDate] = useState('');
  const [newStatus, setNewStatus] = useState('Available');

  const { data: availability = [], isLoading } = useQuery({
    queryKey: ['my-availability', me?.PNumber],
    queryFn: () =>
      base44.entities.InstructorAvailability.filter({
        InstructorPNumber: me?.PNumber,
      }),
    enabled: !!me?.PNumber,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newDate) {
        toast.error('Please select a date');
        return;
      }
      return base44.entities.InstructorAvailability.create({
        InstructorPNumber: me?.PNumber,
        Date: newDate,
        Status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      toast.success('Availability recorded');
      setNewDate('');
      setNewStatus('Available');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InstructorAvailability.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      toast.success('Record deleted');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const availableCount = availability.filter((a) => a.Status === 'Available').length;
  const unavailableCount = availability.filter((a) => a.Status === 'Unavailable').length;

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
    <div className="min-h-screen">
      <PageHeader
        title="My Availability"
        description="Manage your training night availability"
        icon={CalendarCheck}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-chart-2 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" />
              Available Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{availableCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" />
              Unavailable Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{unavailableCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add New Availability (Self-Service) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Record Availability</CardTitle>
          <CardDescription>Submit your availability for upcoming training sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex-1">
                <Label className="text-xs">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="mt-auto gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Records */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your Records</h2>
        {availability.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No availability records yet.</p>
            </CardContent>
          </Card>
        ) : (
          availability
            .sort((a, b) => new Date(a.Date) - new Date(b.Date))
            .map((record) => (
              <Card key={record.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{new Date(record.Date).toLocaleDateString()}</p>
                      {record.Reason && <p className="text-xs text-muted-foreground mt-1">{record.Reason}</p>}
                    </div>
                    <Badge
                      className={
                        record.Status === 'Available'
                          ? 'bg-chart-2/10 text-chart-2'
                          : 'bg-amber-100/50 text-amber-700'
                      }
                    >
                      {record.Status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(record.id)}
                      disabled={deleteMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        '×'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  );
}