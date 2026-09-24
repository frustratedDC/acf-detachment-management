import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Bus, UtensilsCrossed, Tent, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import { EVENT_TYPES, ACTIVITY_TAGS, TRANSPORT_DRESS_STATES } from '@/lib/eventConstants';

export default function EventDetailsSection({ event }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({
      Title: event.Title || '', StartDateTime: event.StartDateTime || '', EndDateTime: event.EndDateTime || '',
      Location: event.Location || '', EventCost: event.EventCost || 0, FSMCost: event.FSMCost || 0, EventType: event.EventType || 'Detachment',
      ActivityTags: event.ActivityTags || [], TransportMode: event.TransportMode || 'Own Transport',
      OutboundDepartureLocation: event.OutboundDepartureLocation || '', OutboundDateTime: event.OutboundDateTime || '',
      OutboundLatestArrival: event.OutboundLatestArrival || '', TransportDressState: event.TransportDressState || 'MTP',
      TransportDressOther: event.TransportDressOther || '', CoachOfficer: event.CoachOfficer || '',
      InboundArrivalLocation: event.InboundArrivalLocation || '', InboundDateTime: event.InboundDateTime || '',
      FeedingProvided: event.FeedingProvided ?? false, RequiresBreakfastPrior: event.RequiresBreakfastPrior ?? false,
      RequiresBreakfast: event.RequiresBreakfast ?? false, RequiresPackedLunch: event.RequiresPackedLunch ?? false,
      RequiresEveningMeal: event.RequiresEveningMeal ?? false, AccommodationProvided: event.AccommodationProvided ?? false,
      AccommodationType: event.AccommodationType || 'Building', OwnSleepingEquipment: event.OwnSleepingEquipment ?? false,
      LaundryAvailable: event.LaundryAvailable || 'NA', LaundryCost: event.LaundryCost || 0,
    });
  }, [event.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EventTrainingPlan.update(event.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-training-plan', event.id] });
      queryClient.invalidateQueries({ queryKey: ['event-training-plans'] });
      toast.success('Event details saved');
    },
  });

  function set(key, val) { setForm((prev) => ({ ...prev, [key]: val })); }
  function toggleTag(tag) {
    setForm((prev) => ({
      ...prev,
      ActivityTags: prev.ActivityTags.includes(tag) ? prev.ActivityTags.filter((t) => t !== tag) : [...prev.ActivityTags, tag],
    }));
  }

  return (
    <div className="space-y-4 pb-20">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shirt className="w-4 h-4" />Core Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Title</Label><Input value={form.Title} onChange={(e) => set('Title', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={form.StartDateTime} onChange={(e) => set('StartDateTime', e.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={form.EndDateTime} onChange={(e) => set('EndDateTime', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Location</Label><Input value={form.Location} onChange={(e) => set('Location', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cost (£/cadet)</Label><Input type="number" value={form.EventCost} onChange={(e) => set('EventCost', Number(e.target.value))} /></div>
              <div><Label>FSM Cost (£/cadet)</Label><Input type="number" value={form.FSMCost} onChange={(e) => set('FSMCost', Number(e.target.value))} /></div>
            </div>
          </div>
          <div>
            <Label>Event Type</Label>
            <Select value={form.EventType} onValueChange={(v) => set('EventType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Activity Tags</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ACTIVITY_TAGS.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(form.ActivityTags || []).includes(tag) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>{tag}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Bus className="w-4 h-4" />Transport</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Transport Mode</Label>
            <Select value={form.TransportMode} onValueChange={(v) => set('TransportMode', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Coach">Coach</SelectItem><SelectItem value="Own Transport">Own Transport</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="text-xs font-semibold text-muted-foreground uppercase">Outbound</div>
          <div><Label>Departure Location</Label><Input value={form.OutboundDepartureLocation} onChange={(e) => set('OutboundDepartureLocation', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Departure Date/Time</Label><Input type="datetime-local" value={form.OutboundDateTime} max={form.OutboundLatestArrival || undefined} onChange={(e) => set('OutboundDateTime', e.target.value)} /></div>
            <div><Label>Latest Arrival (Loading)</Label><Input type="datetime-local" value={form.OutboundLatestArrival} min={form.OutboundDateTime || undefined} onChange={(e) => set('OutboundLatestArrival', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dress State</Label>
              <Select value={form.TransportDressState} onValueChange={(v) => set('TransportDressState', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRANSPORT_DRESS_STATES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.TransportDressState === 'Other' && <div><Label>Dress (Other)</Label><Input value={form.TransportDressOther} onChange={(e) => set('TransportDressOther', e.target.value)} /></div>}
          </div>
          {form.TransportMode === 'Coach' && <div><Label>Coach Officer</Label><Input value={form.CoachOfficer} onChange={(e) => set('CoachOfficer', e.target.value)} /></div>}
          <div className="text-xs font-semibold text-muted-foreground uppercase">Inbound</div>
          <div><Label>Arrival Location</Label><Input value={form.InboundArrivalLocation} onChange={(e) => set('InboundArrivalLocation', e.target.value)} /></div>
          <div><Label>Arrival Date/Time</Label><Input type="datetime-local" value={form.InboundDateTime} min={form.OutboundDateTime || undefined} onChange={(e) => set('InboundDateTime', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" />Feeding</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={form.FeedingProvided} onCheckedChange={(v) => set('FeedingProvided', v)} id="feeding" />
            <Label htmlFor="feeding">Feeding Provided</Label>
          </div>
          {!form.FeedingProvided && (
            <div className="space-y-2 pl-6">
              {[['RequiresBreakfastPrior', 'Breakfast (prior to arrival)'], ['RequiresBreakfast', 'Breakfast'], ['RequiresPackedLunch', 'Packed Lunch'], ['RequiresEveningMeal', 'Evening Meal']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox checked={form[key]} onCheckedChange={(v) => set(key, v)} id={key} />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Tent className="w-4 h-4" />Accommodation & Laundry</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={form.AccommodationProvided} onCheckedChange={(v) => set('AccommodationProvided', v)} id="accom" />
            <Label htmlFor="accom">Accommodation Provided</Label>
          </div>
          {form.AccommodationProvided && (
            <div className="pl-6 space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.AccommodationType} onValueChange={(v) => set('AccommodationType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Building">Building</SelectItem><SelectItem value="Tented">Tented</SelectItem><SelectItem value="Both">Both</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.OwnSleepingEquipment} onCheckedChange={(v) => set('OwnSleepingEquipment', v)} id="sleep" />
                <Label htmlFor="sleep">Own Sleeping Equipment Required</Label>
              </div>
            </div>
          )}
          <div>
            <Label>Laundry Facilities</Label>
            <Select value={form.LaundryAvailable} onValueChange={(v) => set('LaundryAvailable', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="NA">N/A</SelectItem></SelectContent>
            </Select>
          </div>
          {form.LaundryAvailable === 'Yes' && <div><Label>Approximate Cost (£)</Label><Input type="number" value={form.LaundryCost} onChange={(e) => set('LaundryCost', Number(e.target.value))} /></div>}
          {form.LaundryAvailable === 'No' && <p className="text-xs text-amber-600 bg-amber-500/10 rounded p-2">Enough clothing to cover the duration of the event is required.</p>}
        </CardContent>
      </Card>

      <div className="fixed bottom-4 right-4 z-10">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="shadow-lg">
          <Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? 'Saving...' : 'Save Details'}
        </Button>
      </div>
    </div>
  );
}