import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2 } from 'lucide-react';

export default function AttendeeRow({ attendee, canEdit, onUpdate, onDelete }) {
  const [due, setDue] = useState(attendee.AmountDue ?? 0);
  const [paid, setPaid] = useState(attendee.AmountPaid ?? 0);

  function save() {
    const isPaid = Number(due) > 0 && Number(paid) >= Number(due);
    onUpdate(attendee.id, {
      AmountDue: Number(due) || 0,
      AmountPaid: Number(paid) || 0,
      IsPaid: isPaid,
      PaymentDate: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border text-sm flex-wrap">
      <span className="font-medium flex-1 min-w-[120px]">{attendee.Name}</span>
      <Badge variant="outline" className="text-xs">{attendee.PersonType}</Badge>
      {attendee.PersonType === 'Cadet' && (
        attendee.IsPaid
          ? <Badge className="text-xs bg-emerald-100 text-emerald-800 gap-1"><CheckCircle2 className="w-3 h-3" />Paid</Badge>
          : <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Unpaid</Badge>
      )}
      {canEdit ? (
        <>
          <Input type="number" value={due} onChange={e => setDue(e.target.value)} className="h-7 w-20 text-xs" placeholder="Due" />
          <Input type="number" value={paid} onChange={e => setPaid(e.target.value)} className="h-7 w-20 text-xs" placeholder="Paid" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={save}>Save</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(attendee.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">£{attendee.AmountPaid ?? 0} / £{attendee.AmountDue ?? 0}</span>
      )}
    </div>
  );
}