import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function QuickAssignModal({ open, onOpenChange, cadetCount, myLessons, syllabus, onConfirm, isPending }) {
  const [mode, setMode] = useState('existing');
  const [existingLessonCode, setExistingLessonCode] = useState('');
  const [newLessonSearch, setNewLessonSearch] = useState('');
  const [newLessonCode, setNewLessonCode] = useState('');
  const [activityText, setActivityText] = useState('');

  const filteredSyllabus = syllabus.filter(l =>
    !newLessonSearch ||
    l.LessonName?.toLowerCase().includes(newLessonSearch.toLowerCase()) ||
    l.LessonCode?.toLowerCase().includes(newLessonSearch.toLowerCase())
  ).slice(0, 20);

  function reset() {
    setMode('existing');
    setExistingLessonCode('');
    setNewLessonSearch('');
    setNewLessonCode('');
    setActivityText('');
  }

  function handleConfirm() {
    if (mode === 'existing') {
      const lesson = myLessons.find(l => l.LessonCode === existingLessonCode);
      if (!lesson) return;
      onConfirm({ mode, lessonCode: lesson.LessonCode, notes: '' });
    } else if (mode === 'new') {
      if (!newLessonCode) return;
      onConfirm({ mode, lessonCode: newLessonCode, notes: '' });
    } else {
      if (!activityText.trim()) return;
      onConfirm({ mode, lessonCode: 'ACTIVITY', notes: activityText.trim() });
    }
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign {cadetCount} Cadet{cadetCount === 1 ? '' : 's'}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="mode-existing" />
              <Label htmlFor="mode-existing" className="font-normal">Assign to an ongoing lesson tonight</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new" className="font-normal">Assign to a different syllabus lesson</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="activity" id="mode-activity" />
              <Label htmlFor="mode-activity" className="font-normal">Assign to an ad-hoc activity</Label>
            </div>
          </RadioGroup>

          {mode === 'existing' && (
            <Select value={existingLessonCode} onValueChange={setExistingLessonCode}>
              <SelectTrigger><SelectValue placeholder="Select tonight's lesson..." /></SelectTrigger>
              <SelectContent>
                {myLessons.map(l => (
                  <SelectItem key={l.id} value={l.LessonCode}>
                    P{l.Period} · {l.AssignedStarLevel} · {l.LessonCode} — {l.LessonName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {mode === 'new' && (
            <div className="space-y-2">
              <Input
                placeholder="Search syllabus by name or code..."
                value={newLessonSearch}
                onChange={e => setNewLessonSearch(e.target.value)}
              />
              <Select value={newLessonCode} onValueChange={setNewLessonCode}>
                <SelectTrigger><SelectValue placeholder="Select lesson..." /></SelectTrigger>
                <SelectContent>
                  {filteredSyllabus.map(l => (
                    <SelectItem key={l.LessonCode} value={l.LessonCode}>
                      {l.StarLevel} · {l.LessonCode} — {l.LessonName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'activity' && (
            <Input
              placeholder="e.g. Drill Practice, Kit Maintenance..."
              value={activityText}
              onChange={e => setActivityText(e.target.value)}
            />
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={isPending}>Confirm Assignment</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}