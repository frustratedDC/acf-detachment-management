import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Search, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import _ from 'lodash';
import SyllabusEditorDialog from '@/components/syllabus/SyllabusEditorDialog';
import SyllabusBulkBar from '@/components/syllabus/SyllabusBulkBar';
import { toast } from 'sonner';

const STAR_ORDER = { 'Basic': 0, '1 Star': 1, '2 Star': 2, '3 Star': 3, '4 Star': 4, 'Adult': 5, 'Admin': 6 };
const TYPE_BADGE = {
  'Physical Assessment': 'bg-orange-500 text-white',
  'Auto-Assessment': 'bg-blue-500 text-white',
};

export default function SyllabusMaster() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [starFilter, setStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [collapsed, setCollapsed] = useState({});
  const [selected, setSelected] = useState([]);
  const [editingLesson, setEditingLesson] = useState(null);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SyllabusMaster.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      toast.success('Lesson deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = lessons.filter(l => {
    const matchSearch = l.LessonCode?.toLowerCase().includes(search.toLowerCase()) ||
      l.LessonName?.toLowerCase().includes(search.toLowerCase()) ||
      l.SubjectName?.toLowerCase().includes(search.toLowerCase());
    const matchStar = starFilter === 'all' || l.StarLevel === starFilter;
    return matchSearch && matchStar;
  });

  const grouped = _.groupBy(filtered, 'SubjectName');
  const subjects = Object.keys(grouped).sort();

  function sortLessons(list) {
    if (sortBy === 'star') return _.sortBy(list, l => STAR_ORDER[l.StarLevel] ?? 99);
    if (sortBy === 'code') return _.sortBy(list, 'LessonCode');
    return _.sortBy(list, 'LessonName');
  }

  function toggleSection(subject) {
    setCollapsed(p => ({ ...p, [subject]: !p[subject] }));
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <div>
      <PageHeader
        title="Master Syllabus"
        description="Manage the training syllabus: lessons, assessments and qualification requirements"
        icon={BookOpen}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search lessons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={starFilter} onValueChange={setStarFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Star Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stars</SelectItem>
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
              <SelectTrigger className="w-40"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Lesson Name</SelectItem>
                <SelectItem value="code">Sort: Lesson Code</SelectItem>
                <SelectItem value="star">Sort: Star Level</SelectItem>
              </SelectContent>
            </Select>
            <SyllabusEditorDialog />
          </div>
        }
      />

      {selected.length > 0 && (
        <SyllabusBulkBar selectedIds={selected} onClear={() => setSelected([])} />
      )}

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
          {subjects.map(subject => {
            const isCollapsed = !!collapsed[subject];
            return (
              <Card key={subject}>
                <CardHeader
                  className="pb-2 cursor-pointer select-none"
                  onClick={() => toggleSection(subject)}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    {subject}
                    <span className="text-xs font-normal text-muted-foreground">({grouped[subject].length})</span>
                  </CardTitle>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <div className="space-y-1">
                      {sortLessons(grouped[subject]).map(lesson => (
                        <div key={lesson.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                          <Checkbox
                            checked={selected.includes(lesson.id)}
                            onCheckedChange={() => toggleSelect(lesson.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{lesson.LessonCode}</code>
                          <span className="text-sm flex-1">{lesson.LessonName}</span>
                          <Badge variant="outline" className="text-xs">{lesson.StarLevel}</Badge>
                          {lesson.IsMandatory && <Badge className="bg-accent text-accent-foreground text-xs">Required</Badge>}
                          {lesson.LessonType && lesson.LessonType !== 'Lesson' && (
                            <Badge className={`text-xs ${TYPE_BADGE[lesson.LessonType] || ''}`}>{lesson.LessonType}</Badge>
                          )}
                          {(lesson.RequiredQuals || []).map(code => (
                            <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
                          ))}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLesson(lesson)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm(`Delete "${lesson.LessonName}"?`)) deleteMutation.mutate(lesson.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editingLesson && (
        <SyllabusEditorDialog
          lesson={editingLesson}
          open={!!editingLesson}
          onOpenChange={(v) => { if (!v) setEditingLesson(null); }}
        />
      )}
    </div>
  );
}