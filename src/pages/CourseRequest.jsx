import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import { BookOpen, CheckCircle2, Clock, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { hasAccess, ACCESS_LEVELS } from "@/lib/accessLevels";

const COURSES = [
  "ACLC – Army Cadet Leadership Course",
  "SCIC – Senior Cadet Instructor Course",
  "JCIC – Junior Cadet Instructor Course",
  "Adventurous Training Leaders Course",
  "First Aid Instructor Course",
  "Drill & Turnout Course",
  "Range Conducting Officer Course",
  "QAIC – Qualified AI Cadet",
  "Other (specify in reason)",
];

const SEMESTERS = ["Autumn 2026", "Spring 2027", "Summer 2027", "Autumn 2027"];

const STATUS_COLORS = {
  Pending: "bg-accent/10 text-accent-foreground border-accent/30",
  Approved: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  Rejected: "bg-destructive/10 text-destructive border-destructive/30",
  Withdrawn: "bg-muted text-muted-foreground",
};

export default function CourseRequest() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ course: "", semester: "", reason: "" });
  const isAdmin = hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.DET_2IC);

  const { data: myRequests = [], isLoading } = useQuery({
    queryKey: ["course-requests", me?.PNumber],
    queryFn: () => base44.entities.CourseRequest.filter({ PNumber: me?.PNumber }),
    enabled: !!me?.PNumber,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["all-course-requests"],
    queryFn: () => base44.entities.CourseRequest.list("-created_date", 200),
    enabled: isAdmin,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.entities.CourseRequest.create({
      PNumber: me?.PNumber,
      RequestorName: [me?.Rank, me?.FirstName, me?.Surname].filter(Boolean).join(" "),
      CourseName: form.course,
      PreferredSemester: form.semester,
      Reason: form.reason,
      Status: "Pending",
      DateRequested: format(new Date(), "yyyy-MM-dd"),
    }),
    onSuccess: () => {
      toast.success("Course request submitted — your DC will be notified.");
      setForm({ course: "", semester: "", reason: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["course-requests", me?.PNumber] });
      if (isAdmin) queryClient.invalidateQueries({ queryKey: ["all-course-requests"] });
    },
    onError: () => toast.error("Failed to submit request"),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status, notes }) => base44.entities.CourseRequest.update(id, {
      Status: status,
      RespondedByPNumber: me?.PNumber,
      ResponseNotes: notes || "",
    }),
    onSuccess: () => {
      toast.success("Response saved");
      queryClient.invalidateQueries({ queryKey: ["all-course-requests"] });
      queryClient.invalidateQueries({ queryKey: ["course-requests", me?.PNumber] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const displayRequests = isAdmin ? allRequests : myRequests;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Requests"
        description={isAdmin ? "Manage and respond to course enrollment requests" : "Request attendance at a training course"}
        icon={BookOpen}
        actions={
          <Button onClick={() => setShowForm(s => !s)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            New Request
          </Button>
        }
      />

      {/* Submission form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Course Enrollment Request</CardTitle>
            <CardDescription>Complete the form below and your DC will be notified for approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Course</Label>
              <Select value={form.course} onValueChange={v => setForm(p => ({ ...p, course: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a course…" /></SelectTrigger>
                <SelectContent>
                  {COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Preferred Semester</Label>
              <Select value={form.semester} onValueChange={v => setForm(p => ({ ...p, semester: v }))}>
                <SelectTrigger><SelectValue placeholder="Select semester…" /></SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reason / Prerequisites Met</Label>
              <Textarea
                placeholder="Explain why you are requesting this course and confirm any prerequisites you have already completed…"
                className="h-28 resize-none"
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!form.course || !form.reason.trim() || submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : displayRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No course requests yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayRequests.map(req => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm">{req.CourseName}</p>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[req.Status]}`}>
                        {req.Status === "Pending" ? <Clock className="w-3 h-3 mr-1" /> : req.Status === "Approved" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                        {req.Status}
                      </Badge>
                    </div>
                    {isAdmin && req.RequestorName && (
                      <p className="text-xs text-muted-foreground">Requestor: {req.RequestorName} ({req.PNumber})</p>
                    )}
                    {req.PreferredSemester && (
                      <p className="text-xs text-muted-foreground">Preferred: {req.PreferredSemester}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{req.Reason}</p>
                    {req.ResponseNotes && (
                      <p className="text-xs mt-2 p-2 rounded bg-muted/40 italic">Response: {req.ResponseNotes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {req.DateRequested || (req.created_date ? format(new Date(req.created_date), "dd MMM yyyy") : "—")}
                    </p>
                  </div>
                  {isAdmin && req.Status === "Pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => respondMutation.mutate({ id: req.id, status: "Rejected" })}
                        disabled={respondMutation.isPending}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-chart-2 hover:bg-chart-2/90 text-white"
                        onClick={() => respondMutation.mutate({ id: req.id, status: "Approved" })}
                        disabled={respondMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}