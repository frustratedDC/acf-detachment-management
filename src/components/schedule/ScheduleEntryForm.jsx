import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import LessonSelector from '@/components/shared/LessonSelector';
import SmartInput from '@/components/shared/SmartInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star'];
const PERIODS = [1, 2];

const emptyEntry = () => ({
  InstructorPNumber: '',
  LessonCode: '',
  LessonName: '',
  DressCode: '',
  Location: '',
  Notes: '',
});

export default function ScheduleEntryForm({ date, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [formDate, setFormDate] = useState(date);
  const [entries, setEntries] = useState({});

  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const all = await base44.entities.PersonnelManager.filter({});
      return all.filter(p => p.AccessLevel >= 2);
    },
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['staff-availability'],
    queryFn: () => base44.entities.StaffAvailability.filter({}),
  });

  function isAvailableOnDate(pNumber) {
    const rec = availability.find(a => a.EventDate === formDate && a.PNumber === pNumber);
    return rec ? rec.IsAvailable : null; // null = no response
  }

  const { data: existingEntries = [] } = useQuery({
    queryKey: ['schedule-date', formDate],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: formDate }),
  });

  const { data: allLessons = [] } = useQuery({
    queryKey: ['all-syllabus'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  useEffect(() => {
    const map = {};
    STAR_LEVELS.forEach(star => {
      PERIODS.forEach(period => {
        const key = `${star}-${period}`;
        const existing = existingEntries.find(e => e.AssignedStarLevel === star && e.Period === period);
        map[key] = existing ? {
          InstructorPNumber: existing.InstructorPNumber || '',
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing entries for this date
      for (const e of existingEntries) {
        await base44.entities.NightlySchedule.delete(e.id);
      }
      // Create new entries
      const records = [];
      STAR_LEVELS.forEach(star => {
        PERIODS.forEach(period => {
          const key = `${star}-${period}`;
          const entry = entries[key];
          if (entry && entry.LessonCode) {
            const lesson = allLessons.find(l => l.LessonCode === entry.LessonCode);
            records.push({
              Date: formDate,
              Period: period,
              AssignedStarLevel: star,
              InstructorPNumber: entry.InstructorPNumber,
              LessonCode: entry.LessonCode,
              LessonName: lesson?.LessonName || entry.LessonName || entry.LessonCode,
              DressCode: entry.DressCode,
              Location: entry.Location,
              Notes: entry.Notes,
            });
          }
        });
      });
      if (records.length > 0) {
        await base44.entities.NightlySchedule.bulkCreate(records);
      }
    },
    onSuccess: () => {
      toast.success('Schedule saved');
      onSaved();
    },
  });

  function updateEntry(key, field, value) {
    setEntries(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  return (
    <Card className="mb-6 border-accent/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Schedule Entry</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className="w-44"
          />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {STAR_LEVELS.map(star => (
            <div key={star}>
              <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">{star}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {PERIODS.map(period => {
                  const key = `${star}-${period}`;
                  const entry = entries[key] || emptyEntry();
                  return (
                    <div key={key} className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground">Period {period}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Lesson</Label>
                          <LessonSelector
                            value={entry.LessonCode}
                            onChange={(val) => updateEntry(key, 'LessonCode', val)}
                            starLevel={star}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Instructor</Label>
                          <Select
                            value={entry.InstructorPNumber}
                            onValueChange={(val) => updateEntry(key, 'InstructorPNumber', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {instructors.map(i => {
                                const avail = isAvailableOnDate(i.PNumber);
                                return (
                                  <SelectItem key={i.PNumber} value={i.PNumber}>
                                    {avail === true ? '✓ ' : avail === false ? '✗ ' : ''}{i.Rank ? `${i.Rank} ` : ''}{i.Surname} ({i.PNumber})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Dress Code</Label>
                          <SmartInput
                            fieldKey="dress_code"
                            value={entry.DressCode}
                            onChange={(val) => updateEntry(key, 'DressCode', val)}
                            placeholder="e.g. CS95"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Location</Label>
                          <SmartInput
                            fieldKey="location"
                            value={entry.Location}
                            onChange={(val) => updateEntry(key, 'Location', val)}
                            placeholder="e.g. Main Hall"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          value={entry.Notes}
                          onChange={(e) => updateEntry(key, 'Notes', e.target.value)}
                          rows={2}
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6 gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}