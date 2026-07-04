import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import LessonSelector from '@/components/shared/LessonSelector';
import SmartInput from '@/components/shared/SmartInput';
import DutyCadetAssignment from '@/components/schedule/DutyCadetAssignment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { subMonths, parseISO, subDays, format as dateFnsFormat } from 'date-fns';

const STAR_LEVELS = ['Admin', 'Basic', '1 Star', '2 Star', '3 Star', '4 Star'];
const PERIODS = [1, 2];

const emptyEntry = () => ({
  InstructorPNumber: '',
  Instructor2PNumber: '',
  LessonCode: '',
  LessonName: '',
  DressCode: '',
  Location: '',
  Notes: '',
});

function RecentDaysSummary({ schedule, personnel, formDate }) {
  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const prevDates = [...new Set(
    schedule
      .filter(s => s.Date < formDate)
      .map(s => s.Date)
      .sort()
      .reverse()
      .slice(0, 2)
  )];

  if (prevDates.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Entries</p>
      {prevDates.map(d => {
        const rows = schedule.filter(s => s.Date === d).sort((a, b) => a.Period - b.Period);
        return (
          <div key={d} className="p-2 rounded-lg bg-muted/40 border">
            <p className="text-xs font-bold text-muted-foreground mb-1.5">{dateFnsFormat(parseISO(d), 'EEE dd MMM yyyy')}</p>
            <div className="flex flex-wrap gap-1.5">
              {rows.map(r => {
                const inst = personnelMap[r.InstructorPNumber];
                return (
                  <div key={r.id} className="flex items-center gap-1 text-xs bg-background rounded px-2 py-0.5 border">
                    <Badge variant="outline" className="text-xs py-0 h-4">P{r.Period}</Badge>
                    <span className="text-muted-foreground">{r.AssignedStarLevel}</span>
                    <span className="font-medium truncate max-w-[120px]">{r.LessonName || r.LessonCode}</span>
                    {inst && <span className="text-muted-foreground">{inst.Rank ? `${inst.Rank} ` : ''}{inst.Surname}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ScheduleEntryForm({ date, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [formDate, setFormDate] = useState(date);
  const [entries, setEntries] = useState({});
  const [expandedStars, setExpandedStars] = useState({ 'Admin': false, 'Basic': true, '1 Star': true, '2 Star': true, '3 Star': false, '4 Star': false });
  const [dayNotes, setDayNotes] = useState('');

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const all = await base44.entities.PersonnelManager.filter({});
      return all.filter(p => p.AccessLevel >= 2 && (p.PersonnelStatus || 'Active') === 'Active');
    },
  });

  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['instructor-availability'],
    queryFn: () => base44.entities.InstructorAvailability.list(),
  });

  const { data: recentSchedule = [] } = useQuery({
    queryKey: ['schedule-recent'],
    queryFn: () => base44.entities.NightlySchedule.filter({}),
  });

  const { data: existingEntries = [] } = useQuery({
    queryKey: ['schedule-date', formDate],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: formDate }),
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['all-syllabus'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: dayEvents = [] } = useQuery({
    queryKey: ['calendar-event-date', formDate],
    queryFn: () => base44.entities.CalendarEvent.filter({ Date: formDate, IsTrainingNight: true }),
  });

  useEffect(() => {
    setDayNotes(dayEvents[0]?.Notes || '');
  }, [dayEvents]);

  useEffect(() => {
    const map = {};
    STAR_LEVELS.forEach(star => {
      PERIODS.forEach(period => {
        const key = `${star}-${period}`;
        const existing = existingEntries.find(e => e.AssignedStarLevel === star && e.Period === period);
        map[key] = existing ? {
          InstructorPNumber: existing.InstructorPNumber || '',
          Instructor2PNumber: existing.Instructor2PNumber || '',
          LessonCode: existing.LessonCode || '',
          LessonName: existing.LessonName || '',
          DressCode: existing.DressCode || '',
          Location: existing.Location || '',
          Notes: existing.Notes || '',
        } : emptyEntry();
      });
    });
    setEntries(map);
  }, [existingEntries]);

  function isAvailableOnDate(pNumber) {
    const rec = availability.find(a => a.Date === formDate && a.InstructorPNumber === pNumber);
    if (!rec) return null;
    return rec.Status === 'Available';
  }

  function recentLessonWarning(lessonCode) {
    if (!lessonCode) return null;
    const twoMonthsAgo = subMonths(new Date(), 2);
    const recent = recentSchedule.find(s =>
      s.LessonCode === lessonCode && s.Date !== formDate && parseISO(s.Date) >= twoMonthsAgo
    );
    return recent ? `Last taught ${recent.Date}` : null;
  }

  function instructorQualWarning(pNumber, lessonCode) {
    if (!pNumber || !lessonCode) return null;
    const instructor = instructors.find(i => i.PNumber === pNumber);
    if (!instructor) return null;
    const lesson = allLessons.find(l => l.LessonCode === lessonCode);
    if (!lesson) return null;
    const qualified = instructor.QualifiedSubjects || [];
    if (qualified.length === 0) return null;
    if (!qualified.includes(lesson.SubjectName)) return `Not qualified: ${lesson.SubjectName}`;
    return null;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const e of existingEntries) await base44.entities.NightlySchedule.delete(e.id);
      const records = [];
      STAR_LEVELS.forEach(star => {
        PERIODS.forEach(period => {
          const key = `${star}-${period}`;
          const entry = entries[key];
          if (entry && entry.LessonCode) {
            const lesson = allLessons.find(l => l.LessonCode === entry.LessonCode);
            records.push({
              Date: formDate, Period: period, AssignedStarLevel: star,
              InstructorPNumber: entry.InstructorPNumber,
              Instructor2PNumber: entry.Instructor2PNumber || '',
              LessonCode: entry.LessonCode,
              LessonName: lesson?.LessonName || entry.LessonName || entry.LessonCode,
              DressCode: entry.DressCode, Location: entry.Location, Notes: entry.Notes,
            });
          }
        });
      });
      if (records.length > 0) await base44.entities.NightlySchedule.bulkCreate(records);

      // Training Plan is the source of truth for the calendar — sync the linked event
      const linkedEvents = await base44.entities.CalendarEvent.filter({ Date: formDate, IsTrainingNight: true });
      if (records.length > 0) {
        if (linkedEvents.length === 0) {
          await base44.entities.CalendarEvent.create({
            Title: 'Training Night', Date: formDate, EventType: 'Training Night',
            IsTrainingNight: true, GeneratedFromPlan: true, Notes: dayNotes,
          });
        } else {
          await base44.entities.CalendarEvent.update(linkedEvents[0].id, { Notes: dayNotes });
        }
      } else {
        for (const ev of linkedEvents) {
          if (ev.GeneratedFromPlan) await base44.entities.CalendarEvent.delete(ev.id);
        }
      }
    },
    onSuccess: () => {
      toast.success('Schedule saved');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-event-date', formDate] });
      onSaved();
    },
  });

  function updateEntry(key, field, value) {
    setEntries(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function toggleStar(star) {
    setExpandedStars(prev => ({ ...prev, [star]: !prev[star] }));
  }

  return (
    <Card className="mb-6 border-accent/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Schedule Entry</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-40 h-8 text-sm" />
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Recent days summary */}
        <RecentDaysSummary schedule={recentSchedule} personnel={allPersonnel} formDate={formDate} />

        {/* Day-level notes */}
        <div className="mb-4">
          <Label className="text-xs">Day Notes</Label>
          <textarea
            value={dayNotes}
            onChange={(e) => setDayNotes(e.target.value)}
            placeholder="Notes for this training night (visible to instructors)"
            className="mt-1 w-full text-sm rounded-md border border-input bg-transparent px-3 py-2 shadow-sm min-h-[60px]"
          />
        </div>

        <DutyCadetAssignment date={formDate} />

        {/* Star level sections — collapsible */}
        <div className="space-y-2">
          {STAR_LEVELS.map(star => {
            const isExpanded = expandedStars[star];
            const hasEntries = PERIODS.some(p => entries[`${star}-${p}`]?.LessonCode);
            return (
              <div key={star} className="rounded-lg border overflow-hidden">
                <button
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold transition-colors ${isExpanded ? 'bg-primary/10 text-primary' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
                  onClick={() => toggleStar(star)}
                >
                  <span className="flex items-center gap-2">
                    {star}
                    {hasEntries && <Badge className="text-xs py-0 h-4 bg-primary/20 text-primary border-0">Entries</Badge>}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 bg-background">
                    {PERIODS.map(period => {
                      const key = `${star}-${period}`;
                      const entry = entries[key] || emptyEntry();
                      const lessonWarn = recentLessonWarning(entry.LessonCode);
                      const qualWarn = instructorQualWarning(entry.InstructorPNumber, entry.LessonCode);
                      return (
                        <div key={key} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                          <p className="text-xs font-bold text-muted-foreground">Period {period}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Lesson</Label>
                              <LessonSelector
                                value={entry.LessonCode}
                                onChange={(val) => updateEntry(key, 'LessonCode', val)}
                                starLevel={star}
                              />
                              {lessonWarn && (
                                <p className="text-xs text-yellow-700 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />{lessonWarn}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1">
                             <Label className="text-xs">Instructor 1</Label>
                             <Select value={entry.InstructorPNumber} onValueChange={(val) => updateEntry(key, 'InstructorPNumber', val)}>
                               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value={null}>— None —</SelectItem>
                                 {instructors.map(i => {
                                   const avail = isAvailableOnDate(i.PNumber);
                                   return (
                                     <SelectItem key={i.PNumber} value={i.PNumber}>
                                       {avail === true ? '✓ ' : avail === false ? '✗ ' : ''}{i.Rank ? `${i.Rank} ` : ''}{i.Surname}
                                     </SelectItem>
                                   );
                                 })}
                               </SelectContent>
                             </Select>
                             <Select value={entry.Instructor2PNumber || ''} onValueChange={(val) => updateEntry(key, 'Instructor2PNumber', val)}>
                               <SelectTrigger className="h-7 text-xs border-dashed"><SelectValue placeholder="+ 2nd Instructor" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value={null}>— None —</SelectItem>
                                 {instructors.filter(i => i.PNumber !== entry.InstructorPNumber).map(i => {
                                   const avail = isAvailableOnDate(i.PNumber);
                                   return (
                                     <SelectItem key={i.PNumber} value={i.PNumber}>
                                       {avail === true ? '✓ ' : avail === false ? '✗ ' : ''}{i.Rank ? `${i.Rank} ` : ''}{i.Surname}
                                     </SelectItem>
                                   );
                                 })}
                               </SelectContent>
                             </Select>
                             {qualWarn && (
                               <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                                 <AlertTriangle className="w-3 h-3 shrink-0" />{qualWarn}
                               </p>
                             )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Dress</Label>
                              <SmartInput fieldKey="dress_code" value={entry.DressCode} onChange={(val) => updateEntry(key, 'DressCode', val)} placeholder="e.g. CS95" className="h-8 text-xs" />
                            </div>
                            <div>
                              <Label className="text-xs">Location</Label>
                              <SmartInput fieldKey="location" value={entry.Location} onChange={(val) => updateEntry(key, 'Location', val)} placeholder="e.g. Main Hall" className="h-8 text-xs" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}