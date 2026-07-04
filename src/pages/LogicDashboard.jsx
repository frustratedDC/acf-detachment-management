import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import LogicSettingsSection from '@/components/admin/LogicSettingsSection';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { Sliders, Award, CalendarClock, ShoppingBag, FileBarChart } from 'lucide-react';
import { toast } from 'sonner';

// ─── Logic sections config ──────────────────────────────────────────────────
const SECTIONS = [
  {
    key: 'promotion',
    title: 'Promotion Eligibility',
    description: 'Minimum time-in-rank and attendance requirements for promotion readiness.',
    icon: Award,
    fields: [
      { key: 'logic.promotion.lcpl_min_days', label: 'Min Days in Rank for LCpl', default: 120 },
      { key: 'logic.promotion.cpl_min_days', label: 'Min Days in Rank for Cpl', default: 180 },
      { key: 'logic.promotion.sgt_min_days', label: 'Min Days in Rank for Sgt', default: 240 },
      { key: 'logic.promotion.min_attendance_pct', label: 'Min Attendance % Required', default: 75 },
    ],
  },
  {
    key: 'attendance',
    title: 'Attendance & Engagement',
    description: 'Thresholds used to flag non-attenders and disengaged instructors.',
    icon: CalendarClock,
    fields: [
      { key: 'logic.attendance.non_attender_days', label: 'Days Absent Before Flagged Non-Attender', default: 28 },
      { key: 'logic.attendance.instructor_flag_pct', label: 'Instructor Engagement Flag %', default: 60 },
    ],
  },
  {
    key: 'naafi',
    title: 'NAAFI / Inventory',
    description: 'Default thresholds used across NAAFI stock management.',
    icon: ShoppingBag,
    fields: [
      { key: 'logic.naafi.low_stock_default', label: 'Default Low Stock Threshold', default: 5 },
    ],
  },
  {
    key: 'reports',
    title: 'Reporting',
    description: 'Rules used when generating monthly management reports.',
    icon: FileBarChart,
    fields: [
      { key: 'logic.reports.assessment_suffix', label: 'Assessment Lesson Code Suffix', default: '-A', type: 'text', hint: 'Lesson codes containing this suffix are treated as formal assessments.' },
    ],
  },
];

export default function LogicDashboard() {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['det-settings'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });

  const settingsMap = useMemo(() => {
    const map = {};
    settings.forEach(s => { map[s.Key] = s.Value; });
    return map;
  }, [settings]);

  async function handleSaveSection(entries) {
    for (const entry of entries) {
      const existing = settings.find(s => s.Key === entry.key);
      if (existing) {
        await base44.entities.DetachmentSettings.update(existing.id, { Value: entry.value });
      } else {
        await base44.entities.DetachmentSettings.create({ Key: entry.key, Value: entry.value, Description: entry.description });
      }
    }
    queryClient.invalidateQueries({ queryKey: ['det-settings'] });
    toast.success('Logic settings saved');
  }

  return (
    <AccessGate level={ACCESS_LEVELS.SYSTEM_ADMIN}>
      <PageHeader
        title="Logic Dashboard"
        description="Configure the non-static business rules and thresholds used across the app"
        icon={Sliders}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map(section => (
          <LogicSettingsSection
            key={section.key}
            title={section.title}
            description={section.description}
            icon={section.icon}
            fields={section.fields}
            settingsMap={settingsMap}
            onSave={handleSaveSection}
          />
        ))}
      </div>
    </AccessGate>
  );
}