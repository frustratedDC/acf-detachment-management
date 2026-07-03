import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ListTodo } from 'lucide-react';

const PRIORITY_BADGE = {
  High: 'bg-destructive text-destructive-foreground',
  Medium: 'bg-accent text-accent-foreground',
  Low: 'bg-muted text-muted-foreground',
};

export default function MyToDoWidget() {
  const { personnel } = usePersonnel();
  const queryClient = useQueryClient();

  const { data: todos = [] } = useQuery({
    queryKey: ['my-todos', personnel?.PNumber],
    queryFn: () => base44.entities.PersonalToDo.filter({ OwnerPNumber: personnel?.PNumber, Status: 'Open' }),
    enabled: !!personnel?.PNumber,
  });

  const completeMutation = useMutation({
    mutationFn: (id) => base44.entities.PersonalToDo.update(id, { Status: 'Done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-todos'] }),
  });

  const sorted = [...todos].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.Priority] ?? 1) - (order[b.Priority] ?? 1);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" />
          My To-Do List
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No open tasks.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(todo => (
              <div key={todo.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <Checkbox
                  className="mt-0.5"
                  checked={false}
                  onCheckedChange={() => completeMutation.mutate(todo.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{todo.Title}</p>
                  {todo.Description && <p className="text-xs text-muted-foreground truncate">{todo.Description}</p>}
                </div>
                <Badge className={`text-xs shrink-0 ${PRIORITY_BADGE[todo.Priority] || PRIORITY_BADGE.Medium}`}>
                  {todo.Priority}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}