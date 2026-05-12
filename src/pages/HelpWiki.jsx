import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Search } from 'lucide-react';

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started — Account Linking',
    level: null,
    content: `When you first log in, you will be prompted to **link your account** to your personnel record.

You will need:
- Your **PNumber** (e.g. P12345) — provided by your Detachment Commander
- Your **Surname** as it appears on your personnel record
- The **Security Code** — provided by your Detachment Commander

Once linked, the app will load your profile, access level, and personalised dashboard. If you log in with the wrong email, use the **Back to Login** button on the error screen.`
  },
  {
    id: 'access-levels',
    title: 'Access Levels Explained',
    level: null,
    content: `The app uses 7 access levels (L0–L6) to control what each user can see and do:

| Level | Name | Description |
|---|---|---|
| L0 | General | View Dashboard, Notices, Calendar, Parade State (read only), Syllabus |
| L1 | Cadet NCO | L0 + can edit Parade State |
| L2 | Cadet Instructor | L1 + Lesson Attendance, Training Plan (view) |
| L3 | Detachment Instructor | L2 + Training Plan (edit), Export PDF, CFAV Governance, Staff Availability, Qualifications |
| L4 | Detachment 2IC | L3 + Bulk Progress Entry, Analytics, all attendance/availability oversight, View As any user, approve lesson change requests |
| L5 | Detachment Commander | L4 + Personnel Manager, Admin Controls |
| L6 | System Administrator | L5 + Syllabus upload/purge, system-wide settings |

Access levels are set on each personnel record by L5+ users.`
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    level: 'L0',
    content: `The Dashboard is your home screen and provides a snapshot of:

- **Tonight's Training Plan** — lessons, star levels, instructors and locations
- **My Lessons** (instructors) — your assigned lessons for today's parade night
- **Upcoming Events** — next 5 calendar events
- **Important Notices** — current active notices from commanders
- **Quick Stats** (L3+) — attendance counts, pending approvals, compliance alerts

Click any stat card to navigate to the relevant section.`
  },
  {
    id: 'parade-state',
    title: 'Parade State',
    level: 'L1 to edit / L0 to view',
    content: `The Parade State is the daily nominal roll of all Active personnel.

**Taking Parade:**
1. Select the date using the date picker
2. Tick the checkbox next to each Present cadet/instructor
3. Use the **Excuse** button to mark someone Excused
4. Click **Save** to record attendance

**Filters:** Search by name, PNumber, rank or role. Filter by type (Cadets / Instructors).

**Exports:**
- **PDF** — Portrait A4, ACF-branded header with Detachment Name, "PARADE NIGHT NOMINAL ROLL" and Month/Year
- **CSV** — Spreadsheet-compatible export of the current filtered view

Only Active personnel are shown. Non-active personnel (Suspended, Leavers etc.) are hidden.`
  },
  {
    id: 'lesson-attendance',
    title: 'Lesson Attendance',
    level: 'L2+',
    content: `Lesson Attendance lets instructors record which cadets completed a lesson.

**How it works:**
1. Select the training date
2. Your assigned lessons for that date appear as tabs (e.g. P1 · 1 Star · NAV-101)
3. Eligible cadets are those who are:
   - Marked **Present** on the Parade State for that date
   - At the correct **Star Level** for the lesson
   - Have **not** already completed the lesson (Approved status)
4. Tick each cadet who completed the lesson
5. Click **Submit Attendance**

**Auto-Approval:** L4+ submissions are automatically Approved. L2/L3 submissions go to the Task List for L4+ review.

**L4+ Override:** Level 4 and above can view ALL lessons for a training night (not just their own) using the date selector.

**Request Lesson Change:** Use the "Request Change" button next to any lesson tab to submit a change request to the L4+ task list.`
  },
  {
    id: 'training-plan',
    title: 'Training Plan (Schedule)',
    level: 'L2 to view / L3 to edit',
    content: `The Training Plan shows the nightly schedule of lessons by star level and period.

**Viewing:** Browse by date. Each card shows Period, Star Level, Lesson Code, Lesson Name, Instructor, Dress Code, Location and Notes.

**Creating/Editing (L3+):**
1. Click **New Night** and select a date
2. For each Star Level and Period, select a lesson from the dropdown
3. Assign an instructor (only instructors qualified for the subject appear highlighted)
4. Set Dress Code, Location and Notes
5. Click **Save**

**Qualification Warnings:** If an instructor is not listed as qualified for the selected subject, a warning is shown.

**Recent Lesson History:** The form shows if a lesson was recently delivered to help avoid repetition.`
  },
  {
    id: 'training-calendar',
    title: 'Training Calendar',
    level: 'L0 to view / L4 to edit',
    content: `The Training Calendar shows all scheduled events in a monthly grid.

**Event Types:** Training Night, Camp, Competition, Admin, Other.

**Compliance Dots:**
- 🟢 Green — Open: 2+ staff available, valid First Aid present
- 🟡 Amber — Compliance issue (no valid First Aid)
- 🔴 Red — Closed: insufficient staff

**Creating Events (L4+):**
1. Click any day on the calendar or click **New Event**
2. Fill in Title, Date, Type, Location
3. Check **Training Night** to enable compliance tracking and availability deadlines
4. Check **Staff Only** to hide the event from cadets (L0-L2)
5. Click **Create**

**Compliance Override (L4+):** Use the dropdown on each Training Night card to manually set the compliance status.

**Staff Availability:** Click any Training Night card and use **My Availability** to submit your availability. L4+ can see all staff responses.

**Opening Hours:** L4+ can manage standard detachment opening times via the Opening Hours button.`
  },
  {
    id: 'bulk-progress',
    title: 'Bulk Progress Entry',
    level: 'L4+',
    content: `Bulk Progress Entry allows rapid recording of lesson completions across multiple cadets at once.

**Usage:**
1. Select **Star Level** and optionally filter by **Subject**
2. Set the **Completion Date**
3. A grid appears: cadets as rows, lessons as columns
4. Tick individual cells, click a cadet name to toggle all their lessons, or click a lesson header to toggle all cadets for that lesson
5. Use **Complete Whole Subject** (visible when a subject filter is active) to tick all incomplete lessons for all cadets in one click
6. Click **Save Completions** to submit

**Lesson Order:** Within each subject, regular lessons appear first (by code), assessments and tests appear last.

**Auto-Approval:** L4+ submissions are immediately Approved and trigger automatic star-level promotion checks.

**Legend:** ✓ = Already approved · ⏳ = Pending approval · * = Mandatory lesson`
  },
  {
    id: 'plan-generator',
    title: 'Training Plan Generator',
    level: 'L4+',
    content: `The Training Plan Generator creates a structured overview of which lessons to deliver across a 3, 6 or 12 month period.

**How to use:**
1. Set the **Start Month** and **Duration** (3, 6 or 12 months)
2. Select which **Star Levels** to plan for
3. Optionally restrict to **Mandatory lessons only**
4. Click **Generate Plan**

**Algorithm:**
- Mandatory lessons are scheduled first within each star level, then optional
- Within each subject, assessments appear at the end
- 2 lesson periods are allocated per star level per training night
- When all lessons in a level are covered, the cycle repeats (shown as Cycle 2, Cycle 3 etc.)

**Requirement:** Training nights must already be added to the Training Calendar for the selected period. If none exist, add them first.

The generator is a **planning tool** — it does not create or modify actual training plan entries. Use the Training Plan page to formally schedule individual nights.`
  },
  {
    id: 'export-pdf',
    title: 'Training Programme Export (PDF)',
    level: 'L3+',
    content: `Generate a professionally formatted ACF Training Programme document.

**Export Settings:**
- **By Month** — select a specific month
- **Date Range** — specify a custom start and end date

The PDF is landscape A4 with:
- ACF dark green header with detachment name and period
- Calendar events section (training nights + other events)
- Per-night breakdown by star level, showing Period, Lesson Code, Lesson Name, Instructor, Location, Dress Code, Notes
- Footer with generation timestamp and page numbers

**Tips:**
- Keep lesson names concise for best layout
- Notes appear in the final column; keep them brief
- Multi-night periods will add new pages automatically`
  },
  {
    id: 'syllabus',
    title: 'Syllabus (Master & Personal)',
    level: 'L0 to view',
    content: `**Master Syllabus:** The official lesson list for each star level. Mandatory lessons are marked with a red asterisk (*). Lessons are grouped by Subject, with assessments shown at the end of each subject group.

**My Syllabus (Personal):** Create your own additional lessons that supplement the Master Syllabus. These appear in lesson selectors marked as "Personal" and are only visible to you.

To add a personal lesson:
1. Go to **My Syllabus**
2. Click **Add Lesson**
3. Enter Star Level, Subject, Lesson Code (e.g. NAV-201), and Lesson Name

System Administrators (L6) can bulk-upload the Master Syllabus from a CSV file via Admin Controls.`
  },
  {
    id: 'progress-matrix',
    title: 'Progress Matrix',
    level: 'L3+',
    content: `The Progress Matrix shows each cadet's completion status across all lessons for their current star level.

- **Green tick (✓)** — Lesson approved
- **Clock (⏳)** — Pending approval
- **Empty** — Not yet completed

Filter by Star Level and search by cadet name. Mandatory lessons are highlighted. The matrix updates in real-time as progress is submitted and approved.`
  },
  {
    id: 'task-list',
    title: 'Task List & Approvals',
    level: 'L2+',
    content: `The Task List has three tabs:

**Pending Approvals:** Progress ledger submissions awaiting L4+ approval. Click the green tick to approve or red X to reject (removes the record).

**Approved:** History of all approved lesson completions.

**Lesson Change Requests:** Requests submitted by instructors to change an assigned lesson. L4+ can approve or reject each request. The requesting instructor's name, lesson and reason are shown.`
  },
  {
    id: 'staff-availability',
    title: 'Staff Availability',
    level: 'L3+',
    content: `Staff Availability allows instructors to declare whether they can attend each upcoming training night.

**Submitting availability:**
1. Navigate to the correct month using the arrows
2. For each training night, click **Available** or **Unavailable**
3. Optionally add a note (e.g. "Arriving late")
4. Availability is saved immediately — no separate save button needed

**L4+ Oversight:** Commanders (L4+) can see all staff responses for each night, broken down into Available, Unavailable and Not Submitted. Instructors assigned in the training plan who are unavailable are highlighted in red with a ⚠ warning.`
  },
  {
    id: 'personnel',
    title: 'Personnel Manager',
    level: 'L5+',
    content: `Manage your detachment's personnel records.

**Adding/Editing:** Click **Add Personnel** or the pencil icon on any record. Fields include PNumber, Rank, Name, Type (Cadet/Adult Instructor), Access Level, Role Name and Star Level.

**Filters:** Search by name/PNumber/rank, filter by type, star level, access level and status.

**Status:** L4+ can see non-Active personnel (Suspended, Leavers etc.). Click a record to open the full profile view with status management.

**View As (L4+):** Click the eye icon on any personnel record to enter "View As" mode. A banner appears at the top showing who you are viewing as. Click **Exit View As** to return to normal.

**Linked accounts:** Records show a "Linked" badge when the person has connected their app login.`
  },
  {
    id: 'cfav-governance',
    title: 'CFAV Governance',
    level: 'L3+',
    content: `Track mandatory training compliance for all Adult Instructors (CFAVs).

**Mandatory courses:** First Aid, Data Protection, Safeguarding, Fire Safety, Medication Management, Cold Injury and Heat Illness, Mental Health Awareness.

**Status colours:**
- 🟢 Green — Valid and current
- 🟡 Amber — Expiring within 60 days
- 🔴 Red — Expired or not recorded

**Adding a record:** Click **Record Training** or select an instructor and add the course, completion date and expiry date.

Governance failures are also visible on the Analytics Dashboard.`
  },
  {
    id: 'wht',
    title: 'Weapon Handling Tests (WHT)',
    level: 'L0 to view own',
    content: `Record and track Weapon Handling Test results for cadets and CFAVs.

Each WHT record includes:
- Weapon type (e.g. L98A2, L85A2)
- Test date and expiry date (typically 6 months)
- Assessor PNumber
- Notes

Records expiring within 30 days are highlighted amber; expired records are highlighted red.`
  },
  {
    id: 'instructor-quals',
    title: 'Instructor Qualifications Matrix',
    level: 'L3+',
    content: `The Instructor Qualifications Matrix shows all adult instructors and their qualification status across all defined qualification columns.

**Adding qualifications:** Click any cell to record a qualification award date for that instructor/qualification combination.

**Qualification columns** are managed by L5+ via the Admin Controls or the "Manage Columns" button on the page.

Qualifications are also visible on individual personnel profiles.`
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    level: 'L4+',
    content: `The Analytics Dashboard provides training, attendance and compliance insights:

- **Active Cadets / Instructors** — current headcount
- **Lessons Approved** — total approved completions
- **Governance Issues** — count of instructors with compliance failures
- **Cadet Attendance Rate** (last 30 days, by star level)
- **Staff Availability Trend** (last 8 training nights)
- **Mandatory Lesson Completion** — average % completion at current star level per group
- **Adults Failing Mandatory Compliance** — list with specific missing courses
- **Adult Instructor Attendance** — bar chart of nights attended vs total (last 30 days)

Data updates in real-time from parade state, progress ledger and governance records.`
  },
  {
    id: 'admin-controls',
    title: 'Admin Controls',
    level: 'L5+',
    content: `**Detachment Commander (L5+):**
- Set your **Detachment Name** (used in all PDF exports and headers)
- **Import Personnel Roster** via CSV (columns: PNumber, Rank, FirstName, Surname, Type, AccessLevel, RoleName, CurrentStarLevel)
- **Purge Personnel Roster** — permanently removes all personnel records

**System Administrator (L6 only):**
- **Upload Master Syllabus** via CSV (columns: LessonCode, StarLevel, SubjectName, LessonName, IsMandatory)
- **Purge Master Syllabus** — permanently removes all syllabus records

⚠ Purge operations cannot be undone.`
  },
  {
    id: 'lesson-change-requests',
    title: 'Requesting a Lesson Change',
    level: 'L2+',
    content: `If you need a change to a lesson you have been assigned to deliver:

1. Go to **Lesson Attendance**
2. Select the relevant lesson tab
3. Click the **Request Change** button (pencil icon) next to the lesson
4. Describe the change you are requesting and your reason
5. Click **Submit Request**

The request is added to the L4+ **Task List → Lesson Change Requests** tab for review. You will need to confirm the outcome with your commander directly as the app does not currently send notifications.`
  },
  {
    id: 'notices',
    title: 'Important Notices',
    level: 'L0 to view',
    content: `Notices appear on the Dashboard and in the dedicated **Notices** page.

**Priority levels:** Low, Normal, High (amber), Urgent (red).

Notices can be set with an **expiry date** — they are automatically hidden after that date. L4+ can create, edit and deactivate notices. A notice can be deactivated without deleting it using the toggle on the notices management page.`
  },
  {
    id: 'shorthand',
    title: 'PDF Lesson Code Shorthand',
    level: null,
    content: `When exporting the Training Plan to PDF, lesson codes are abbreviated for the notice-board layout.

**Rule:** Text before the first hyphen ("-") becomes the subject short code.

**Examples:**
- \`MAP-101\` → **MAP**
- \`NAV-305\` → **NAV**
- \`FIELDCRAFT-102\` → **FIELDCRAFT**

Keep lesson codes in the format SUBJECT-NUMBER for best results.`
  },
];

export default function HelpWiki() {
  const [search, setSearch] = useState('');

  const filtered = SECTIONS.filter(s =>
    !search ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Help & Wiki"
        description="Complete guide to using the ACF Training Manager"
        icon={HelpCircle}
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search help topics..."
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
        <Accordion type="multiple" className="space-y-2">
          {filtered.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  {section.title}
                  {section.level && (
                    <Badge variant="outline" className="text-xs font-normal">{section.level}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pb-2">
                  {section.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}