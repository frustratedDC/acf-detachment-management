import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoff = sixMonthsAgo.toISOString().split('T')[0];

    const discharged = await base44.asServiceRole.entities.PersonnelManager.filter({ IsArchived: true });
    const toPurge = discharged.filter(p => p.DischargeDate && p.DischargeDate <= cutoff);

    let purgedCount = 0;
    for (const person of toPurge) {
      const pNumber = person.PNumber;
      const relatedEntities = [
        'ProgressLedger', 'TrainingHistory', 'DailyParadeState', 'CommunityEngagementLedger',
        'StarLevelMilestone', 'PromotionMilestoneTask', 'CEMilestoneTask', 'NewJoinerChecklist',
        'UniformRequest', 'PersonalSyllabus',
      ];
      for (const entityName of relatedEntities) {
        const records = await base44.asServiceRole.entities[entityName].filter({ CadetPNumber: pNumber });
        for (const record of records) {
          await base44.asServiceRole.entities[entityName].delete(record.id);
        }
      }
      await base44.asServiceRole.entities.PersonnelManager.delete(person.id);
      purgedCount++;
    }

    return Response.json({ success: true, purged: purgedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});