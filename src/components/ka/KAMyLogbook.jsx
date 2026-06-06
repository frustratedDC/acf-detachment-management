import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp } from 'lucide-react';

export default function KAMyLogbook({ pnum }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pnum) { setLoading(false); return; }
    base44.entities.KA_LogBook.filter({ Name: pnum })
      .then(recs => {
        const sorted = recs.sort((a, b) => new Date(b.Date) - new Date(a.Date));
        setEntries(sorted);
      })
      .finally(() => setLoading(false));
  }, [pnum]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const totalPoints = entries.reduce((s, e) => s + (e.Points || 0), 0);
  const chartData = entries
    .slice()
    .reverse()
    .map((e, i) => ({ date: format(parseISO(e.Date), 'dd MMM'), points: e.Points, cumulative: entries.slice(-i - 1).reduce((s, x) => s + (x.Points || 0), 0) }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total KA Points</p>
              <p className="text-3xl font-bold">{totalPoints}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Points Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No KA logbook entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm">
                    +{entry.Points}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{entry.Notes}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(entry.Date), 'd MMM yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}