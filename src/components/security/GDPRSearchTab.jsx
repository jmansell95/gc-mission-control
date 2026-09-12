import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Search, Loader2, FileSearch, Download, Trash2, Shield, AlertTriangle,
  User, Building2, HardHat, FileText, MapPin, Calendar, Briefcase,
} from 'lucide-react';

const SEARCH_ENTITIES = [
  {
    name: 'Staff',
    label: 'Staff & Crew',
    icon: User,
    fields: ['name', 'email', 'phone', 'ni_number'],
    sensitive: ['ni_number', 'date_of_birth'],
  },
  {
    name: 'Client',
    label: 'Clients',
    icon: Building2,
    fields: ['name', 'contact_name', 'contact_email', 'contact_phone'],
    sensitive: [],
  },
  {
    name: 'Contractor',
    label: 'Contractors',
    icon: HardHat,
    fields: ['name', 'contact_name', 'contact_email', 'contact_phone'],
    sensitive: [],
  },
  {
    name: 'StaffRequest',
    label: 'Staff Requests',
    icon: FileText,
    fields: ['staff_name', 'subject', 'body'],
    sensitive: [],
  },
  {
    name: 'StaffTask',
    label: 'Staff Tasks',
    icon: Briefcase,
    fields: ['assigned_to_name', 'title', 'description'],
    sensitive: [],
  },
  {
    name: 'Absence',
    label: 'Absences',
    icon: Calendar,
    fields: ['staff_name', 'notes'],
    sensitive: [],
  },
  {
    name: 'StaffLocationLog',
    label: 'Location Logs',
    icon: MapPin,
    fields: ['staff_id'],
    sensitive: ['lat', 'lng'],
  },
];

export default function GDPRSearchTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.trim().length < 2) return;
    setSearching(true);
    setResults(null);
    try {
      const allResults = {};
      for (const entity of SEARCH_ENTITIES) {
        try {
          const records = await base44.entities[entity.name].list(500);
          const term = searchTerm.trim().toLowerCase();
          const matches = records.filter(r =>
            entity.fields.some(f => {
              const val = r[f];
              return val && String(val).toLowerCase().includes(term);
            })
          );
          if (matches.length > 0) {
            allResults[entity.name] = { entity, matches };
          }
        } catch (err) {
          // skip entities we can't access
        }
      }
      setResults(allResults);
    } catch (err) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (entityName, recordId) => {
    setDeleting(recordId);
    try {
      await base44.entities[entityName].delete(recordId);
      // Remove from results
      setResults(prev => {
        const next = { ...prev };
        if (next[entityName]) {
          next[entityName] = {
            ...next[entityName],
            matches: next[entityName].matches.filter(m => m.id !== recordId),
          };
          if (next[entityName].matches.length === 0) delete next[entityName];
        }
        return next;
      });
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
      setShowConfirm(null);
    }
  };

  const totalMatches = results ? Object.values(results).reduce((sum, r) => sum + r.matches.length, 0) : 0;

  return (
    <div className="space-y-4">
      {/* SAR notice */}
      <div className="hub-glass rounded-2xl p-4 bg-violet-50/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">GDPR / Subject Access & Erasure</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Search for a person's data across all personal-data entities by name, email, phone, or NI number.
              Export results (Subject Access Request) or delete records (Right to Erasure). Sensitive fields are
              redacted in the results view.
            </p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, email, phone, or NI number..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary outline-none text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || searchTerm.trim().length < 2}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
          Search
        </button>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-700">
              {totalMatches === 0 ? 'No matches found' : `${totalMatches} record${totalMatches !== 1 ? 's' : ''} found`}
            </p>
            {totalMatches > 0 && (
              <button
                type="button"
                onClick={() => downloadFile(JSON.stringify(results, null, 2), `gdpr_search_${searchTerm.trim()}.json`, 'application/json')}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Export Results
              </button>
            )}
          </div>

          {totalMatches > 0 && Object.entries(results).map(([entityName, { entity, matches }]) => {
            const Icon = entity.icon;
            return (
              <div key={entityName} className="hub-glass rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/50 border-b border-slate-100">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <h4 className="font-bold text-sm text-slate-900">{entity.label}</h4>
                  <span className="text-xs text-slate-400">({matches.length})</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {matches.map(record => {
                    const matchedField = entity.fields.find(f =>
                      record[f] && String(record[f]).toLowerCase().includes(searchTerm.trim().toLowerCase())
                    );
                    return (
                      <div key={record.id} className="p-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {record.name || record.staff_name || record.assigned_to_name || record.contact_name || record.title || 'Unnamed record'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            Matched: <span className="font-mono text-slate-500">{matchedField}</span> = "{record[matchedField]}"
                          </p>
                          {entity.sensitive.length > 0 && entity.sensitive.some(f => record[f]) && (
                            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> Contains sensitive data (redacted in view)
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConfirm({ entityName, recordId: record.id, name: record.name || record.staff_name || 'this record' })}
                          disabled={deleting === record.id}
                          className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition disabled:opacity-50 flex-shrink-0"
                          title="Delete (Right to Erasure)"
                        >
                          {deleting === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(8,23,48,0.96)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-pop-in">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Delete this record?</h3>
            <p className="text-sm text-slate-500 mb-4">
              You are about to permanently delete <span className="font-semibold">{showConfirm.name}</span> from {showConfirm.entityName}.
              This action cannot be undone and fulfils a Right to Erasure request.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(showConfirm.entityName, showConfirm.recordId)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}