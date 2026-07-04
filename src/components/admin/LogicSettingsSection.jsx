import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

export default function LogicSettingsSection({ title, description, icon, fields, settingsMap, onSave }) {
  const Icon = icon;
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial = {};
    fields.forEach(f => {
      initial[f.key] = settingsMap[f.key] !== undefined ? settingsMap[f.key] : f.default;
    });
    setValues(initial);
  }, [settingsMap, fields]);

  async function handleSave() {
    setSaving(true);
    await onSave(fields.map(f => ({ key: f.key, value: String(values[f.key] ?? ''), description: f.description })));
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type || 'number'}
                value={values[f.key] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1"
              />
              {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Section
        </Button>
      </CardContent>
    </Card>
  );
}