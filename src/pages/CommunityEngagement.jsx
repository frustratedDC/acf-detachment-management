import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeartHandshake, Dumbbell, Lock, Send, PlusCircle, Clock, CheckCircle2, X, Star } from "lucide-react";
import { toast } from "sonner";
import { ACCESS_LEVELS, hasAccess } from "@/lib/accessLevels";
import { format } from "date-fns";
import BulkCEEntry from "@/components/ce/BulkCEEntry";
import KeepingActiveTracker from "@/pages/KeepingActiveTracker";

// CE hour requirements per star level
export const CE_REQUIREMENTS = {
  "1 Star":  { hours: 4,  mandatory: true },
  "2 Star":  { hours: 8,  mandatory: true },
  "3 Star":  { hours: 16, mandatory: false },
  "4 Star":  { hours: 10, mandatory: false },
};

export default function CommunityEngagement() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  // All hooks unconditionally
  const [existingRequest, setExistingRequest] = useState(null);
  const [checkingRequest, setCheckingRequest] = useState(true);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ Hours: "", Description: "", Date: format(new Date(), "yyyy-MM-dd") });

  const myCEAccess = hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.CADET_NCO) || me?.CEAccess === true;
  // Any user with CE access can submit; L4+ submissions are auto-approved
  const canSubmitCE = myCEAccess;
  const isAutoApproved = hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.DET_2IC) || me?.role === 'admin';

  // Check for existing access request
  useEffect(() => {
    if (!me?.PNumber || myCEAccess) { setCheckingRequest(false); return; }
    base44.entities.AccessRequest.filter({ RequesterPNumber: me.PNumber, FeatureKey: "CEAccess" })
      .then(reqs => {
        const pending = reqs.find(r => r.Status === "Pending");
        const approved = reqs.find(r => r.Status === "Approved");
        setExistingRequest(pending || approved || null);
      })
      .finally(() => setCheckingRequest(false));
  }, [me?.PNumber, myCEAccess]);

  // Load CE entries
  useEffect(() => {
    if (!me?.PNumber || !myCEAccess) { setLoadingEntries(false); return; }
    base44.entities.CommunityEngagementLedger.filter({ CadetPNumber: me.PNumber })
      .then(setEntries)
      .finally(() => setLoadingEntries(false));
  }, [me?.PNumber, myCEAccess]);

  const totalApprovedHours = useMemo(
    () => entries.filter(e => e.Status === "Approved").reduce((s, e) => s + (e.Hours || 0), 0),
    [entries]
  );

  const requestAccessMutation = useMutation({
    mutationFn: () => base44.entities.AccessRequest.create({
      RequesterPNumber: me.PNumber,
      RequesterName: [me.Rank, me.FirstName, me.Surname].filter(Boolean).join(" "),
      FeatureKey: "CEAccess",
      FeatureLabel: "Community Engagement Tracker",
      Status: "Pending",
    }),
    onSuccess: (req) => { setExistingRequest(req); toast.success("Access request submitted to instructors."); },
    onError: () => toast.error("Failed to submit request."),
  });

  const submitMutation = useMutation({
    mutationFn: () => base44.entities.CommunityEngagementLedger.create({
      CadetPNumber: me.PNumber,
      CadetName: [me.Rank, me.FirstName, me.Surname].filter(Boolean).join(" "),
      Hours: parseFloat(form.Hours),
      Description: form.Description,
      Date: form.Date,
      Status: isAutoApproved ? "Approved" : "Pending",
      ApprovedByPNumber: isAutoApproved ? me.PNumber : undefined,
    }),
    onSuccess: (newEntry) => {
      setEntries(prev => [...prev, newEntry]);
      setShowForm(false);
      setForm({ Hours: "", Description: "", Date: format(new Date(), "yyyy-MM-dd") });
      toast.success(isAutoApproved ? "CE hours added and approved." : "CE hours submitted — awaiting instructor approval.");
      queryClient.invalidateQueries({ queryKey: ["ce-ledger"] });
    },
    onError: () => toast.error("Failed to submit CE hours."),
  });

  // ── Access Gate ──────────────────────────────────────────────────────────
  if (!myCEAccess) {
    if (checkingRequest) {
      return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;
    }
    return (
      <div>
        <PageHeader title="Community Engagement" description="Log and track your community engagement hours" icon={HeartHandshake} />
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Access Restricted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Community Engagement is available to Cadet NCOs and above, or cadets with instructor approval.
              </p>
            </div>
            {existingRequest?.Status === "Pending" && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 text-sm">
                ⏳ Your access request is pending review by an Adult Instructor.
              </div>
            )}
            {existingRequest?.Status === "Approved" && (
              <div className="rounded-lg bg-chart-2/10 border border-chart-2/30 p-3 text-sm text-chart-2">
                ✓ Your request was approved — please refresh the page.
              </div>
            )}
            {!existingRequest && (
              <Button onClick={() => requestAccessMutation.mutate()} disabled={requestAccessMutation.isPending}>
                <Send className="w-4 h-4 mr-2" />
                {requestAccessMutation.isPending ? "Submitting..." : "Request Access"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  const starLevel = me?.CurrentStarLevel;
  const req = CE_REQUIREMENTS[starLevel];

  return (
    <div className="space-y-6">
      <PageHeader
        title="CE / KA Session Entry"
        description="Log community engagement hours and run Keeping Active sessions"
        icon={Dumbbell}
      />

      <Tabs defaultValue="ce">
        <TabsList className="mb-2">
          <TabsTrigger value="ce" className="gap-2">
            <HeartHandshake className="w-3.5 h-3.5" />Community Engagement
          </TabsTrigger>
          <TabsTrigger value="ka" className="gap-2">
            <Dumbbell className="w-3.5 h-3.5" />Keeping Active
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ka">
          <KeepingActiveTracker hideHeader />
        </TabsContent>

        <TabsContent value="ce" className="space-y-6">
          {canSubmitCE && (
            <div className="flex justify-end">
              <Button onClick={() => setShowForm(s => !s)} size="sm" className="gap-1">
                <PlusCircle className="w-4 h-4" />Add CE Hours
              </Button>
            </div>
          )}

          {/* Progress card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="col-span-1 sm:col-span-2">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Approved Hours</p>
                    <p className="text-3xl font-bold tracking-tight">{totalApprovedHours.toFixed(1)}h</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <HeartHandshake className="w-6 h-6 text-primary" />
                  </div>
                </div>
                {req && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{starLevel} requirement: {req.hours}h {req.mandatory ? "(Mandatory)" : "(Optional milestone)"}</span>
                      <span>{Math.min(100, Math.round((totalApprovedHours / req.hours) * 100))}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`rounded-full h-2 transition-all ${totalApprovedHours >= req.hours ? "bg-chart-2" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, (totalApprovedHours / req.hours) * 100)}%` }}
                      />
                    </div>
                    {totalApprovedHours >= req.hours && (
                      <div className="flex items-center gap-1 mt-2 text-chart-2 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />Requirement met!
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Milestones */}
            {Object.entries(CE_REQUIREMENTS).map(([level, r]) => {
              const met = totalApprovedHours >= r.hours;
              return (
                <Card key={level} className={met ? "border-chart-2/40 bg-chart-2/5" : ""}>
                  <CardContent className="pt-4 pb-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Star className={`w-4 h-4 ${met ? "text-chart-2" : "text-muted-foreground"}`} />
                      <span className="text-sm font-semibold">{level}</span>
                      <Badge variant={r.mandatory ? "default" : "secondary"} className="text-xs ml-auto">
                        {r.mandatory ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{r.hours}h</p>
                    {met ? (
                      <p className="text-xs text-chart-2 font-semibold">✓ Complete</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{Math.max(0, r.hours - totalApprovedHours).toFixed(1)}h remaining</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Submission form */}
          {showForm && canSubmitCE && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Log Community Engagement Hours</CardTitle>
                <CardDescription>{isAutoApproved ? "As DC/2IC, hours you add are automatically approved." : "Submitted hours require instructor approval before they count toward your total."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Hours</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="e.g. 2.5"
                      value={form.Hours}
                      onChange={e => setForm(f => ({ ...f, Hours: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.Date}
                      onChange={e => setForm(f => ({ ...f, Date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Description of Activity</Label>
                  <Textarea
                    placeholder="Describe the community engagement activity..."
                    value={form.Description}
                    onChange={e => setForm(f => ({ ...f, Description: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={!form.Hours || !form.Description || submitMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitMutation.isPending ? "Submitting..." : "Submit for Approval"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bulk CE Entry — DC/2IC only */}
          {hasAccess(me?.AccessLevel ?? 0, ACCESS_LEVELS.DET_2IC) && <BulkCEEntry />}

          {/* Entries log */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                My CE Log ({entries.length} entries)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEntries ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
                </div>
              ) : entries.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">No CE hours logged yet. Use the "Add CE Hours" button to get started.</p>
              ) : (
                <div className="space-y-2">
                  {[...entries].sort((a, b) => b.Date.localeCompare(a.Date)).map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        entry.Status === "Approved" ? "bg-chart-2/10 text-chart-2" :
                        entry.Status === "Rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-accent/10 text-accent-foreground"
                      }`}>
                        {entry.Hours}h
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entry.Description}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.Date && format(new Date(entry.Date + "T00:00:00"), "d MMM yyyy")}
                        </p>
                      </div>
                      <Badge variant={
                        entry.Status === "Approved" ? "default" :
                        entry.Status === "Rejected" ? "destructive" : "outline"
                      } className="text-xs shrink-0">
                        {entry.Status === "Approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {entry.Status === "Rejected" && <X className="w-3 h-3 mr-1" />}
                        {entry.Status === "Pending" && <Clock className="w-3 h-3 mr-1" />}
                        {entry.Status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}