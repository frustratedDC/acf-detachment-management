import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function NaafiStockForm({ item, open, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    ItemName: '', Category: 'Snack', Price: '', QuantityInStock: '', LowStockThreshold: 5,
  });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    onSave({
      ...form,
      Price: parseFloat(form.Price) || 0,
      QuantityInStock: parseInt(form.QuantityInStock) || 0,
      LowStockThreshold: parseInt(form.LowStockThreshold) || 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Item Name</Label>
            <Input value={form.ItemName} onChange={e => update('ItemName', e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.Category} onValueChange={v => update('Category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Drink">Drink</SelectItem>
                <SelectItem value="Snack">Snack</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price (£)</Label>
              <Input type="number" step="0.01" value={form.Price} onChange={e => update('Price', e.target.value)} />
            </div>
            <div>
              <Label>Quantity in Stock</Label>
              <Input type="number" value={form.QuantityInStock} onChange={e => update('QuantityInStock', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Low Stock Threshold</Label>
            <Input type="number" value={form.LowStockThreshold} onChange={e => update('LowStockThreshold', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.ItemName || !form.Price}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}