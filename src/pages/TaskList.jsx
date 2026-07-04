import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersonnel } from '@/lib/usePersonnel';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Check, X, Clock, CheckCircle2, Pencil, Shirt, ShieldCheck, HeartHandshake, BookOpen, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ACCESS_LEVELS, hasAccess } from '@/lib/accessLevels';
import { checkAndPromoteCadet } from '@/lib/progressUtils';
import CEMilestoneTasksTab from '@/components/tasks/CEMilestoneTasksTab';
import PromotionTasksTab from '@/components/tasks/PromotionTasksTab';

export default function TaskList() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();

  const { data: allProgress = [], isLoading } = useQuery({
    queryKey: ['all-progress'],
    queryFn: () => base44.entities.ProgressLedger.list('-created_date', 500),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const personnelMap = useMemo(() => {
    const m = {};
    personnel.forEach(p => { m[p.PNumber] = p; });
    return m;
  }, [personnel]);

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

  const { data: uniformRequests = [] } = useQuery({
    queryKey: ['uniform-requests'],
    queryFn: () => base44.entities.UniformRequest.list('-created_date', 200),
  });

  const pendingUniformRequests = uniformRequests.filter(r => r.Status === 'Pending');

  const { data: accessRequests = [] } = useQuery({
    queryKey: ['access-requests'],
    queryFn: () => base44.entities.AccessRequest.filter({}),
  });

  const pendingAccessRequests = accessRequests.filter(r => r.Status === 'Pending');

  const { data: ceRequests = [] } = useQuery({
    queryKey: ['ce-requests'],
    queryFn: () => base44.entities.CommunityEngagementLedger.filter({ Status: 'Pending' }),
  });

  const { data: ceMilestoneTasks = [] } = useQuery({
    queryKey: ['ce-milestone-tasks'],
    queryFn: () => base44.entities.CEMilestoneTask.filter({ Status: 'Pending' }),
  });

  const { data: promotionTasks = [] } = useQuery({
    queryKey: ['promotion-milestone-tasks'],
    queryFn: () => base44.entities.PromotionMilestoneTask.filter({ Status: 'Pending' }),
  });

  const { data: courseRequests = [] } = useQuery({
    queryKey: ['course-requests-all'],
    queryFn: () => base44.entities.CourseRequest.list('-created_date', 200),
  });

  const { data: issueReports = [] } = useQuery({
    queryKey: ['issue-reports-all'],
    queryFn: () => base44.entities.IssueReport.list('-created_date', 200),
  });

  const pendingCourseRequests = courseRequests.filter(r => r.Status === 'Pending');
  const openIssues = issueReports.filter(r => r.Status === 'Open');

  const approveCEMutation = useMutation({
    mutationFn: (entry) => base44.entities.CommunityEngagementLedger.update(entry.id, {
      Status: 'Approved',
      ApprovedByPNumber: me?.PNumber,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ce-requests'] });
      toast.success('CE hours approved');
    },
  });

  const rejectCEMutation = useMutation({
    mutationFn: (entry) => base44.entities.CommunityEngagementLedger.update(entry.id, {
      Status: 'Rejected',
      ApprovedByPNumber: me?.PNumber,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ce-requests'] });
      toast.success('CE hours rejected');
    },
  });

  const approveAccessMutation = useMutation({
    mutationFn: async ({ req }) => {
      await base44.entities.AccessRequest.update(req.id, {
        Status: 'Approved',
        RespondedByPNumber: me?.PNumber,
        ResponseDate: format(new Date(), 'yyyy-MM-dd'),
      });
      const records = await base44.entities.PersonnelManager.filter({ PNumber: req.RequesterPNumber });
      if (records.length > 0) {
        const flagField = req.FeatureKey === 'CEAccess' ? { CEAccess: true } : { KeepingActiveAccess: true };
        await base44.entities.PersonnelManager.update(records[0].id, flagField);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      const label = vars.req.FeatureKey === 'CEAccess' ? 'Community Engagement Tracker' : 'Keeping Active Tracker';
      toast.success(`Access approved — cadet can now use the ${label}`);
    },
    onError: () => toast.error('Failed to approve access'),
  });

  const rejectAccessMutation = useMutation({
    mutationFn: (req) => base44.entities.AccessRequest.update(req.id, {
      Status: 'Rejected',
      RespondedByPNumber: me?.PNumber,
      ResponseDate: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      toast.success('Access request rejected');
    },
  });

  const resolveUniformMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.UniformRequest.update(id, { Status: status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uniform-requests'] });
      toast.success('Uniform request updated');
    },
  });

  const resolveChangeRequestMutation = useMutation({
    mutationFn: ({ id, status, notes }) => base44.entities.LessonChangeRequest.update(id, { Status: status, ResponseNotes: notes, RespondedByPNumber: me?.PNumber || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-change-requests'] });
      toast.success('Change request updated');
    },
  });

  const resolveCourseRequestMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.CourseRequest.update(id, { Status: status, RespondedByPNumber: me?.PNumber || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-requests-all'] });
      toast.success('Course request updated');
    },
  });

  const resolveIssueMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.IssueReport.update(id, { Status: status, RespondedByPNumber: me?.PNumber || '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-reports-all'] });
      toast.success('Issue report updated');
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
          <TabsTrigger value="uniform-requests" className="gap-1">
            <Shirt className="w-3.5 h-3.5" />
            Uniform ({pendingUniformRequests.length})
          </TabsTrigger>
          <TabsTrigger value="access-requests" className="gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Access ({pendingAccessRequests.length})
          </TabsTrigger>
          <TabsTrigger value="ce-requests" className="gap-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            CE Hours ({ceRequests.length})
          </TabsTrigger>
          <TabsTrigger value="ce-milestones" className="gap-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            CE Milestones ({ceMilestoneTasks.length})
          </TabsTrigger>
          <TabsTrigger value="promotion-tasks" className="gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Promotions ({promotionTasks.length})
          </TabsTrigger>
          <TabsTrigger value="course-requests" className="gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Courses ({pendingCourseRequests.length})
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Issues ({openIssues.length})
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
        <TabsContent value="uniform-requests">
          <Card>
            <CardContent className="p-2">
              {uniformRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No uniform requests.</p>
              ) : (
                <div className="space-y-2">
                  {uniformRequests.map(req => {
                    const requester = personnelMap[req.PNumber];
                    const statusColor = req.Status === 'Completed' ? 'default' : req.Status === 'Approved' ? 'secondary' : 'outline';
                    return (
                      <div key={req.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {requester ? `${requester.Rank || ''} ${requester.FirstName || ''} ${requester.Surname}`.trim() : req.PNumber}
                              {' — '}{req.RequestType}
                            </p>
                            <p className="text-xs text-muted-foreground">{req.PNumber} · {req.DateSubmitted} · {req.ItemName}</p>
                            {req.SizeReturning && <p className="text-xs mt-0.5">Returning: {req.SizeReturning}</p>}
                            {req.ReasonForReturn && <p className="text-xs text-muted-foreground">{req.ReasonForReturn}</p>}
                          </div>
                          <Badge variant={statusColor} className="text-xs shrink-0">{req.Status}</Badge>
                        </div>
                        {req.Status === 'Pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => resolveUniformMutation.mutate({ id: req.id, status: 'Approved' })}>
                              <Check className="w-3.5 h-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => resolveUniformMutation.mutate({ id: req.id, status: 'Completed' })}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Complete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="access-requests">
          <Card>
            <CardContent className="p-2">
              {accessRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No access requests.</p>
              ) : (
                <div className="space-y-2">
                  {accessRequests.map(req => (
                    <div key={req.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {req.RequesterName || req.RequesterPNumber} — {req.FeatureLabel || req.FeatureKey}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PNumber: {req.RequesterPNumber} · Requested: {req.created_date ? format(new Date(req.created_date), 'd MMM yyyy') : '—'}
                          </p>
                        </div>
                        <Badge variant={req.Status === 'Approved' ? 'default' : req.Status === 'Rejected' ? 'destructive' : 'outline'} className="text-xs shrink-0">
                          {req.Status}
                        </Badge>
                      </div>
                      {req.Status === 'Pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => approveAccessMutation.mutate({ req })}>
                            <Check className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => rejectAccessMutation.mutate(req)}>
                            <X className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ce-requests">
          <Card>
            <CardContent className="p-2">
              {ceRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No pending CE hour submissions.</p>
              ) : (
                <div className="space-y-2">
                  {ceRequests.map(entry => {
                    const cadet = personnelMap[entry.CadetPNumber];
                    return (
                      <div key={entry.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {cadet ? `${cadet.Rank || ''} ${cadet.Surname}`.trim() : entry.CadetPNumber}
                              {' — '}<span className="text-primary">{entry.Hours}h</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{entry.Date} · {entry.Description}</p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => approveCEMutation.mutate(entry)}>
                            <Check className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => rejectCEMutation.mutate(entry)}>
                            <X className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ce-milestones">
          <CEMilestoneTasksTab tasks={ceMilestoneTasks} currentPNumber={me?.PNumber} />
        </TabsContent>
        <TabsContent value="promotion-tasks">
          <PromotionTasksTab tasks={promotionTasks} currentPNumber={me?.PNumber} />
        </TabsContent>
        <TabsContent value="course-requests">
          <Card>
            <CardContent className="p-2">
              {courseRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No course requests.</p>
              ) : (
                <div className="space-y-2">
                  {courseRequests.map(req => (
                    <div key={req.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{req.RequestorName || req.PNumber} — {req.CourseName}</p>
                          <p className="text-xs text-muted-foreground">{req.PreferredSemester} · {req.DateRequested}</p>
                          {req.Reason && <p className="text-xs mt-0.5 text-muted-foreground">{req.Reason}</p>}
                        </div>
                        <Badge variant={req.Status === 'Approved' ? 'default' : req.Status === 'Rejected' ? 'destructive' : 'outline'} className="text-xs shrink-0">{req.Status}</Badge>
                      </div>
                      {req.Status === 'Pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => resolveCourseRequestMutation.mutate({ id: req.id, status: 'Approved' })}>
                            <Check className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => resolveCourseRequestMutation.mutate({ id: req.id, status: 'Rejected' })}>
                            <X className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="issues">
          <Card>
            <CardContent className="p-2">
              {issueReports.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No issue reports.</p>
              ) : (
                <div className="space-y-2">
                  {issueReports.map(issue => (
                    <div key={issue.id} className="p-3 rounded-lg border hover:bg-muted/30 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{issue.ReporterName || issue.PNumber} — {issue.Title}</p>
                          <p className="text-xs text-muted-foreground">{issue.Category} · {issue.Urgency} urgency · {issue.DateReported}</p>
                          {issue.Description && <p className="text-xs mt-0.5 text-muted-foreground">{issue.Description}</p>}
                        </div>
                        <Badge variant={issue.Status === 'Resolved' ? 'default' : issue.Status === 'Closed' ? 'secondary' : 'outline'} className="text-xs shrink-0">{issue.Status}</Badge>
                      </div>
                      {(issue.Status === 'Open' || issue.Status === 'In Progress') && (
                        <div className="flex gap-2">
                          {issue.Status === 'Open' && (
                            <Button size="sm" variant="outline" onClick={() => resolveIssueMutation.mutate({ id: issue.id, status: 'In Progress' })}>
                              <Clock className="w-3.5 h-3.5 mr-1" />In Progress
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-chart-2 hover:text-chart-2" onClick={() => resolveIssueMutation.mutate({ id: issue.id, status: 'Resolved' })}>
                            <Check className="w-3.5 h-3.5 mr-1" />Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </AccessGate>
  );
}