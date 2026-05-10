import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ClipboardList, Save, Search, UserCheck, UserX, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function ParadeState() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
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
    existingParade.forEach(p => { map[p.UserPNumber] = p; });
    const newLocal = {};
    allPersonnel.forEach(p => {
      newLocal[p.PNumber] = map[p.PNumber]?.AttendanceStatus || 'Present';
    });
    setLocalStatuses(newLocal);
  }, [existingParade, allPersonnel]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing records for this date
      for (const existing of existingParade) {
        await base44.entities.DailyParadeState.delete(existing.id);
      }
      // Create new records
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

  const filtered = allPersonnel.filter(p =>
    p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    p.PNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const presentCount = Object.values(localStatuses).filter(s => s === 'Present').length;
  const absentCount = Object.values(localStatuses).filter(s => s === 'Absent').length;
  const excusedCount = Object.values(localStatuses).filter(s => s === 'Excused').length;

  return (
    <AccessGate level={ACCESS_LEVELS.CADET_NCO}>
      <PageHeader
        title="Parade State"
        description="Daily Nominal Roll"
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      />

      {/* Summary Bar */}
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
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or PNumber..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map((p) => (
              <div
                key={p.PNumber}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {p.Surname?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.Surname}</p>
                    <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
                  </div>
                </div>
                <Select
                  value={localStatuses[p.PNumber] || 'Present'}
                  onValueChange={(val) => setLocalStatuses(prev => ({ ...prev, [p.PNumber]: val }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No personnel found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </AccessGate>
  );
}