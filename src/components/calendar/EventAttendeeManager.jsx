import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AddAttendeeControl from './AddAttendeeControl';
import AttendeeRow from './AttendeeRow';
import { toast } from 'sonner';

export default function EventAttendeeManager({ event, open, onClose, canEdit }) {
  const queryClient = useQueryClient();

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
    enabled: open,
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ['event-attendees', event?.id],
    queryFn: () => base44.entities.EventAttendee.filter({ EventId: event.id }),
    enabled: !!event && open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event-attendees', event?.id] });

  const addMutation = useMutation({
    mutationFn: ({ p, personType, tier }) => {
      const priceMap = { Full: event?.FullPrice, FSM: event?.FSMPrice, Adult: event?.AdultPrice, None: 0 };
      return base44.entities.EventAttendee.create({
        EventId: event.id,
        PNumber: p.PNumber,
        Name: [p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' '),
        PersonType: personType,
        PriceTier: tier,
        AmountDue: priceMap[tier] || 0,
        AmountPaid: 0,
        IsPaid: false,
      });
    },
    onSuccess: () => { invalidate(); toast.success('Attendee added'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventAttendee.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Payment updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventAttendee.delete(id),
    onSuccess: () => { invalidate(); toast.success('Attendee removed'); },
  });

  const existingPNumbers = attendees.map(a => a.PNumber);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Attendees & Payments — {event?.Title}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2 max-h-[60vh] overflow-y-auto">
          {canEdit && (
            <AddAttendeeControl
              personnel={personnel}
              existingPNumbers={existingPNumbers}
              onAdd={(p, personType, tier) => addMutation.mutate({ p, personType, tier })}
            />
          )}
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">No attendees assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {attendees.map(a => (
                <AttendeeRow
                  key={a.id}
                  attendee={a}
                  canEdit={canEdit}
                  onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}