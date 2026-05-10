import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import _ from 'lodash';

export default function LessonSelector({ value, onChange, starLevel, className }) {
  const { personnel } = usePersonnel();

  const { data: masterLessons = [] } = useQuery({
    queryKey: ['syllabus-master', starLevel],
    queryFn: () => starLevel
      ? base44.entities.SyllabusMaster.filter({ StarLevel: starLevel })
      : base44.entities.SyllabusMaster.filter({}),
  });

  const { data: personalLessons = [] } = useQuery({
    queryKey: ['personal-syllabus', personnel?.PNumber, starLevel],
    queryFn: () => {
      const query = { UserPNumber: personnel?.PNumber };
      if (starLevel) query.StarLevel = starLevel;
      return base44.entities.PersonalSyllabus.filter(query);
    },
    enabled: !!personnel?.PNumber,
  });

  const allLessons = [
    ...masterLessons.map(l => ({ ...l, source: 'master' })),
    ...personalLessons.map(l => ({ ...l, source: 'personal' })),
  ];

  const grouped = _.groupBy(allLessons, 'SubjectName');
  const sortedSubjects = Object.keys(grouped).sort();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select a lesson" />
      </SelectTrigger>
      <SelectContent>
        {sortedSubjects.map(subject => (
          <SelectGroup key={subject}>
            <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {subject}
            </SelectLabel>
            {_.sortBy(grouped[subject], 'LessonName').map(lesson => (
              <SelectItem key={lesson.LessonCode} value={lesson.LessonCode}>
                <span className="flex items-center gap-2">
                  {lesson.LessonCode} - {lesson.LessonName}
                  {lesson.source === 'personal' && (
                    <span className="text-xs text-accent-foreground bg-accent/20 px-1.5 rounded">Personal</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {sortedSubjects.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground text-center">No lessons available</div>
        )}
      </SelectContent>
    </Select>
  );
}