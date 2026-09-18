import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { KIT_CATEGORIES } from '@/lib/eventConstants';

export default function EventKitSection({ event }) {
  const queryClient = useQueryClient();
  const [included, setIncluded] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  const { data: kitItems = [] } = useQuery({
    queryKey: ['event-kit-items', event.id],
    queryFn: () => base44.entities.EventKitItem.filter({ EventID: event.id }),
  });

  useEffect(() => {
    const inc = {};
    const sel = {};
    kitItems.forEach((ki) => {
      inc[ki.CategoryNumber] = ki.Included;
      sel[ki.CategoryNumber] = ki.SelectedItems || [];
    });
    KIT_CATEGORIES.forEach((cat) => {
      if (!(cat.number in inc)) {
        inc[cat.number] = true;
        sel[cat.number] = cat.items.slice();
      }
    });
    setIncluded(inc);
    setSelectedItems(sel);
  }, [kitItems]);

  const uniformMultiplier = event.TransportDressState === 'CIV' ? 2 : 1;

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const ki of kitItems) {
        await base44.entities.EventKitItem.delete(ki.id);
      }
      const records = KIT_CATEGORIES.map((cat) => ({
        EventID: event.id,
        CategoryNumber: cat.number,
        CategoryName: cat.name,
        Included: included[cat.number] ?? false,
        SelectedItems: selectedItems[cat.number] || [],
        Disclaimer: cat.disclaimer,
        UniformMultiplier: cat.number === 1 ? uniformMultiplier : 1,
        DetachmentID: event.DetachmentID,
      }));
      await base44.entities.EventKitItem.bulkCreate(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-kit-items', event.id] });
      toast.success('Kit list saved');
    },
  });

  function toggleItem(catNum, item) {
    setSelectedItems((prev) => {
      const items = prev[catNum] || [];
      return { ...prev, [catNum]: items.includes(item) ? items.filter((i) => i !== item) : [...items, item] };
    });
  }
  function toggleCategory(catNum) {
    setIncluded((prev) => ({ ...prev, [catNum]: !prev[catNum] }));
  }

  return (
    <div className="space-y-4 pb-20">
      {event.TransportDressState && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 text-sm">
            <span className="font-semibold">Uniform Auto-Calc:</span> Transport dress state is <Badge className="ml-1">{event.TransportDressState}</Badge> → {uniformMultiplier}x issued uniform per cadet.
          </CardContent>
        </Card>
      )}
      {KIT_CATEGORIES.map((cat) => (
        <Card key={cat.number} className={!included[cat.number] ? 'opacity-60' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Checkbox checked={included[cat.number] ?? false} onCheckedChange={() => toggleCategory(cat.number)} id={`cat-${cat.number}`} />
              <CardTitle className="text-sm flex-1">{cat.number}. {cat.name}</CardTitle>
              {cat.multiQuantityItems.length > 0 && <Badge variant="outline" className="text-xs">Multi-qty items</Badge>}
            </div>
          </CardHeader>
          {included[cat.number] && (
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground italic">{cat.disclaimer}</p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((item) => {
                  const isSelected = (selectedItems[cat.number] || []).includes(item);
                  const isMulti = cat.multiQuantityItems.includes(item);
                  return (
                    <button key={item} type="button" onClick={() => toggleItem(cat.number, item)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'} ${isMulti ? 'ring-1 ring-accent/40' : ''}`}>
                      {item}{isMulti && cat.number === 1 ? ` ×${uniformMultiplier}` : ''}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
      <div className="fixed bottom-4 right-4 z-10">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="shadow-lg">
          <Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? 'Saving...' : 'Save Kit List'}
        </Button>
      </div>
    </div>
  );
}