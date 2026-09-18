import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EventEquipmentSection({ event }) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState({ ItemName: '', Quantity: 1, Size: '', Source: 'CQMS Provided' });

  const { data: equipment = [] } = useQuery({
    queryKey: ['event-equipment', event.id],
    queryFn: () => base44.entities.EventEquipment.filter({ EventID: event.id }),
  });

  const addMutation = useMutation({
    mutationFn: () => base44.entities.EventEquipment.create({ ...newItem, EventID: event.id, DetachmentID: event.DetachmentID }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-equipment', event.id] });
      setNewItem({ ItemName: '', Quantity: 1, Size: '', Source: 'CQMS Provided' });
      toast.success('Equipment added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventEquipment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-equipment', event.id] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-4"><Label className="text-xs">Item</Label><Input value={newItem.ItemName} onChange={(e) => setNewItem({ ...newItem, ItemName: e.target.value })} placeholder="e.g. Rifles" /></div>
            <div className="col-span-4 sm:col-span-2"><Label className="text-xs">Qty</Label><Input type="number" value={newItem.Quantity} onChange={(e) => setNewItem({ ...newItem, Quantity: Number(e.target.value) })} /></div>
            <div className="col-span-4 sm:col-span-2"><Label className="text-xs">Size</Label><Input value={newItem.Size} onChange={(e) => setNewItem({ ...newItem, Size: e.target.value })} placeholder="N/A" /></div>
            <div className="col-span-4 sm:col-span-3">
              <Label className="text-xs">Source</Label>
              <Select value={newItem.Source} onValueChange={(v) => setNewItem({ ...newItem, Source: v })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="CQMS Provided">CQMS Provided</SelectItem><SelectItem value="Own Provision">Own Provision</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-1"><Button size="sm" onClick={() => addMutation.mutate()} disabled={!newItem.ItemName} className="w-full"><Plus className="w-4 h-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {equipment.map((eq) => (
          <Card key={eq.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{eq.ItemName}</span>
                <span className="text-xs text-muted-foreground ml-2">×{eq.Quantity}{eq.Size && ` · ${eq.Size}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${eq.Source === 'CQMS Provided' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{eq.Source}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(eq.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {equipment.length === 0 && <p className="text-center py-8 text-sm text-muted-foreground">No equipment added yet.</p>}
      </div>
    </div>
  );
}