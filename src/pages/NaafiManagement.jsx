import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import NaafiSellGrid from '@/components/naafi/NaafiSellGrid';
import NaafiSalesLog from '@/components/naafi/NaafiSalesLog';
import NaafiStockForm from '@/components/naafi/NaafiStockForm';
import { ShoppingBag, Plus, Pencil, Trash2, PoundSterling } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { usePersonnel } from '@/lib/usePersonnel';
import { format } from 'date-fns';

export default function NaafiManagement() {
  const queryClient = useQueryClient();
  const { personnel } = usePersonnel();
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { data: stock = [] } = useQuery({
    queryKey: ['naafi-stock'],
    queryFn: () => base44.entities.NafiiStock.filter({}),
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['naafi-sales'],
    queryFn: () => base44.entities.NafiiSale.list('-created_date', 50),
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysSales = sales.filter(s => s.SaleDate === todayStr);
  const todaysTotal = todaysSales.reduce((sum, s) => sum + (s.TotalAmount || 0), 0);

  async function handleSaveItem(data) {
    if (editingItem) {
      await base44.entities.NafiiStock.update(editingItem.id, data);
    } else {
      await base44.entities.NafiiStock.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['naafi-stock'] });
    setFormOpen(false);
    setEditingItem(null);
  }

  async function handleDeleteItem(item) {
    await base44.entities.NafiiStock.delete(item.id);
    queryClient.invalidateQueries({ queryKey: ['naafi-stock'] });
  }

  async function handleSell(item) {
    await base44.entities.NafiiSale.create({
      ItemId: item.id,
      ItemName: item.ItemName,
      Quantity: 1,
      UnitPrice: item.Price,
      TotalAmount: item.Price,
      SoldByPNumber: personnel?.PNumber || '',
      SaleDate: format(new Date(), 'yyyy-MM-dd'),
    });
    await base44.entities.NafiiStock.update(item.id, { QuantityInStock: Math.max(0, item.QuantityInStock - 1) });
    queryClient.invalidateQueries({ queryKey: ['naafi-stock'] });
    queryClient.invalidateQueries({ queryKey: ['naafi-sales'] });
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="NAAFI Management"
        description="Sell items, manage stock levels, and track NAAFI sales"
        icon={ShoppingBag}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><PoundSterling className="w-3 h-3" />Today's Sales</p>
            <p className="text-2xl font-bold">£{todaysTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Items Sold Today</p>
            <p className="text-2xl font-bold">{todaysSales.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Stock Items</p>
            <p className="text-2xl font-bold">{stock.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sell">
        <TabsList>
          <TabsTrigger value="sell">Sell</TabsTrigger>
          <TabsTrigger value="stock">Manage Stock</TabsTrigger>
          <TabsTrigger value="sales">Sales Log</TabsTrigger>
        </TabsList>

        <TabsContent value="sell" className="mt-4">
          <NaafiSellGrid items={stock} onSell={handleSell} />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => { setEditingItem(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {stock.map(item => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.ItemName}</p>
                    <p className="text-xs text-muted-foreground">{item.Category} · £{item.Price?.toFixed(2)} · {item.QuantityInStock} in stock</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setFormOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {stock.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No stock items yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <NaafiSalesLog sales={sales} />
        </TabsContent>
      </Tabs>

      {formOpen && (
        <NaafiStockForm
          item={editingItem}
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}
    </AccessGate>
  );
}