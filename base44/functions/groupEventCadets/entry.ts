import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { STAR_TRAJECTORY_ORDER } from '../../shared/eventConstants.ts';

const SECTIONS_PER_PLATOON = 3;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { eventId } = body;
    if (!eventId) return Response.json({ error: 'eventId required' }, { status: 400 });

    const [cadets, platoons, existingSections] = await Promise.all([
      base44.entities.EventNominalRoll.filter({ EventID: eventId }),
      base44.entities.EventPlatoon.filter({ EventID: eventId }),
      base44.entities.EventSection.filter({ EventID: eventId }),
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

    // Index existing sections by platoon id so we reuse rather than duplicate
    const sectionsByPlatoon = {};
    existingSections.forEach((s) => {
      if (!sectionsByPlatoon[s.PlatoonID]) sectionsByPlatoon[s.PlatoonID] = [];
      sectionsByPlatoon[s.PlatoonID].push(s);
    });

    const groupings = [];

    // Persist platoon assignments + create/distribute sections within each platoon
    for (const platoon of platoons) {
      const assigned = platoonCadets[platoon.id];
      const cadetIds = assigned.map((c) => c.id);
      await base44.entities.EventPlatoon.update(platoon.id, { CadetIDs: cadetIds });

      // Ensure exactly SECTIONS_PER_PLATOON sections exist for this platoon
      let platoonSections = sectionsByPlatoon[platoon.id] || [];
      while (platoonSections.length < SECTIONS_PER_PLATOON) {
        const created = await base44.entities.EventSection.create({
          EventID: eventId,
          PlatoonID: platoon.id,
          SectionName: String(platoonSections.length + 1),
          CadetIDs: [],
          SortOrder: platoonSections.length,
          DetachmentID: platoon.DetachmentID,
        });
        platoonSections.push(created);
      }
      // Trim extra sections (reassign their cadets back into the platoon pool first)
      if (platoonSections.length > SECTIONS_PER_PLATOON) {
        const extras = platoonSections.slice(SECTIONS_PER_PLATOON);
        for (const ex of extras) {
          for (const cid of ex.CadetIDs || []) {
            assigned.push({ id: cid, _recovered: true });
          }
          await base44.entities.EventSection.delete(ex.id);
        }
        platoonSections = platoonSections.slice(0, SECTIONS_PER_PLATOON);
      }

      // Round-robin distribute this platoon's cadets across its sections
      const sectionCadets = {};
      platoonSections.forEach((s) => { sectionCadets[s.id] = []; });
      assigned.forEach((c, i) => {
        if (c._recovered) return;
        const section = platoonSections[i % platoonSections.length];
        sectionCadets[section.id].push(c);
      });

      for (const section of platoonSections) {
        const sectionCadetIds = sectionCadets[section.id].map((c) => c.id);
        await base44.entities.EventSection.update(section.id, { CadetIDs: sectionCadetIds });
        for (const c of sectionCadets[section.id]) {
          await base44.entities.EventNominalRoll.update(c.id, { PlatoonID: platoon.id, SectionID: section.id });
        }
      }

      groupings.push({
        platoonId: platoon.id,
        platoonName: platoon.PlatoonName,
        cadetCount: assigned.filter((c) => !c._recovered).length,
        sections: platoonSections.map((s) => ({
          sectionId: s.id,
          sectionName: s.SectionName,
          cadetCount: sectionCadets[s.id].length,
        })),
      });
    }

    return Response.json({
      success: true,
      groupings,
      totalCadets: cadets.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}