import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Download, Eye, Truck, Link2, EyeOff, Eye as EyeIcon, CheckCircle2, ShieldCheck, GitBranch, ChevronDown, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const categoryConfig = {
  site_map: { label: 'Site Map', badge: 'bg-emerald-100 text-emerald-700' },
  scope_of_work: { label: 'Scope of Work / Work Order', badge: 'bg-amber-100 text-amber-700' },
  rams: { label: 'RAMS', badge: 'bg-red-100 text-red-700' },
  method_statement: { label: 'Method Statement', badge: 'bg-blue-100 text-blue-700' },
  risk_assessment: { label: 'Risk Assessment', badge: 'bg-amber-100 text-amber-700' },
  completion_cert: { label: 'Completion Cert', badge: 'bg-emerald-100 text-emerald-700' },
  other: { label: 'Document', badge: 'bg-slate-100 text-slate-600' }
};

// Group documents by category + normalised filename base (strip version suffixes like _v2, (1), -rev3)
function getDocGroupKey(doc) {
  const base = (doc.document_name || '').replace(/[_\-]v?\d+|\(\d+\)|[_\-]rev\d+/gi, '').replace(/\.[^.]+$/, '').trim().toLowerCase();
  return `${doc.category || 'other'}::${base}`;
}

export default function DocumentManager({ job }) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('other');
  const [linkedCostItemId, setLinkedCostItemId] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [clientVisible, setClientVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [versioningFor, setVersioningFor] = useState(null);
  const fileInputRef = useRef(null);
  const versionFileRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ['job-documents', job.id],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: job.id })
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });

  // Group documents by category + filename base for version history
  const docGroups = React.useMemo(() => {
    const groups = {};
    documents.forEach(doc => {
      const key = getDocGroupKey(doc);
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });
    // Sort each group by version descending (highest = current)
    Object.values(groups).forEach(arr => arr.sort((a, b) => (b.version || 1) - (a.version || 1)));
    return groups;
  }, [documents]);

  const groupKeys = Object.keys(docGroups).sort();

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const created = await base44.entities.JobDocument.create({
        job_id: job.id,
        document_url: file_url,
        document_name: file.name,
        category,
        linked_cost_item_id: linkedCostItemId || '',
        delivery_notes: deliveryNotes || '',
        collection_notes: collectionNotes || '',
        client_visible: clientVisible,
        version: 1,
        is_current_version: true,
      });
      queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLinkedCostItemId('');
      setDeliveryNotes('');
      setCollectionNotes('');
      setClientVisible(false);
      setShowDetails(false);
    } catch (error) {
      console.error('Error uploading document:', error);
    }
    setUploading(false);
  };

  const handleVersionUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !versioningFor) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      // Mark all existing versions in this group as superseded
      const groupDocs = docGroups[versioningFor] || [];
      const newVersion = Math.max(...groupDocs.map(d => d.version || 1)) + 1;
      await base44.entities.JobDocument.bulkUpdate(
        groupDocs.map(d => ({
          id: d.id,
          is_current_version: false,
          superseded_by_version: newVersion
        }))
      );
      // Create the new current version
      const currentDoc = groupDocs[0];
      await base44.entities.JobDocument.create({
        job_id: job.id,
        document_url: file_url,
        document_name: file.name,
        category: currentDoc?.category || category,
        linked_cost_item_id: currentDoc?.linked_cost_item_id || '',
        delivery_notes: currentDoc?.delivery_notes || '',
        collection_notes: currentDoc?.collection_notes || '',
        client_visible: currentDoc?.client_visible || false,
        version: newVersion,
        is_current_version: true
      });
      queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
      if (versionFileRef.current) versionFileRef.current.value = '';
      setVersioningFor(null);
    } catch (error) {
      console.error('Error uploading new version:', error);
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.JobDocument.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
  };

  const toggleClientVisible = async (doc) => {
    await base44.entities.JobDocument.update(doc.id, { client_visible: !doc.client_visible });
    queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
  };

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const clientVisibleCount = documents.filter(d => d.client_visible && d.is_current_version !== false).length;
  const acknowledgedCount = documents.filter(d => d.client_visible && d.client_approved && d.is_current_version !== false).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Documents</h3>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{documents.length}</span>
        <div className="ml-auto flex items-center gap-2">
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-medium ml-auto">
            <Link2 className="w-4 h-4" /> {showDetails ? 'Hide' : 'Link, notes & visibility'}
          </button>
        </div>

        {showDetails && (
          <div className="border border-slate-200 rounded-lg p-3 mb-4 space-y-3 bg-slate-50/50">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Link to equipment</label>
              <select value={linkedCostItemId} onChange={e => setLinkedCostItemId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">None (standalone document)</option>
                {costItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.description}{item.reference_number ? ` · Ref: ${item.reference_number}` : ''}{item.category === 'hired_equipment' ? ' (Hired)' : ' (Internal)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Notes</label>
                <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows="2" placeholder="Delivery address, contact, timing" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Collection Notes</label>
                <textarea value={collectionNotes} onChange={e => setCollectionNotes(e.target.value)} rows="2" placeholder="Collection date, contact, return condition" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={clientVisible} onChange={e => setClientVisible(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                <EyeIcon className="w-3.5 h-3.5 text-emerald-600" /> Visible to client on the client portal
              </span>
            </label>
            <p className="text-xs text-slate-400">These details are saved with the document and visible on its card below.</p>
          </div>
        )}

        {clientVisibleCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
              <EyeIcon className="w-3.5 h-3.5" /> {clientVisibleCount} {clientVisibleCount === 1 ? 'document' : 'documents'} shared with the client
            </p>
            {acknowledgedCount > 0 && (
              <p className="text-xs text-emerald-700 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> {acknowledgedCount} acknowledged by client
              </p>
            )}
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {groupKeys.map(groupKey => {
              const groupDocs = docGroups[groupKey];
              const currentDoc = groupDocs[0];
              const hasVersions = groupDocs.length > 1;
              const isExpanded = expandedGroups[groupKey];
              const cfg = categoryConfig[currentDoc.category] || categoryConfig.other;
              const linkedItem = costItems.find(c => c.id === currentDoc.linked_cost_item_id);
              const isClientVisible = currentDoc.client_visible === true;
              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{currentDoc.document_name}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                        {hasVersions && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700 inline-flex items-center gap-1">
                            <GitBranch className="w-2.5 h-2.5" /> v{currentDoc.version || 1} · {groupDocs.length} versions
                          </span>
                        )}
                        {linkedItem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600 inline-flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5" /> {linkedItem.description}{linkedItem.reference_number ? ` · ${linkedItem.reference_number}` : ''}
                          </span>
                        )}
                        {isClientVisible && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                            <EyeIcon className="w-2.5 h-2.5" /> Client
                          </span>
                        )}
                        {isClientVisible && currentDoc.client_approved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 inline-flex items-center gap-1" title={currentDoc.client_approved_by_name ? `Acknowledged by ${currentDoc.client_approved_by_name}${currentDoc.client_approved_at ? ' on ' + format(parseISO(currentDoc.client_approved_at), 'dd MMM yyyy') : ''}` : 'Acknowledged'}>
                            <CheckCircle2 className="w-2.5 h-2.5" /> Acknowledged{currentDoc.client_approved_by_name ? ` · ${currentDoc.client_approved_by_name}` : ''}
                          </span>
                        )}
                      </div>
                      {(currentDoc.delivery_notes || currentDoc.collection_notes) && (
                        <div className="mt-1.5 space-y-1">
                          {currentDoc.delivery_notes && (
                            <div className="flex items-start gap-1.5 text-xs text-slate-500">
                              <Truck className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-slate-600">Delivery:</span> {currentDoc.delivery_notes}</span>
                            </div>
                          )}
                          {currentDoc.collection_notes && (
                            <div className="flex items-start gap-1.5 text-xs text-slate-500">
                              <Truck className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span><span className="font-medium text-slate-600">Collection:</span> {currentDoc.collection_notes}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      {hasVersions && (
                        <button onClick={() => toggleGroup(groupKey)} title="Show version history"
                          className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button onClick={() => { setVersioningFor(groupKey); versionFileRef.current?.click(); }} title="Upload new version"
                        className="p-1.5 text-violet-500 hover:bg-violet-50 rounded-lg transition">
                        <GitBranch className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleClientVisible(currentDoc)} title={isClientVisible ? 'Hide from client' : 'Show to client'}
                        className={`p-1.5 rounded-lg transition ${isClientVisible ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {isClientVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <a href={currentDoc.document_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      <a href={currentDoc.document_url} download={currentDoc.document_name}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => handleDelete(currentDoc.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Version history */}
                  {hasVersions && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-violet-200 pl-3">
                      {groupDocs.slice(1).map(oldDoc => (
                        <div key={oldDoc.id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-lg p-2">
                          <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-500 font-medium">v{oldDoc.version || 1}</span>
                          <span className="text-xs text-slate-400 truncate flex-1">{oldDoc.document_name}</span>
                          {oldDoc.signed_off_by && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" /> Signed off
                            </span>
                          )}
                          <a href={oldDoc.document_url} target="_blank" rel="noopener noreferrer"
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded transition">
                            <Eye className="w-3 h-3" />
                          </a>
                          <a href={oldDoc.document_url} download={oldDoc.document_name}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition">
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <input ref={versionFileRef} type="file" onChange={handleVersionUpload} className="hidden" />
      </div>
    </div>
  );
}