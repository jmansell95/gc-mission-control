import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getConnection, resolveTenant, buildApiBase, buildJobFolderUrl, ensureFolder,
  uploadFile, listFiles, downloadFile, buildFileWebUrl, buildFolderWebUrl,
} from '../../shared/sharePointSync.ts';

/**
 * SharePoint Two-Way Document Sync
 *
 * Actions:
 *   - "push": Push a single JobDocument to SharePoint (called after upload in the app).
 *       args: { action: "push", document_id: "<JobDocument id>" }
 *   - "pull": Pull new/modified files from a job's SharePoint folder into the app.
 *       args: { action: "pull", job_id: "<Job id>" }
 *   - "sync_job": Two-way sync for a single job (push pending + pull new).
 *       args: { action: "sync_job", job_id: "<Job id>" }
 *   - "sync_all": Pull from all active jobs' SharePoint folders (called by the scheduled workflow).
 *       args: { action: "sync_all" }
 *   - "status": Check if the SharePoint connector is connected.
 *       args: { action: "status" }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = body.action || "sync_all";

    // Status check — no auth required, just checks connector
    if (action === "status") {
      try {
        const { accessToken } = await getConnection(base44);
        const hostname = await resolveTenant(accessToken);
        return Response.json({ connected: true, tenant: hostname });
      } catch (e) {
        return Response.json({ connected: false, error: e.message });
      }
    }

    // All other actions require admin auth
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await getConnection(base44);
    const hostname = await resolveTenant(accessToken);
    const apiBase = buildApiBase(hostname, "sites/UtilityARB");

    if (action === "push") {
      return Response.json(await doPush(base44, accessToken, apiBase, hostname, body.document_id));
    }
    if (action === "pull") {
      return Response.json(await doPull(base44, accessToken, apiBase, hostname, body.job_id));
    }
    if (action === "sync_job") {
      const pushResult = await doPushPending(base44, accessToken, apiBase, hostname, body.job_id);
      const pullResult = await doPull(base44, accessToken, apiBase, hostname, body.job_id);
      return Response.json({ pushed: pushResult, pulled: pullResult });
    }
    if (action === "sync_all") {
      return Response.json(await doSyncAll(base44, accessToken, apiBase, hostname));
    }
    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Push a single document to SharePoint.
 */
async function doPush(base44: any, accessToken: string, apiBase: string, hostname: string, documentId: string) {
  const doc = await base44.asServiceRole.entities.JobDocument.get(documentId);
  if (!doc) throw new Error(`Document not found: ${documentId}`);

  const job = await base44.asServiceRole.entities.Job.get(doc.job_id);
  if (!job) throw new Error(`Job not found: ${doc.job_id}`);

  // Ensure the job's SharePoint folder exists
  const folderUrl = buildJobFolderUrl(job);
  await ensureFolder(accessToken, apiBase, folderUrl);

  // Download the file from the app's public storage
  const fileRes = await fetch(doc.document_url);
  if (!fileRes.ok) throw new Error(`Failed to download document from app storage (${fileRes.status})`);
  const fileContent = await fileRes.arrayBuffer();

  // Upload to SharePoint
  const spFile = await uploadFile(accessToken, apiBase, folderUrl, doc.document_name, fileContent);
  const spUrl = buildFileWebUrl(hostname, spFile.ServerRelativeUrl || `${folderUrl}/${doc.document_name}`);

  // Update the JobDocument with sync metadata
  await base44.asServiceRole.entities.JobDocument.update(documentId, {
    sharepoint_file_url: spUrl,
    sharepoint_file_id: spFile.UniqueId || "",
    sharepoint_etag: spFile.ETag || "",
    sharepoint_modified_at: spFile.TimeLastModified || new Date().toISOString(),
    sharepoint_synced_at: new Date().toISOString(),
    sharepoint_sync_status: "synced",
    sharepoint_sync_direction: "push",
  });

  // Update the job's folder path if not set
  if (!job.sharepoint_folder_path) {
    await base44.asServiceRole.entities.Job.update(job.id, {
      sharepoint_folder_path: folderUrl,
      sharepoint_folder_url: buildFolderWebUrl(hostname, folderUrl),
    });
  }

  return { success: true, document_id: documentId, sharepoint_url: spUrl };
}

/**
 * Push all pending documents for a job (status = "pending").
 */
