import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { HeartHandshake, Loader2, Check, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const ACTIVITY_TYPES = [
  'Volunteering',
  'Fundraising',
  'Environmental',
  'Community Support',
  'Event Support',
  'Other',
];

export default function BulkCEEntry() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  const [selectedPNumbers, setSelectedPNumbers] = useState(new Set());
  const [hours, setHours] = useState('');
  const [activityType, setActivityType] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const cadets = useMemo(() =>
    allPersonnel
      .filter(p => p.Type === 'Cadet' && (p.PersonnelStatus || 'Active') === 'Active')
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          p.Surname?.toLowerCase().includes(q) ||
          p.FirstName?.toLowerCase().includes(q) ||
          p.PNumber?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.Surname.localeCompare(b.Surname)),
    [allPersonnel, search]
  );

  const toggleCadet = (pNumber) => {
    setSelectedPNumbers(prev => {
      const next = new Set(prev);
      next.has(pNumber) ? next.delete(pNumber) : next.add(pNumber);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPNumbers.size === cadets.length) {
      setSelectedPNumbers(new Set());
    } else {
      setSelectedPNumbers(new Set(cadets.map(c => c.PNumber)));
    }
  };

  const bulkCEMutation = useMutation({
    mutationFn: async () => {
      const hoursNum = parseFloat(hours);
      if (!hoursNum || hoursNum <= 0) throw new Error('Invalid hours');
      if (!activityType) throw new Error('Please select an activity type');
      if (selectedPNumbers.size === 0) throw new Error('No cadets selected');

      const selectedCadets = allPersonnel.filter(p => selectedPNumbers.has(p.PNumber));

      // Dual-action: for each cadet, create CE record AND increment CEHours on PersonnelManager
      await Promise.all(selectedCadets.map(async (cadet) => {
        // Action 1: Create CommunityEngagementLedger record (Status: Pending — routed to Task List for approval)
        await base44.entities.CommunityEngagementLedger.create({
          CadetPNumber: cadet.PNumber,
          CadetName: [cadet.Rank, cadet.FirstName, cadet.Surname].filter(Boolean).join(' '),
          Hours: hoursNum,
          ActivityType: activityType,
          Description: description || activityType,
          Date: date,
          Status: 'Pending',
        });

        // Action 2: Increment CEHours on PersonnelManager — only if field exists on record
        const currentCEHours = typeof cadet.CEHours === 'number' ? cadet.CEHours : 0;
        await base44.entities.PersonnelManager.update(cadet.id, {
          CEHours: currentCEHours + hoursNum,
        });
      }));
    },
    onSuccess: () => {
      toast.success(`CE entry submitted for ${selectedPNumbers.size} cadet(s) — pending approval.`);
      setSelectedPNumbers(new Set());
      setHours('');
      setActivityType('');
      setDescription('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      queryClient.invalidateQueries({ queryKey: ['ce-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to submit CE entries'),
  });

  const isValid = selectedPNumbers.size > 0 && parseFloat(hours) > 0 && activityType;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-primary" />
          Bulk CE Entry
        </CardTitle>
        <CardDescription>
          Select cadets, enter hours and activity type. Records are created as Pending and routed to the Task List for approval. CEHours on each cadet profile is incremented immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Step 1: Activity details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Hours <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              placeholder="e.g. 2.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Activity Type <span className="text-destructive">*</span></Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Description (optional)</Label>
          <Input
            placeholder="Brief description of the activity…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Step 2: Cadet selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Select Cadets
              {selectedPNumbers.size > 0 && (
                <Badge className="text-xs">{selectedPNumbers.size} selected</Badge>
              )}
            </Label>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
              {selectedPNumbers.size === cadets.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <Input
            placeholder="Search by name or PNumber…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {cadets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No cadets found.</p>
            ) : cadets.map(cadet => (
              <label
                key={cadet.PNumber}
                className="flex items-center gap-3 p-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedPNumbers.has(cadet.PNumber)}
                  onCheckedChange={() => toggleCadet(cadet.PNumber)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {cadet.Rank ? `${cadet.Rank} ` : ''}{cadet.Surname}{cadet.FirstName ? `, ${cadet.FirstName}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">{cadet.PNumber} · {cadet.CurrentStarLevel}</p>
                </div>
                {typeof cadet.CEHours === 'number' && (
                  <span className="text-xs text-muted-foreground shrink-0">{cadet.CEHours}h CE</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Validation hint */}
        {!isValid && selectedPNumbers.size > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Please enter hours and select an activity type to continue.</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => bulkCEMutation.mutate()}
            disabled={!isValid || bulkCEMutation.isPending}
          >
            {bulkCEMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              <><Check className="w-4 h-4 mr-2" />Submit for {selectedPNumbers.size || 0} Cadet(s)</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}