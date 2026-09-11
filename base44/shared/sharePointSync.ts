/**
 * SharePoint sync helpers — shared logic for the two-way document sync.
 *
 * Connection: shared SharePoint connector (builder's account).
 * Site: gcontrol365.sharepoint.com/sites/UtilityARB
 * Library: Shared Documents
 * Base folder: Drilling Team
 * Each job gets its own subfolder under Drilling Team, named by sanitised
 * job_reference + job name.
 *
 * All SharePoint REST API calls use the OAuth access token from the connector
 * connection. The tenant hostname is resolved via Microsoft Graph.
 */

export const SHAREPOINT_SITE_PATH = "sites/UtilityARB";
export const SHAREPOINT_LIBRARY = "Shared Documents";
export const SHAREPOINT_BASE_FOLDER = "Drilling Team";

/**
 * Sanitise a job name for use as a SharePoint folder name.
 * SharePoint forbids: ~ " # % & * : < > ? / \ { | } and leading/trailing dots/spaces.
 * Max length 128 chars (we use 80 to be safe with the reference prefix).
 */
export function sanitizeFolderName(name: string): string {
  return (name || "Unnamed")
    .replace(/[~"#%&*:<>?/\\{|}]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 80) || "Unnamed";
}

/**
 * Build the SharePoint folder name for a job: "{job_reference} - {name}".
 */
export function buildJobFolderName(job: any): string {
  const ref = (job.job_reference || "").trim();
  const name = (job.name || "").trim();
  const raw = ref ? `${ref} - ${name}` : name;
  return sanitizeFolderName(raw);
}

/**
 * Get the SharePoint connector connection (access token + connectionConfig).
 * connectionConfig.subdomain holds the site path.
 */
export async function getConnection(base44: any) {
  const connector = await base44.asServiceRole.connectors.getConnection("share_point");
  const accessToken = connector.accessToken;
  if (!accessToken) throw new Error("SharePoint connector not authorized");
  return { accessToken, connectionConfig: connector.connectionConfig || {} };
}

/**
 * Resolve the SharePoint tenant hostname via Microsoft Graph.
 * GET https://graph.microsoft.com/v1.0/sites/root returns the root site
 * with a hostname (e.g. "gcontrol365.sharepoint.com").
 */
export async function resolveTenant(accessToken: string): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/sites/root", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error (${res.status}): ${text}`);
  }
  const data = await res.json();
  // data.siteCollection.hostname = "gcontrol365.sharepoint.com"
  const hostname = data?.siteCollection?.hostname || data?.hostname;
  if (!hostname) throw new Error("Could not resolve SharePoint tenant hostname");
  return hostname;
}

/**
 * Build the SharePoint REST API base URL for the site.
 * e.g. https://gcontrol365.sharepoint.com/sites/UtilityARB/_api
 */
export function buildApiBase(hostname: string, sitePath: string): string {
  return `https://${hostname}/${sitePath}/_api`;
}

/**
 * Build the server-relative folder URL for a job.
 * e.g. /sites/UtilityARB/Shared Documents/Drilling Team/{JobFolderName}
 */
export function buildJobFolderUrl(job: any): string {
  const folderName = buildJobFolderName(job);
  return `/${SHAREPOINT_SITE_PATH}/${SHAREPOINT_LIBRARY}/${SHAREPOINT_BASE_FOLDER}/${folderName}`;
}

/**
 * Ensure a folder exists in SharePoint. Creates it (and parent folders) if
 * missing. Uses the folders/add endpoint which is idempotent for existing folders.
 * Returns the server-relative folder URL.
 */
export async function ensureFolder(
  accessToken: string,
  apiBase: string,
  folderUrl: string
): Promise<string> {
  // SharePoint REST: POST /web/folders/add('{serverRelativeUrl}')
  // If the folder already exists, this returns 200 with the folder object.
  const res = await fetch(`${apiBase}/web/folders/add('${folderUrl}')`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/json;odata=verbose",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // 13 is the error code for "folder already exists" — that's fine
    if (text.includes("213") || text.includes("already exists")) {
      return folderUrl;
    }
    throw new Error(`Failed to create folder (${res.status}): ${text}`);
  }
  return folderUrl;
}

/**
 * Upload a file to a SharePoint folder. Overwrites if the file already exists.
 * Returns the SharePoint file metadata (UniqueId, ETag, TimeLastModified, etc.).
 */
export async function uploadFile(
  accessToken: string,
  apiBase: string,
  folderUrl: string,
  fileName: string,
  fileContent: ArrayBuffer
): Promise<any> {
  const sanitized = fileName.replace(/[~"#%&*:<>?/\\{|}]/g, "_");
  const endpoint = `${apiBase}/web/GetFolderByServerRelativeUrl('${folderUrl}')/Files/add(url='${encodeURIComponent(sanitized)}',overwrite=true)`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/octet-stream",
    },
    body: fileContent,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload file (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.d || data;
}

/**
 * List all files in a SharePoint folder.
 * Returns array of { Name, ServerRelativeUrl, UniqueId, ETag, TimeLastModified, Length }.
 */
export async function listFiles(
  accessToken: string,
  apiBase: string,
  folderUrl: string
): Promise<any[]> {
  const endpoint = `${apiBase}/web/GetFolderByServerRelativeUrl('${folderUrl}')/Files?$select=Name,ServerRelativeUrl,UniqueId,ETag,TimeLastModified,Length`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json;odata=verbose",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list files (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.d?.results || [];
}

/**
 * Download a file's content from SharePoint.
 * Returns an ArrayBuffer.
 */
export async function downloadFile(
  accessToken: string,
  apiBase: string,
  fileServerRelativeUrl: string
): Promise<ArrayBuffer> {
  const endpoint = `${apiBase}/web/GetFileByServerRelativeUrl('${fileServerRelativeUrl}')/$value`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/octet-stream",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download file (${res.status}): ${text}`);
  }
  return await res.arrayBuffer();
}

/**
 * Build the SharePoint web URL for a file (for opening in the browser).
 * e.g. https://gcontrol365.sharepoint.com/sites/UtilityARB/Shared Documents/Drilling Team/{folder}/{file}
 */
export function buildFileWebUrl(hostname: string, fileServerRelativeUrl: string): string {
  return `https://${hostname}${fileServerRelativeUrl}`;
}

/**
 * Build the SharePoint web URL for a job folder.
 */
export function buildFolderWebUrl(hostname: string, folderUrl: string): string {
  return `https://${hostname}${folderUrl}`;
}