async function doPushPending(base44: any, accessToken: string, apiBase: string, hostname: string, jobId: string) {
  const job = await base44.asServiceRole.entities.Job.get(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const pendingDocs = await base44.asServiceRole.entities.JobDocument.filter({
    job_id: jobId,
    sharepoint_sync_status: "pending",
  });

  const results = [];
  for (const doc of pendingDocs) {
    try {
      const result = await doPush(base44, accessToken, apiBase, hostname, doc.id);
      results.push(result);
    } catch (e) {
      await base44.asServiceRole.entities.JobDocument.update(doc.id, {
        sharepoint_sync_status: "error",
      }).catch(() => {});
      results.push({ success: false, document_id: doc.id, error: e.message });
    }
  }
  return { pushed: results.length, results };
}

/**
 * Pull new/modified files from a job's SharePoint folder.
 */
async function doPull(base44: any, accessToken: string, apiBase: string, hostname: string, jobId: string) {
  const job = await base44.asServiceRole.entities.Job.get(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  // Ensure the folder exists (creates it if first sync)
  const folderUrl = buildJobFolderUrl(job);
  await ensureFolder(accessToken, apiBase, folderUrl);

  // Update job folder path
  if (!job.sharepoint_folder_path) {
    await base44.asServiceRole.entities.Job.update(jobId, {
      sharepoint_folder_path: folderUrl,
      sharepoint_folder_url: buildFolderWebUrl(hostname, folderUrl),
    });
  }

  // List files in the SharePoint folder
  const spFiles = await listFiles(accessToken, apiBase, folderUrl);

  // Get existing documents for this job that have SharePoint sync data
  const existingDocs = await base44.asServiceRole.entities.JobDocument.filter({ job_id: jobId });

  // Build a lookup by sharepoint_file_id and by document_name
  const bySpId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const d of existingDocs) {
    if (d.sharepoint_file_id) bySpId.set(d.sharepoint_file_id, d);
    byName.set((d.document_name || "").toLowerCase(), d);
  }

  let pulled = 0;
  let skipped = 0;
  const errors = [];

  for (const spFile of spFiles) {
    const spFileId = spFile.UniqueId;
    const spName = spFile.Name;
    const spEtag = spFile.ETag;
    const spModified = spFile.TimeLastModified;

    // Check if we already have this file synced
    const existing = bySpId.get(spFileId) || byName.get(spName.toLowerCase());

    if (existing && existing.sharepoint_etag === spEtag) {
      // Unchanged — skip
      skipped++;
      continue;
    }

    try {
      // Download the file from SharePoint
      const fileContent = await downloadFile(accessToken, apiBase, spFile.ServerRelativeUrl);

      // Upload to the app's public storage so we have a document_url
      const blob = new Blob([fileContent]);
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: blob });
      const appFileUrl = uploadRes.file_url;

      const spUrl = buildFileWebUrl(hostname, spFile.ServerRelativeUrl);

      if (existing) {
        // Update existing document with new SharePoint version
        await base44.asServiceRole.entities.JobDocument.update(existing.id, {
          document_url: appFileUrl,
          document_name: spName,
          sharepoint_file_url: spUrl,
          sharepoint_file_id: spFileId,
          sharepoint_etag: spEtag,
          sharepoint_modified_at: spModified,
          sharepoint_synced_at: new Date().toISOString(),
          sharepoint_sync_status: "synced",
          sharepoint_sync_direction: "pull",
        });
      } else {
        // Create new JobDocument from SharePoint file
        await base44.asServiceRole.entities.JobDocument.create({
          job_id: jobId,
          document_url: appFileUrl,
          document_name: spName,
          category: "other",
          version: 1,
          is_current_version: true,
          sharepoint_file_url: spUrl,
          sharepoint_file_id: spFileId,
          sharepoint_etag: spEtag,
          sharepoint_modified_at: spModified,
          sharepoint_synced_at: new Date().toISOString(),
          sharepoint_sync_status: "synced",
          sharepoint_sync_direction: "pull",
        });
      }
      pulled++;
    } catch (e) {
      errors.push({ file: spName, error: e.message });
    }
  }

  // Update job last sync timestamp
  await base44.asServiceRole.entities.Job.update(jobId, {
    sharepoint_last_sync_at: new Date().toISOString(),
  });

  return { pulled, skipped, errors, total_files: spFiles.length };
}

/**
 * Sync all active jobs (pull only — push happens on upload).
 * Called by the scheduled workflow.
 */
async function doSyncAll(base44: any, accessToken: string, apiBase: string, hostname: string) {
  // Get all active/in-progress jobs
  const jobs = await base44.asServiceRole.entities.Job.filter({ status: "in_progress" });
  const planningJobs = await base44.asServiceRole.entities.Job.filter({ status: "planning" });
  const allJobs = [...jobs, ...planningJobs];

  const results = [];
  for (const job of allJobs) {
    try {
      // Push pending docs for this job
      const pushResult = await doPushPending(base44, accessToken, apiBase, hostname, job.id);
      // Pull new files from SharePoint
      const pullResult = await doPull(base44, accessToken, apiBase, hostname, job.id);
      results.push({ job_id: job.id, job_name: job.name, pushed: pushResult.pushed, pulled: pullResult.pulled });
    } catch (e) {
      results.push({ job_id: job.id, job_name: job.name, error: e.message });
    }
  }
  return { synced_jobs: results.length, results };
}