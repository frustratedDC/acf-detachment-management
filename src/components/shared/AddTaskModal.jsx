import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

export default function AddTaskModal({ open, onOpenChange }) {
  const { personnel } = usePersonnel();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');

  const createMutation = useMutation({
    mutationFn: () => base44.entities.PersonalToDo.create({
      Title: title,
      Description: description,
      Priority: priority,
      Status: 'Open',
      OwnerPNumber: personnel?.PNumber || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-todos'] });
      toast.success('Task added');
      setTitle('');
      setDescription('');
      setPriority('Medium');
      onOpenChange(false);
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add To-Do</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            Add Task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}