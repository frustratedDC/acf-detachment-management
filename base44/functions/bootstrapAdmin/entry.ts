import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow bootstrap if NO personnel records exist at all
    const existing = await base44.asServiceRole.entities.PersonnelManager.list('created_date', 1);
    if (existing.length > 0) {
      return Response.json({ error: 'Bootstrap not allowed: personnel records already exist.' }, { status: 403 });
    }

    const { PNumber, FirstName, Surname, Rank } = await req.json();
    if (!PNumber || !Surname) {
      return Response.json({ error: 'PNumber and Surname are required.' }, { status: 400 });
    }

    const record = await base44.asServiceRole.entities.PersonnelManager.create({
      PNumber: PNumber.trim(),
      FirstName: (FirstName || '').trim(),
      Surname: Surname.trim(),
      Rank: (Rank || '').trim(),
      Type: 'Adult Instructor',
      AccessLevel: 6,
      RoleName: 'System Administrator',
      PersonnelStatus: 'Active',
      IsLinked: true,
      LinkedEmailUID: user.email,
    });

    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});