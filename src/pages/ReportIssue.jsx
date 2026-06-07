import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import { AlertCircle, CheckCircle2, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { hasAccess, ACCESS_LEVELS } from "@/lib/accessLevels";

const CATEGORIES = ["IT Support", "Facilities", "Training / Syllabus", "Uniform / Equipment", "Welfare", "Other"];

const URGENCY = [
  { value: "Low", className: "bg-green-500/10 text-green-600 border-green-500/30" },
  { value: "Medium", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "High", className: "bg-red-500/10 text-red-600 border-red-500/30" },
];

const STATUS_COLORS = {
  Open: "bg-destructive/10 text-destructive border-destructive/30",
  "In Progress": "bg-accent/10 text-accent-foreground border-accent/30",
  Resolved: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  Closed: "bg-muted text-muted-foreground",
};

export default function ReportIssue() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", urgency: "", description: "" });
  const isAdmin = hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.DET_2IC);

  const { data: myIssues = [], isLoading } = useQuery({
    queryKey: ["issue-reports-mine", me?.PNumber],
    queryFn: () => base44.entities.IssueReport.filter({ PNumber: me?.PNumber }),
    enabled: !!me?.PNumber,
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: ["all-issue-reports"],
    queryFn: () => base44.entities.IssueReport.list("-created_date", 200),
    enabled: isAdmin,
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.entities.IssueReport.create({
      PNumber: me?.PNumber,
      ReporterName: [me?.Rank, me?.FirstName, me?.Surname].filter(Boolean).join(" "),
      Title: form.title,
      Category: form.category,
      Urgency: form.urgency,
      Description: form.description,
      Status: "Open",
      DateReported: format(new Date(), "yyyy-MM-dd"),
    }),
    onSuccess: () => {
      toast.success("Issue reported — your DC will be notified.");
      setForm({ title: "", category: "", urgency: "", description: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["issue-reports-mine", me?.PNumber] });
      if (isAdmin) queryClient.invalidateQueries({ queryKey: ["all-issue-reports"] });
    },
    onError: () => toast.error("Failed to submit issue report"),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status, notes }) => base44.entities.IssueReport.update(id, {
      Status: status,
      RespondedByPNumber: me?.PNumber,
      ResponseNotes: notes || "",
    }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["all-issue-reports"] });
      queryClient.invalidateQueries({ queryKey: ["issue-reports-mine"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  const canSubmit = form.title.trim() && form.category && form.urgency && form.description.trim();
  const displayIssues = isAdmin ? allIssues : myIssues;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Issue"
        description={isAdmin ? "Manage and respond to submitted issue reports" : "Submit concerns or support requests to the Detachment Commander"}
        icon={AlertCircle}
        actions={
          <Button onClick={() => setShowForm(s => !s)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />Report Issue
          </Button>
        }
      />

      {/* Submission form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Issue & Support Ticket</CardTitle>
            <CardDescription>All submissions are sent directly and confidentially to your DC.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Issue Title</Label>
              <Input
                placeholder="Brief summary of the issue…"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Urgency</Label>
                <div className="flex gap-2 pt-1">
                  {URGENCY.map(u => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, urgency: u.value }))}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-all ${u.className} ${form.urgency === u.value ? 'ring-2 ring-offset-1 ring-ring' : 'opacity-60 hover:opacity-100'}`}
                    >
                      {u.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the issue in detail — include any relevant dates, locations, or people involved…"
                className="h-32 resize-none"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending}>
                {submitMutation.isPending ? "Submitting…" : "Submit Issue Report"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : displayIssues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No issues reported yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayIssues.map(issue => {
            const urgencyItem = URGENCY.find(u => u.value === issue.Urgency);
            return (
              <Card key={issue.id} className={issue.Status === "Open" && issue.Urgency === "High" ? "border-destructive/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-sm">{issue.Title}</p>
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[issue.Status]}`}>
                          {issue.Status}
                        </Badge>
                        {urgencyItem && (
                          <Badge variant="outline" className={`text-xs ${urgencyItem.className}`}>
                            {issue.Urgency}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">{issue.Category}</Badge>
                      </div>
                      {isAdmin && issue.ReporterName && (
                        <p className="text-xs text-muted-foreground">Reporter: {issue.ReporterName} ({issue.PNumber})</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{issue.Description}</p>
                      {issue.ResponseNotes && (
                        <p className="text-xs mt-2 p-2 rounded bg-muted/40 italic">Response: {issue.ResponseNotes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported: {issue.DateReported || (issue.created_date ? format(new Date(issue.created_date), "dd MMM yyyy") : "—")}
                      </p>
                    </div>
                    {isAdmin && issue.Status === "Open" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respondMutation.mutate({ id: issue.id, status: "In Progress" })}
                          disabled={respondMutation.isPending}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />In Progress
                        </Button>
                        <Button
                          size="sm"
                          className="bg-chart-2 hover:bg-chart-2/90 text-white"
                          onClick={() => respondMutation.mutate({ id: issue.id, status: "Resolved" })}
                          disabled={respondMutation.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}