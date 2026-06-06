import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { HeartHandshake, CheckCircle2, Clock, X } from 'lucide-react';

export default function CEMyLogbook({ pnum }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pnum) { setLoading(false); return; }
    base44.entities.CommunityEngagementLedger.filter({ CadetPNumber: pnum })
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

  const approvedEntries = entries.filter(e => e.Status === 'Approved');
  const totalApprovedHours = approvedEntries.reduce((s, e) => s + (e.Hours || 0), 0);
  const chartData = approvedEntries
    .slice()
    .reverse()
    .map((e, i) => ({ date: format(parseISO(e.Date), 'dd MMM'), hours: e.Hours, cumulative: approvedEntries.slice(-i - 1).reduce((s, x) => s + (x.Hours || 0), 0) }));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Approved Hours</p>
              <p className="text-3xl font-bold">{totalApprovedHours.toFixed(1)}h</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
              <HeartHandshake className="w-6 h-6 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {approvedEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hours Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">All Submissions ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No CE submissions yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                    entry.Status === 'Approved' ? 'bg-chart-2/10 text-chart-2' :
                    entry.Status === 'Rejected' ? 'bg-destructive/10 text-destructive' :
                    'bg-accent/10 text-accent-foreground'
                  }`}>
                    {entry.Hours}h
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.Description}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(entry.Date + 'T00:00:00'), 'd MMM yyyy')}</p>
                  </div>
                  <Badge variant={
                    entry.Status === 'Approved' ? 'default' :
                    entry.Status === 'Rejected' ? 'destructive' : 'outline'
                  } className="text-xs shrink-0">
                    {entry.Status === 'Approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {entry.Status === 'Rejected' && <X className="w-3 h-3 mr-1" />}
                    {entry.Status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                    {entry.Status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}