import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Send, Shirt, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SIZING_FIELDS = [
  { key: 'HeadCircumference', label: 'Head Circumference', placeholder: 'e.g. 56 cm', unit: 'cm' },
  { key: 'Height', label: 'Height', placeholder: 'e.g. 170 cm', unit: 'cm' },
  { key: 'Chest', label: 'Chest', placeholder: 'e.g. 90 cm', unit: 'cm' },
  { key: 'Waist', label: 'Waist', placeholder: 'e.g. 72 cm', unit: 'cm' },
  { key: 'SeatHips', label: 'Seat / Hips', placeholder: 'e.g. 92 cm', unit: 'cm' },
  { key: 'InnerLeg', label: 'Inner Leg', placeholder: 'e.g. 76 cm', unit: 'cm' },
  { key: 'BootSize', label: 'Boot Size', placeholder: 'e.g. 8 or 42', unit: '' },
];

export default function UniformRequestForm({ open, onClose }) {
  const { personnel } = usePersonnel();
  const [requestType, setRequestType] = useState(null); // 'indent' | 'exchange'
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Indent fields
  const [sizing, setSizing] = useState({});
  const [isBootOrder, setIsBootOrder] = useState(false);

  // Exchange fields
  const [itemName, setItemName] = useState('');
  const [sizeReturning, setSizeReturning] = useState('');
  const [reasonForReturn, setReasonForReturn] = useState('');
  const [newSizeRequired, setNewSizeRequired] = useState('');

  function resetForm() {
    setRequestType(null);
    setSubmitted(false);
    setSizing({});
    setIsBootOrder(false);
    setItemName('');
    setSizeReturning('');
    setReasonForReturn('');
    setNewSizeRequired('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleIndentSubmit(e) {
    e.preventDefault();
    for (const f of SIZING_FIELDS) {
      if (!sizing[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSubmitting(true);

    const fullName = [personnel?.Rank, personnel?.FirstName, personnel?.Surname].filter(Boolean).join(' ');

    // 1. Write UniformRequest record
    await base44.entities.UniformRequest.create({
      PNumber: personnel?.PNumber || '',
      RequestType: 'Initial Indent',
      ItemName: 'Full Initial Indent',
      Status: 'Pending',
      DateSubmitted: format(new Date(), 'yyyy-MM-dd'),
      ReasonForReturn: isBootOrder ? 'Boot order required' : '',
    });

    // 2. Update personnel sizing measurements
    if (personnel?.id) {
      await base44.entities.PersonnelManager.update(personnel.id, {
        HeadCircumference: sizing.HeadCircumference,
        Height: sizing.Height,
        Chest: sizing.Chest,
        Waist: sizing.Waist,
        SeatHips: sizing.SeatHips,
        InnerLeg: sizing.InnerLeg,
        BootSize: sizing.BootSize,
        IsBootOrder: isBootOrder,
      });
    }

    // 3. Create task notice for L5+
    const body = [
      `Cadet: ${fullName} (${personnel?.PNumber})`,
      `Request Type: Initial INDENT`,
      `Head: ${sizing.HeadCircumference}cm, Height: ${sizing.Height}cm`,
      `Chest: ${sizing.Chest}cm, Waist: ${sizing.Waist}cm`,
      `Seat/Hips: ${sizing.SeatHips}cm, Inner Leg: ${sizing.InnerLeg}cm`,
      `Boot Size: ${sizing.BootSize}`,
      `Boot Order Required: ${isBootOrder ? 'YES' : 'No'}`,
    ].join('\n');

    await base44.entities.ImportantNotice.create({
      Title: `Uniform Indent Request — ${fullName}`,
      Body: body,
      Priority: 'Normal',
      PublishedByPNumber: personnel?.PNumber || '',
      IsActive: true,
    });

    toast.success('Initial indent submitted. Your measurements have been saved.');
    setSubmitting(false);
    setSubmitted(true);
  }

  async function handleExchangeSubmit(e) {
    e.preventDefault();
    if (!itemName) { toast.error('Item Name is required'); return; }
    if (!sizeReturning) { toast.error('Size Returning is required'); return; }
    if (!reasonForReturn) { toast.error('Reason for Return is required'); return; }
    if (!newSizeRequired) { toast.error('New Size Required is required'); return; }

    setSubmitting(true);

    const fullName = [personnel?.Rank, personnel?.FirstName, personnel?.Surname].filter(Boolean).join(' ');

    // 1. Write UniformRequest record
    await base44.entities.UniformRequest.create({
      PNumber: personnel?.PNumber || '',
      RequestType: 'Exchange',
      ItemName: itemName,
      SizeReturning: sizeReturning,
      ReasonForReturn: reasonForReturn,
      Status: 'Pending',
      DateSubmitted: format(new Date(), 'yyyy-MM-dd'),
    });

    // 2. Create task notice for L5+
    const body = [
      `Cadet: ${fullName} (${personnel?.PNumber})`,
      `Request Type: Exchange`,
      `Item: ${itemName}`,
      `Size Returning: ${sizeReturning}`,
      `New Size Required: ${newSizeRequired}`,
      `Reason: ${reasonForReturn}`,
    ].join('\n');

    await base44.entities.ImportantNotice.create({
      Title: `Uniform Exchange Request — ${fullName} (${itemName})`,
      Body: body,
      Priority: 'Normal',
      PublishedByPNumber: personnel?.PNumber || '',
      IsActive: true,
    });

    toast.success('Exchange request submitted successfully.');
    setSubmitting(false);
    setSubmitted(true);
  }

  const fullName = [personnel?.Rank, personnel?.FirstName, personnel?.Surname].filter(Boolean).join(' ');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="w-5 h-5" />
            Uniform Request
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-10 gap-3 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <p className="text-lg font-semibold">Request Submitted</p>
            <p className="text-sm text-muted-foreground">Your request has been sent to the Detachment Commander for processing.</p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : !requestType ? (
          /* Step 1: Choose type */
          <div className="space-y-4 py-2">
            {/* Pre-populated identity */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {personnel?.Surname?.[0] || '?'}
              </div>
              <div>
                <p className="font-medium text-sm">{fullName || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{personnel?.PNumber} · {personnel?.RoleName}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">Select the type of uniform request:</p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setRequestType('indent')}
                className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-sm">Initial INDENT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">First-time uniform issue — all measurements required</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setRequestType('exchange')}
                className="flex items-center justify-between p-4 rounded-lg border-2 hover:border-primary hover:bg-primary/5 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-sm">Exchange</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Replace a uniform item for a different size</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ) : requestType === 'indent' ? (
          /* Step 2A: Initial Indent */
          <form onSubmit={handleIndentSubmit} className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Initial INDENT</Badge>
              <button type="button" onClick={() => setRequestType(null)} className="text-xs text-muted-foreground underline">Change</button>
            </div>
            <p className="text-xs text-muted-foreground">All measurements are required. Measure in centimetres (cm).</p>

            <div className="grid grid-cols-2 gap-3">
              {SIZING_FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-xs">{f.label} {f.unit && <span className="text-muted-foreground">({f.unit})</span>} *</Label>
                  <Input
                    className="mt-1"
                    placeholder={f.placeholder}
                    value={sizing[f.key] || ''}
                    onChange={e => setSizing(s => ({ ...s, [f.key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <span className="text-sm font-medium">Boot Order Required?</span>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsBootOrder(true)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${isBootOrder ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >Yes</button>
                <button
                  type="button"
                  onClick={() => setIsBootOrder(false)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${!isBootOrder ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >No</button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                <Send className="w-4 h-4 mr-1" />
                {submitting ? 'Submitting...' : 'Submit Indent'}
              </Button>
            </div>
          </form>
        ) : (
          /* Step 2B: Exchange */
          <form onSubmit={handleExchangeSubmit} className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Exchange</Badge>
              <button type="button" onClick={() => setRequestType(null)} className="text-xs text-muted-foreground underline">Change</button>
            </div>
            <p className="text-xs text-muted-foreground">Please measure for the new item before submitting.</p>

            <div>
              <Label>Item Name *</Label>
              <Input className="mt-1" placeholder="e.g. Smock, Trousers, Shirt" value={itemName} onChange={e => setItemName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Size Returning *</Label>
                <Input className="mt-1" placeholder="e.g. 170/88" value={sizeReturning} onChange={e => setSizeReturning(e.target.value)} required />
              </div>
              <div>
                <Label>New Size Required *</Label>
                <Input className="mt-1" placeholder="e.g. 170/96" value={newSizeRequired} onChange={e => setNewSizeRequired(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Reason for Return *</Label>
              <Textarea className="mt-1" rows={3} placeholder="e.g. Grown out of current size" value={reasonForReturn} onChange={e => setReasonForReturn(e.target.value)} required />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                <Send className="w-4 h-4 mr-1" />
                {submitting ? 'Submitting...' : 'Submit Exchange'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}