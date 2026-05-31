import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const CATEGORIES = ["IT Support", "Facilities", "Training / Syllabus", "Uniform / Equipment", "Welfare", "Other"];

const URGENCY = [
  { value: "Low", className: "bg-green-500/10 text-green-600 border-green-500/30" },
  { value: "Medium", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "High", className: "bg-red-500/10 text-red-600 border-red-500/30" },
];

export default function ReportIssue() {
  const [form, setForm] = useState({ title: "", category: "", urgency: "", description: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  function handleReset() {
    setForm({ title: "", category: "", urgency: "", description: "" });
    setSubmitted(false);
  }

  const canSubmit = form.title.trim() && form.category && form.urgency && form.description.trim();

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto pt-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Issue Reported</h2>
        <p className="text-muted-foreground mb-6">
          Your <strong>{form.urgency}</strong>-urgency issue "<strong>{form.title}</strong>" has been submitted to the Detachment Commander.
        </p>
        <Button variant="outline" onClick={handleReset}>Report Another Issue</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Report Issue to DC"
        description="Submit concerns or support requests to the Detachment Commander"
        icon={AlertCircle}
      />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Issue & Support Ticket</CardTitle>
            <CardDescription>All submissions are sent directly and confidentially to your DC.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Issue Title</Label>
                <Input
                  placeholder="Brief summary of the issue…"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Urgency Level</Label>
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

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the issue in detail — include any relevant dates, locations, or people involved…"
                  className="h-36 resize-none"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                Submit Issue Report
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}