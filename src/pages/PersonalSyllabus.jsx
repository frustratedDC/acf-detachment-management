import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BookOpenCheck, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import _ from 'lodash';

export default function PersonalSyllabus() {
  const { personnel } = usePersonnel();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ StarLevel: 'Basic', SubjectName: '', LessonCode: '', LessonName: '' });

  const { data: lessons = [] } = useQuery({
    queryKey: ['personal-syllabus', personnel?.PNumber],
    queryFn: () => base44.entities.PersonalSyllabus.filter({ UserPNumber: personnel?.PNumber }),
    enabled: !!personnel?.PNumber,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PersonalSyllabus.create({
      ...data,
      UserPNumber: personnel.PNumber,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-syllabus'] });
      toast.success('Lesson added');
      setOpen(false);
      setForm({ StarLevel: 'Basic', SubjectName: '', LessonCode: '', LessonName: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PersonalSyllabus.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-syllabus'] });
      toast.success('Lesson removed');
    },
  });

  const grouped = _.groupBy(lessons, 'SubjectName');

  return (
    <div>
      <PageHeader
        title="Ad-Hoc Syllabus"
        description="Additional lessons outside the master syllabus"
        icon={BookOpenCheck}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Lesson</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Personal Lesson</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Star Level</Label>
                  <Select value={form.StarLevel} onValueChange={(v) => setForm(p => ({ ...p, StarLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="1 Star">1 Star</SelectItem>
                      <SelectItem value="2 Star">2 Star</SelectItem>
                      <SelectItem value="3 Star">3 Star</SelectItem>
                      <SelectItem value="4 Star">4 Star</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject Name</Label>
                  <Input value={form.SubjectName} onChange={(e) => setForm(p => ({ ...p, SubjectName: e.target.value }))} placeholder="e.g. Navigation" />
                </div>
                <div>
                  <Label>Lesson Code</Label>
                  <Input value={form.LessonCode} onChange={(e) => setForm(p => ({ ...p, LessonCode: e.target.value }))} placeholder="e.g. NAV-201" />
                </div>
                <div>
                  <Label>Lesson Name</Label>
                  <Input value={form.LessonName} onChange={(e) => setForm(p => ({ ...p, LessonName: e.target.value }))} placeholder="e.g. Advanced Map Reading" />
                </div>
                <Button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.SubjectName || !form.LessonCode || !form.LessonName || createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? 'Adding...' : 'Add Lesson'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpenCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No personal lessons yet. Add your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.keys(grouped).sort().map(subject => (
            <Card key={subject}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{subject}</CardTitle>
              </CardHeader>
              <CardContent>
                {_.sortBy(grouped[subject], 'LessonName').map(lesson => (
                  <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{lesson.LessonCode}</code>
                    <span className="text-sm flex-1">{lesson.LessonName}</span>
                    <span className="text-xs text-muted-foreground">{lesson.StarLevel}</span>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(lesson.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}