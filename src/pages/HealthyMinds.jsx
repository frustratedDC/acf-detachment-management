import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/shared/PageHeader";
import { Brain, Phone, CalendarDays, BookOpen, CheckCircle2, ExternalLink } from "lucide-react";

const RESOURCES = [
  {
    icon: Phone,
    title: "24/7 Support Hotline",
    description: "Speak confidentially with a trained support worker any time, day or night.",
    action: "Call 0800 138 1925",
    href: "tel:08001381925",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: CalendarDays,
    title: "Book a Counselling Session",
    description: "Request a one-to-one session with a qualified counsellor at your own pace.",
    action: "Book Online",
    href: "https://www.armycadets.com",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    icon: BookOpen,
    title: "Mindfulness Guides",
    description: "Self-led exercises, breathing techniques, and wellbeing resources.",
    action: "Browse Guides",
    href: "https://www.nhs.uk/mental-health/self-help/",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

const CONTACT_METHODS = ["Phone Call", "Text Message", "Email"];
const TIME_SLOTS = ["Morning (08:00–12:00)", "Afternoon (12:00–17:00)", "Evening (17:00–20:00)"];

export default function HealthyMinds() {
  const [form, setForm] = useState({ contactMethod: "", timeSlot: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div>
      <PageHeader
        title="Healthy Minds"
        description="Wellbeing resources and confidential support"
        icon={Brain}
      />

      {/* Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {RESOURCES.map(r => (
          <Card key={r.title} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className={`w-10 h-10 rounded-xl ${r.bg} flex items-center justify-center mb-3`}>
                <r.icon className={`w-5 h-5 ${r.color}`} />
              </div>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription className="text-sm">{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 mt-auto">
              <a href={r.href} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {r.action}
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Confidential Callback Form */}
      <div className="max-w-lg">
        <Card className="border-violet-500/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-500" />
              Request a Confidential Callback
            </CardTitle>
            <CardDescription>
              Your details will only be seen by the welfare officer. All requests are strictly confidential.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="font-semibold text-foreground">Request Received</p>
                <p className="text-sm text-muted-foreground">
                  A welfare officer will contact you via <strong>{form.contactMethod}</strong> during <strong>{form.timeSlot}</strong>.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setForm({ contactMethod: "", timeSlot: "" }); setSubmitted(false); }}>
                  Submit Another
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Preferred Contact Method</Label>
                  <Select value={form.contactMethod} onValueChange={v => setForm(p => ({ ...p, contactMethod: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="How should we reach you?" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Time Slot</Label>
                  <Select value={form.timeSlot} onValueChange={v => setForm(p => ({ ...p, timeSlot: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="When is best for you?" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={!form.contactMethod || !form.timeSlot}>
                  Request Callback
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}