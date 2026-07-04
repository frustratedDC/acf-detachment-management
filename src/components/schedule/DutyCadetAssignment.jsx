import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Save } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['Duty NCO', 'NAAFI NCO', 'NAAFI Cadet'];
const CE_HOURS_PER_DUTY = 0.25; // 15 minutes

export default function DutyCadetAssignment({ date }) {
  const queryClient = useQueryClient();
  const { personnel } = usePersonnel();
  const [selections, setSelections] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: cadets = [] } = useQuery({
    queryKey: ['duty-cadets'],
    queryFn: async () => {
      const all = await base44.entities.PersonnelManager.filter({ Type: 'Cadet' });
      return all.filter(p => (p.PersonnelStatus || 'Active') === 'Active');
    },
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ['duty-assignments', date],
    queryFn: () => base44.entities.DutyAssignment.filter({ Date: date }),
  });

  useEffect(() => {
    const map = {};
    ROLES.forEach(role => {
      const existing = existingAssignments.find(a => a.Role === role);
      map[role] = existing?.CadetPNumber || '';
    });
    setSelections(map);
  }, [existingAssignments]);

  function updateSelection(role, value) {
    setSelections(prev => ({ ...prev, [role]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const role of ROLES) {
        const existing = existingAssignments.find(a => a.Role === role);
        const selectedCadet = selections[role];

        if (existing && existing.CadetPNumber === selectedCadet) continue; // no change

        if (existing) await base44.entities.DutyAssignment.delete(existing.id);

        if (selectedCadet) {
          await base44.entities.DutyAssignment.create({ Date: date, Role: role, CadetPNumber: selectedCadet, CEAwarded: false });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['duty-assignments', date] });
      toast.success('Duty cadets saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 border-accent/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Duty Cadets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ROLES.map(role => (
            <div key={role}>
              <Label className="text-xs">{role}</Label>
              <Select value={selections[role] || ''} onValueChange={(val) => updateSelection(role, val)}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select cadet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {cadets.map(c => (
                    <SelectItem key={c.PNumber} value={c.PNumber}>{c.Rank ? `${c.Rank} ` : ''}{c.FirstName} {c.Surname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Each assigned duty cadet earns 15 minutes of Community Engagement time, submitted for DC approval after final parade (2100hrs).</p>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Duty Cadets'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}