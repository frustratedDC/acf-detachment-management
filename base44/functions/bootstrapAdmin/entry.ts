import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { PNumber, FirstName, Surname, Rank, AccessLevel, RoleName, mode } = body;

    if (!PNumber || !Surname) {
      return Response.json({ error: 'PNumber and Surname are required.' }, { status: 400 });
    }

    if (mode === 'self_link') {
      // Allow any logged-in user to create their own linked record if they don't have one yet
      const existing = await base44.asServiceRole.entities.PersonnelManager.filter({ LinkedEmailUID: user.email });
      if (existing.length > 0) {
        return Response.json({ error: 'Your account is already linked to a personnel record.' }, { status: 403 });
      }
      // Check PNumber not already taken
      const pnCheck = await base44.asServiceRole.entities.PersonnelManager.filter({ PNumber: PNumber.trim() });
      if (pnCheck.length > 0) {
        return Response.json({ error: 'That PNumber is already in use.' }, { status: 409 });
      }
      const record = await base44.asServiceRole.entities.PersonnelManager.create({
        PNumber: PNumber.trim(),
        FirstName: (FirstName || '').trim(),
        Surname: Surname.trim(),
        Rank: (Rank || '').trim(),
        Type: 'Adult Instructor',
        AccessLevel: AccessLevel ?? 4,
        RoleName: RoleName || 'Detachment Commander',
        PersonnelStatus: 'Active',
        IsLinked: true,
        LinkedEmailUID: user.email,
      });
      return Response.json({ success: true, record });
    }

    // Default mode: first-time bootstrap (no records exist)
    const all = await base44.asServiceRole.entities.PersonnelManager.list('created_date', 1);
    if (all.length > 0) {
      return Response.json({ error: 'Bootstrap not allowed: personnel records already exist. Use self_link mode instead.' }, { status: 403 });
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