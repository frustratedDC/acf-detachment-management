import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { DetachmentName: '', DCRank: '', DCFirstName: '', DCSurname: '', DCPNumber: '', DCEmail: '' };

export default function TenantsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const { data: detachments = [] } = useQuery({
    queryKey: ['detachments'],
    queryFn: () => base44.entities.Detachment.list(),
  });

  function slugify(name) {
    const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `${base}_${Date.now().toString(36).toUpperCase()}`;
  }

  async function handleCreate() {
    if (!form.DetachmentName || !form.DCSurname || !form.DCPNumber || !form.DCEmail) {
      toast.error('Please fill in detachment name, DC PNumber, surname and email');
      return;
    }
    setCreating(true);
    try {
      const detachmentId = slugify(form.DetachmentName);
      const user = await base44.auth.me();

      await base44.entities.Detachment.create({
        DetachmentID: detachmentId,
        Name: form.DetachmentName,
        CreatedByEmail: user?.email,
      });

      await base44.entities.PersonnelManager.create({
        PNumber: form.DCPNumber,
        Rank: form.DCRank,
        FirstName: form.DCFirstName,
        Surname: form.DCSurname,
        Type: 'Adult Instructor',
        AccessLevel: 5,
        RoleName: 'Detachment Commander',
        CurrentStarLevel: 'Adult',
        PersonnelStatus: 'Active',
        IsLinked: true,
        LinkedEmailUID: form.DCEmail,
        DetachmentID: detachmentId,
      });

      await base44.users.inviteUser(form.DCEmail, 'user');

      queryClient.invalidateQueries({ queryKey: ['detachments'] });
      toast.success(`${form.DetachmentName} created and invite sent to ${form.DCEmail}`);
      setForm(emptyForm);
    } catch (e) {
      toast.error(`Failed to create tenant: ${e.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Building2 className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">Provision a new detachment tenant and invite its Detachment Commander. Their account is pre-set to L5 and scoped to their own DetachmentID — they start with a blank roster.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4 text-accent" />New Detachment</CardTitle>
          <CardDescription>Creates the tenant and invites the Detachment Commander in one step.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Detachment Name</Label>
            <Input value={form.DetachmentName} onChange={e => setForm(p => ({ ...p, DetachmentName: e.target.value }))} placeholder="e.g. 456 (Town) Sqn ACF" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>DC Rank</Label>
              <Input value={form.DCRank} onChange={e => setForm(p => ({ ...p, DCRank: e.target.value }))} placeholder="e.g. Capt" />
            </div>
            <div>
              <Label>DC PNumber</Label>
              <Input value={form.DCPNumber} onChange={e => setForm(p => ({ ...p, DCPNumber: e.target.value }))} />
            </div>
            <div>
              <Label>DC First Name</Label>
              <Input value={form.DCFirstName} onChange={e => setForm(p => ({ ...p, DCFirstName: e.target.value }))} />
            </div>
            <div>
              <Label>DC Surname</Label>
              <Input value={form.DCSurname} onChange={e => setForm(p => ({ ...p, DCSurname: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>DC Email</Label>
            <Input type="email" value={form.DCEmail} onChange={e => setForm(p => ({ ...p, DCEmail: e.target.value }))} placeholder="dc@example.com" />
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={creating}>
            {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Tenant & Invite DC'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing Detachments ({detachments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {detachments.map(d => (
            <div key={d.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/40">
              <span className="text-sm font-medium">{d.Name}</span>
              <Badge variant="outline" className="text-xs font-mono">{d.DetachmentID}</Badge>
            </div>
          ))}
          {detachments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No detachments yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}