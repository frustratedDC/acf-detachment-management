import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dumbbell, Save, Search, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const today = () => new Date().toISOString().split('T')[0];

// Per-cadet score entry row
function CadetScoreRow({ cadet, scores, onChange }) {
  const [expanded, setExpanded] = useState(false);

  const numInput = (key, placeholder) => (
    <Input
      type="number"
      className="h-8 text-sm"
      placeholder={placeholder || '—'}
      value={scores[key] ?? ''}
      onChange={e => onChange(cadet.PNumber, key, e.target.value)}
    />
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1">
          <p className="text-sm font-medium">{cadet.Rank} {cadet.FirstName} {cadet.Surname}</p>
          <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
        </div>
        <Badge variant="outline" className="text-xs">{cadet.CurrentStarLevel}</Badge>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">BJ Attempt 1 (cm)</Label>
            {numInput('BJ1')}
          </div>
          <div>
            <Label className="text-xs">BJ Attempt 2 (cm)</Label>
            {numInput('BJ2')}
          </div>
          <div>
            <Label className="text-xs">BJ Attempt 3 (cm)</Label>
            {numInput('BJ3')}
          </div>
          <div>
            <Label className="text-xs">Squats</Label>
            {numInput('Squats')}
          </div>
          <div>
            <Label className="text-xs">Press Ups</Label>
            {numInput('PressUps')}
          </div>
          <div>
            <Label className="text-xs">Shuttle (secs)</Label>
            {numInput('Shuttle')}
          </div>
          <div>
            <Label className="text-xs">MSFT (level)</Label>
            {numInput('MSFT')}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KASessionForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { personnel } = usePersonnel();

  const [date, setDate] = useState(today());
  const [det, setDet] = useState(personnel?.Det || '');
  const [duration, setDuration] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCadets, setSelectedCadets] = useState([]);
  // cadetScores: { [PNumber]: { BJ1, BJ2, ... } }
  const [cadetScores, setCadetScores] = useState({});

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const cadets = allPersonnel.filter(p => p.Type === 'Cadet' && p.PersonnelStatus === 'Active');

  const filteredCadets = cadets.filter(c =>
    c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
    c.PNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const records = selectedCadets.map(pnum => {
        const scores = cadetScores[pnum] || {};
        const payload = {
          Date: date,
          Name: pnum,
          Det: det,
          Duration_Minutes: Number(duration),
          Session_Status: 'Open',
        };
        ['BJ1','BJ2','BJ3','Squats','PressUps','Shuttle','MSFT'].forEach(k => {
          if (scores[k] !== undefined && scores[k] !== '') payload[k] = Number(scores[k]);
        });
        return payload;
      });
      await base44.entities.KA_Session.bulkCreate(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ka-sessions'] });
      toast.success(`${selectedCadets.length} KA session(s) created`);
      navigate('/ka-sessions');
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleCadet(pnum) {
    setSelectedCadets(prev =>
      prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]
    );
  }

  function handleScoreChange(pnum, key, val) {
    setCadetScores(prev => ({
      ...prev,
      [pnum]: { ...(prev[pnum] || {}), [key]: val },
    }));
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedCadets.length === 0) { toast.error('Select at least one cadet'); return; }
    if (!det || !duration) { toast.error('Please fill in Detachment and Duration'); return; }
    createMutation.mutate();
  };

  const selectedCadetObjects = cadets.filter(c => selectedCadets.includes(c.PNumber));

  return (
    <AccessGate level={2}>
      <div className="p-6 max-w-3xl mx-auto">
        <PageHeader title="New KA Session" description="Record Keeping Active sessions for multiple cadets" icon={Dumbbell} />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Details */}
          <Card>
            <CardHeader><CardTitle className="text-base">Session Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Duration (minutes) *</Label>
                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="mt-1" placeholder="e.g. 60" />
              </div>
              <div>
                <Label>Detachment *</Label>
                <Input value={det} onChange={e => setDet(e.target.value)} className="mt-1" placeholder="e.g. 1234 Det" />
              </div>
            </CardContent>
          </Card>

          {/* Cadet Selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select Cadets
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-44"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredCadets.map(cadet => (
                  <label
                    key={cadet.PNumber}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedCadets.includes(cadet.PNumber)}
                      onCheckedChange={() => toggleCadet(cadet.PNumber)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cadet.Rank} {cadet.FirstName} {cadet.Surname}</p>
                      <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{cadet.CurrentStarLevel}</Badge>
                  </label>
                ))}
                {filteredCadets.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground text-sm">No active cadets found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Per-Cadet Scores */}
          {selectedCadetObjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scores — {selectedCadetObjects.length} cadet(s) selected</CardTitle>
                <p className="text-xs text-muted-foreground">Expand each cadet to enter their individual scores (all optional)</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedCadetObjects.map(cadet => (
                  <CadetScoreRow
                    key={cadet.PNumber}
                    cadet={cadet}
                    scores={cadetScores[cadet.PNumber] || {}}
                    onChange={handleScoreChange}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/ka-sessions')}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || selectedCadets.length === 0}>
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Saving…' : `Save ${selectedCadets.length || ''} Session(s)`}
            </Button>
          </div>
        </form>
      </div>
    </AccessGate>
  );
}