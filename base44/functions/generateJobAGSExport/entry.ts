import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// generateJobAGSExport
// ============================================================
// Builds a complete AGS v3.1 file from all APPROVED investigation
// logs for a given job, ready to import into OpenGround for
// further analysis by the Senior Engineer. Includes manager
// review status and notes so the Senior Engineer sees the QC
// decisions that were made on every record.
//
// Admin-only. Returns the raw .ags file as a text/plain download.

function esc(v: any): string {
  if (v == null) return '';
  let s = String(v);
  // AGS wraps values containing spaces, commas, or quotes in double quotes
  // and escapes internal quotes by doubling them.
  if (s.includes('"') || s.includes(',') || s.includes('\t') || s.includes(' ')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function num(v: any): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return String(n);
}

function dateStr(v: string | null | undefined): string {
  if (!v) return '';
  // AGS dates are YYYY-MM-DD
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  if (isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}

// Build a single AGS group block (HEAD + UNIT + TYPE + DATA rows)
function agsGroup(group: string, fields: string[], units: string[], types: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push([group, ...fields].map(esc).join('\t'));
  lines.push(['UNIT', ...units].map(esc).join('\t'));
  lines.push(['TYPE', ...types].map(esc).join('\t'));
  for (const row of rows) {
    lines.push(['DATA', ...row].map(esc).join('\t'));
  }
  return lines.join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'manager') {
      return Response.json({ error: 'Admin or manager only' }, { status: 403 });
    }

    const body = await req.json();
    const jobId: string = body.job_id;
    if (!jobId) return Response.json({ error: 'job_id is required' }, { status: 400 });
    // Optional sub-scopes: per-borehole and per-staff exports narrow the
    // approved logs within the job to a single borehole ref or staff member.
    const boreholeRef: string | undefined = body.borehole_ref;
    const staffId: string | undefined = body.staff_id;

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Fetch ALL logs for this job — both staff-entered and KeyLogBook imports.
    // Only APPROVED logs are exported (the user reviews everything first).
    const allLogs = await base44.asServiceRole.entities.InvestigationLog.filter({ job_id: jobId });
    let logs = allLogs.filter((l: any) => (l.manager_review_status || 'pending') === 'approved');
    if (boreholeRef) logs = logs.filter((l: any) => l.borehole_ref === boreholeRef);
    if (staffId) logs = logs.filter((l: any) => l.staff_id === staffId);

    if (logs.length === 0) {
      return Response.json({ error: 'No approved logs to export. Review and approve logs in Log QC first.' }, { status: 422 });
    }

    // Pull distinct boreholes and staff for cross-referencing
    const boreholeRefs = [...new Set(logs.map((l: any) => l.borehole_ref).filter(Boolean))];

    // ---- Build AGS file content ----
    const blocks: string[] = [];

    // File header
    blocks.push('**AGS Format Version 3.1');
    blocks.push('**Exported from Ground Control Log QC — ' + new Date().toISOString().slice(0, 10));
    blocks.push('**Job: ' + (job.name || ''));
    blocks.push('**Reviewed and approved borehole data for OpenGround import');
    blocks.push('');

    // PROJ group
    blocks.push(agsGroup('PROJ',
      ['PROJ_ID', 'PROJ_NAME', 'PROJ_LOC', 'PROJ_CL_REF', 'PROJ_CONT', 'PROJ_DATE'],
      ['', '', '', '', '', ''],
      ['PA', 'PA', 'PA', 'PA', 'PA', 'DT'],
      [[
        job.job_reference || job.id.slice(0, 8),
        job.name || '',
        job.location || '',
        job.client_id || '',
        job.project_manager || '',
        dateStr(job.start_date),
      ]]
    ));
    blocks.push('');

    // LOCA group — one row per borehole (derived from logs)
    const locaRows: string[][] = [];
    for (const ref of boreholeRefs) {
      const bhLogs = logs.filter((l: any) => l.borehole_ref === ref);
      const maxDepth = bhLogs.reduce((m: number, l: any) => Math.max(m, l.depth_to || 0), 0);
      const firstLog = bhLogs[0];
      const gwStrike = bhLogs.find((l: any) => l.groundwater_strike_depth != null);
      locaRows.push([
        ref,
        'borehole',
        dateStr(firstLog?.date),
        '', // easting
        '', // northing
        '', // ground level
        maxDepth > 0 ? String(maxDepth) : '',
        gwStrike ? String(gwStrike.groundwater_strike_depth) : '',
      ]);
    }
    blocks.push(agsGroup('LOCA',
      ['LOCA_ID', 'LOCA_TYPE', 'LOCA_STAR', 'LOCA_NATE', 'LOCA_NATN', 'LOCA_GL', 'LOCA_FDEP', 'LOCA_GND'],
      ['', '', '', 'm', 'm', 'm', 'm', 'm'],
      ['ID', 'PA', 'DT', 'DT', 'DT', 'DT', 'DT', 'DT'],
      locaRows
    ));
    blocks.push('');

    // GEOL group — strata logs (exclude SPT-only logs which go to the SPT group)
    const geolRows: string[][] = [];
    for (const l of logs) {
      if (!l.borehole_ref) continue;
      if (l.log_type !== 'borehole_progress' && l.log_type !== 'window_sampling') continue;
      if (l.depth_from == null && l.depth_to == null) continue;
      // Skip SPT logs — those with an N-value, blow counts, or SPT in the description
      if (l.spt_n_value != null) continue;
      if (Array.isArray(l.spt_blows) && l.spt_blows.length > 0) continue;
      if (l.description && l.description.toUpperCase().includes('SPT')) continue;
      // Skip installation/standpipe logs that have no strata content
      if (!l.strata_description_detail && !l.strata_descriptor) continue;
      const desc = [l.strata_description_detail, l.description].filter(Boolean).join(' ');
      const reviewNote = l.manager_review_note ? ` [QC: ${l.manager_review_note}]` : '';
      geolRows.push([
        l.borehole_ref,
        num(l.depth_from),
        num(l.depth_to),
        desc + reviewNote,
        l.manager_review_status || 'approved',
        l.manager_reviewed_by || '',
        l.staff_name || '',
      ]);
    }
    if (geolRows.length > 0) {
      blocks.push(agsGroup('GEOL',
        ['LOCA_ID', 'GEOL_TOP', 'GEOL_BASE', 'GEOL_DESC', 'GEOL_REVIEW', 'GEOL_REVIEWER', 'GEOL_LOGGER'],
        ['', 'm', 'm', '', '', '', ''],
        ['ID', 'DT', 'DT', 'PA', 'PA', 'PA', 'PA'],
        geolRows
      ));
      blocks.push('');
    }

    // SAMP group — samples
    const sampRows: string[][] = [];
    for (const l of logs) {
      if (!l.borehole_ref || !l.sample_id) continue;
      const reviewNote = l.manager_review_note ? ` [QC: ${l.manager_review_note}]` : '';
      sampRows.push([
        l.borehole_ref,
        l.sample_id,
        l.sample_type ? l.sample_type.charAt(0).toUpperCase() : 'D',
        num(l.depth_from),
        l.strata_description_detail ? l.strata_description_detail + reviewNote : reviewNote.slice(1) || '',
        l.manager_review_status || 'approved',
      ]);
    }
    if (sampRows.length > 0) {
      blocks.push(agsGroup('SAMP',
        ['LOCA_ID', 'SAMP_ID', 'SAMP_TYPE', 'SAMP_TOP', 'SAMP_DESC', 'SAMP_REVIEW'],
        ['', '', '', 'm', '', ''],
        ['ID', 'ID', 'PA', 'DT', 'PA', 'PA'],
        sampRows
      ));
      blocks.push('');
    }

    // SPT group — penetration tests
    const sptRows: string[][] = [];
    for (const l of logs) {
      if (!l.borehole_ref || l.spt_n_value == null) continue;
      const blows = Array.isArray(l.spt_blows) ? l.spt_blows : [];
      sptRows.push([
        l.borehole_ref,
        num(l.depth_from),
        num(l.spt_n_value),
        blows[0] != null ? String(blows[0]) : '',
        blows[1] != null ? String(blows[1]) : '',
        blows[2] != null ? String(blows[2]) : '',
        blows[3] != null ? String(blows[3]) : '',
        l.manager_review_status || 'approved',
      ]);
    }
    if (sptRows.length > 0) {
      blocks.push(agsGroup('SPT',
        ['LOCA_ID', 'SPT_TOP', 'SPT_NVAL', 'SPT_BL1', 'SPT_BL2', 'SPT_BL3', 'SPT_BL4', 'SPT_REVIEW'],
        ['', 'm', '', '', '', '', '', ''],
        ['ID', 'DT', 'DT', 'DT', 'DT', 'DT', 'DT', 'PA'],
        sptRows
      ));
      blocks.push('');
    }

    // CORE group — rotary core runs
    const coreRows: string[][] = [];
    for (const l of logs) {
      if (!l.borehole_ref || l.log_type !== 'core_inspection') continue;
      if (l.depth_from == null && l.depth_to == null && l.coring_rqd == null && l.coring_recovery == null) continue;
      const reviewNote = l.manager_review_note ? ` [QC: ${l.manager_review_note}]` : '';
      coreRows.push([
        l.borehole_ref,
        l.core_run_number || '',
        num(l.depth_from),
        num(l.depth_to),
        num(l.coring_recovery),
        num(l.coring_rqd),
        [l.strata_description_detail, l.description].filter(Boolean).join(' ') + reviewNote,
        l.manager_review_status || 'approved',
      ]);
    }
    if (coreRows.length > 0) {
      blocks.push(agsGroup('CORE',
        ['LOCA_ID', 'CORE_RUN', 'CORE_TOP', 'CORE_BASE', 'CORE_REC', 'CORE_RQD', 'CORE_DESC', 'CORE_REVIEW'],
        ['', '', 'm', 'm', '%', '%', '', ''],
        ['ID', 'PA', 'DT', 'DT', 'DT', 'DT', 'PA', 'PA'],
        coreRows
      ));
      blocks.push('');
    }

    // WSTG group — standpipe installations + groundwater readings
    const wstgRows: string[][] = [];
    for (const l of logs) {
      if (!l.borehole_ref) continue;
      if (l.log_type !== 'installation' && l.log_type !== 'standpipe_reading') continue;
      const reviewNote = l.manager_review_note ? ` [QC: ${l.manager_review_note}]` : '';
      wstgRows.push([
        l.borehole_ref,
        l.standpipe_ref || '',
        num(l.depth_from),
        num(l.depth_to),
        num(l.standpipe_reading_m),
        dateStr(l.date),
        [l.description].filter(Boolean).join(' ') + reviewNote,
        l.manager_review_status || 'approved',
      ]);
    }
    if (wstgRows.length > 0) {
      blocks.push(agsGroup('WSTG',
        ['LOCA_ID', 'WSTG_ID', 'WSTG_TOP', 'WSTG_BASE', 'WSTG_DP', 'WSTG_DATE', 'WSTG_REM', 'WSTG_REVIEW'],
        ['', '', 'm', 'm', 'm', '', '', ''],
        ['ID', 'ID', 'DT', 'DT', 'DT', 'DT', 'PA', 'PA'],
        wstgRows
      ));
      blocks.push('');
    }

    // REVIEW group — full manager review audit trail (custom group for OpenGround)
    const reviewRows: string[][] = [];
    for (const l of logs) {
      if (!l.manager_review_note && !l.manager_reviewed_by) continue;
      reviewRows.push([
        l.borehole_ref || '',
        l.log_type || '',
        num(l.depth_from),
        num(l.depth_to),
        l.manager_review_status || 'approved',
        l.manager_reviewed_by || '',
        dateStr(l.manager_reviewed_at),
        l.manager_review_note || '',
      ]);
    }
    if (reviewRows.length > 0) {
      blocks.push(agsGroup('REVIEW',
        ['LOCA_ID', 'REVIEW_TYPE', 'REVIEW_TOP', 'REVIEW_BASE', 'REVIEW_STAT', 'REVIEW_BY', 'REVIEW_DATE', 'REVIEW_NOTE'],
        ['', '', 'm', 'm', '', '', '', ''],
        ['ID', 'PA', 'DT', 'DT', 'PA', 'PA', 'DT', 'PA'],
        reviewRows
      ));
      blocks.push('');
    }

    // FILE footer
    blocks.push('**END');

    const agsContent = blocks.join('\n') + '\n';
    const safeName = (job.name || job.id).replace(/[^a-zA-Z0-9-_]/g, '_');
    const scopeTag = boreholeRef ? `_BH-${boreholeRef.replace(/[^a-zA-Z0-9-_]/g, '_')}` : (staffId ? `_Staff` : '');
    const filename = `${safeName}${scopeTag}_OpenGround_${new Date().toISOString().slice(0, 10)}.ags`;

    return new Response(agsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});