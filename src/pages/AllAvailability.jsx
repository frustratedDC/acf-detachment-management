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

  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newInstructor, setNewInstructor] = useState('');
  const [newStatus, setNewStatus] = useState('Available');
  const [newReason, setNewReason] = useState('');

  const [editRecord, setEditRecord] = useState(null);
  const [editStatus, setEditStatus] = useState('Available');
  const [editReason, setEditReason] = useState('');

  // Unified availability — merges new InstructorAvailability + legacy StaffAvailability
  const { availability } = useAvailability();

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  // Filter instructors based on user role
  const visibleAvailability = useMemo(() => {
    if (isInstructor) {
      return availability.filter(a => a.InstructorPNumber === me?.PNumber);
    }
    return availability;
  }, [availability, me?.PNumber, isInstructor]);

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

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newInstructor) {
        throw new Error('Please select an instructor');
      }
      await base44.entities.InstructorAvailability.create({
        InstructorPNumber: newInstructor,
        Date: newDate,
        Status: newStatus,
        Reason: newStatus === 'Unavailable' ? newReason : '',
      });
    },
    onSuccess: () => {
      toast.success('Availability added');
      queryClient.invalidateQueries({ queryKey: ['instructor-availability'] });
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
      setNewInstructor('');
      setNewStatus('Available');
      setNewReason('');
    },
    onError: (err) => toast.error(err.message),
  });

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
      await base44.entities.InstructorAvailability.update(editRecord.id, {
        Status: editStatus,
        Reason: editStatus === 'Unavailable' ? editReason : '',
      });
    },
    onSuccess: () => {
      toast.success('Availability updated');
      queryClient.invalidateQueries({ queryKey: ['instructor-availability'] });
      setEditRecord(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = (record) => {
    setEditRecord(record);
    setEditStatus(record.Status);
    setEditReason(record.Reason || '');
  };

  // Group by date
  const groupedByDate = useMemo(() => {
    const grouped = {};
    visibleAvailability.forEach(a => {
      if (!grouped[a.Date]) grouped[a.Date] = [];
      grouped[a.Date].push(a);
    });
    return grouped;
  }, [visibleAvailability]);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="All Instructor Availability"
        description={isInstructor ? 'Your availability record' : 'Centralized staff availability tracking'}
        icon={CalendarCheck}
      />

      {!isInstructor && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Quick Add Availability
            </CardTitle>
            <CardDescription>Rapidly log instructor availability for phone-ins and manual updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Instructor</Label>
                <Select value={newInstructor} onValueChange={setNewInstructor}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="Select instructor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instructorOptions.map(i => (
                      <SelectItem key={i.PNumber} value={i.PNumber}>
                        {i.Rank} {i.FirstName} {i.Surname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Date</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 w-36 text-xs" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newStatus === 'Unavailable' && (
                <div>
                  <Label className="text-xs mb-1 block">Reason</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Training, Sick"
                    value={newReason}
                    onChange={e => setNewReason(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !newInstructor}
              >
                {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(groupedByDate).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No availability records found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate)
            .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
            .map(([date, records]) => (
              <Card key={date}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{format(new Date(date + 'T00:00:00'), 'EEEE, d MMMM yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {records.map(record => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{instructorMap[record.InstructorPNumber] || record.InstructorPNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={record.Status === 'Available' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {record.Status}
                            </Badge>
                            {record.Reason && <span className="text-xs text-muted-foreground italic">({record.Reason})</span>}
                          </div>
                        </div>
                        {!isInstructor && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(record)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(record.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Availability</DialogTitle>
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