import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess } from '@/lib/accessLevels';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dumbbell, Plus, Eye, Lock, Pencil } from 'lucide-react';
import { scoreSession } from '@/lib/kaScoring';
import ActivityPointsBadge from '@/components/ka/ActivityPointsBadge';
import BonusChips from '@/components/ka/BonusChips';

export default function KASessions() {
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editSession, setEditSession] = useState(null);
  const [viewSession, setViewSession] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['ka-sessions'],
    queryFn: () => base44.entities.KA_Session.list('-Date'),
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

  const scoredSessions = useMemo(() => sessions.map(s => ({
    ...s,
    _score: scoreSession(s, sessions),
  })), [sessions]);

  const filtered = useMemo(() => scoredSessions.filter(s => {
    const name = displayName(s.Name).toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !s.Det?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && s.Session_Status !== statusFilter) return false;
    return true;
  }), [scoredSessions, search, statusFilter]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KA_Session.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ka-sessions'] });
      toast.success('Session updated');
      setEditSession(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const canEdit = (s) => hasAccess(accessLevel, 3) || (hasAccess(accessLevel, 2) && s.Session_Status === 'Open');
  const canComplete = hasAccess(accessLevel, 3);

  return (
    <AccessGate level={2}>
      <div className="p-6">
        <PageHeader
          title="KA Sessions"
          description="Keeping Active session records"
          icon={Dumbbell}
          actions={
            <Link to="/ka-session-new">
              <Button><Plus className="w-4 h-4" /> New Session</Button>
            </Link>
          }
        />

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <Input placeholder="Search name or det…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 && <p className="text-muted-foreground text-center py-12">No sessions found.</p>}
            {filtered.map(s => {
              const sc = s._score;
              return (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{displayName(s.Name)}</span>
                          <Badge variant={s.Session_Status === 'Completed' ? 'secondary' : 'outline'}
                            className={s.Session_Status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : ''}>
                            {s.Session_Status === 'Completed' ? <><Lock className="w-3 h-3 mr-1" />Completed</> : 'Open'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">{s.Date} · {s.Det} · {s.Duration_Minutes} min</div>
                        <div className="mt-2"><BonusChips bonuses={sc} /></div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <ActivityPointsBadge points={sc.activity_total} label="Activity" />
                        <ActivityPointsBadge points={sc.participation} label="Partic." />
                        <ActivityPointsBadge points={sc.total} label="Bonus" />
                        <div className="flex flex-col items-center rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2 min-w-[64px]">
                          <span className="text-lg font-bold text-primary">{sc.session_total}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-primary/70">Total</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setViewSession(s)}><Eye className="w-4 h-4" /></Button>
                        {canEdit(s) && (
                          <Button size="sm" variant="ghost" onClick={() => setEditSession(s)}><Pencil className="w-4 h-4" /></Button>
                        )}
                        {canComplete && s.Session_Status === 'Open' && (
                          <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            onClick={() => updateMutation.mutate({ id: s.id, data: { Session_Status: 'Completed' } })}>
                            <Lock className="w-3 h-3 mr-1" />Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* View Detail Dialog */}
      {viewSession && (
        <SessionDetailDialog session={viewSession} allSessions={sessions} displayName={displayName} onClose={() => setViewSession(null)} />
      )}

      {/* Edit Dialog */}
      {editSession && (
        <EditSessionDialog
          session={editSession}
          accessLevel={accessLevel}
          onClose={() => setEditSession(null)}
          onSave={(data) => updateMutation.mutate({ id: editSession.id, data })}
          allPersonnel={allPersonnel}
        />
      )}
    </AccessGate>
  );
}

function SessionDetailDialog({ session, allSessions, displayName, onClose }) {
  const sc = scoreSession(session, allSessions);
  const bjM = sc.bj_max;

  const row = (label, raw, pts, bonusH, bonusI) => (
    <tr key={label} className="border-b last:border-0">
      <td className="py-2 pr-4 text-sm font-medium">{label}</td>
      <td className="py-2 pr-4 text-sm text-muted-foreground">{raw ?? '—'}</td>
      <td className="py-2 pr-4">
        <span className="inline-block w-6 text-center font-bold text-sm">{pts}</span>
      </td>
      <td className="py-2 text-xs">
        {bonusH ? <span className="mr-1 text-amber-600">+1 Best</span> : null}
        {bonusI ? <span className="text-sky-600">+1 PB</span> : null}
      </td>
    </tr>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Session Details — {displayName(session.Name)}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground mb-3">{session.Date} · {session.Det} · {session.Duration_Minutes} min</div>
        <table className="w-full">
          <thead>
            <tr className="border-b text-xs text-muted-foreground uppercase">
              <th className="text-left pb-2">Activity</th>
              <th className="text-left pb-2">Value</th>
              <th className="text-left pb-2">Pts</th>
              <th className="text-left pb-2">Bonuses</th>
            </tr>
          </thead>
          <tbody>
            {row('Broad Jump', bjM != null ? `${bjM} cm` : null, sc.bj_points, sc.bj_h, sc.bj_i)}
            {row('Squats', session.Squats, sc.sq_points, sc.sq_h, sc.sq_i)}
            {row('Press Ups', session.PressUps, sc.pu_points, sc.pu_h, sc.pu_i)}
            {row('Shuttle', session.Shuttle ? `${session.Shuttle}s` : null, sc.sh_points, sc.sh_h, sc.sh_i)}
            {row('MSFT', session.MSFT, sc.msft_points, sc.msft_h, sc.msft_i)}
          </tbody>
        </table>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[['Activity', sc.activity_total], ['Participation', sc.participation], ['Bonus', sc.total], ['TOTAL', sc.session_total]].map(([l, v]) => (
            <div key={l} className={`rounded-lg border p-2 ${l === 'TOTAL' ? 'border-primary bg-primary/5' : ''}`}>
              <div className={`text-xl font-bold ${l === 'TOTAL' ? 'text-primary' : ''}`}>{v}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{l}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditSessionDialog({ session, accessLevel, onClose, onSave, allPersonnel }) {
  const [form, setForm] = useState({
    Date: session.Date || '',
    Duration_Minutes: session.Duration_Minutes ?? '',
    BJ1: session.BJ1 ?? '', BJ2: session.BJ2 ?? '', BJ3: session.BJ3 ?? '',
    Squats: session.Squats ?? '', PressUps: session.PressUps ?? '',
    Shuttle: session.Shuttle ?? '', MSFT: session.MSFT ?? '',
  });

  const h = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const payload = { Date: form.Date, Duration_Minutes: Number(form.Duration_Minutes) };
    ['BJ1','BJ2','BJ3','Squats','PressUps','Shuttle','MSFT'].forEach(k => {
      payload[k] = form[k] !== '' ? Number(form[k]) : null;
    });
    onSave(payload);
  };

  const nf = (label, key) => (
    <div key={key}>
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={form[key]} onChange={e => h(key, e.target.value)} className="mt-1 h-8 text-sm" placeholder="—" />
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Session</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={form.Date} onChange={e => h('Date', e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          {nf('Duration (min)', 'Duration_Minutes')}
          {nf('BJ Attempt 1', 'BJ1')}{nf('BJ Attempt 2', 'BJ2')}{nf('BJ Attempt 3', 'BJ3')}
          {nf('Squats', 'Squats')}{nf('Press Ups', 'PressUps')}
          {nf('Shuttle (sec)', 'Shuttle')}{nf('MSFT Level', 'MSFT')}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}