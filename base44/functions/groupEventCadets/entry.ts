import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { STAR_TRAJECTORY_ORDER } from '../../shared/eventConstants.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { eventId } = body;
    if (!eventId) return Response.json({ error: 'eventId required' }, { status: 400 });

    const [cadets, platoons] = await Promise.all([
      base44.entities.EventNominalRoll.filter({ EventID: eventId }),
      base44.entities.EventPlatoon.filter({ EventID: eventId }),
    ]);

    if (platoons.length === 0) {
      return Response.json({ error: 'No platoons configured. Create platoons first.' }, { status: 400 });
    }
    if (cadets.length === 0) {
      return Response.json({ error: 'No cadets on nominal roll. Upload the nominal roll first.' }, { status: 400 });
    }

    // Score each cadet by the three priorities:
    // 1. Fastest star level completion trajectory (higher star = closer to done = higher score)
    // 2. Most completed subjects at current star level
    // 3. Targeted training inputs
    const scored = cadets.map((c) => {
      const starIdx = STAR_TRAJECTORY_ORDER.indexOf(c.CurrentStarLevel);
      const trajectoryScore = starIdx >= 0 ? (STAR_TRAJECTORY_ORDER.length - starIdx) : 0;
      const completions = (c.SubjectCompletions || []).length + (c.PartialCompletions || []).length;
      const targeted = (c.TargetedTraining || []).length;
      // Weighted: trajectory dominates, then completions, then targeted
      const score = trajectoryScore * 1000 + completions * 10 + targeted;
      return { cadet: c, score, trajectoryScore, completions, targeted };
    });

    scored.sort((a, b) => b.score - a.score);

    // Distribute cadets across platoons (round-robin by score for balanced groups)
    const platoonCadets = {};
    platoons.forEach((p) => { platoonCadets[p.id] = []; });
    scored.forEach((cs, i) => {
      const platoon = platoons[i % platoons.length];
      platoonCadets[platoon.id].push(cs.cadet);
    });

    // Persist assignments
    for (const platoon of platoons) {
      const assigned = platoonCadets[platoon.id];
      const cadetIds = assigned.map((c) => c.id);
      await base44.entities.EventPlatoon.update(platoon.id, { CadetIDs: cadetIds });
      for (const c of assigned) {
        await base44.entities.EventNominalRoll.update(c.id, { PlatoonID: platoon.id });
      }
    }

    return Response.json({
      success: true,
      groupings: platoons.map((p) => ({
        platoonId: p.id,
        platoonName: p.PlatoonName,
        cadetCount: platoonCadets[p.id].length,
      })),
      totalCadets: cadets.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}