import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Megaphone, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

const PRIORITY_BADGE = {
  Urgent: 'bg-destructive text-destructive-foreground',
  High: 'bg-accent text-accent-foreground',
  Normal: 'bg-primary/10 text-primary',
  Low: 'bg-muted text-muted-foreground',
};

const emptyForm = { Title: '', Body: '', Priority: 'Normal', ExpiryDate: '', IsActive: true };

export default function ImportantNotices() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: notices = [] } = useQuery({
    queryKey: ['all-notices'],
    queryFn: () => base44.entities.ImportantNotice.filter({}),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ImportantNotice.create({ ...data, PublishedByPNumber: me?.PNumber }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-notices'] }); queryClient.invalidateQueries({ queryKey: ['important-notices'] }); toast.success('Notice created'); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ImportantNotice.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-notices'] }); queryClient.invalidateQueries({ queryKey: ['important-notices'] }); toast.success('Notice updated'); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ImportantNotice.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['all-notices'] }); queryClient.invalidateQueries({ queryKey: ['important-notices'] }); toast.success('Notice deleted'); },
  });

  function openCreate() { setForm(emptyForm); setEditingRec(null); setDialogOpen(true); }
  function openEdit(n) { setForm({ Title: n.Title, Body: n.Body, Priority: n.Priority || 'Normal', ExpiryDate: n.ExpiryDate || '', IsActive: n.IsActive !== false }); setEditingRec(n); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditingRec(null); setForm(emptyForm); }

  function save() {
    if (!form.Title || !form.Body) return;
    if (editingRec) updateMutation.mutate({ id: editingRec.id, data: form });
    else createMutation.mutate(form);
  }

  const sorted = [...notices].sort((a, b) => {
    const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
    return (order[a.Priority] ?? 2) - (order[b.Priority] ?? 2);
  });

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Important Notices"
        description="Manage detachment-wide announcements"
        icon={Megaphone}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />New Notice
          </Button>
        }
      />

      <div className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">No notices yet. Create one above.</p>
        )}
        {sorted.map(n => (
          <Card key={n.id} className={!n.IsActive ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-sm">{n.Title}</p>
                    <Badge className={`text-xs ${PRIORITY_BADGE[n.Priority]}`}>{n.Priority}</Badge>
                    {!n.IsActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    {n.ExpiryDate && <span className="text-xs text-muted-foreground">Expires {format(parseISO(n.ExpiryDate), 'dd MMM yyyy')}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.Body}</p>
                  <p className="text-xs text-muted-foreground mt-1">Created {format(parseISO(n.created_date), 'dd MMM yyyy')}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(n)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(n.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRec ? 'Edit Notice' : 'New Notice'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Title</Label>
              <Input value={form.Title} onChange={e => setForm(p => ({ ...p, Title: e.target.value }))} className="mt-1" placeholder="Notice title" />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea value={form.Body} onChange={e => setForm(p => ({ ...p, Body: e.target.value }))} className="mt-1" rows={4} placeholder="Full notice content..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.Priority} onValueChange={v => setForm(p => ({ ...p, Priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Urgent', 'High', 'Normal', 'Low'].map(pr => <SelectItem key={pr} value={pr}>{pr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiry Date (optional)</Label>
                <Input type="date" value={form.ExpiryDate} onChange={e => setForm(p => ({ ...p, ExpiryDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.IsActive} onCheckedChange={v => setForm(p => ({ ...p, IsActive: v }))} />
              <Label>Active (visible on dashboard)</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={save} disabled={!form.Title || !form.Body}>{editingRec ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AccessGate>
  );
}