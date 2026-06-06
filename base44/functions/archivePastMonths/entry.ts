import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Fetch all TrainingMonth records
    const allMonths = await base44.asServiceRole.entities.TrainingMonth.list();
    const months = Array.isArray(allMonths) ? allMonths : (allMonths?.data || []);

    // Find months where MonthDate < currentMonth and IsArchived !== true
    const toArchive = months.filter(m => {
      if (m.IsArchived) return false;
      const monthStr = m.MonthDate.substring(0, 7); // Extract YYYY-MM
      return monthStr < currentMonth;
    });

    // Update each to IsArchived = true
    for (const month of toArchive) {
      await base44.asServiceRole.entities.TrainingMonth.update(month.id, { IsArchived: true });
    }

    const message = `Archived ${toArchive.length} past training month${toArchive.length !== 1 ? 's' : ''}`;
    console.log(message);

    return Response.json({ success: true, archived: toArchive.length, message });
  } catch (error) {
    console.error('Archive automation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});