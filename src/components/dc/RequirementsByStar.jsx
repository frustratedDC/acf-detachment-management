import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { sortLessons } from '@/lib/lessonSort';
import _ from 'lodash';

const STAR_ORDER = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];

export default function RequirementsByStar({ syllabus, progress, cadets, isLoading }) {
  const [expanded, setExpanded] = useState({});

  const mandatoryByStar = _.groupBy(
    sortLessons(syllabus.filter(l => l.IsMandatory)),
    'StarLevel'
  );

  const approvedByCadet = _.groupBy(progress.filter(p => p.Status === 'Approved'), 'CadetPNumber');
  const cadetsByStar = _.groupBy(cadets, 'CurrentStarLevel');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-accent" />
          Training Requirements by Star Level
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Outstanding mandatory lessons across cadets — link directly to the training plan to schedule.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {STAR_ORDER.map(star => {
          const lessons = mandatoryByStar[star] || [];
          const starCadets = cadetsByStar[star] || [];
          if (lessons.length === 0 || starCadets.length === 0) return null;

          const isOpen = expanded[star] !== false;
          const approvedSets = {};
          starCadets.forEach(c => {
            approvedSets[c.PNumber] = new Set((approvedByCadet[c.PNumber] || []).map(p => p.LessonCode));
          });

          // For each lesson, count how many cadets have NOT completed it
          const lessonStatus = lessons.map(lesson => {
            const outstanding = starCadets.filter(c => !approvedSets[c.PNumber]?.has(lesson.LessonCode)).length;
            return { lesson, outstanding, total: starCadets.length };
          });

          const totalOutstanding = lessonStatus.reduce((s, l) => s + l.outstanding, 0);
          const fullyCovered = lessonStatus.filter(l => l.outstanding === 0).length;

          return (
            <div key={star} className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                onClick={() => setExpanded(p => ({ ...p, [star]: !isOpen }))}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-semibold text-sm">{star}</span>
                  <Badge variant="secondary" className="text-xs">{starCadets.length} cadet{starCadets.length !== 1 ? 's' : ''}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {totalOutstanding === 0 ? (
                    <Badge className="text-xs bg-chart-2 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Complete</Badge>
                  ) : (
                    <Badge className="text-xs bg-accent text-accent-foreground">{totalOutstanding} outstanding</Badge>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="p-3 pt-0 space-y-1.5">
                  <div className="text-xs text-muted-foreground mb-2">
                    {fullyCovered} of {lessons.length} lessons fully completed · {lessons.length - fullyCovered} need scheduling
                  </div>
                  {lessonStatus.map(({ lesson, outstanding, total }) => (
                    <div
                      key={lesson.LessonCode}
                      className={`flex items-center gap-2 p-2 rounded-lg ${outstanding === 0 ? 'bg-chart-2/5' : 'bg-accent/5'}`}
                    >
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{lesson.LessonCode}</code>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{lesson.LessonName}</p>
                        <p className="text-xs text-muted-foreground">{lesson.SubjectName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {outstanding === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-chart-2" />
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-accent-foreground">{outstanding}/{total}</p>
                            <p className="text-xs text-muted-foreground">remaining</p>
                          </>
                        )}
                      </div>
                      {outstanding > 0 && (
                        <Link to="/schedule">
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0">
                            Schedule <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {STAR_ORDER.every(s => (mandatoryByStar[s] || []).length === 0 || (cadetsByStar[s] || []).length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No mandatory syllabus lessons or active cadets found.</p>
        )}
      </CardContent>
    </Card>
  );
}