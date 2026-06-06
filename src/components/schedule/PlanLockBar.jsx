import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { toast } from 'sonner';

export default function PlanLockBar({ trainingMonths, currentMonthStr, isDC }) {
  const queryClient = useQueryClient();

  // Find the TrainingMonth record for a given YYYY-MM string
  function getMonthRecord(monthStr) {
    return trainingMonths.find(m => m.MonthDate && m.MonthDate.startsWith(monthStr));
  }

  const lockMutation = useMutation({
    mutationFn: async ({ monthStr, lock }) => {
      const existing = getMonthRecord(monthStr);
      const monthDate = `${monthStr}-01`;
      if (existing) {
        await base44.entities.TrainingMonth.update(existing.id, { IsLocked: lock });
      } else {
        await base44.entities.TrainingMonth.create({ MonthDate: monthDate, IsLocked: lock });
      }
    },
    onSuccess: (_, { lock }) => {
      queryClient.invalidateQueries({ queryKey: ['training-months'] });
      toast.success(lock ? 'Month locked — plan is now read-only for cadets and instructors' : 'Month unlocked');
    },
  });

  if (!isDC) return null;

  // Get months present in training months data (plus current month)
  const monthsToShow = [...new Set(trainingMonths.map(m => m.MonthDate?.slice(0, 7)).filter(Boolean))];
  if (!monthsToShow.includes(currentMonthStr)) monthsToShow.push(currentMonthStr);
  monthsToShow.sort();

  return (
    <div className="mb-4 p-3 rounded-xl border-2 border-primary/20 bg-primary/5 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-primary font-semibold text-sm">
        <Lock className="w-4 h-4" />
        Plan Lock Controls (DC Only)
      </div>
      <div className="flex flex-wrap gap-2 flex-1">
        {monthsToShow.map(monthStr => {
          const rec = getMonthRecord(monthStr);
          const isLocked = !!rec?.IsLocked;
          const label = format(parseISO(`${monthStr}-01`), 'MMM yyyy');
          return (
            <div key={monthStr} className="flex items-center gap-1.5">
              <Badge variant={isLocked ? 'default' : 'outline'} className="text-xs">
                {isLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                {label}
              </Badge>
              <Button
                size="sm"
                variant={isLocked ? 'outline' : 'default'}
                className="h-6 text-xs px-2"
                onClick={() => lockMutation.mutate({ monthStr, lock: !isLocked })}
                disabled={lockMutation.isPending}
              >
                {isLocked ? 'Unlock' : 'Lock'}
              </Button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <AlertTriangle className="w-3 h-3" />
        Locked months are read-only for all non-DC roles
      </div>
    </div>
  );
}