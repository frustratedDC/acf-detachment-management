import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Brain, Search } from 'lucide-react';
import { ACCESS_LEVELS, isCadet } from '@/lib/accessLevels';
import { sortLessons } from '@/lib/lessonSort';
import ProgressMatrixGrid from '@/components/progress/ProgressMatrixGrid';
import _ from 'lodash';

const STAR_ORDER = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star', 'Adult', 'Admin'];

export default function ProgressMatrix() {
  const [starFilter, setStarFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortBy, setSortBy] = useState('surname');

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

  // Only show Active Cadets (L0-L2) — Adult Instructors (L3+) and non-Active do not appear
  const cadets = personnel.filter(p =>
    isCadet(p.AccessLevel) &&
    (p.PersonnelStatus || 'Active') === 'Active' &&
    (starFilter === 'all' || p.CurrentStarLevel === starFilter) &&
    (p.Surname?.toLowerCase().includes(search.toLowerCase()) || p.PNumber?.toLowerCase().includes(search.toLowerCase()))
  );

  const mandatoryLessons = sortLessons(syllabus.filter(l => l.IsMandatory));
  const approvedByUser = _.groupBy(progress.filter(p => p.Status === 'Approved'), 'CadetPNumber');

  const cadetsWithProgress = cadets.map(cadet => {
    const completed = approvedByUser[cadet.PNumber] || [];
    const completedCodes = new Set(completed.map(c => c.LessonCode));
    const relevantMandatory = mandatoryLessons.filter(l => l.StarLevel === cadet.CurrentStarLevel);
    const completedCount = relevantMandatory.filter(l => completedCodes.has(l.LessonCode)).length;
    const remaining = relevantMandatory.length - completedCount;
    const pct = relevantMandatory.length > 0 ? Math.round((completedCount / relevantMandatory.length) * 100) : 0;
    return { cadet, completedCodes, relevantMandatory, completedCount, remaining, pct };
  });

  const sortedCadets = _.orderBy(
    cadetsWithProgress,
    sortBy === 'surname' ? ['cadet.Surname'] : ['remaining'],
    sortBy === 'remaining-desc' ? ['desc'] : ['asc']
  );

  // Group by star level so each grid has a consistent set of lesson columns
  const groups = _.groupBy(sortedCadets, 'cadet.CurrentStarLevel');
  const groupLevels = Object.keys(groups).sort((a, b) => STAR_ORDER.indexOf(a) - STAR_ORDER.indexOf(b));

  return (
    <AccessGate level={ACCESS_LEVELS.DET_INSTRUCTOR}>
      <PageHeader
        title="Syllabus Progress Matrix"
        description="Track cadet progress through the syllabus"
        icon={Brain}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={starFilter} onValueChange={setStarFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Basic">Basic</SelectItem>
            <SelectItem value="1 Star">1 Star</SelectItem>
            <SelectItem value="2 Star">2 Star</SelectItem>
            <SelectItem value="3 Star">3 Star</SelectItem>
            <SelectItem value="4 Star">4 Star</SelectItem>
            <SelectItem value="Adult">Adult</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="surname">Sort: Surname</SelectItem>
            <SelectItem value="remaining-asc">Qty Remaining: Low-High</SelectItem>
            <SelectItem value="remaining-desc">Qty Remaining: High-Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
          <Label htmlFor="show-completed" className="text-sm whitespace-nowrap">Show Completed Lessons</Label>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-48" />
        </div>
      </div>

      {sortedCadets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No cadets found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupLevels.map(level => {
            const groupCadets = groups[level];
            let lessonsForGroup = mandatoryLessons.filter(l => l.StarLevel === level);
            if (!showCompleted) {
              lessonsForGroup = lessonsForGroup.filter(l => !groupCadets.every(c => c.completedCodes.has(l.LessonCode)));
            }
            return (
              <Card key={level}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {level}
                    <Badge variant="secondary" className="text-xs">{groupCadets.length} cadet{groupCadets.length !== 1 ? 's' : ''}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProgressMatrixGrid lessons={lessonsForGroup} cadets={groupCadets} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AccessGate>
  );
}