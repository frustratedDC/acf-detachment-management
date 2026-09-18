import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function EventCommitSection({ event }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: staff = [] } = useQuery({ queryKey: ['event-staff', event.id], queryFn: () => base44.entities.EventStaff.filter({ EventID: event.id }) });
  const { data: platoons = [] } = useQuery({ queryKey: ['event-platoons', event.id], queryFn: () => base44.entities.EventPlatoon.filter({ EventID: event.id }) });
  const { data: roll = [] } = useQuery({ queryKey: ['event-nominal-roll', event.id], queryFn: () => base44.entities.EventNominalRoll.filter({ EventID: event.id }) });
  const { data: kit = [] } = useQuery({ queryKey: ['event-kit-items', event.id], queryFn: () => base44.entities.EventKitItem.filter({ EventID: event.id }) });
  const { data: equipment = [] } = useQuery({ queryKey: ['event-equipment', event.id], queryFn: () => base44.entities.EventEquipment.filter({ EventID: event.id }) });
  const { data: slots = [] } = useQuery({ queryKey: ['event-itinerary', event.id], queryFn: () => base44.entities.EventItinerarySlot.filter({ EventID: event.id }) });

  const commitMutation = useMutation({
    mutationFn: () => base44.entities.EventTrainingPlan.update(event.id, { Status: 'Committed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-training-plans'] });
      toast.success('Training plan committed!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      for (const s of staff) await base44.entities.EventStaff.delete(s.id);
      for (const p of platoons) await base44.entities.EventPlatoon.delete(p.id);
      for (const r of roll) await base44.entities.EventNominalRoll.delete(r.id);
      for (const k of kit) await base44.entities.EventKitItem.delete(k.id);
      for (const eq of equipment) await base44.entities.EventEquipment.delete(eq.id);
      for (const sl of slots) await base44.entities.EventItinerarySlot.delete(sl.id);
      await base44.entities.EventTrainingPlan.delete(event.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plans'] });
      toast.success('Event deleted');
      navigate('/event-planning');
    },
  });

  const isCommitted = event.Status === 'Committed';
  const includedKit = kit.filter((k) => k.Included);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold">Draft Training Plan Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{event.Title}</span></div>
            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{event.EventType}</span></div>
            <div><span className="text-muted-foreground">Start:</span> <span className="font-medium">{event.StartDateTime ? format(new Date(event.StartDateTime), 'dd MMM yyyy HH:mm') : '—'}</span></div>
            <div><span className="text-muted-foreground">End:</span> <span className="font-medium">{event.EndDateTime ? format(new Date(event.EndDateTime), 'dd MMM yyyy HH:mm') : '—'}</span></div>
            <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{event.Location || '—'}</span></div>
            <div><span className="text-muted-foreground">Cost:</span> <span className="font-medium">£{event.EventCost || 0}</span></div>
          </div>
          {(event.ActivityTags || []).length > 0 && (
            <div className="flex flex-wrap gap-1">{event.ActivityTags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center"><p className="text-2xl font-bold text-primary">{staff.length}</p><p className="text-xs text-muted-foreground">Staff</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-primary">{roll.length}</p><p className="text-xs text-muted-foreground">Cadets</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-primary">{platoons.length}</p><p className="text-xs text-muted-foreground">Platoons</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-primary">{includedKit.length}</p><p className="text-xs text-muted-foreground">Kit Categories</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-primary">{equipment.length}</p><p className="text-xs text-muted-foreground">Equipment Items</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-primary">{slots.length}</p><p className="text-xs text-muted-foreground">Itinerary Slots</p></div>
          </div>
          {(event.CompanyStaffOC || event.CompanyStaffTO || event.CompanyStaffCSM) && (
            <div className="text-sm">
              <span className="text-muted-foreground">Company Staff:</span>{' '}
              {[['OC', event.CompanyStaffOC], ['TO', event.CompanyStaffTO], ['CSM', event.CompanyStaffCSM], ['SO', event.CompanyStaffOfficer], ['CQMS', event.CompanyStaffCQMS]]
                .filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`).join(' · ')}
            </div>
          )}
        </CardContent>
      </Card>

      {!isCommitted && platoons.length === 0 && (
        <Card className="bg-amber-500/5 border-amber-500/30">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-700">No platoons created yet. Complete the Platoons section before committing.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Planning Status</p>
            <Badge className={isCommitted ? 'bg-chart-2/20 text-chart-2' : 'bg-muted text-muted-foreground'}>{event.Status}</Badge>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1.5" />Delete Event</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>This permanently deletes the event and all linked staff, nominal roll, platoons, kit, equipment, and itinerary data. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {!isCommitted && (
              <Button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />{commitMutation.isPending ? 'Committing...' : 'Complete Planning Phase'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}