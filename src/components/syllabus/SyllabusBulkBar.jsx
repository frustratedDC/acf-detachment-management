import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SyllabusBulkBar({ selectedIds, onClear }) {
  const queryClient = useQueryClient();
  const [lessonType, setLessonType] = useState('');
  const [requiredQuals, setRequiredQuals] = useState('');

  const { data: qualColumns = [] } = useQuery({
    queryKey: ['qual-columns'],
    queryFn: () => base44.entities.QualificationColumn.filter({}),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const codes = requiredQuals
        ? [...new Set(requiredQuals.split(',').map(c => c.trim().toUpperCase()).filter(Boolean))]
        : null;

      if (codes) {
        const existingCodes = new Set(qualColumns.map(c => c.Code));
        for (const code of codes.filter(c => !existingCodes.has(c))) {
          await base44.entities.QualificationColumn.create({ Code: code, Name: code });
        }
      }

      const updates = selectedIds.map(id => {
        const data = {};
        if (lessonType) data.LessonType = lessonType;
        if (codes) data.RequiredQuals = codes;
        return { id, ...data };
      });
      return base44.entities.SyllabusMaster.bulkUpdate(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      queryClient.invalidateQueries({ queryKey: ['qual-columns'] });
      toast.success(`Updated ${selectedIds.length} lessons`);
      setLessonType('');
      setRequiredQuals('');
      onClear();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-accent/10 mb-4">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <Select value={lessonType} onValueChange={setLessonType}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Set Lesson Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Lesson">Lesson</SelectItem>
          <SelectItem value="Physical Assessment">Physical Assessment</SelectItem>
          <SelectItem value="Auto-Assessment">Auto-Assessment</SelectItem>
        </SelectContent>
      </Select>
      <Input
        className="w-56"
        placeholder="Required Quals, comma separated"
        value={requiredQuals}
        onChange={(e) => setRequiredQuals(e.target.value)}
      />
      <Button
        size="sm"
        disabled={(!lessonType && !requiredQuals) || applyMutation.isPending}
        onClick={() => applyMutation.mutate()}
      >
        <Check className="w-4 h-4 mr-1" />Apply to Selected
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="w-4 h-4 mr-1" />Clear
      </Button>
    </div>
  );
}