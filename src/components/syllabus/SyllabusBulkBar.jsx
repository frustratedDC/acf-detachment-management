import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SyllabusBulkBar({ selectedIds, onClear }) {
  const queryClient = useQueryClient();
  const [lessonType, setLessonType] = useState('');
  const [requiredQual, setRequiredQual] = useState('');

  const applyMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedIds.map(id => {
        const data = {};
        if (lessonType) data.LessonType = lessonType;
        if (requiredQual) data.RequiredQual = requiredQual.toUpperCase();
        return { id, ...data };
      });
      return base44.entities.SyllabusMaster.bulkUpdate(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      toast.success(`Updated ${selectedIds.length} lessons`);
      setLessonType('');
      setRequiredQual('');
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
        className="w-36"
        placeholder="Required Qual"
        value={requiredQual}
        onChange={(e) => setRequiredQual(e.target.value)}
      />
      <Button
        size="sm"
        disabled={(!lessonType && !requiredQual) || applyMutation.isPending}
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