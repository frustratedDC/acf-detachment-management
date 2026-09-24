import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import EventDetailsSection from '@/components/event/EventDetailsSection';
import EventKitSection from '@/components/event/EventKitSection';
import EventStaffSection from '@/components/event/EventStaffSection';
import EventNominalRollSection from '@/components/event/EventNominalRollSection';
import EventTrainingSection from '@/components/event/EventTrainingSection';
import EventPlatoonSection from '@/components/event/EventPlatoonSection';
import EventEquipmentSection from '@/components/event/EventEquipmentSection';
import EventItinerarySection from '@/components/event/EventItinerarySection';
import EventCommitSection from '@/components/event/EventCommitSection';
import EventStanceSection from '@/components/event/EventStanceSection';
import EventLessonTrackingSection from '@/components/event/EventLessonTrackingSection';
import EventAwardsSection from '@/components/event/EventAwardsSection';
import EventKASessionSection from '@/components/event/EventKASessionSection';
import EventStoresSection from '@/components/event/EventStoresSection';
import EventPaperworkSection from '@/components/event/EventPaperworkSection';
import EventCadetRecordsSection from '@/components/event/EventCadetRecordsSection';
import EventCompleteSection from '@/components/event/EventCompleteSection';
import EventOfflineSheetsSection from '@/components/event/EventOfflineSheetsSection';

const STATUS_COLOR = {
  Draft: 'bg-muted text-muted-foreground',
  Planned: 'bg-blue-500/20 text-blue-600',
  Committed: 'bg-chart-2/20 text-chart-2',
  Complete: 'bg-chart-2/30 text-chart-2 font-semibold',
  Cancelled: 'bg-destructive/20 text-destructive',
};

const SECTIONS = [
  { key: 'details', label: 'Details' },
  { key: 'kit', label: 'Kit' },
  { key: 'staff', label: 'Staff' },
  { key: 'roll', label: 'Nominal Roll' },
  { key: 'training', label: 'Training' },
  { key: 'stances', label: 'Stances' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'awards', label: 'Awards' },
  { key: 'ka', label: 'KA Sessions' },
  { key: 'stores', label: 'Stores' },
  { key: 'platoons', label: 'Platoons' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'paperwork', label: 'Paperwork' },
  { key: 'records', label: 'Cadet Records' },
  { key: 'offline', label: 'Offline Sheets' },
  { key: 'complete', label: 'Complete' },
  { key: 'commit', label: 'Commit' },
];

export default function EventTrainingPlanDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('details');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event-training-plan', eventId],
    queryFn: () => base44.entities.EventTrainingPlan.get(eventId),
    enabled: !!eventId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!event) {
    return <div className="py-24 text-center text-muted-foreground">Event not found.</div>;
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/event-planning')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate">{event.Title}</h1>
            <Badge className={`text-xs ${STATUS_COLOR[event.Status] || ''}`}>{event.Status}</Badge>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto mb-4 flex-nowrap h-auto">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs whitespace-nowrap">{s.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="details"><EventDetailsSection event={event} /></TabsContent>
        <TabsContent value="kit"><EventKitSection event={event} /></TabsContent>
        <TabsContent value="staff"><EventStaffSection event={event} /></TabsContent>
        <TabsContent value="roll"><EventNominalRollSection event={event} /></TabsContent>
        <TabsContent value="training"><EventTrainingSection event={event} /></TabsContent>
        <TabsContent value="stances"><EventStanceSection event={event} /></TabsContent>
        <TabsContent value="tracking"><EventLessonTrackingSection event={event} /></TabsContent>
        <TabsContent value="awards"><EventAwardsSection event={event} /></TabsContent>
        <TabsContent value="ka"><EventKASessionSection event={event} /></TabsContent>
        <TabsContent value="stores"><EventStoresSection event={event} /></TabsContent>
        <TabsContent value="platoons"><EventPlatoonSection event={event} /></TabsContent>
        <TabsContent value="equipment"><EventEquipmentSection event={event} /></TabsContent>
        <TabsContent value="itinerary"><EventItinerarySection event={event} /></TabsContent>
        <TabsContent value="paperwork"><EventPaperworkSection event={event} /></TabsContent>
        <TabsContent value="records"><EventCadetRecordsSection event={event} /></TabsContent>
        <TabsContent value="offline"><EventOfflineSheetsSection event={event} /></TabsContent>
        <TabsContent value="complete"><EventCompleteSection event={event} /></TabsContent>
        <TabsContent value="commit"><EventCommitSection event={event} /></TabsContent>
      </Tabs>
    </AccessGate>
  );
}