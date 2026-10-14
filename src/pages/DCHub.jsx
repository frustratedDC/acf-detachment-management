import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { isCadet } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Calendar, BookOpen, Users, ClipboardCheck, Layers, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import DateRangeSelector from '@/components/dc/DateRangeSelector';
import TrainingOverview from '@/components/dc/TrainingOverview';
import RequirementsByStar from '@/components/dc/RequirementsByStar';

const QUICK_LINKS = [
  { to: '/schedule', label: 'Training Plan', desc: 'Schedule and edit training nights', icon: Calendar, color: 'bg-primary/10 text-primary' },
  { to: '/syllabus', label: 'Syllabus', desc: 'View and edit the master syllabus', icon: BookOpen, color: 'bg-chart-5/10 text-chart-5' },
  { to: '/all-availability', label: 'Staff Availability', desc: 'Check and assign instructors', icon: ClipboardCheck, color: 'bg-chart-2/10 text-chart-2' },
  { to: '/personnel', label: 'Cadet Nominal Roll', desc: 'All cadet records and profiles', icon: Users, color: 'bg-chart-3/10 text-chart-3' },
  { to: '/progress', label: 'Lesson Completion', desc: 'Progress matrix by star level', icon: Layers, color: 'bg-chart-4/10 text-chart-4' },
];

export default function DCHub() {
  const { personnel } = usePersonnel();
  const [range, setRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['dc-schedule', range],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: { $gte: range.start, $lte: range.end } }),
  });

  const { data: syllabus = [], isLoading: syllabusLoading } = useQuery({
    queryKey: ['dc-syllabus'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: progress = [], isLoading: progressLoading } = useQuery({
    queryKey: ['dc-progress'],
    queryFn: () => base44.entities.ProgressLedger.filter({ Status: 'Approved' }),
  });

  const { data: allPersonnel = [], isLoading: personnelLoading } = useQuery({
    queryKey: ['dc-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const cadets = useMemo(
    () => allPersonnel.filter(p => isCadet(p.AccessLevel) && (p.PersonnelStatus || 'Active') === 'Active'),
    [allPersonnel]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Command Hub — ${personnel?.Surname || 'DC'}`}
        description="Training overview, planning and requirements at a glance"
        icon={Shield}
      />

      {/* Date Range Selector */}
      <Card>
        <CardContent className="p-4">
          <DateRangeSelector range={range} onChange={setRange} />
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {QUICK_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <Link key={link.to} to={link.to}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full group">
                <CardContent className="p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${link.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-sm">{link.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{link.desc}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Overview + Requirements side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrainingOverview schedule={schedule} isLoading={scheduleLoading} range={range} />
        <RequirementsByStar
          syllabus={syllabus}
          progress={progress}
          cadets={cadets}
          isLoading={syllabusLoading || progressLoading || personnelLoading}
        />
      </div>
    </div>
  );
}