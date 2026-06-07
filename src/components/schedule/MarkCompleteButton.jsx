import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

/**
 * Mark Night Complete — Det 2IC+ only.
 * For each scheduled lesson on this date:
 *   1. Find cadets at the correct star level who were marked Present in DailyParadeState.
 *   2. Skip cadets who already have an Approved ProgressLedger record for this lesson.
 *   3. Bulk-create Approved records for all eligible cadets.
 */
export default function MarkCompleteButton({ date, scheduleEntries, accessLevel = 0 }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: paradeState = [], isLoading: loadingParade } = useQuery({
    queryKey: ['parade', date],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: date }),
    enabled: open,
  });

  const { data: allPersonnel = [], isLoading: loadingPersonnel } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
    enabled: open,
  });

  const lessonCodes = [...new Set(scheduleEntries.map(e => e.LessonCode).filter(Boolean))];

  const { data: existingProgress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['progress-batch-check', date],
    queryFn: async () => {
      const results = await Promise.all(
        lessonCodes.map(lc => base44.entities.ProgressLedger.filter({ LessonCode: lc, CompletionDate: date }))
      );
      return results.flat();
    },
    enabled: open && lessonCodes.length > 0,
  });

  const isLoading = loadingParade || loadingPersonnel || (lessonCodes.length > 0 && loadingProgress);

  // Cadets marked Present
  const presentPNumbers = new Set(
    paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber)
  );

  const noParadeData = open && !loadingParade && paradeState.length === 0;

  // Deduplicate entries by LessonCode+StarLevel so we don't double-credit
  const deduplicatedEntries = scheduleEntries.reduce((acc, entry) => {
    const key = `${entry.LessonCode}__${entry.AssignedStarLevel}`;
    if (!acc.seen.has(key) && entry.LessonCode) {
      acc.seen.add(key);
      acc.entries.push(entry);
    }
    return acc;
  }, { seen: new Set(), entries: [] }).entries;

  // Build preview per lesson
  const preview = deduplicatedEntries.map(entry => {
    const eligibleCadets = allPersonnel.filter(p =>
      p.Type === 'Cadet' &&
      (p.PersonnelStatus || 'Active') === 'Active' &&
      p.CurrentStarLevel === entry.AssignedStarLevel &&
      presentPNumbers.has(p.PNumber) &&
      !existingProgress.find(ep =>
        ep.CadetPNumber === p.PNumber &&
        ep.LessonCode === entry.LessonCode &&
        ep.Status === 'Approved'
      )
    );
    return { entry, eligibleCadets };
  }).filter(({ eligibleCadets }) => eligibleCadets.length > 0);

  const totalRecords = preview.reduce((sum, { eligibleCadets }) => sum + eligibleCadets.length, 0);

  const completeMutation = useMutation({
    mutationFn: async () => {
      const records = [];
      preview.forEach(({ entry, eligibleCadets }) => {
        eligibleCadets.forEach(cadet => {
          records.push({
            CadetPNumber: cadet.PNumber,
            LessonCode: entry.LessonCode,
            Status: 'Approved',
            CompletionDate: date,
            InstructorPNumber: entry.InstructorPNumber || entry.Instructor2PNumber || 'SYSTEM',
          });
        });
      });
      if (records.length > 0) {
        await base44.entities.ProgressLedger.bulkCreate(records);
      }
    },
    onSuccess: () => {
      toast.success(`Night marked complete — ${totalRecords} progress records created`);
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['all-progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-batch-check', date] });
      setOpen(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Hard gate — below Det 2IC sees nothing
  if (accessLevel < ACCESS_LEVELS.DET_2IC) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-green-500 text-green-700 hover:bg-green-50"
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        Mark Complete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Mark Night Complete
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Creates <strong>Approved</strong> progress records for all cadets marked <strong>Present</strong> in tonight's parade state, for each lesson at their star level.
              </p>

              {/* No parade state warning */}
              {noParadeData && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No parade state recorded for this date.</p>
                    <p className="text-xs mt-0.5">Complete the Parade State before marking nights complete, or progress records cannot be assigned.</p>
                  </div>
                </div>
              )}

              {!noParadeData && preview.length === 0 && (
                <div className="p-4 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                  No eligible cadets — either no cadets were present or all progress has already been recorded.
                </div>
              )}

              {preview.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {preview.map(({ entry, eligibleCadets }) => (
                    <div key={entry.id} className="p-2.5 rounded-lg border bg-muted/30 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{entry.LessonName || entry.LessonCode}</span>
                        <Badge variant="outline" className="text-xs">{entry.AssignedStarLevel}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Users className="w-3 h-3" />
                        <span>{eligibleCadets.length} cadet{eligibleCadets.length !== 1 ? 's' : ''} will be credited</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {eligibleCadets.map(c => (
                          <Badge key={c.PNumber} variant="secondary" className="text-xs">
                            {c.Rank ? `${c.Rank} ` : ''}{c.Surname}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  disabled={preview.length === 0 || completeMutation.isPending}
                  onClick={() => completeMutation.mutate()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {completeMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Processing...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-1.5" />Confirm — {totalRecords} Records</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}