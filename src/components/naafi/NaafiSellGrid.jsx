import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';

export default function NaafiSellGrid({ items, onSell }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No items in stock yet — add some below.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map(item => {
        const outOfStock = item.QuantityInStock <= 0;
        const lowStock = !outOfStock && item.QuantityInStock <= (item.LowStockThreshold ?? 5);
        return (
          <Card
            key={item.id}
            className={`transition-colors ${outOfStock ? 'opacity-50' : 'hover:border-primary cursor-pointer'}`}
            onClick={() => !outOfStock && onSell(item)}
          >
            <CardContent className="p-3 text-center">
              <ShoppingCart className="w-5 h-5 mx-auto mb-1.5 text-primary" />
              <p className="text-sm font-semibold truncate">{item.ItemName}</p>
              <p className="text-xs text-muted-foreground mb-1.5">£{item.Price?.toFixed(2)}</p>
              <Badge variant={outOfStock ? 'destructive' : lowStock ? 'outline' : 'secondary'} className={lowStock ? 'border-amber-400 text-amber-700 text-xs' : 'text-xs'}>
                {outOfStock ? 'Out of stock' : `${item.QuantityInStock} left`}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}