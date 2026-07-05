import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MILESTONES = [12, 16, 31];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cadetPNumber = body?.data?.Name;
    if (!cadetPNumber) return Response.json({ error: 'Missing cadet PNumber' }, { status: 400 });

    const logEntries = await base44.asServiceRole.entities.KA_LogBook.filter({ Name: cadetPNumber });
    const totalPoints = logEntries.reduce((sum, e) => sum + (e.Points || 0), 0);

    const crossedMilestones = MILESTONES.filter(m => totalPoints >= m);
    if (crossedMilestones.length === 0) {
      return Response.json({ created: 0, totalPoints });
    }

    const existingTasks = await base44.asServiceRole.entities.KAMilestoneTask.filter({ CadetPNumber: cadetPNumber });
    const existingMilestones = new Set(existingTasks.map(t => t.MilestonePoints));

    const cadetRecords = await base44.asServiceRole.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
    const cadet = cadetRecords[0];
    const cadetName = cadet ? `${cadet.Rank || ''} ${cadet.Surname}`.trim() : cadetPNumber;

    const toCreate = crossedMilestones.filter(m => !existingMilestones.has(m));
    for (const milestone of toCreate) {
      await base44.asServiceRole.entities.KAMilestoneTask.create({
        CadetPNumber: cadetPNumber,
        CadetName: cadetName,
        MilestonePoints: milestone,
        TotalPoints: totalPoints,
        Status: 'Pending',
      });
    }

    return Response.json({ created: toCreate.length, totalPoints });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});