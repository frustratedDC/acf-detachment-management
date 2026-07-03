import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAvailability } from '@/lib/useAvailability';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import AccessGate from '@/components/shared/AccessGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS, isAdultInstructor } from '@/lib/accessLevels';

export default function AllAvailability() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const isInstructor = isAdultInstructor(me?.AccessLevel ?? 0);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // editRecord: { id?, InstructorPNumber, Date } — id is null when the instructor has no record yet
  const [editRecord, setEditRecord] = useState(null);
  const [editStatus, setEditStatus] = useState('Available');
  const [editReason, setEditReason] = useState('');

  // Unified availability — merges new InstructorAvailability + legacy StaffAvailability
  const { availability } = useAvailability();

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const instructorMap = useMemo(() => {
    const map = {};
    personnel.forEach(p => {
      if (p.Type === 'Adult Instructor') {
        map[p.PNumber] = `${p.Rank} ${p.FirstName} ${p.Surname}`.trim();
      }
    });
    return map;
  }, [personnel]);

  const instructorOptions = personnel.filter(p => p.Type === 'Adult Instructor');

  // Master roster for the selected date: every instructor, whether they've submitted or not
  const rosterForDate = useMemo(() => {
    return instructorOptions.map(p => {
      const record = availability.find(a => a.InstructorPNumber === p.PNumber && a.Date === selectedDate);
      return {
        PNumber: p.PNumber,
        Name: `${p.Rank} ${p.FirstName} ${p.Surname}`.trim(),
        record: record || null,
      };
    });
  }, [instructorOptions, availability, selectedDate]);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.InstructorAvailability.delete(id);
    },
    onSuccess: () => {
      toast.success('Availability removed');
      queryClient.invalidateQueries({ queryKey: ['instructor-availability'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (editRecord.id && !editRecord.id.toString().startsWith('legacy__')) {
        await base44.entities.InstructorAvailability.update(editRecord.id, {
          Status: editStatus,
          Reason: editStatus === 'Unavailable' ? editReason : '',
        });
      } else {
        await base44.entities.InstructorAvailability.create({
          InstructorPNumber: editRecord.InstructorPNumber,
          Date: editRecord.Date,
          Status: editStatus,
          Reason: editStatus === 'Unavailable' ? editReason : '',
        });
      }
    },
    onSuccess: () => {
      toast.success('Availability updated');
      queryClient.invalidateQueries({ queryKey: ['instructor-availability'] });
      setEditRecord(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEditForRoster = (rosterEntry) => {
    const record = rosterEntry.record;
    setEditRecord({
      id: record?.id || null,
      InstructorPNumber: rosterEntry.PNumber,
      Date: selectedDate,
    });
    setEditStatus(record?.Status || 'Available');
    setEditReason(record?.Reason || '');
  };

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="All Instructor Availability"
        description={isInstructor ? 'Your availability record' : 'Centralized staff availability tracking'}
        icon={CalendarCheck}
      />

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Date</CardTitle>
          <CardDescription>View and set every instructor's status for a specific date</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 w-48"
          />
        </CardContent>
      </Card>

      {rosterForDate.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No adult instructors found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{format(new Date(selectedDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rosterForDate
                .filter(r => !isInstructor || me?.AccessLevel >= ACCESS_LEVELS.DET_2IC || r.PNumber === me?.PNumber)
                .map(entry => (
                <div key={entry.PNumber} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.Name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {entry.record ? (
                        <>
                          <Badge
                            variant={entry.record.Status === 'Available' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {entry.record.Status}
                          </Badge>
                          {entry.record.Reason && <span className="text-xs text-muted-foreground italic">({entry.record.Reason})</span>}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Not submitted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditForRoster(entry)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {!isInstructor && entry.record && !entry.record.id?.toString().startsWith('legacy__') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(entry.record.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRecord?.id ? 'Edit Availability' : 'Set Availability'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editStatus === 'Unavailable' && (
              <div>
                <Label className="text-xs mb-1 block">Reason</Label>
                <Input
                  type="text"
                  placeholder="e.g. Training, Sick"
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}