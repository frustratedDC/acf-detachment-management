import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DutyNightCard from '@/components/duty/DutyNightCard';
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function DutyRoster() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ['schedule-all'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {}; allPersonnel.forEach(p => { m[p.PNumber] = p; }); return m;
  }, [allPersonnel]);

  const entriesForDate = useMemo(() =>
    schedule.filter(e => e.Date === dateStr),
    [schedule, dateStr]
  );

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Duty Roster"
        description="Daily duty roster showing role and instructor assignments per training session"
        icon={ClipboardList}
      />

      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold">{format(selectedDate, 'EEEE, d MMMM yyyy')}</h2>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : entriesForDate.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No duty roster entries for this date.</p>
          </CardContent>
        </Card>
      ) : (
        <DutyNightCard date={dateStr} entries={entriesForDate} personnelMap={personnelMap} />
      )}
    </AccessGate>
  );
}