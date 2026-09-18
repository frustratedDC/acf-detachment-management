import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { QUALIFIED_STATUS_PRIORITY, QUAL_TO_DOMAIN } from '../../shared/eventConstants.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { eventId } = body;
    if (!eventId) return Response.json({ error: 'eventId required' }, { status: 400 });

    const event = await base44.entities.EventTrainingPlan.get(eventId);
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });

    const [staff, platoons] = await Promise.all([
      base44.entities.EventStaff.filter({ EventID: eventId }),
      base44.entities.EventPlatoon.filter({ EventID: eventId }),
    ]);

    if (platoons.length === 0) {
      return Response.json({ error: 'No platoons configured. Create platoons first.' }, { status: 400 });
    }

    const requiredSubjects = event.TrainingSubjects || [];
    const requiredDomains = new Set(
      requiredSubjects.map((s) => {
        const key = Object.keys(QUAL_TO_DOMAIN).find((k) => k.includes(s) || s.includes(k));
        return key ? QUAL_TO_DOMAIN[key] : s;
      })
    );

    // Adult instructors only for platoon allocation
    const ais = staff.filter((s) => s.StaffType === 'Adult Instructor');

    // Sort by qualified status priority (SPTA highest)
    ais.sort((a, b) => {
      const pa = QUALIFIED_STATUS_PRIORITY[a.QualifiedStatus] ?? 99;
      const pb = QUALIFIED_STATUS_PRIORITY[b.QualifiedStatus] ?? 99;
      return pa - pb;
    });

    const assignedIds = new Set();
    const assignments = [];

    for (const platoon of platoons) {
      const platoonStaff = [];
      const maxStaff = 2;

      // Priority 1: AIs whose subject quals match required domains
      for (const ai of ais) {
        if (assignedIds.has(ai.id)) continue;
        if (platoonStaff.length >= maxStaff) break;
        const aiDomains = new Set(
          (ai.SubjectQualifications || []).map((q) => QUAL_TO_DOMAIN[q]).filter(Boolean)
        );
        const matches = [...requiredDomains].some((d) => aiDomains.has(d));
        if (matches) {
          platoonStaff.push(ai);
          assignedIds.add(ai.id);
        }
      }

      // Priority 2: Fill remaining slots by qualified status (already sorted)
      for (const ai of ais) {
        if (assignedIds.has(ai.id)) continue;
        if (platoonStaff.length >= maxStaff) break;
        platoonStaff.push(ai);
        assignedIds.add(ai.id);
      }

      const staffIds = platoonStaff.map((s) => s.id);
      const commanderName = platoonStaff[0]
        ? [platoonStaff[0].Rank, platoonStaff[0].Name].filter(Boolean).join(' ')
        : platoon.CommanderName || '';

      await base44.entities.EventPlatoon.update(platoon.id, {
        StaffIDs: staffIds,
        CommanderName: commanderName,
      });

      for (const s of platoonStaff) {
        await base44.entities.EventStaff.update(s.id, { PlatoonID: platoon.id });
      }

      assignments.push({
        platoonId: platoon.id,
        platoonName: platoon.PlatoonName,
        commanderName,
        staff: platoonStaff.map((s) => ({ id: s.id, name: s.Name, qualifiedStatus: s.QualifiedStatus })),
      });
    }

    return Response.json({
      success: true,
      assignments,
      platoonCount: platoons.length,
      staffAssigned: assignedIds.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}