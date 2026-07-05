import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  LessonCode: '', StarLevel: 'Basic', SubjectName: '', LessonName: '',
  IsMandatory: false, LessonType: 'Lesson', RequiredQual: '',
};

export default function SyllabusEditorDialog({ lesson, open: controlledOpen, onOpenChange, trigger }) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const isEdit = !!lesson;
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(v) {
    if (isControlled) onOpenChange(v);
    else setInternalOpen(v);
  }

  useEffect(() => {
    if (open) setForm(lesson ? { ...emptyForm, ...lesson } : emptyForm);
  }, [open, lesson]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.SyllabusMaster.update(lesson.id, data)
      : base44.entities.SyllabusMaster.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      toast.success(isEdit ? 'Lesson updated' : 'Lesson added to syllabus');
      setOpen(false);
    },
  });

  const { id, created_date, updated_date, created_by_id, ...payload } = form;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || <Button><Plus className="w-4 h-4 mr-2" />Add Lesson</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lesson' : 'Add Lesson to Master Syllabus'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Lesson Code</Label>
              <Input value={form.LessonCode} onChange={(e) => setForm(p => ({ ...p, LessonCode: e.target.value }))} placeholder="e.g. 1S-DRILL-01" />
            </div>
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
                  <SelectItem value="Adult">Adult</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={form.SubjectName} onChange={(e) => setForm(p => ({ ...p, SubjectName: e.target.value }))} placeholder="e.g. Drill" />
          </div>
          <div>
            <Label>Lesson Name</Label>
            <Input value={form.LessonName} onChange={(e) => setForm(p => ({ ...p, LessonName: e.target.value }))} placeholder="e.g. Foot Drill Basics" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Lesson Type</Label>
              <Select value={form.LessonType || 'Lesson'} onValueChange={(v) => setForm(p => ({ ...p, LessonType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lesson">Lesson</SelectItem>
                  <SelectItem value="Physical Assessment">Physical Assessment</SelectItem>
                  <SelectItem value="Auto-Assessment">Auto-Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Required Qual</Label>
              <Input value={form.RequiredQual || ''} onChange={(e) => setForm(p => ({ ...p, RequiredQual: e.target.value.toUpperCase() }))} placeholder="e.g. SAAI" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.IsMandatory} onCheckedChange={(v) => setForm(p => ({ ...p, IsMandatory: !!v }))} />
            <span className="text-sm">Mandatory lesson</span>
          </label>
          <Button
            className="w-full"
            disabled={!form.LessonCode || !form.SubjectName || !form.LessonName || saveMutation.isPending}
            onClick={() => saveMutation.mutate(payload)}
          >
            {saveMutation.isPending ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Lesson')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}