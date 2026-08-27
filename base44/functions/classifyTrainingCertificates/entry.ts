import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * classifyTrainingCertificates
 * Accepts an array of uploaded certificate file URLs + a target staff mapping,
 * uses InvokeLLM (vision-capable model) to classify each file (driving licence
 * front/back, NVQ Level 2, CSCS card, first aid cert, etc.), extract the holder
 * name, issue date, expiry date, and provider. Returns the classified records
 * for preview before commit.
 *
 * Payload: { files: [{ file_url, file_name }], staff: [{ id, name }] }
 * Returns: { results: [{ file_url, file_name, document_type, qualification_type,
 *   holder_name, matched_staff_id, issue_date, expiry_date, provider_name,
 *   is_front, is_back, confidence }] }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admins only' }, { status: 403 });

    const body = await req.json();
    const files = Array.isArray(body?.files) ? body.files : [];
    const staff = Array.isArray(body?.staff) ? body.staff : [];

    if (files.length === 0) return Response.json({ error: 'No files provided' }, { status: 400 });
    if (files.length > 20) return Response.json({ error: 'Maximum 20 files per batch' }, { status: 400 });

    const staffRoster = staff.map(s => `${s.id}::${s.name}`).join('\n');

    const prompt = `You are a UK construction training compliance assistant. For each uploaded certificate image/PDF, classify the document and extract key fields.

Look at each file and return one entry per file. Identify the document type from this list:
- "driver_license_front" (UK driving licence — front side with photo)
- "driver_license_back" (UK driving licence — back side with categories)
- "cscs_card" (CSCS card — front or back)
- "cpcs_card" (CPCS card)
- "npors_card" (NPORS card)
- "first_aid_cert" (First Aid certificate)
- "dbs_certificate" (DBS certificate)
- "forklift_cert" (Forklift / plant operator certificate)
- "nvq" (NVQ certificate — note the level if visible, e.g. NVQ Level 2)
- "ipaf" (IPAF certificate)
- "pasma" (PASMA certificate)
- "confined_space" (Confined space training certificate)
- "asbestos_awareness" (Asbestos awareness certificate)
- "manual_handling" (Manual handling certificate)
- "working_at_height" (Working at height certificate)
- "other_training_cert" (any other training certificate)

For each file extract:
- document_type (from the list above)
- qualification_type (the matching qualification key: cscs_card, cpcs_card, npors_card, first_aid_cert, driver_license, dbs_certificate, forklift, or "other" if not standard)
- holder_name (the name of the person the certificate belongs to — exactly as printed)
- issue_date (YYYY-MM-DD if a full date is visible, YYYY-MM if only month/year, or "" if not visible)
- expiry_date (YYYY-MM-DD or YYYY-MM or "" if not visible / no expiry)
- provider_name (the training provider / awarding body name, e.g. "CITB", "NPORS", "St John Ambulance", or "")
- is_front (true if this is the front side of a two-sided card like a driving licence or CSCS card)
- is_back (true if this is the back side of a two-sided card)
- confidence (0-1, how confident you are in the classification)

Match the holder_name to one of these staff members if possible (return the matched id, otherwise empty):
STAFF ROSTER:
${staffRoster}

Return a JSON object: { "results": [ { "file_url": "...", "file_name": "...", "document_type": "...", "qualification_type": "...", "holder_name": "...", "matched_staff_id": "...", "issue_date": "...", "expiry_date": "...", "provider_name": "...", "is_front": false, "is_back": false, "confidence": 0.9 } ] }
One result per file, in the same order as the files were provided.`;

    const fileUrls = files.map(f => f.file_url);
    const fileNames = files.map(f => f.file_name);

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: fileUrls,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file_url: { type: 'string' },
                file_name: { type: 'string' },
                document_type: { type: 'string' },
                qualification_type: { type: 'string' },
                holder_name: { type: 'string' },
                matched_staff_id: { type: 'string' },
                issue_date: { type: 'string' },
                expiry_date: { type: 'string' },
                provider_name: { type: 'string' },
                is_front: { type: 'boolean' },
                is_back: { type: 'boolean' },
                confidence: { type: 'number' },
              },
            },
          },
        },
      },
    });

    // Ensure each result carries the original file_url/file_name even if the LLM dropped them
    const raw = (llmRes && llmRes.results) ? llmRes.results : [];
    const results = raw.map((r, i) => ({
      file_url: r.file_url || fileUrls[i] || '',
      file_name: r.file_name || fileNames[i] || '',
      document_type: r.document_type || 'other_training_cert',
      qualification_type: r.qualification_type || 'other',
      holder_name: r.holder_name || '',
      matched_staff_id: r.matched_staff_id || '',
      issue_date: r.issue_date || '',
      expiry_date: r.expiry_date || '',
      provider_name: r.provider_name || '',
      is_front: r.is_front === true,
      is_back: r.is_back === true,
      confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
    }));

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}