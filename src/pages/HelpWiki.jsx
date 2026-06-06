import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Search, ClipboardCheck, FileDown, Shield, Crosshair, BookOpen, Users, CalendarCheck, BarChart2, Settings } from 'lucide-react';

const SECTIONS = [
  {
    id: 'bulk-entry',
    title: 'How to: Bulk Entry',
    icon: ClipboardCheck,
    badge: null,
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'text-blue-800',
    content: [
      { heading: '1. Select Filters', text: 'Go to Bulk Progress Entry. Choose a Star Level (e.g. 1 Star) from the first dropdown. The Subject dropdown will then unlock — choose your subject (e.g. Navigation).' },
      { heading: '2. Review the Table', text: 'Only cadets currently at that Star Level appear as rows. Lessons for the selected subject appear as columns. Green ✓ = already approved. ⏳ = pending. Empty = not yet done.' },
      { heading: '3. Mark Completions', text: 'Tick individual cells, click a cadet name to toggle all their lessons, or click a lesson column header to toggle all cadets. Use "Apply Pass to All" in the Bulk Action header row to mark every eligible cell in one tap.' },
      { heading: '4. Save', text: 'Click "Save Entries" at the bottom. L4+ entries are Auto-Approved immediately and trigger star-level promotion checks. L2/L3 entries go to the Task List for L4+ approval.' },
      { heading: 'Tip: Clear Filters', text: 'Use the "✕ Clear Filters" button to reset the view and select a different star level or subject.' },
    ],
  },
  {
    id: 'reporting',
    title: 'How to: Reporting & PDF Export',
    icon: FileDown,
    badge: null,
    color: 'bg-green-50 border-green-200',
    headerColor: 'text-green-800',
    content: [
      { heading: 'Monthly Reports', text: 'Navigate to Dashboard → Monthly Reports. Select the month using the dropdown. Click "Generate Report" to produce a summary of cadet attendance, lesson completions and qualification status.' },
      { heading: 'Training Plan PDF', text: 'Go to Instruction → Export PDF. Choose "By Month" or a custom date range. Click "Generate PDF" — a landscape A4 document downloads with per-night lesson breakdowns, instructors, dress codes and locations.' },
      { heading: 'Parade State Export', text: 'On the Parade Nominal Roll page, use the "Export PDF" or "Export CSV" buttons to download the current filtered view. The PDF uses an ACF-branded header with detachment name and date.' },
      { heading: 'Lesson Code Shorthand', text: 'In exported PDFs, lesson codes are abbreviated to the text before the first hyphen (e.g. NAV-101 → NAV). Keep lesson codes in SUBJECT-NUMBER format for best results.' },
    ],
  },
  {
    id: 'dc-authority',
    title: 'Admin: DC Command Authority',
    icon: Shield,
    badge: null,
    color: 'bg-amber-50 border-amber-200',
    headerColor: 'text-amber-800',
    content: [
      { heading: 'Access Levels Overview', text: 'L0 = General (all cadets). L1 = Cadet NCO. L2 = Cadet Instructor. L3 = Det Instructor. L4 = Det 2IC (approve records, bulk progress). L5 = Detachment Commander (personnel management, purge). L6 = System Admin (syllabus upload/purge).' },
      { heading: 'Granting CE & KA Access', text: 'By default, cadets below 2 Star cannot access the Community Engagement or Keeping Active trackers. A DC (L5+) can grant explicit access via the Personnel profile — toggle "CE Access" or "Keeping Active Access" on the cadet\'s record.' },
      { heading: 'Approving Progress Records', text: 'L4+ users auto-approve their own submissions. L2/L3 submissions appear in the Task List → Pending Approvals. Click the green tick to approve or red X to reject a record.' },
      { heading: 'Governance Compliance', text: 'CFAV Governance tracks mandatory training for all Adult Instructors. DCs should ensure all records are updated when courses are completed. Failures show on the Analytics Dashboard.' },
      { heading: 'Accounts', text: 'The Accounts ledger tracks RV (receipts) and PV (payments) for both Petty Cash and Bank accounts. Only L4+ can view or edit account transactions.' },
    ],
  },
  {
    id: 'wht-compliance',
    title: 'Quick Reference: WHT Compliance',
    icon: Crosshair,
    badge: null,
    color: 'bg-red-50 border-red-200',
    headerColor: 'text-red-800',
    content: [
      { heading: 'Status Indicators', text: '🟢 Green = Valid and current. 🟡 Amber = Expiring within 30 days. 🔴 Red = Expired or not on record.' },
      { heading: 'Standard WHT Cycle', text: 'Weapon Handling Tests typically expire 6 months from test date. Each WHT record shows the weapon type (e.g. L98A2, L85A2), test date, expiry date and assessor PNumber.' },
      { heading: 'Recording a WHT', text: 'Go to Cadets → Weapon Handling Tests. Click "Add WHT". Enter the cadet or CFAV PNumber, weapon type, test date and expiry date. The system calculates compliance status automatically.' },
      { heading: 'Dashboard Alert', text: 'The Command Hub dashboard shows a WHT compliance alert if any records are expired or expiring within 30 days. Click the alert to navigate directly to the WHT page.' },
    ],
  },
  {
    id: 'access-levels',
    title: 'Access Levels Explained',
    icon: Users,
    badge: null,
    color: 'bg-slate-50 border-slate-200',
    headerColor: 'text-slate-800',
    content: [
      { heading: 'L0 – General', text: 'Dashboard, Notices, Calendar, Training Plan (view), Syllabus, My Progress, Forms & Resources, Logbooks.' },
      { heading: 'L1 – Cadet NCO', text: 'L0 + can edit Parade Nominal Roll.' },
      { heading: 'L2 – Cadet Instructor', text: 'L1 + Lesson Nominal Roll, My Availability, My Qualifications, My Governance, KA Sessions.' },
      { heading: 'L3 – Det Instructor', text: 'L2 + Training Plan (edit), Export PDF, Staff Availability overview.' },
      { heading: 'L4 – Det 2IC', text: 'L3 + Bulk Progress Entry, Analytics, Personnel (view), CFAV Governance, Instructor Quals, Monthly Reports, All Availability, Form Creator, Accounts.' },
      { heading: 'L5 – Det Commander', text: 'L4 + Personnel create/delete, System Settings (import/purge roster).' },
      { heading: 'L6 – System Admin', text: 'L5 + Syllabus upload/purge, all system-level operations.' },
    ],
  },
  {
    id: 'availability',
    title: 'How to: Staff Availability',
    icon: CalendarCheck,
    badge: null,
    color: 'bg-purple-50 border-purple-200',
    headerColor: 'text-purple-800',
    content: [
      { heading: 'Submitting Availability', text: 'Go to Instruction → My Availability. Navigate to the month using the arrows. For each training night, click "Available" or "Unavailable". Optionally add a reason. Changes save immediately.' },
      { heading: 'Viewing All Responses (L4+)', text: 'Go to Instruction → All Availability. Select a training night to see a breakdown of Available, Unavailable and Not Submitted responses from all instructors.' },
      { heading: 'Compliance Dots on Calendar', text: '🟢 = 2+ staff available with valid First Aid. 🟡 = Compliance issue (e.g. no First Aid cover). 🔴 = Insufficient staff. Dots update automatically as availability is submitted.' },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting Started — Account Linking',
    icon: Settings,
    badge: null,
    color: 'bg-slate-50 border-slate-200',
    headerColor: 'text-slate-800',
    content: [
      { heading: 'What you need', text: 'Your PNumber (e.g. P12345) — provided by your Detachment Commander. Your Surname as it appears on your personnel record. The Security Code — provided by your Detachment Commander.' },
      { heading: 'Linking your account', text: 'When you first log in you will be prompted to link your account. Enter your PNumber, Surname and Security Code. Once linked, the app loads your profile, access level and personalised dashboard.' },
      { heading: 'Wrong email?', text: 'If you log in with the wrong email, use the "Back to Login" button on the error screen and sign in with the correct email address.' },
    ],
  },
];

export default function HelpWiki() {
  const [search, setSearch] = useState('');

  const filtered = SECTIONS.filter(s =>
    !search ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.content.some(c => c.heading.toLowerCase().includes(search.toLowerCase()) || c.text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <PageHeader
        title="Help & Wiki"
        description="Kings Royal Hussars ACF — Training Manager Reference Guide"
        icon={HelpCircle}
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search help topics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No help topics match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(section => {
            const Icon = section.icon;
            return (
              <Card key={section.id} className={`border ${section.color}`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className={`text-sm font-bold flex items-center gap-2 ${section.headerColor}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {section.title}
                    {section.badge && (
                      <Badge className="text-xs ml-1 bg-amber-400 text-amber-900 border-0">{section.badge}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {section.content.map((item, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground mb-0.5">{item.heading}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}