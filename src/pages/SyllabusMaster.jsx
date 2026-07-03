import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, Search } from 'lucide-react';
import _ from 'lodash';
import AddLessonDialog from '@/components/syllabus/AddLessonDialog';

export default function SyllabusMaster() {
  const [search, setSearch] = useState('');

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const filtered = lessons.filter(l =>
    l.LessonCode?.toLowerCase().includes(search.toLowerCase()) ||
    l.LessonName?.toLowerCase().includes(search.toLowerCase()) ||
    l.SubjectName?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = _.groupBy(filtered, 'SubjectName');
  const subjects = Object.keys(grouped).sort();

  return (
    <div>
      <PageHeader
        title="Master Syllabus"
        description="Read-only view of the training syllabus"
        icon={BookOpen}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search lessons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <AddLessonDialog />
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>)}
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No syllabus data loaded. Contact your admin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {subjects.map(subject => (
            <Card key={subject}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{subject}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {_.sortBy(grouped[subject], 'LessonName').map(lesson => (
                    <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{lesson.LessonCode}</code>
                      <span className="text-sm flex-1">{lesson.LessonName}</span>
                      <Badge variant="outline" className="text-xs">{lesson.StarLevel}</Badge>
                      {lesson.IsMandatory && <Badge className="bg-accent text-accent-foreground text-xs">Required</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}