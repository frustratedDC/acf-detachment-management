import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess } from '@/lib/accessLevels';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trophy, TrendingUp, BookOpen, Plus, Star, Activity } from 'lucide-react';
import { buildLeaderboard, scoreSession } from '@/lib/kaScoring';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const today = () => new Date().toISOString().split('T')[0];

export default function KALeaderboard() {
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;
  const queryClient = useQueryClient();
  const [showLogForm, setShowLogForm] = useState(false);

  const { data: sessions = [] } = useQuery({
    queryKey: ['ka-sessions'],
    queryFn: () => base44.entities.KA_Session.list('-Date'),
  });

  const { data: logbook = [] } = useQuery({
    queryKey: ['ka-logbook'],
    queryFn: () => base44.entities.KA_LogBook.list('-Date'),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.list(),
  });

  const personnelMap = useMemo(() => {
    const m = {};
    allPersonnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [allPersonnel]);

  const displayName = (pnum) => {
    const p = personnelMap[pnum];
    return p ? `${p.Rank || ''} ${p.FirstName || ''} ${p.Surname || ''}`.trim() : pnum;
  };

  const leaderboard = useMemo(() => buildLeaderboard(sessions, logbook), [sessions, logbook]);

  const totalSessions = sessions.length;
  const globalAvg = useMemo(() => {
    if (!sessions.length) return 0;
    const all = sessions.map(s => scoreSession(s, sessions).session_total);
    return (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1);
  }, [sessions]);

  const mostImproved = useMemo(() => {
    if (!leaderboard.length) return null;
    // aggregate bonus totals per name
    const bonusMap = {};
    sessions.forEach(s => {
      const sc = scoreSession(s, sessions);
      bonusMap[s.Name] = (bonusMap[s.Name] || 0) + sc.total;
    });
    const best = Object.entries(bonusMap).sort((a, b) => b[1] - a[1])[0];
    return best ? { name: displayName(best[0]), bonuses: best[1] } : null;
  }, [sessions, leaderboard]);

  const top5 = leaderboard.slice(0, 5);

  const chartData = leaderboard.slice(0, 10).map(r => ({
    name: displayName(r.name).split(' ').slice(-1)[0],
    Ka: r.ka_total,
    LogBook: r.logbook_total,
    Total: r.final_total,
  }));

  return (
    <AccessGate level={2}>
      <div className="p-6">
        <PageHeader
          title="KA Leaderboard"
          description="Keeping Active performance rankings"
          icon={Trophy}
          actions={
            hasAccess(accessLevel, 4) && (
              <Button onClick={() => setShowLogForm(true)}>
                <Plus className="w-4 h-4" /> Log Book Entry
              </Button>
            )
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Sessions', value: totalSessions, icon: Activity, color: 'text-primary' },
            { label: 'Avg Session Score', value: globalAvg, icon: Star, color: 'text-amber-600' },
            { label: 'Cadets Ranked', value: leaderboard.length, icon: Trophy, color: 'text-emerald-600' },
            { label: 'Most Improved', value: mostImproved?.name ?? '—', sub: mostImproved ? `${mostImproved.bonuses} bonus pts` : '', icon: TrendingUp, color: 'text-sky-600' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 5 */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />Top 5 Cadets</CardTitle></CardHeader>
            <CardContent>
              {top5.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data yet.</p>
              ) : top5.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{displayName(r.name)}</div>
                    <div className="text-xs text-muted-foreground">{r.sessions} sessions · avg {r.avg_score.toFixed(1)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{r.final_total}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Score Breakdown (Top 10)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Ka" name="KA Sessions" fill="#6366f1" radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="LogBook" name="Log Book" fill="#10b981" radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Full Table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Full Rankings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-right">Sessions</th>
                    <th className="px-4 py-3 text-right">KA Pts</th>
                    {hasAccess(accessLevel, 4) && <th className="px-4 py-3 text-right">Log Book</th>}
                    <th className="px-4 py-3 text-right">Avg</th>
                    <th className="px-4 py-3 text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, i) => (
                    <tr key={r.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{displayName(r.name)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{r.sessions}</td>
                      <td className="px-4 py-2.5 text-right">{r.ka_total}</td>
                      {hasAccess(accessLevel, 4) && <td className="px-4 py-2.5 text-right text-emerald-600">{r.logbook_total}</td>}
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{r.avg_score.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary">{r.final_total}</td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No sessions recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {showLogForm && hasAccess(accessLevel, 4) && (
        <LogBookEntryDialog
          allPersonnel={allPersonnel}
          personnel={personnel}
          queryClient={queryClient}
          onClose={() => setShowLogForm(false)}
        />
      )}
    </AccessGate>
  );
}

function LogBookEntryDialog({ allPersonnel, personnel, queryClient, onClose }) {
  const cadets = allPersonnel.filter(p => p.Type === 'Cadet' && p.PersonnelStatus === 'Active');
  const [form, setForm] = useState({ Date: today(), Name: '', Points: '', Notes: '' });
  const h = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KA_LogBook.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ka-logbook'] });
      toast.success('Log book entry saved');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.Name || !form.Points) { toast.error('Name and Points are required'); return; }
    createMutation.mutate({
      Date: form.Date,
      Name: form.Name,
      Points: Number(form.Points),
      Notes: form.Notes || undefined,
      Entered_By: personnel?.PNumber || '',
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4" />Log Book Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Date *</Label>
            <Input type="date" value={form.Date} onChange={e => h('Date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Cadet *</Label>
            <Select value={form.Name} onValueChange={v => h('Name', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select cadet…" /></SelectTrigger>
              <SelectContent>
                {cadets.map(c => (
                  <SelectItem key={c.PNumber} value={c.PNumber}>{c.Rank} {c.FirstName} {c.Surname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Points * <span className="text-xs text-muted-foreground">(recommended max 10)</span></Label>
            <Input type="number" value={form.Points} onChange={e => h('Points', e.target.value)} className="mt-1" min={0} max={10} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.Notes} onChange={e => h('Notes', e.target.value)} className="mt-1" rows={3} placeholder="Optional performance/effort notes…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}