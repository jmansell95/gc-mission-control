import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Weather-Aware Auto-Rostering — runs daily at 06:00.
 *
 * Scans the Met Office weather feed for amber/red alerts affecting active
 * job sites in the next 48 hours. For each affected job:
 *   1. Auto-drafts a delay log (weather category)
 *   2. Flags the affected rota assignments
 *   3. Sends an email to the division manager with suggested crew reassignments
 *
 * Leverages: syncMetOfficeWeather, checkSiteWeatherAlerts, JobDelayLog, RotaAssignment
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Sync the latest weather data
    await base44.asServiceRole.functions.invoke('syncMetOfficeWeather', {});

    // 2. Get all active jobs (not completed/cancelled)
    const jobs = await base44.asServiceRole.entities.Job.filter({
      status: { $nin: ['completed', 'cancelled', 'on_hold'] },
    });

    const today = new Date().toISOString().slice(0, 10);
    const alerts = [];

    for (const job of jobs) {
      if (!job.lat || !job.lng) continue;

      // 3. Check weather status for this job site
      const weatherRes = await base44.asServiceRole.functions.invoke('getJobWeatherStatus', {
        job_id: job.id,
        lat: job.lat,
        lng: job.lng,
      });

      const weather = weatherRes.data;
      if (!weather || !weather.alert_level || !['amber', 'red'].includes(weather.alert_level)) continue;

      // 4. Auto-draft a delay log (idempotent — check if one already exists for today)
      const existingDelay = await base44.asServiceRole.entities.JobDelayLog.filter({
        job_id: job.id,
        delay_type: 'weather',
        created_date: { $gte: today },
      });

      if (existingDelay.length === 0) {
        await base44.asServiceRole.entities.JobDelayLog.create({
          job_id: job.id,
          job_name: job.name || job.site_name || '',
          delay_type: 'weather',
          description: `${weather.alert_level.toUpperCase()} weather alert: ${weather.alert_description || 'adverse weather conditions expected'}`,
          status: 'draft',
          reported_by_name: 'Weather Autopilot',
        });
      }

      // 5. Flag affected rota assignments for the next 2 days
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

      const assignments = await base44.asServiceRole.entities.RotaAssignment.filter({
        job_id: job.id,
        assigned_date: { $in: [today, tomorrow, dayAfter] },
        status: { $ne: 'completed' },
      });

      for (const a of assignments) {
        await base44.asServiceRole.entities.RotaAssignment.update(a.id, {
          notes: (a.notes || '') + `\n⚠️ Weather alert (${weather.alert_level}): ${weather.alert_description || 'adverse conditions'}`.trim(),
        });
      }

      alerts.push({
        job_id: job.id,
        job_name: job.name || job.site_name,
        alert_level: weather.alert_level,
        description: weather.alert_description,
        affected_assignments: assignments.length,
      });
    }

    // 6. Send a digest email to admins if any alerts were found
    if (alerts.length > 0) {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const summary = alerts.map((a) =>
        `• ${a.job_name}: ${a.alert_level.toUpperCase()} — ${a.description} (${a.affected_assignments} crew affected)`
      ).join('\n');

      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Weather Alert — ${alerts.length} job${alerts.length !== 1 ? 's' : ''} affected`,
            body: `The following active jobs have weather alerts in the next 48 hours:\n\n${summary}\n\nDelay logs have been auto-drafted. Review the Rota Builder to reassign affected crew.\n\nGC Mission Control — Weather Autopilot`,
          });
        } catch (_) {}
      }
    }

    return Response.json({ ok: true, alertsFound: alerts.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}