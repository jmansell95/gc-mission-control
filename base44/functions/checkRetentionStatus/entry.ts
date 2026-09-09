import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { brandedWrapper, heading, p, dataTable, callout, escapeHtml, formatGBP, getAppBaseUrl, ctaButton } from '../../shared/emailStyling.ts';

// ============================================================
// checkRetentionStatus — nightly check for retention release
// eligibility on completed jobs.
// ============================================================
// Scans active JobBillingContracts with retention_percentage > 0
// and total_retention_held > retention_released. When the linked
// job is 'completed' (or 'decommissioning'), the contract is
// flagged as retention_release_eligible so the PM can release
// the retained funds.
//
// Payload: { action: "check" | "scheduled" }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ ok: false, error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scheduled';

    // Load all active billing contracts with retention
    const contracts = await base44.asServiceRole.entities.JobBillingContract.filter({ status: 'active' });
    const withRetention = contracts.filter((c: any) =>
      Number(c.retention_percentage) > 0 &&
      (Number(c.total_retention_held) || 0) > (Number(c.retention_released) || 0)
    );

    if (withRetention.length === 0) {
      return Response.json({ ok: true, message: 'No active contracts with unreleased retention.', checked: contracts.length, eligible: 0 });
    }

    // Load linked jobs to check completion status
    const jobIds = [...new Set(withRetention.map((c: any) => c.job_id).filter(Boolean))] as string[];
    const jobs: any[] = [];
    for (const jid of jobIds) {
      try {
        const j = await base44.asServiceRole.entities.Job.get(jid);
        if (j) jobs.push(j);
      } catch (_) {}
    }
    const jobMap: Record<string, any> = {};
    for (const j of jobs) jobMap[j.id] = j;

    let eligible = 0;
    let updated = 0;
    const eligibleContracts: any[] = [];

    for (const contract of withRetention) {
      const job = jobMap[contract.job_id];
      if (!job) continue;

      // Retention is release-eligible when the job is completed or decommissioning
      const isComplete = job.status === 'completed' || job.status === 'decommissioning';
      const currentlyEligible = contract.retention_status === 'release_eligible';

      if (isComplete && !currentlyEligible) {
        await base44.asServiceRole.entities.JobBillingContract.update(contract.id, {
          retention_status: 'release_eligible',
          retention_release_date: new Date().toISOString().slice(0, 10),
        });
        updated++;
        eligible++;
        eligibleContracts.push({
          contract_id: contract.id,
          job_id: contract.job_id,
          job_name: job.name,
          retention_percentage: contract.retention_percentage,
          retention_held: contract.total_retention_held,
          retention_released: contract.retention_released,
          releasable: (Number(contract.total_retention_held) || 0) - (Number(contract.retention_released) || 0),
        });
      } else if (isComplete) {
        eligible++;
        eligibleContracts.push({
          contract_id: contract.id,
          job_id: contract.job_id,
          job_name: job.name,
          retention_percentage: contract.retention_percentage,
          retention_held: contract.total_retention_held,
          retention_released: contract.retention_released,
          releasable: (Number(contract.total_retention_held) || 0) - (Number(contract.retention_released) || 0),
        });
      }
    }

    // Email admins about newly-eligible retention releases
    if (updated > 0) {
      try {
        const adminUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
        const emails = adminUsers.map((u: any) => u.email).filter(Boolean);
        if (emails.length > 0) {
          const subject = `💰 ${updated} retention release${updated === 1 ? '' : 's'} ready for approval`;
          const baseUrl = await getAppBaseUrl(base44);
          const rows = eligibleContracts.filter(c => updated > 0).slice(0, updated).map(c => [
            c.job_name,
            `${c.retention_percentage}%`,
            formatGBP(Number(c.releasable)),
          ]);
          const content = heading('Retention Release Ready') +
            p(`The following completed job${updated === 1 ? '' : 's'} have retention held that is now eligible for release:`) +
            callout('Retention can now be released for completed jobs. Review and approve in the Billing Contracts section.', 'success') +
            dataTable(['Job', 'Retention %', 'Releasable Amount'], rows) +
            (baseUrl ? `<div style="margin-top:16px">${ctaButton(baseUrl.replace(/\/+$/, '') + '/billing', 'Open Financial Hub')}</div>` : '');
          const emailHtml = brandedWrapper(content, { banner_subtitle: 'Retention Release', headerVariant: 'emerald' });
          for (const email of emails) {
            try { await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, html: emailHtml }); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return Response.json({
      ok: true,
      action,
      checked: contracts.length,
      with_retention: withRetention.length,
      eligible,
      newly_flagged: updated,
      eligible_contracts: eligibleContracts.map(c => ({ job_name: c.job_name, releasable: c.releasable, retention_pct: c.retention_percentage })),
      message: updated > 0 ? `${updated} contract${updated === 1 ? '' : 's'} flagged for retention release.` : `${eligible} contract${eligible === 1 ? '' : 's'} already eligible. No new flags.`,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}