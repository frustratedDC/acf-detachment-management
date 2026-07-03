import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';

export default function NaafiSalesLog({ sales }) {
  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No sales recorded yet today.</p>;
  }

  return (
    <div className="space-y-1.5">
      {sales.map(sale => (
        <Card key={sale.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{sale.ItemName} × {sale.Quantity}</p>
              <p className="text-xs text-muted-foreground">
                {sale.created_date ? format(parseISO(sale.created_date), 'd MMM yyyy, HH:mm') : ''}
              </p>
            </div>
            <p className="text-sm font-bold">£{sale.TotalAmount?.toFixed(2)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}