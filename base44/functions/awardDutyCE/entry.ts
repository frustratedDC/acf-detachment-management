import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CE_HOURS_PER_DUTY = 0.25; // 15 minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Today's date in Europe/London
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

    const assignments = await base44.asServiceRole.entities.DutyAssignment.filter({ Date: today, CEAwarded: false });

    for (const assignment of assignments) {
      await base44.asServiceRole.entities.CommunityEngagementLedger.create({
        CadetPNumber: assignment.CadetPNumber,
        Hours: CE_HOURS_PER_DUTY,
        ActivityType: 'Event Support',
        Description: `Training night duty: ${assignment.Role}`,
        Date: assignment.Date,
        Status: 'Pending',
      });
      await base44.asServiceRole.entities.DutyAssignment.update(assignment.id, { CEAwarded: true });
    }

    const message = `Queued ${assignments.length} duty CE submission${assignments.length !== 1 ? 's' : ''} for approval`;
    console.log(message);

    return Response.json({ success: true, queued: assignments.length, message });
  } catch (error) {
    console.error('awardDutyCE error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});