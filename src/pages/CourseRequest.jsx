import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import { BookOpen, CheckCircle2 } from "lucide-react";

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

export default function CourseRequest() {
  const [form, setForm] = useState({ course: "", semester: "", reason: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  function handleReset() {
    setForm({ course: "", semester: "", reason: "" });
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto pt-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Request Submitted</h2>
        <p className="text-muted-foreground mb-6">
          Your course enrollment request for <strong>{form.course}</strong> ({form.semester}) has been sent to the Detachment Commander for review.
        </p>
        <Button variant="outline" onClick={handleReset}>Submit Another Request</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Course Request"
        description="Request attendance at a training course"
        icon={BookOpen}
      />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Course Enrollment Request</CardTitle>
            <CardDescription>Complete the form below and your DC will be notified for approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={form.course} onValueChange={v => setForm(p => ({ ...p, course: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preferred Semester</Label>
                <Select value={form.semester} onValueChange={v => setForm(p => ({ ...p, semester: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reason for Request / Prerequisites Met</Label>
                <Textarea
                  placeholder="Explain why you are requesting this course and confirm any prerequisites you have already completed…"
                  className="h-32 resize-none"
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={!form.course || !form.semester || !form.reason.trim()}>
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}