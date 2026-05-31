import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { UserX, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { key: 'outreach', label: 'Send Outreach Email' },
  { key: 'followup', label: 'Log Follow-Up' },
  { key: 'response', label: 'Response Received' },
];

export default function NonAttenderTracker({ person, onUpdate }) {
  const tracking = person.NonAttenderTracking || {};
  const [saving, setSaving] = useState(null);

  async function handleCheck(stepKey, checked) {
    setSaving(stepKey);
    const updated = {
      ...tracking,
      [stepKey]: checked ? new Date().toISOString() : null,
    };
    await base44.entities.PersonnelManager.update(person.id, {
      NonAttenderTracking: updated,
    });
    onUpdate();
    toast.success(checked ? `"${STEPS.find(s => s.key === stepKey)?.label}" marked complete` : 'Step unchecked');
    setSaving(null);
  }

  return (
    <Card className="border-amber-300/50 bg-amber-50/20 mt-2">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-semibold flex items-center gap-2 text-amber-700">
          <UserX className="w-3.5 h-3.5" />
          Non-Attender Outreach Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {STEPS.map(step => {
          const ts = tracking[step.key];
          const isChecked = !!ts;
          return (
            <div key={step.key} className="flex items-start gap-2.5">
              <Checkbox
                checked={isChecked}
                disabled={saving === step.key}
                onCheckedChange={(v) => handleCheck(step.key, v)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                  {step.label}
                </p>
                {ts && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              {isChecked && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 h-4 px-1.5">Done</Badge>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}