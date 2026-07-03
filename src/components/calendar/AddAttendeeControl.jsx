import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

export default function AddAttendeeControl({ personnel, existingPNumbers, onAdd }) {
  const [pnum, setPnum] = useState('');
  const [tier, setTier] = useState('Full');
  const available = personnel.filter(p => !existingPNumbers.includes(p.PNumber));

  function handleAdd() {
    const p = personnel.find(x => x.PNumber === pnum);
    if (!p) return;
    const personType = p.Type === 'Adult Instructor' ? 'Adult Staff' : 'Cadet';
    onAdd(p, personType, tier);
    setPnum('');
  }

  return (
    <div className="flex gap-2 items-end flex-wrap p-2 border rounded-lg bg-muted/20">
      <div className="flex-1 min-w-[160px]">
        <Select value={pnum} onValueChange={setPnum}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add attendee..." /></SelectTrigger>
          <SelectContent>
            {available.map(p => (
              <SelectItem key={p.PNumber} value={p.PNumber}>
                {[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Select value={tier} onValueChange={setTier}>
        <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Full">Full</SelectItem>
          <SelectItem value="FSM">FSM</SelectItem>
          <SelectItem value="Adult">Adult</SelectItem>
          <SelectItem value="None">None</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8" onClick={handleAdd} disabled={!pnum}>
        <UserPlus className="w-3.5 h-3.5 mr-1" />Add
      </Button>
    </div>
  );
}