import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';
import { DEFAULT_THRESHOLDS, resolveThresholds, evaluateWeather, fetchSiteWeather } from '../../shared/weatherThresholds.ts';
import {
  brandedWrapper, escapeHtml, getAppBaseUrl, ctaButton, linkBlock,
  infoTable, statusPill, pillDanger, pillWarning, pillSuccess,
  sectionCard, helpTip, heading, p, callout, html, dataTable, statTileRow
} from '../../shared/emailStyling.ts';

// ============================================================
// checkSiteWeatherAlerts — scheduled automation that checks
// weather conditions for all active job sites and emails
// admins when stop-work / caution conditions are detected.
// ============================================================

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const defaultsRaw = await getAppSettingValue(base44, 'weather_thresholds', DEFAULT_THRESHOLDS);
    const defaults = { ...DEFAULT_THRESHOLDS, ...defaultsRaw };

    const weatherConfig = await getAppSettingValue(base44, 'weather_api_config', {});
    const apiKey = weatherConfig.api_key || undefined;

    const jobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    const activeJobs = jobs.filter((j: any) =>
      (j.status === 'in_progress' || j.status === 'planning') &&
      j.site_lat != null && j.site_lng != null
    );

    if (activeJobs.length === 0) {
      return Response.json({ ok: true, message: 'No active jobs with site coordinates — no weather check needed.', alerts: [] });
    }

    const stopAlerts: any[] = [];
    const cautionAlerts: any[] = [];

    for (const job of activeJobs) {
      const weather = await fetchSiteWeather(job.site_lat, job.site_lng, apiKey);
      if (!weather) continue;
      const thresholds = resolveThresholds(job, defaults);
      const assessment = evaluateWeather(weather, thresholds);
      if (assessment.level === 'stop') {
        stopAlerts.push({ job, weather, assessment });
      } else if (assessment.level === 'caution') {
        cautionAlerts.push({ job, weather, assessment });
      }
    }

    if (stopAlerts.length === 0 && cautionAlerts.length === 0) {
      return Response.json({
        ok: true,
        message: `All clear — ${activeJobs.length} active site(s) checked, no adverse weather.`,
        alerts: [],
        stop_count: 0,
        caution_count: 0,
      });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 100);
    const adminEmails = users
      .filter((u: any) => u.role === 'admin' || u.role === 'super_admin')
      .map((u: any) => u.email)
      .filter(Boolean);

    if (adminEmails.length === 0) {
      return Response.json({
        ok: true,
        message: `${stopAlerts.length} stop + ${cautionAlerts.length} caution conditions found but no admin emails registered to alert.`,
        alerts: [...stopAlerts, ...cautionAlerts],
        stop_count: stopAlerts.length,
        caution_count: cautionAlerts.length,
      });
    }

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const baseUrl = await getAppBaseUrl(base44);

    // Build stat tiles
    const statsTiles = statTileRow([
      { label: 'Sites Checked', value: String(activeJobs.length), icon: '📍', color: '#2E5A1A' },
      { label: 'Stop Work', value: String(stopAlerts.length), icon: '🛑', color: stopAlerts.length > 0 ? '#e11d48' : '#059669' },
      { label: 'Caution', value: String(cautionAlerts.length), icon: '⚠', color: cautionAlerts.length > 0 ? '#d97706' : '#059669' },
      { label: 'All Clear', value: String(activeJobs.length - stopAlerts.length - cautionAlerts.length), icon: '✓', color: '#059669' },
    ]);

    // Stop-work table
    let stopTable = '';
    if (stopAlerts.length > 0) {
      const rows = stopAlerts.map(a => {
        const temp = a.weather.current ? Math.round(a.weather.current.temperature_2m) + '°C' : '—';
        return [a.job.name, a.job.location || '—', a.assessment.reasons.join(', '), temp, html(pillDanger('STOP'))];
      });
      stopTable = sectionCard('🛑 DO NOT WORK — Stop-Work Conditions', dataTable(['Job', 'Location', 'Reason', 'Temp', 'Status'], rows), { titleBg: '#be123c' });
    }

    // Caution table
    let cautionTable = '';
    if (cautionAlerts.length > 0) {
      const rows = cautionAlerts.map(a => {
        const temp = a.weather.current ? Math.round(a.weather.current.temperature_2m) + '°C' : '—';
        return [a.job.name, a.job.location || '—', a.assessment.reasons.join(', '), temp, html(pillWarning('CAUTION'))];
      });
      cautionTable = sectionCard('⚠️ Caution — Brief Crews Before Work', dataTable(['Job', 'Location', 'Reason', 'Temp', 'Status'], rows), { titleBg: '#b45309' });
    }

    const bodyHtml =
      heading('Site weather alert') +
      p('Automated working-conditions check for ' + today + '. The following sites have weather conditions that breach safe working thresholds or require crew briefing.') +
      statsTiles +
      (stopAlerts.length > 0 ? callout(stopAlerts.length + ' site(s) breach STOP-WORK thresholds. Crews must NOT work on these sites until conditions improve.', 'danger') : '') +
      stopTable +
      cautionTable +
      helpTip('What to do next', 'For STOP-WORK sites, contact the crew and client immediately to halt work. For CAUTION sites, brief crews on the hazards before they start. Check the live weather on the job detail page for updates throughout the day.') +
      linkBlock(baseUrl, '/admin', 'Open Dashboard');

    const subject = stopAlerts.length > 0
      ? `🛑 DO NOT WORK — ${stopAlerts.length} site${stopAlerts.length > 1 ? 's' : ''} breach weather thresholds`
      : `⚠️ Weather Caution — ${cautionAlerts.length} site${cautionAlerts.length > 1 ? 's' : ''} need crew briefing`;

    const variant = stopAlerts.length > 0 ? 'rose' : 'amber';
    const fullHtml = brandedWrapper(bodyHtml, { headerVariant: variant, banner_subtitle: 'Weather Alert · ' + today });

    let emailed = 0;
    for (const email of adminEmails) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: fullHtml });
        emailed++;
      } catch (_) { /* skip individual failures */ }
    }

    return Response.json({
      ok: true,
      message: `${stopAlerts.length} stop-work + ${cautionAlerts.length} caution conditions found. ${emailed} admin(s) emailed.`,
      alerts: [...stopAlerts, ...cautionAlerts],
      stop_count: stopAlerts.length,
      caution_count: cautionAlerts.length,
      emailed,
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}