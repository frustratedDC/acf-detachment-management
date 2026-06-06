import React, { useState } from 'react';
import { usePersonnel } from '@/lib/usePersonnel';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, HeartHandshake, Dumbbell } from 'lucide-react';
import KAMyLogbook from '@/components/ka/KAMyLogbook';
import CEMyLogbook from '@/components/ce/CEMyLogbook';

export default function MyLogbooks() {
  const { personnel: me } = usePersonnel();
  const [activeTab, setActiveTab] = useState('ka');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Logbooks"
        description="Review your historic training and engagement records"
        icon={BookOpen}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ka" className="gap-2">
            <Dumbbell className="w-4 h-4" />
            Keeping Active
          </TabsTrigger>
          <TabsTrigger value="ce" className="gap-2">
            <HeartHandshake className="w-4 h-4" />
            Community Engagement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ka" className="mt-6">
          <KAMyLogbook pnum={me?.PNumber} />
        </TabsContent>

        <TabsContent value="ce" className="mt-6">
          <CEMyLogbook pnum={me?.PNumber} />
        </TabsContent>
      </Tabs>
    </div>
  );
}