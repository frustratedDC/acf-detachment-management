import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const QUICK_TAGS = ['Needs Discussion', 'Policy Check', 'General Wellbeing', 'Repeated Absence', 'Personal Circumstances'];
const REASONS = ['Late', 'No-Show', 'Training Issue', 'Other'];

export default function EngagementNoteModal({ instructor, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleConfirm() {
    if (!reason) return;
    onConfirm({ reason, notes, tags });
  }

  const name = [instructor?.Rank, instructor?.FirstName, instructor?.Surname].filter(Boolean).join(' ');

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Record Engagement Note</DialogTitle>
          <p className="text-sm text-muted-foreground">{name} — DC only, not visible to the instructor</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Quick Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    tags.includes(tag)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Engagement Notes</Label>
            <Textarea
              placeholder="DC-only notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!reason}>
            Confirm Not Attended
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}