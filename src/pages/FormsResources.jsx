import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, FileText, ExternalLink, Heart, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import UniformRequestForm from '@/components/forms/UniformRequestForm';

const FORMS = [
  {
    id: 'uniform-exchange',
    title: 'Request a Uniform Exchange',
    description: 'Submit a request to exchange uniform items.',
    icon: '👕',
    fields: [
      { key: 'name', label: 'Your Name', type: 'text', required: true },
      { key: 'item', label: 'Item to Exchange', type: 'text', required: true },
      { key: 'size_returning', label: 'Size Returning', type: 'text', required: false },
      { key: 'reason', label: 'Reason for Exchange', type: 'textarea', required: true },
    ],
    taskTitle: 'Uniform Exchange Request',
    priority: 'Medium',
  },
  {
    id: 'course-request',
    title: 'Course Request Form',
    description: 'Request to attend an ACF course.',
    icon: '🎓',
    fields: [
      { key: 'name', label: 'Your Name', type: 'text', required: true },
      { key: 'course_name', label: 'Course Name / Type', type: 'text', required: true },
      { key: 'reason', label: 'Why do you want to attend?', type: 'textarea', required: true },
    ],
    taskTitle: 'Course Request',
    priority: 'Medium',
  },
  {
    id: 'report-issue',
    title: 'Report an Issue to the Detachment Commander',
    description: 'Report a concern or issue directly to the DC.',
    icon: '🚨',
    fields: [
      { key: 'name', label: 'Your Name', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'details', label: 'Details', type: 'textarea', required: true },
    ],
    taskTitle: 'Issue Report',
    priority: 'High',
  },
];

const RESOURCES = [
  {
    id: 'healthy-minds',
    title: 'Healthy Minds',
    description: 'Mental health and wellbeing resources for cadets and adults.',
    url: 'https://www.healthymindshub.co.uk',
    category: 'Wellbeing',
  },
];

function FormDialog({ form, personnel, onClose }) {
  const [values, setValues] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = form.fields.filter(f => f.required);
    for (const f of requiredFields) {
      if (!values[f.key]) { toast.error(`${f.label} is required`); return; }
    }

    const body = form.fields
      .map(f => `${f.label}: ${values[f.key] || '—'}`)
      .join('\n');

    await base44.entities.ImportantNotice.create({
      Title: `${form.taskTitle} — ${values['name'] || personnel?.Surname || 'Unknown'}`,
      Body: body,
      Priority: form.priority === 'High' ? 'High' : 'Normal',
      PublishedByPNumber: personnel?.PNumber || '',
      IsActive: true,
    });

    toast.success('Your request has been submitted to the Detachment Commander.');
    setSubmitted(true);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.icon} {form.title}</DialogTitle>
        </DialogHeader>
        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="font-semibold">Request Submitted</p>
            <p className="text-sm text-muted-foreground">Your request has been sent to the Detachment Commander.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {form.fields.map(f => (
              <div key={f.key}>
                <Label>{f.label}{f.required && ' *'}</Label>
                {f.type === 'textarea' ? (
                  <Textarea
                    className="mt-1"
                    rows={3}
                    value={values[f.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    className="mt-1"
                    value={values[f.key] || ''}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit"><Send className="w-4 h-4 mr-1" />Submit</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FormsResources() {
  const { personnel } = usePersonnel();
  const [activeForm, setActiveForm] = useState(null);
  const [uniformOpen, setUniformOpen] = useState(false);

  // Non-uniform forms (exclude uniform-exchange, handled separately)
  const otherForms = FORMS.filter(f => f.id !== 'uniform-exchange');

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="Forms & Resources"
        description="Submit requests and access useful resources"
        icon={FolderOpen}
      />

      {/* Forms */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Forms
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Uniform Exchange — uses dedicated smart form */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setUniformOpen(true)}>
            <CardContent className="p-5">
              <div className="text-3xl mb-3">👕</div>
              <h3 className="font-semibold text-sm mb-1">Request a Uniform Exchange</h3>
              <p className="text-xs text-muted-foreground mb-4">Submit an initial indent or item exchange request.</p>
              <Button size="sm" className="w-full">Open Form</Button>
            </CardContent>
          </Card>

          {otherForms.map(f => (
            <Card key={f.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setActiveForm(f)}>
              <CardContent className="p-5">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground mb-4">{f.description}</p>
                <Button size="sm" className="w-full">Open Form</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Heart className="w-4 h-4" /> Resources
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RESOURCES.map(r => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{r.title}</h3>
                  <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{r.description}</p>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="w-full">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />Open Resource
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {activeForm && (
        <FormDialog form={activeForm} personnel={personnel} onClose={() => setActiveForm(null)} />
      )}

      <UniformRequestForm open={uniformOpen} onClose={() => setUniformOpen(false)} />
    </div>
  );
}