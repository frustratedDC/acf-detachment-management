import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, ArrowRight, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import _ from 'lodash';

const STAR_COLORS = {
  'Basic': 'bg-emerald-100 text-emerald-700',
  '1 Star': 'bg-blue-100 text-blue-700',
  '2 Star': 'bg-purple-100 text-purple-700',
  '3 Star': 'bg-orange-100 text-orange-700',
  '4 Star': 'bg-red-100 text-red-700',
  'Admin': 'bg-slate-100 text-slate-700',
};

export default function TrainingOverview({ schedule, isLoading, range }) {
  const groupedByDate = _.groupBy(schedule, 'Date');
  const dates = Object.keys(groupedByDate).sort();

  const totalLessons = schedule.length;
  const starCoverage = _.uniq(schedule.map(s => s.AssignedStarLevel)).filter(Boolean);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Training Overview
          </CardTitle>
          <Link to="/schedule">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Open Plan <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(range.start), 'd MMM')} – {format(parseISO(range.end), 'd MMM yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-2xl font-bold text-foreground">{dates.length}</p>
            <p className="text-xs text-muted-foreground">Nights</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-2xl font-bold text-foreground">{totalLessons}</p>
            <p className="text-xs text-muted-foreground">Lessons</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-2xl font-bold text-foreground">{starCoverage.length}</p>
            <p className="text-xs text-muted-foreground">Star Levels</p>
          </div>
        </div>

        {/* Star coverage badges */}
        {starCoverage.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {starCoverage.sort().map(sl => (
              <Badge key={sl} className={`text-xs ${STAR_COLORS[sl] || 'bg-muted'}`}>{sl}</Badge>
            ))}
          </div>
        )}

        {/* Night list */}
        {dates.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Layers className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No training nights in this period.</p>
            <Link to="/schedule">
              <Button variant="outline" size="sm" className="mt-2 text-xs">Plan a Night</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {dates.map(date => {
              const entries = groupedByDate[date];
              const stars = _.uniq(entries.map(e => e.AssignedStarLevel)).filter(Boolean).sort();
              return (
                <Link
                  key={date}
                  to="/schedule"
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="shrink-0 text-center bg-primary/10 rounded-lg p-1.5 min-w-[44px]">
                    <p className="text-xs font-bold text-primary">{format(parseISO(date), 'dd')}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(date), 'MMM')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{format(parseISO(date), 'EEEE')}</p>
                    <p className="text-xs text-muted-foreground">{entries.length} lesson{entries.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {stars.map(sl => (
                      <Badge key={sl} variant="outline" className="text-xs">{sl}</Badge>
                    ))}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}