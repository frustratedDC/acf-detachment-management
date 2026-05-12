import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Check, X, Clock, CheckCircle2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { checkAndPromoteCadet } from '@/lib/progressUtils';

export default function TaskList() {
  const queryClient = useQueryClient();

  const { data: allProgress = [], isLoading } = useQuery({
    queryKey: ['all-progress'],
    queryFn: () => base44.entities.ProgressLedger.list('-created_date', 500),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const pending = allProgress.filter(p => p.Status === 'Pending');
  const approved = allProgress.filter(p => p.Status === 'Approved');

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['lesson-change-requests'],
    queryFn: () => base44.entities.LessonChangeRequest.list('-created_date', 200),
  });

  const pendingChangeRequests = changeRequests.filter(r => r.Status === 'Pending');

  const resolveChangeRequestMutation = useMutation({
    mutationFn: ({ id, status, notes }) => base44.entities.LessonChangeRequest.update(id, { Status: status, ResponseNotes: notes, RespondedByPNumber: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-change-requests'] });
      toast.success('Change request updated');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (entry) => base44.entities.ProgressLedger.update(entry.id, { Status: 'Approved' }),
    onSuccess: async (_, entry) => {
      await queryClient.invalidateQueries({ queryKey: ['all-progress'] });
      toast.success('Entry approved');
      // Check for star level promotion
      const updatedProgress = await base44.entities.ProgressLedger.filter({});
      const cadet = personnelMap[entry.CadetPNumber];
      if (cadet) {
        const result = await checkAndPromoteCadet(entry.CadetPNumber, cadet.CurrentStarLevel, syllabus, updatedProgress);
        if (result) {
          queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
          if (result.newStarLevel) toast.success(`🎖 ${cadet.Surname} promoted to ${result.newStarLevel}!`);
          if (result.newAccessLevel) toast.success(`⭐ ${cadet.Surname} is now a Cadet Instructor (${result.earnedQual})!`);
        }
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.ProgressLedger.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-progress'] });
      toast.success('Entry rejected and removed');
    },
  });

  function ProgressRow({ entry, showActions }) {
    const cadet = personnelMap[entry.CadetPNumber];
    const instructor = personnelMap[entry.InstructorPNumber];
    return (
      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {cadet?.Surname?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {cadet?.Surname || entry.CadetPNumber} — {entry.LessonCode}
            </p>
            <p className="text-xs text-muted-foreground">
              Instructor: {instructor?.Surname || entry.InstructorPNumber} · {entry.CompletionDate && format(new Date(entry.CompletionDate + 'T00:00:00'), 'd MMM yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={entry.Status === 'Approved' ? 'default' : 'outline'} className="text-xs">
            {entry.Status === 'Approved' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
            {entry.Status}
          </Badge>
          {showActions && (
            <>
              <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => approveMutation.mutate(entry)}>
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => rejectMutation.mutate(entry.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Task List & Approvals"
        description="Review and approve progress ledger submissions"
        icon={CheckSquare}
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="change-requests" className="gap-1">
            <Pencil className="w-3.5 h-3.5" />
            Changes ({pendingChangeRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-2">
              {pending.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No pending submissions.</p>
              ) : (
                <div className="space-y-1">
                  {pending.map(entry => <ProgressRow key={entry.id} entry={entry} showActions />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardContent className="p-2">
              {approved.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No approved entries.</p>
              ) : (
                <div className="space-y-1">
                  {approved.map(entry => <ProgressRow key={entry.id} entry={entry} showActions={false} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="change-requests">
          <Card>
            <CardContent className="p-2">
              {changeRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No lesson change requests.</p>
              ) : (
                <div className="space-y-2">
                  {changeRequests.map(req => {
                    const requester = personnelMap[req.RequestedByPNumber];
                    return (
                      <div key={req.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{req.CurrentLessonCode} — {req.CurrentLessonName}</p>
                            <p className="text-xs text-muted-foreground">
                              From: {requester ? `${requester.Rank || ''} ${requester.Surname}`.trim() : req.RequestedByPNumber} · {req.Date}
                            </p>
                            <p className="text-xs mt-1"><span className="font-medium">Request:</span> {req.RequestedChange}</p>
                            {req.Reason && <p className="text-xs text-muted-foreground">{req.Reason}</p>}
                          </div>
                          <Badge variant={req.Status === 'Approved' ? 'default' : req.Status === 'Rejected' ? 'destructive' : 'outline'} className="text-xs shrink-0">
                            {req.Status}
                          </Badge>
                        </div>
                        {req.Status === 'Pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => resolveChangeRequestMutation.mutate({ id: req.id, status: 'Approved', notes: '' })}>
                              <Check className="w-3.5 h-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => resolveChangeRequestMutation.mutate({ id: req.id, status: 'Rejected', notes: '' })}>
                              <X className="w-3.5 h-3.5 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                        {req.ResponseNotes && <p className="text-xs text-muted-foreground italic">Response: {req.ResponseNotes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AccessGate>
  );
}