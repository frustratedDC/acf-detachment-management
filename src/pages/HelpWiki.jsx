import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, BookOpen, Clock, FileText, Wrench } from 'lucide-react';

const sections = [
  {
    id: 'personal-lessons',
    icon: BookOpen,
    title: 'Adding Personal Lessons',
    content: `Navigate to **My Syllabus** from the sidebar. Click the **"Add Lesson"** button to open the form.

Fill in:
- **Star Level** — Select Basic, 1 Star, or 2 Star
- **Subject Name** — The category of the lesson (e.g. Navigation, Fieldcraft)
- **Lesson Code** — A unique code (e.g. NAV-201). Use the format SUBJECT-NUMBER
- **Lesson Name** — A descriptive name for the lesson

Your personal lessons will appear in lesson dropdown selectors alongside the Master Syllabus entries, marked with a "Personal" tag. These entries are private and only visible to you.`
  },
  {
    id: 'custom-timing',
    icon: Clock,
    title: 'Managing Training Schedules',
    content: `The **Training Plan** page allows Level 2+ users to create and manage nightly training schedules.

**Creating a New Training Night:**
1. Click **"New Night"** and select a date
2. For each Star Level (Basic, 1 Star, 2 Star) and Period (1, 2):
   - Select a lesson from the merged dropdown
   - Assign an instructor
   - Set dress code and location
   - Add any notes
3. Click **"Save Schedule"**

**Editing/Deleting:** Use the pencil or trash icons on existing entries. Edits and deletes apply to the entire training night.`
  },
  {
    id: 'shorthand',
    icon: FileText,
    title: 'Understanding Subject Shorthand Codes',
    content: `When exporting the Training Plan to PDF, lesson codes are shortened for the notice-board layout.

**Rule:** Text before the first hyphen ("-") is extracted as the Subject Short code.

**Examples:**
- \`MAP-101\` → **MAP**
- \`NAV-305\` → **NAV**
- \`DRI-200\` → **DRI**
- \`FIELDCRAFT-102\` → **FIELDCRAFT**

This shorthand appears on Line 1 of each lesson cell in the PDF export.`
  },
  {
    id: 'pdf-troubleshooting',
    icon: Wrench,
    title: 'Troubleshooting PDF Layout',
    content: `**PDF Export** generates a landscape notice-board format.

**Common Issues:**

**Notes box not appearing:**
The "Lesson Notes & Administrative Instructions" box only appears when at least one Star Level on that date has notes entered. If all notes fields are empty, the box is hidden by design.

**Text overflow:**
Keep lesson names and notes concise. The PDF uses 8pt for lesson details and 7pt for instructor/location info.

**Column widths:**
Parade columns (1900, 1950, 2045) are narrower by 30%. Lesson columns (1910, 2005) expand to fill remaining space.

**Logo:**
The logo is placed at 35x35px in the top-right corner, vertically centred to the header height.`
  },
];

export default function HelpWiki() {
  return (
    <div>
      <PageHeader
        title="Help & Wiki"
        description="Guide to using the ACF Training Manager"
        icon={HelpCircle}
      />

      <Accordion type="single" collapsible className="space-y-2">
        {sections.map(section => (
          <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <div className="flex items-center gap-2">
                <section.icon className="w-4 h-4 text-accent" />
                {section.title}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}