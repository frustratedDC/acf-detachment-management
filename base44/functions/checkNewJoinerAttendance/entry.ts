import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const record = body?.data;
    if (!record) return Response.json({ error: 'Missing parade record' }, { status: 400 });
    if (record.AttendanceStatus !== 'Present') {
      return Response.json({ updated: false, reason: 'Not marked Present' });
    }

    const checklists = await base44.asServiceRole.entities.NewJoinerChecklist.filter({
      CadetPNumber: record.UserPNumber,
    });
    const checklist = checklists[0];
    if (!checklist || checklist.SixTrainingNightsComplete) {
      return Response.json({ updated: false, reason: 'No active checklist' });
    }

    const newCount = (checklist.TrainingNightsCount || 0) + 1;
    await base44.asServiceRole.entities.NewJoinerChecklist.update(checklist.id, {
      TrainingNightsCount: newCount,
      SixTrainingNightsComplete: newCount >= 6,
    });

    return Response.json({ updated: true, count: newCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});