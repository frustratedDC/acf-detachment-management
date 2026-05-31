import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shirt } from 'lucide-react';
import { format } from 'date-fns';

export default function MyInspections() {
  const { personnel } = usePersonnel();

  const { data: myInspections = [] } = useQuery({
    queryKey: ['inspections-mine', personnel?.PNumber],
    queryFn: () =>
      personnel?.PNumber
        ? base44.entities.UniformInspection.filter({ PNumber: personnel.PNumber })
        : Promise.resolve([]),
    enabled: !!personnel?.PNumber,
  });

  const sorted = [...myInspections].sort((a, b) => new Date(b.Date) - new Date(a.Date)).slice(0, 5);

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shirt className="w-4 h-4 text-primary" />
            My Inspections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-3">No inspections yet.</p>
        </CardContent>
      </Card>
    );
  }

  const avgScore = sorted.reduce((sum, i) => sum + (i.TotalScore || 0), 0) / sorted.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shirt className="w-4 h-4 text-primary" />
            My Inspections
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Avg: {avgScore.toFixed(1)}/30
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map(insp => (
            <div key={insp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm font-medium">{format(new Date(insp.Date), 'dd MMMM yyyy')}</p>
                <p className="text-xs text-muted-foreground">
                  {insp.InspectedByPNumber || 'Inspector'}
                </p>
              </div>
              <Badge className="bg-primary/10 text-primary border-0">
                {insp.TotalScore}/30
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}