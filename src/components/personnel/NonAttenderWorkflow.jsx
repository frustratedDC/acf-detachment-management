import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { key: 'outreach', label: 'Send Outreach Email' },
  { key: 'followup', label: 'Log Follow-Up' },
  { key: 'response', label: 'Response Received' },
];

export default function NonAttenderWorkflow({ person, onUpdated }) {
  const workflow = person.NonAttenderWorkflow || {};
  const [saving, setSaving] = useState(null);

  async function toggleStep(key) {
    if (workflow[key]) return; // already done, don't un-do
    setSaving(key);
    const updated = {
      ...workflow,
      [key]: new Date().toISOString(),
    };
    await base44.entities.PersonnelManager.update(person.id, { NonAttenderWorkflow: updated });
    toast.success(`"${STEPS.find(s => s.key === key)?.label}" logged`);
    setSaving(null);
    onUpdated?.();
  }

  const completedCount = STEPS.filter(s => workflow[s.key]).length;
  const allComplete = completedCount === STEPS.length;

  async function handleResolved() {
    setSaving('resolved');
    await base44.entities.PersonnelManager.update(person.id, {
      PersonnelStatus: 'Active',
      NonAttenderWorkflow: {},
    });
    toast.success(`${person.Surname} returned to Active status`);
    setSaving(null);
    onUpdated?.();
  }

  return (
    <Card className="border-amber-400/30 bg-amber-50/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Non-Attender Tracking — {person.Rank} {person.FirstName} {person.Surname}
          <Badge variant="outline" className="ml-auto text-xs border-amber-400/50 text-amber-600">
            {completedCount}/{STEPS.length} Steps
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {allComplete && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 flex-1 font-medium">All outreach steps complete — response received.</span>
            <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/40 text-green-700 hover:bg-green-50" onClick={handleResolved} disabled={saving === 'resolved'}>
              {saving === 'resolved' ? 'Saving...' : 'Mark Resolved'}
            </Button>
          </div>
        )}
        {STEPS.map(step => {
          const done = !!workflow[step.key];
          const ts = workflow[step.key];
          return (
            <label
              key={step.key}
              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${done ? 'bg-amber-100/50' : 'hover:bg-muted/40'}`}
              onClick={() => !done && toggleStep(step.key)}
            >
              <Checkbox
                checked={done}
                disabled={saving === step.key || done}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{step.label}</p>
                {ts && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(ts).toLocaleString('en-GB')}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}