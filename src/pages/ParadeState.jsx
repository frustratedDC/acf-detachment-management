import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Save, Search, UserCheck, UserX, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function ParadeState() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [localStatuses, setLocalStatuses] = useState({});

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: existingParade = [] } = useQuery({
    queryKey: ['parade', date],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: date }),
  });

  useEffect(() => {
    const map = {};
    existingParade.forEach(p => { map[p.UserPNumber] = p.AttendanceStatus; });
    const newLocal = {};
    allPersonnel.forEach(p => {
      newLocal[p.PNumber] = map[p.PNumber] || 'Absent';
    });
    setLocalStatuses(newLocal);
  }, [existingParade, allPersonnel]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const existing of existingParade) {
        await base44.entities.DailyParadeState.delete(existing.id);
      }
      const records = Object.entries(localStatuses).map(([pnum, status]) => ({
        Date: date,
        UserPNumber: pnum,
        AttendanceStatus: status,
      }));
      await base44.entities.DailyParadeState.bulkCreate(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parade', date] });
      toast.success('Parade state saved successfully');
    },
  });

  const filtered = allPersonnel.filter(p => {
    const matchSearch = p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
      p.PNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
      p.RoleName?.toLowerCase().includes(search.toLowerCase()) ||
      p.Rank?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.Type === typeFilter;
    return matchSearch && matchType;
  });

  const presentCount = Object.values(localStatuses).filter(s => s === 'Present').length;
  const absentCount = Object.values(localStatuses).filter(s => s === 'Absent').length;
  const excusedCount = Object.values(localStatuses).filter(s => s === 'Excused').length;

  function togglePresent(pnum) {
    setLocalStatuses(prev => {
      const cur = prev[pnum] || 'Absent';
      return { ...prev, [pnum]: cur === 'Present' ? 'Absent' : 'Present' };
    });
  }

  function setExcused(pnum) {
    setLocalStatuses(prev => ({
      ...prev, [pnum]: prev[pnum] === 'Excused' ? 'Absent' : 'Excused'
    }));
  }

  return (
    <AccessGate level={ACCESS_LEVELS.CADET_NCO}>
      <PageHeader
        title="Parade State"
        description="Daily Nominal Roll — tick Present for First Parade"
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="bg-chart-2/5 border-chart-2/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium">Present: {presentCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserX className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium">Absent: {absentCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">Excused: {excusedCount}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name, PNumber, rank, role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Cadet">Cadets</SelectItem>
                <SelectItem value="Adult Instructor">Instructors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map((p) => {
              const status = localStatuses[p.PNumber] || 'Absent';
              return (
                <div key={p.PNumber} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={status === 'Present'}
                      onCheckedChange={() => togglePresent(p.PNumber)}
                      className="data-[state=checked]:bg-chart-2 data-[state=checked]:border-chart-2"
                    />
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {p.Surname?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={status === 'Present' ? 'default' : status === 'Excused' ? 'outline' : 'secondary'}
                      className={`text-xs ${status === 'Present' ? 'bg-chart-2/20 text-chart-2 border-chart-2/30' : status === 'Excused' ? 'border-accent/40 text-accent-foreground' : ''}`}
                    >
                      {status}
                    </Badge>
                    <button
                      onClick={() => setExcused(p.PNumber)}
                      className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground transition-colors"
                    >
                      {status === 'Excused' ? 'Unexcuse' : 'Excuse'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No personnel found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </AccessGate>
  );
}