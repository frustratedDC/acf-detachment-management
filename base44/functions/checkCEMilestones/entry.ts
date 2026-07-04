import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MILESTONES = [4, 12, 28, 38];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cadetPNumber = body?.data?.CadetPNumber;
    if (!cadetPNumber) return Response.json({ error: 'Missing CadetPNumber' }, { status: 400 });

    const approvedEntries = await base44.asServiceRole.entities.CommunityEngagementLedger.filter({
      CadetPNumber: cadetPNumber,
      Status: 'Approved',
    });
    const totalHours = approvedEntries.reduce((sum, e) => sum + (e.Hours || 0), 0);

    const crossedMilestones = MILESTONES.filter(m => totalHours >= m);
    if (crossedMilestones.length === 0) {
      return Response.json({ created: 0, totalHours });
    }

    const existingTasks = await base44.asServiceRole.entities.CEMilestoneTask.filter({ CadetPNumber: cadetPNumber });
    const existingMilestones = new Set(existingTasks.map(t => t.Milestone));

    const cadetRecords = await base44.asServiceRole.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
    const cadet = cadetRecords[0];
    const cadetName = cadet ? `${cadet.Rank || ''} ${cadet.Surname}`.trim() : cadetPNumber;

    const toCreate = crossedMilestones.filter(m => !existingMilestones.has(m));
    for (const milestone of toCreate) {
      await base44.asServiceRole.entities.CEMilestoneTask.create({
        CadetPNumber: cadetPNumber,
        CadetName: cadetName,
        Milestone: milestone,
        TotalApprovedHours: totalHours,
        Status: 'Pending',
      });
    }

    return Response.json({ created: toCreate.length, totalHours });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});