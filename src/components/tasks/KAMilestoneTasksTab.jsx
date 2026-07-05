import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function KAMilestoneTasksTab({ tasks, currentPNumber }) {
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.KAMilestoneTask.update(id, {
      Status: status,
      ApprovedByPNumber: currentPNumber,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ka-milestone-tasks'] });
      toast.success('KA milestone updated');
    },
  });

  return (
    <Card>
      <CardContent className="p-2">
        {tasks.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No KA milestones awaiting sign-off.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {task.CadetName || task.CadetPNumber}
                      {' — '}<span className="text-primary">{task.MilestonePoints}pt milestone</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total accumulated points: {task.TotalPoints}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => resolveMutation.mutate({ id: task.id, status: 'Approved' })}>
                    <Check className="w-3.5 h-3.5 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => resolveMutation.mutate({ id: task.id, status: 'Rejected' })}>
                    <X className="w-3.5 h-3.5 mr-1" />Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}