import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, Send, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { isCadet } from '@/lib/accessLevels';

const STAR_LEVELS = ['Basic', '1 Star', '2 Star'];

export default function BulkProgressEntry() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();

  const [starLevel, setStarLevel] = useState('Basic');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedCadets, setSelectedCadets] = useState([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const cadets = personnel.filter(p => isCadet(p.AccessLevel) && p.CurrentStarLevel === starLevel);
  const filteredCadets = cadets.filter(c =>
    c.Surname?.toLowerCase().includes(search.toLowerCase()) ||
    c.PNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const lessons = syllabus.filter(l => l.StarLevel === starLevel && (subjectFilter === 'all' || l.SubjectName === subjectFilter));
  const subjects = [...new Set(syllabus.filter(l => l.StarLevel === starLevel).map(l => l.SubjectName))];

  const approvedCodes = new Set(progress.filter(p => p.Status === 'Approved').map(p => `${p.CadetPNumber}::${p.LessonCode}`));

  function toggleCadet(pnum) {
    setSelectedCadets(prev => prev.includes(pnum) ? prev.filter(p => p !== pnum) : [...prev, pnum]);
  }

  function toggleAll() {
    const eligible = filteredCadets.filter(c => !approvedCodes.has(`${c.PNumber}::${selectedLesson}`));
    const allSelected = eligible.every(c => selectedCadets.includes(c.PNumber));
    if (allSelected) setSelectedCadets([]);
    else setSelectedCadets(eligible.map(c => c.PNumber));
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const isAutoApproved = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC;
      const records = selectedCadets.map(pnum => ({
        CadetPNumber: pnum,
        LessonCode: selectedLesson,
        Status: isAutoApproved ? 'Approved' : 'Pending',
        CompletionDate: date,
        InstructorPNumber: me?.PNumber,
      }));
      await base44.entities.ProgressLedger.bulkCreate(records);
    },
    onSuccess: () => {
      toast.success(`Submitted ${selectedCadets.length} progress records`);
      setSelectedCadets([]);
      queryClient.invalidateQueries({ queryKey: ['progress-all'] });
      queryClient.invalidateQueries({ queryKey: ['all-progress'] });
    },
  });

  const selectedLessonObj = lessons.find(l => l.LessonCode === selectedLesson);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Bulk Progress Entry"
        description="Mark passed lessons for multiple cadets at once"
        icon={ClipboardCheck}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Step 1 — Select Lesson</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Star Level</Label>
              <Select value={starLevel} onValueChange={v => { setStarLevel(v); setSelectedLesson(''); setSubjectFilter('all'); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAR_LEVELS.map(sl => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lesson</Label>
              <Select value={selectedLesson} onValueChange={setSelectedLesson}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select lesson..." /></SelectTrigger>
                <SelectContent>
                  {lessons.map(l => (
                    <SelectItem key={l.LessonCode} value={l.LessonCode}>
                      {l.LessonCode} — {l.LessonName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Completion Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            {selectedLessonObj && (
              <div className="p-2 rounded-lg bg-muted/50 text-xs space-y-1">
                <p><strong>{selectedLessonObj.LessonCode}</strong> — {selectedLessonObj.LessonName}</p>
                <p className="text-muted-foreground">{selectedLessonObj.SubjectName} · {selectedLessonObj.StarLevel}</p>
                {selectedLessonObj.IsMandatory && <Badge className="text-xs">Mandatory</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Step 2 — Select Cadets ({selectedCadets.length} selected)</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={!selectedLesson}>
                  {selectedCadets.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-40" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto mb-4">
              {filteredCadets.map(cadet => {
                const alreadyDone = approvedCodes.has(`${cadet.PNumber}::${selectedLesson}`);
                return (
                  <label
                    key={cadet.PNumber}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${alreadyDone ? 'opacity-40' : 'hover:bg-muted/50'}`}
                  >
                    <Checkbox
                      checked={selectedCadets.includes(cadet.PNumber)}
                      onCheckedChange={() => !alreadyDone && toggleCadet(cadet.PNumber)}
                      disabled={alreadyDone}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{[cadet.Rank, cadet.FirstName, cadet.Surname].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-muted-foreground">{cadet.PNumber}</p>
                    </div>
                    {alreadyDone && <Badge variant="outline" className="text-xs text-chart-2 border-chart-2/30">Already passed</Badge>}
                  </label>
                );
              })}
              {filteredCadets.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">No cadets at {starLevel} level.</p>}
            </div>
            <Button
              className="w-full"
              onClick={() => submitMutation.mutate()}
              disabled={!selectedLesson || selectedCadets.length === 0 || submitMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit {selectedCadets.length} Record{selectedCadets.length !== 1 ? 's' : ''}
              {(me?.AccessLevel ?? 0) < ACCESS_LEVELS.DET_2IC ? ' (Pending Approval)' : ' (Auto-Approved)'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}