import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const STAR_ORDER = ['Basic', '1 Star', '2 Star', '3 Star', '4 Star'];
const SAA_SUBJECT = 'Skill at Arms';
const CE_MANDATORY_GATES = { '1 Star': 4, '2 Star': 8 };

function isAssessment(code) {
  return !!code?.match(/-A\d+$/);
}

function isSubjectComplete(subjectName, lessons, approvedCodes) {
  if (!lessons || lessons.length === 0) return false;
  const assessments = lessons.filter(l => isAssessment(l.LessonCode));
  const standards = lessons.filter(l => !isAssessment(l.LessonCode));
  const assessmentPassed = assessments.some(l => approvedCodes.has(l.LessonCode));

  if (subjectName === SAA_SUBJECT) {
    const allStandardsDone = standards.length > 0 && standards.every(l => approvedCodes.has(l.LessonCode));
    return allStandardsDone && assessmentPassed;
  }
  if (assessments.length > 0) return assessmentPassed;
  return lessons.every(l => approvedCodes.has(l.LessonCode));
}

function isReadyForAdvancement(starLevel, syllabus, approvedCodes) {
  const levelLessons = syllabus.filter(l => l.StarLevel === starLevel);
  if (!levelLessons.length) return false;
  const subjects = {};
  levelLessons.forEach(l => {
    if (!subjects[l.SubjectName]) subjects[l.SubjectName] = [];
    subjects[l.SubjectName].push(l);
  });
  return Object.entries(subjects).every(([name, lessons]) => isSubjectComplete(name, lessons, approvedCodes));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const cadetPNumber = body?.data?.CadetPNumber;
    if (!cadetPNumber) return Response.json({ error: 'Missing CadetPNumber' }, { status: 400 });

    const cadetRecords = await base44.asServiceRole.entities.PersonnelManager.filter({ PNumber: cadetPNumber });
    const cadet = cadetRecords[0];
    if (!cadet) return Response.json({ error: 'Cadet not found' }, { status: 404 });

    const currentStarLevel = cadet.CurrentStarLevel;
    const currentIdx = STAR_ORDER.indexOf(currentStarLevel);
    if (currentIdx === -1 || currentIdx >= STAR_ORDER.length - 1) {
      return Response.json({ ready: false, reason: 'No further star level to advance to' });
    }
    const newStarLevel = STAR_ORDER[currentIdx + 1];

    // CE hours gate
    const ceGateHours = CE_MANDATORY_GATES[currentStarLevel];
    if (ceGateHours) {
      const ceLedger = await base44.asServiceRole.entities.CommunityEngagementLedger.filter({
        CadetPNumber: cadetPNumber,
        Status: 'Approved',
      });
      const totalCEHours = ceLedger.reduce((s, e) => s + (e.Hours || 0), 0);
      if (totalCEHours < ceGateHours) {
        return Response.json({ ready: false, reason: 'CE hours gate not met' });
      }
    }

    const syllabus = await base44.asServiceRole.entities.SyllabusMaster.filter({});
    const allProgress = await base44.asServiceRole.entities.ProgressLedger.filter({ CadetPNumber: cadetPNumber, Status: 'Approved' });
    const approvedCodes = new Set(allProgress.map(p => p.LessonCode));

    const ready = isReadyForAdvancement(currentStarLevel, syllabus, approvedCodes);
    if (!ready) {
      return Response.json({ ready: false });
    }

    const existingTasks = await base44.asServiceRole.entities.PromotionMilestoneTask.filter({
      CadetPNumber: cadetPNumber,
      NewStarLevel: newStarLevel,
    });
    if (existingTasks.length > 0) {
      return Response.json({ ready: true, created: false });
    }

    const cadetName = `${cadet.Rank || ''} ${cadet.Surname}`.trim();
    await base44.asServiceRole.entities.PromotionMilestoneTask.create({
      CadetPNumber: cadetPNumber,
      CadetName: cadetName,
      CurrentStarLevel: currentStarLevel,
      NewStarLevel: newStarLevel,
      Status: 'Pending',
    });

    return Response.json({ ready: true, created: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});