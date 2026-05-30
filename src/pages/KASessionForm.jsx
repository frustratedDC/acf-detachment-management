import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess } from '@/lib/accessLevels';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Dumbbell, Save } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

export default function KASessionForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;

  const [form, setForm] = useState({
    Date: today(),
    Name: '',
    Det: personnel?.Det || '',
    Duration_Minutes: '',
    BJ1: '', BJ2: '', BJ3: '',
    Squats: '', PressUps: '', Shuttle: '', MSFT: '',
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.list(),
  });

  const cadets = allPersonnel.filter(p => p.Type === 'Cadet' && p.PersonnelStatus === 'Active');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KA_Session.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ka-sessions'] });
      toast.success('KA session created');
      navigate('/ka-sessions');
    },
    onError: (e) => toast.error(e.message),
  });

  const handleChange = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.Name || !form.Det || !form.Duration_Minutes) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload = {
      Date: form.Date,
      Name: form.Name,
      Det: form.Det,
      Duration_Minutes: Number(form.Duration_Minutes),
      Session_Status: 'Open',
    };
    ['BJ1','BJ2','BJ3','Squats','PressUps','Shuttle','MSFT'].forEach(k => {
      if (form[k] !== '') payload[k] = Number(form[k]);
    });
    createMutation.mutate(payload);
  };

  const numField = (label, key, hint) => (
    <div>
      <Label className="text-sm font-medium">{label}{hint && <span className="ml-1 text-xs text-muted-foreground">({hint})</span>}</Label>
      <Input type="number" value={form[key]} onChange={e => handleChange(key, e.target.value)} className="mt-1" placeholder="—" />
    </div>
  );

  return (
    <AccessGate level={2}>
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader title="New KA Session" description="Record a Keeping Active session" icon={Dumbbell} />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core */}
          <Card>
            <CardHeader><CardTitle className="text-base">Session Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input type="date" value={form.Date} onChange={e => handleChange('Date', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Duration (minutes) *</Label>
                <Input type="number" value={form.Duration_Minutes} onChange={e => handleChange('Duration_Minutes', e.target.value)} className="mt-1" placeholder="e.g. 60" />
              </div>
              <div>
                <Label>Cadet Name *</Label>
                {cadets.length > 0 ? (
                  <Select value={form.Name} onValueChange={v => handleChange('Name', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select cadet…" /></SelectTrigger>
                    <SelectContent>
                      {cadets.map(c => (
                        <SelectItem key={c.PNumber} value={c.PNumber}>{c.Rank} {c.FirstName} {c.Surname}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.Name} onChange={e => handleChange('Name', e.target.value)} className="mt-1" placeholder="PNumber or name" />
                )}
              </div>
              <div>
                <Label>Detachment *</Label>
                <Input value={form.Det} onChange={e => handleChange('Det', e.target.value)} className="mt-1" placeholder="e.g. 1234 Det" />
              </div>
            </CardContent>
          </Card>

          {/* Broad Jump */}
          <Card>
            <CardHeader><CardTitle className="text-base">Broad Jump (cm)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              {numField('Attempt 1', 'BJ1')}
              {numField('Attempt 2', 'BJ2')}
              {numField('Attempt 3', 'BJ3')}
            </CardContent>
          </Card>

          {/* Other Activities */}
          <Card>
            <CardHeader><CardTitle className="text-base">Other Activities</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {numField('Squats', 'Squats', 'count')}
              {numField('Press Ups', 'PressUps', 'count')}
              {numField('Shuttle Run', 'Shuttle', 'seconds – lower is better')}
              {numField('MSFT', 'MSFT', 'level')}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/ka-sessions')}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Saving…' : 'Save Session'}
            </Button>
          </div>
        </form>
      </div>
    </AccessGate>
  );
}