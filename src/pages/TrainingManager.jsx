import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, CheckCircle2, Users, Lightbulb, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import _ from 'lodash';

export default function TrainingManager() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule-today', today],
    queryFn: () => base44.entities.NightlySchedule.filter({ Date: today }),
  });

  const { data: paradeState = [] } = useQuery({
    queryKey: ['parade', today],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: today }),
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['progress-all'],
    queryFn: () => base44.entities.ProgressLedger.filter({}),
  });

  const { data: syllabus = [] } = useQuery({
    queryKey: ['syllabus-master-all'],
    queryFn: () => base44.entities.SyllabusMaster.filter({}),
  });

  const personnelMap = {};
  personnel.forEach(p => { personnelMap[p.PNumber] = p; });

  const presentPNumbers = new Set(paradeState.filter(p => p.AttendanceStatus === 'Present').map(p => p.UserPNumber));
  const scheduledInstructors = [...new Set(schedule.map(s => s.InstructorPNumber))];
  const absentInstructors = scheduledInstructors.filter(ip => !presentPNumbers.has(ip));
  const presentInstructors = personnel.filter(p => p.AccessLevel >= 2 && presentPNumbers.has(p.PNumber));

  async function getAiSuggestions() {
    setLoadingAi(true);
    const completedByLevel = _.groupBy(progress.filter(p => p.Status === 'Approved'), 'CadetPNumber');
    const mandatoryLessons = syllabus.filter(l => l.IsMandatory);

    const gaps = [];
    personnel.filter(p => p.AccessLevel === 0).forEach(cadet => {
      const completed = new Set((completedByLevel[cadet.PNumber] || []).map(c => c.LessonCode));
      const missing = mandatoryLessons.filter(l => l.StarLevel === cadet.CurrentStarLevel && !completed.has(l.LessonCode));
      if (missing.length > 0) {
        gaps.push({ cadet: cadet.Surname, starLevel: cadet.CurrentStarLevel, missing: missing.map(m => m.LessonCode) });
      }
    });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an ACF Training Manager AI assistant. Based on the following data, suggest a training plan priority for tonight.

Available instructors tonight: ${presentInstructors.map(i => `${i.Surname} (${i.PNumber})`).join(', ')}

Syllabus gaps (cadets missing mandatory lessons):
${gaps.slice(0, 20).map(g => `${g.cadet} (${g.starLevel}): Missing ${g.missing.join(', ')}`).join('\n')}

Provide 3-5 prioritized recommendations for tonight's training, focusing on the most common gaps. Be concise and military-style.`,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priority: { type: "number" },
                lesson: { type: "string" },
                reasoning: { type: "string" },
                suggestedInstructor: { type: "string" },
              }
            }
          }
        }
      }
    });
    setAiSuggestion(result);
    setLoadingAi(false);
  }

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Training Manager"
        description="Intelligence hub for training planning"
        icon={Brain}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Exception Monitor */}
        <Card className="border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" />
              Live Exception Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {absentInstructors.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-chart-2">
                <CheckCircle2 className="w-4 h-4" />
                All scheduled instructors are present.
              </div>
            ) : (
              <div className="space-y-2">
                {absentInstructors.map(ip => (
                  <div key={ip} className="p-3 rounded-lg bg-destructive/10 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <strong>{personnelMap[ip]?.Surname || ip}</strong> is absent
                    </div>
                    <div className="ml-6 mt-1 text-xs text-muted-foreground">
                      Assigned lessons: {schedule.filter(s => s.InstructorPNumber === ip).map(s => s.LessonCode).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Present Staff */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Available Instructors ({presentInstructors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {presentInstructors.map(inst => (
                <div key={inst.PNumber} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 text-sm">
                  <div className="w-6 h-6 rounded bg-chart-2/10 flex items-center justify-center text-xs text-chart-2 font-bold">
                    {inst.Surname?.[0]}
                  </div>
                  <span>{inst.Surname}</span>
                  <Badge variant="outline" className="text-xs ml-auto">{inst.RoleName}</Badge>
                </div>
              ))}
              {presentInstructors.length === 0 && (
                <p className="text-sm text-muted-foreground">No instructors marked as present.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Suggestions */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-accent" />
            AI Planning Suggestions
          </CardTitle>
          <Button onClick={getAiSuggestions} disabled={loadingAi} size="sm">
            {loadingAi ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
            {loadingAi ? 'Analysing...' : 'Get Suggestions'}
          </Button>
        </CardHeader>
        <CardContent>
          {aiSuggestion?.recommendations ? (
            <div className="space-y-3">
              {aiSuggestion.recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">Priority {rec.priority}</Badge>
                    <span className="text-sm font-medium">{rec.lesson}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{rec.reasoning}</p>
                  {rec.suggestedInstructor && (
                    <p className="text-xs mt-1">Suggested: <strong>{rec.suggestedInstructor}</strong></p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Click "Get Suggestions" to analyse training gaps and generate recommendations.
            </p>
          )}
        </CardContent>
      </Card>
    </AccessGate>
  );
}