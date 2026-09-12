import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Trash2, Eye, Loader2, X, Map, ClipboardList, ShieldAlert } from 'lucide-react';

const DOC_CATEGORIES = [
  { value: 'scope_of_work', label: 'Scope of Work / Work Order', icon: ClipboardList },
  { value: 'site_map', label: 'Site Map', icon: Map },
  { value: 'rams', label: 'RAMS', icon: ShieldAlert },
  { value: 'method_statement', label: 'Method Statement', icon: FileText },
  { value: 'risk_assessment', label: 'Risk Assessment', icon: ShieldAlert },
  { value: 'other', label: 'Other Document', icon: FileText },
];

/**
 * JobDocumentsStep — shared document upload UI for the job creation wizard
 * and the edit job form.
 *
 * When `jobId` is provided (edit mode): files are uploaded immediately and
 * existing documents are listed with preview/delete actions.
 *
 * When `jobId` is not provided (create mode): files are staged in parent state
 * via `stagedFiles` / `onStagedFilesChange` and uploaded after the job is saved.
 */
export default function JobDocumentsStep({ jobId, stagedFiles = [], onStagedFilesChange }) {
  const [category, setCategory] = useState('scope_of_work');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: existingDocs = [] } = useQuery({
    queryKey: ['job-documents-wizard', jobId],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const invalidateDocQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['job-documents-wizard', jobId] });
    queryClient.invalidateQueries({ queryKey: ['job-documents', jobId] });
    queryClient.invalidateQueries({ queryKey: ['job-documents-staff', jobId] });
    queryClient.invalidateQueries({ queryKey: ['briefing-docs', jobId] });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    if (jobId) {
      setUploading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.JobDocument.create({
          job_id: jobId,
          document_url: file_url,
          document_name: file.name,
          category,
          version: 1,
          is_current_version: true,
        });
        invalidateDocQueries();
      } catch (err) {
        setError(err?.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      onStagedFilesChange([...stagedFiles, { file, category }]);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeStagedFile = (idx) => {
    onStagedFilesChange(stagedFiles.filter((_, i) => i !== idx));
  };

  const deleteExistingDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    try {
      await base44.entities.JobDocument.delete(docId);
      invalidateDocQueries();
    } catch (err) {
      setError(err?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-1">Work Order & Documents</h3>
        <p className="text-xs text-slate-500 mb-3">
          Upload the work order, site maps, RAMS and any other documents the crew need.
          Work orders (Scope of Work) and site maps are shown to field staff on their assignment
          cards and in the pre-work briefing so they know exactly what to do.
        </p>
      </div>

      {/* Category selector */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Document Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm transition"
        >
          {DOC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Upload drop zone */}
      <label className="flex items-center gap-3 px-4 py-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary/40 transition">
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-slate-500">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-slate-400" />
            <span className="text-sm text-slate-500">
              Click to upload a document (PDF, image, Word, Excel)
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Staged files (create mode) */}
      {!jobId && stagedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Staged for upload ({stagedFiles.length})
          </p>
          {stagedFiles.map((f, i) => {
            const cat = DOC_CATEGORIES.find((c) => c.value === f.category);
            return (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
              >
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">{f.file.name}</p>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {cat?.label || f.category}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeStagedFile(i)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-400">
            These will be attached to the job once it's created.
          </p>
        </div>
      )}

      {/* Existing documents (edit mode) */}
      {jobId && existingDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Attached documents ({existingDocs.length})
          </p>
          {existingDocs.map((doc) => {
            const cat =
              DOC_CATEGORIES.find((c) => c.value === doc.category) ||
              DOC_CATEGORIES[DOC_CATEGORIES.length - 1];
            const isImg = /\.(png|jpe?g|webp|gif)$/i.test(doc.document_name || '');
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200"
              >
                {isImg ? (
                  <img
                    src={doc.document_url}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {doc.document_name}
                  </p>
                  <span className="text-[10px] font-semibold text-slate-500">{cat.label}</span>
                </div>
                <a
                  href={doc.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Eye className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => deleteExistingDoc(doc.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state for edit mode */}
      {jobId && existingDocs.length === 0 && !uploading && (
        <div className="text-center py-4 text-xs text-slate-400">
          No documents attached yet. Upload the work order above.
        </div>
      )}
    </div>
  );
}