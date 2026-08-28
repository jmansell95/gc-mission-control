import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAppSettingValue } from '../../shared/appSettings.ts';
import { DEFAULT_THRESHOLDS, resolveThresholds, evaluateWeather, fetchSiteWeather } from '../../shared/weatherThresholds.ts';

// ============================================================
// getJobWeatherStatus — live "okay to work" check for a job
// ============================================================
// Fetches current site weather, resolves the active thresholds
// (per-job override ?? global default), and evaluates them to
// produce an okay / caution / stop verdict with the breached
// parameter called out. Shared logic lives in weatherThresholds.ts.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { job_id } = body;
    if (!job_id) return Response.json({ ok: false, error: 'job_id required' }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ ok: false, error: 'Job not found' }, { status: 404 });
    if (job.site_lat == null || job.site_lng == null) {
      return Response.json({ ok: true, status: null, message: 'No site coordinates set — cannot check weather.' });
    }

    const defaultsRaw = await getAppSettingValue(base44, 'weather_thresholds', DEFAULT_THRESHOLDS);
    const defaults = { ...DEFAULT_THRESHOLDS, ...defaultsRaw };
    const thresholds = resolveThresholds(job, defaults);

    const weatherConfig = await getAppSettingValue(base44, 'weather_api_config', {});
    const apiKey = weatherConfig.api_key || undefined;

    const weather = await fetchSiteWeather(job.site_lat, job.site_lng, apiKey);
    if (!weather) return Response.json({ ok: false, error: 'Weather fetch failed' }, { status: 502 });

    const result = evaluateWeather(weather, thresholds);
    return Response.json({ ok: true, ...result });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message || String(error) }, { status: 500 });
  }
}