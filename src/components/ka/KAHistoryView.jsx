import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Dumbbell, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function KAHistoryView({ pnum, promotionDate }) {
  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ['ka-logbook-history', pnum],
    queryFn: () => base44.entities.KA_LogBook.filter({ Name: pnum }),
    enabled: !!pnum,
  });

  const sorted = [...allEntries].sort((a, b) => (b.Date || '').localeCompare(a.Date || ''));

  const lifetimeTotal = allEntries.reduce((s, e) => s + (e.Points || 0), 0);
  const currentLevelTotal = allEntries
    .filter(e => !promotionDate || (e.Date && e.Date >= promotionDate))
    .reduce((s, e) => s + (e.Points || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Star className="w-3 h-3" />Current Level
            </p>
            <p className="text-2xl font-bold">{currentLevelTotal}</p>
            <p className="text-xs text-muted-foreground">pts since last promotion</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Trophy className="w-3 h-3" />Lifetime Total
            </p>
            <p className="text-2xl font-bold">{lifetimeTotal}</p>
            <p className="text-xs text-muted-foreground">pts all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Full logbook */}
      <Card>
        <CardContent className="p-2">
          {sorted.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No KA activity recorded yet.</p>
          ) : (
            <div className="divide-y">
              {sorted.map(entry => {
                const isCurrentLevel = !promotionDate || (entry.Date && entry.Date >= promotionDate);
                return (
                  <div key={entry.id} className="flex items-start justify-between py-3 px-2 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isCurrentLevel ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Dumbbell className={`w-4 h-4 ${isCurrentLevel ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{entry.Notes || 'KA Activity'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.Date ? format(parseISO(entry.Date), 'd MMM yyyy') : '—'}
                          {!isCurrentLevel && <span className="ml-1.5 text-muted-foreground/60">(previous level)</span>}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`shrink-0 ml-2 ${isCurrentLevel ? 'bg-primary/10 text-primary border-0' : 'bg-muted text-muted-foreground border-0'}`}
                    >
                      +{entry.Points || 0} pts
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}