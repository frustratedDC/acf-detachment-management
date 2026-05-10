import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Search, CheckCircle2, Clock } from 'lucide-react';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import _ from 'lodash';

export default function ProgressMatrix() {
  const [starFilter, setStarFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const cadets = personnel.filter(p =>
    (starFilter === 'all' || p.CurrentStarLevel === starFilter) &&
    (p.Surname?.toLowerCase().includes(search.toLowerCase()) || p.PNumber?.toLowerCase().includes(search.toLowerCase()))
  );

  const mandatoryLessons = syllabus.filter(l => l.IsMandatory);
  const approvedByUser = _.groupBy(progress.filter(p => p.Status === 'Approved'), 'CadetPNumber');

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Syllabus Progress Matrix"
        description="Track cadet progress through the syllabus"
        icon={Brain}
        actions={
          <div className="flex items-center gap-2">
            <Select value={starFilter} onValueChange={setStarFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
                <SelectItem value="1 Star">1 Star</SelectItem>
                <SelectItem value="2 Star">2 Star</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-48" />
            </div>
          </div>
        }
      />

      {cadets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No cadets found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cadets.map(cadet => {
            const completed = approvedByUser[cadet.PNumber] || [];
            const completedCodes = new Set(completed.map(c => c.LessonCode));
            const relevantMandatory = mandatoryLessons.filter(l => l.StarLevel === cadet.CurrentStarLevel);
            const completedCount = relevantMandatory.filter(l => completedCodes.has(l.LessonCode)).length;
            const pct = relevantMandatory.length > 0 ? Math.round((completedCount / relevantMandatory.length) * 100) : 0;

            return (
              <Card key={cadet.PNumber}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {cadet.Surname?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{cadet.Surname}</p>
                        <p className="text-xs text-muted-foreground">{cadet.PNumber} · {cadet.CurrentStarLevel}</p>
                      </div>
                    </div>
                    <Badge variant={pct === 100 ? 'default' : 'outline'}>
                      {pct}% ({completedCount}/{relevantMandatory.length})
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {relevantMandatory.map(lesson => (
                      <span
                        key={lesson.LessonCode}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          completedCodes.has(lesson.LessonCode)
                            ? 'bg-chart-2/10 text-chart-2'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {completedCodes.has(lesson.LessonCode) ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {lesson.LessonCode}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccessGate>
  );
}