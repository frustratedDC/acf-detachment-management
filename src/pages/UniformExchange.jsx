import React, { useState } from 'react';
import PageHeader from "@/components/shared/PageHeader";
import { Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import UniformRequestForm from '@/components/forms/UniformRequestForm';

export default function UniformExchange() {
  const [open, setOpen] = useState(true);

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Uniform Exchange" 
        description="Request uniform items and exchanges"
        icon={Shirt}
        actions={<Button onClick={() => setOpen(true)}>Open Form</Button>}
      />
      <UniformRequestForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}