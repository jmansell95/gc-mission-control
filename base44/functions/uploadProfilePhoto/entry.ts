import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ============================================================
// uploadProfilePhoto — reliable profile-photo upload.
//
// The frontend base44.integrations.Core.UploadFile call is
// unreliable on the published site, so profile photos are
// posted here as multipart/form-data (the SDK sends File
// objects passed to base44.functions.invoke as multipart
// automatically). This function reads the file via
// req.formData(), uploads it to Base44 file storage using
// the server-side integration, and returns the public URL.
// ============================================================

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json({ error: 'multipart/form-data required' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const res = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
    return Response.json({ file_url: res.file_url });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}