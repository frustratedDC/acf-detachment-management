import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  LessonCode: '', StarLevel: 'Basic', SubjectName: '', LessonName: '',
  IsMandatory: false, LessonType: 'Lesson', RequiredQuals: [],
};

// Ensures every qual code referenced by the syllabus exists as a QualificationColumn
// so it appears in the Instructor Qualifications matrix.
async function syncQualColumns(codes, existingColumns) {
  const existingCodes = new Set(existingColumns.map(c => c.Code));
  const missing = [...new Set(codes)].filter(c => c && !existingCodes.has(c));
  for (const code of missing) {
    await base44.entities.QualificationColumn.create({ Code: code, Name: code });
  }
}

export default function SyllabusEditorDialog({ lesson, open: controlledOpen, onOpenChange, trigger }) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [qualInput, setQualInput] = useState('');
  const isEdit = !!lesson;
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const { data: qualColumns = [] } = useQuery({
    queryKey: ['qual-columns'],
    queryFn: () => base44.entities.QualificationColumn.filter({}),
  });

  function setOpen(v) {
    if (isControlled) onOpenChange(v);
    else setInternalOpen(v);
  }

  useEffect(() => {
    if (open) setForm(lesson ? { ...emptyForm, ...lesson, RequiredQuals: lesson.RequiredQuals || [] } : emptyForm);
  }, [open, lesson]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      await syncQualColumns(data.RequiredQuals, qualColumns);
      return isEdit
        ? base44.entities.SyllabusMaster.update(lesson.id, data)
        : base44.entities.SyllabusMaster.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      queryClient.invalidateQueries({ queryKey: ['qual-columns'] });
      toast.success(isEdit ? 'Lesson updated' : 'Lesson added to syllabus');
      setOpen(false);
    },
  });

  const { id, created_date, updated_date, created_by_id, ...payload } = form;

  function addQual() {
    const code = qualInput.trim().toUpperCase();
    if (!code) return;
    if (!form.RequiredQuals.includes(code)) {
      setForm(p => ({ ...p, RequiredQuals: [...p.RequiredQuals, code] }));
    }
    setQualInput('');
  }

  function removeQual(code) {
    setForm(p => ({ ...p, RequiredQuals: p.RequiredQuals.filter(c => c !== code) }));
  }

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
            <Label>Required Qualifications (any one applies)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={qualInput}
                onChange={(e) => setQualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQual(); } }}
                placeholder="e.g. DCCT, SR, LR, NRSA_YPS"
                list="qual-code-suggestions"
              />
              <datalist id="qual-code-suggestions">
                {qualColumns.map(c => <option key={c.Code} value={c.Code} />)}
              </datalist>
              <Button type="button" variant="outline" onClick={addQual}>Add</Button>
            </div>
            {form.RequiredQuals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.RequiredQuals.map(code => (
                  <Badge key={code} variant="outline" className="text-xs gap-1">
                    {code}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeQual(code)} />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Any qualification added here is automatically added to Instructor Qualifications if it doesn't already exist.</p>
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