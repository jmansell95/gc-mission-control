import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, HardHat, Mail, Phone, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Send, Loader2, FileText, Building2, Calendar, BadgeCheck } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import CISBatchVerifyWidget from '@/components/contractors/CISBatchVerifyWidget';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';
import ContactsEditor from '@/components/ContactsEditor';

const ACCENT = '#2E5A1A';

const STATUS_CONFIG = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  documents_requested: { label: 'Docs Requested', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  under_review: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  suspended: { label: 'Suspended', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

const CIS_STATUS_META = {
  pending: { label: 'CIS Pending', cls: 'bg-slate-100 text-slate-600', short: 'Pending' },
  verified_net: { label: 'CIS Net (30%)', cls: 'bg-amber-100 text-amber-700', short: 'Net 30%' },
  verified_gross: { label: 'CIS Gross', cls: 'bg-emerald-100 text-emerald-700', short: 'Gross' },
  unknown: { label: 'CIS Unknown', cls: 'bg-rose-100 text-rose-700', short: 'Unknown' },
  failed: { label: 'CIS Failed', cls: 'bg-rose-100 text-rose-700', short: 'Failed' },
};

const ACCREDITATION_LABELS = {
  chas: 'CHAS', constructionline: 'Constructionline', smas: 'SMAS', safecontractor: 'SafeContractor',
  iso9001: 'ISO 9001', iso14001: 'ISO 14001', iso45001: 'ISO 45001', achilles: 'Achilles', other: 'Other',
};

const SERVICE_OPTIONS = ['drilling', 'groundworks', 'coring', 'trial_pit', 'enabling', 'cp_drilling', 'rotary_drilling', 'depot'];

const emptyForm = {
  name: '', contact_name: '', contact_email: '', contact_phone: '', contacts: [], notes: '',
  onboarding_status: 'pending',
  services_offered: [],
  company_reg_number: '', vat_number: '', hse_registration: '',
  accreditations: [],
  insurance_provider: '', insurance_policy_number: '', insurance_expiry: '',
  public_liability_limit: '', employers_liability_limit: '', professional_indemnity_limit: '',
  safetyculture_email: '', default_daily_rate: '', rejection_reason: '',
};

function genToken() {
  return 'sub-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export default function ContractorManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailId, setDetailId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [verifyingCisId, setVerifyingCisId] = useState(null);
  const [cisMsg, setCisMsg] = useState({});

  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const { data: contractors = [], isLoading } = useScopedEntity('Contractor', { queryKey: ['contractors'] });

  const filtered = contractors.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ = !q || (c.name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.contact_email?.toLowerCase().includes(q));
    const matchesS = statusFilter === 'all' || c.onboarding_status === statusFilter;
    return matchesQ && matchesS;
  });

  const handleVerifyCis = async (contractorId) => {
    setVerifyingCisId(contractorId);
    try {
      const res = await base44.functions.invoke('verifyCIS', { contractor_id: contractorId });
      const d = res.data || {};
      setCisMsg({ [contractorId]: { ok: !!d.ok, msg: d.message || d.error || 'Unknown' } });
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
    } catch (e) {
      setCisMsg({ [contractorId]: { ok: false, msg: e.message } });
    }
    setVerifyingCisId(null);
  };

  const detail = contractors.find((c) => c.id === detailId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      public_liability_limit: formData.public_liability_limit ? Number(formData.public_liability_limit) : null,
      employers_liability_limit: formData.employers_liability_limit ? Number(formData.employers_liability_limit) : null,
      professional_indemnity_limit: formData.professional_indemnity_limit ? Number(formData.professional_indemnity_limit) : null,
      default_daily_rate: formData.default_daily_rate ? Number(formData.default_daily_rate) : null,
    };
    if (editingId) { await base44.entities.Contractor.update(editingId, payload); }
    else { await base44.entities.Contractor.create({ ...payload, division_id: activeDivisionId }); }
    queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
    setFormData(emptyForm); setShowForm(false); setEditingId(null);
  };

  const handleEdit = (c) => {
    setFormData({
      ...emptyForm,
      ...c,
      public_liability_limit: c.public_liability_limit || '',
      employers_liability_limit: c.employers_liability_limit || '',
      professional_indemnity_limit: c.professional_indemnity_limit || '',
      default_daily_rate: c.default_daily_rate || '',
    });
    setEditingId(c.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this subcontractor? This cannot be undone.')) {
      await base44.entities.Contractor.delete(id);
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
    }
  };

  const sendOnboarding = async (c) => {
    if (!c.contact_email) {
      alert('No contact email on file for this subcontractor. Add one before sending the onboarding link.');
      return;
    }
    setBusyId(c.id);
    try {
      const res = await base44.functions.invoke('dispatchPortalInvite', {
        target: 'subcontractor',
        contractorId: c.id,
        recipientEmail: c.contact_email,
        portalBaseUrl: window.location.origin,
      });
      const data = res.data || {};
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
      } else {
        alert(data.error || 'Failed to send onboarding email');
      }
    } catch (e) {
      // Fallback to mailto if the backend function fails
      const token = c.onboarding_token || genToken();
      await base44.entities.Contractor.update(c.id, {
        onboarding_token: token,
        onboarding_status: c.onboarding_status === 'pending' ? 'documents_requested' : c.onboarding_status,
        onboarding_sent_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
      const link = window.location.origin + '/subcontractor-onboarding/' + token;
      const subject = 'Subcontractor onboarding — ' + c.name;
      const body = [
        'Hi ' + (c.contact_name || 'there') + ',',
        '',
        'Please complete your subcontractor onboarding so we can clear you for work on our sites. Use the link below to upload your insurance, accreditations and company details:',
        '',
        link,
        '',
        'Once submitted, our team will review and confirm your approval.',
        '',
        'Thank you,',
        'Ground Control',
      ].join('\n');
      window.location.href = 'mailto:' + c.contact_email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (c, status, extra = {}) => {
    setBusyId(c.id);
    try {
      const patch = { onboarding_status: status, ...extra };
      if (status === 'approved') { patch.approved_at = new Date().toISOString(); patch.approved_by_name = 'Me'; }
      if (status === 'rejected' && !extra.rejection_reason) { const reason = prompt('Reason for rejection:'); if (!reason) { setBusyId(null); return; } patch.rejection_reason = reason; }
      await base44.entities.Contractor.update(c.id, patch);
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Contractor'] });
    } finally {
      setBusyId(null);
    }
  };

  const toggleArrayField = (field, value) => {
    setFormData((f) => {
      const arr = f[field] || [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...f, [field]: next };
    });
  };

  const insuranceExpired = (c) => c.insurance_expiry && new Date(c.insurance_expiry) < new Date();

  return (
    <div>
      <SettingsSectionHeader
        icon={HardHat}
        title="Subcontractor Onboarding"
        description="Onboard, vet and approve subcontractors — insurance, accreditations & SafetyCulture email auto-link audits"
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
            style={{ background: ACCENT }}>
            <Plus className="w-4 h-4" /> Add Subcontractor
          </button>
        }
      />

      {/* CIS batch verification hub */}
      <div className="mb-4">
        <CISBatchVerifyWidget />
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setStatusFilter('all')}
          className={'px-3 py-1.5 rounded-full text-xs font-medium transition ' + (statusFilter === 'all' ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
          style={statusFilter === 'all' ? { background: ACCENT } : {}}>
          All ({contractors.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = contractors.filter((c) => c.onboarding_status === key).length;
          if (count === 0 && key !== 'approved') return null;
          return (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={'px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 ' + (statusFilter === key ? cfg.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
              <span className={'w-1.5 h-1.5 rounded-full ' + cfg.dot} />
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 border border-emerald-200 mb-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{editingId ? 'Edit Subcontractor' : 'New Subcontractor'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Person</label>
              <input type="text" value={formData.contact_name} onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input type="text" value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <ContactsEditor
              value={formData.contacts}
              onChange={(contacts) => setFormData((prev) => ({ ...prev, contacts }))}
              label="Additional Contacts"
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SafetyCulture Email</label>
              <input type="email" value={formData.safetyculture_email} onChange={(e) => setFormData({ ...formData, safetyculture_email: e.target.value })}
                placeholder="Audits from this email auto-link here"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Day Rate (GBP)</label>
              <input type="number" value={formData.default_daily_rate} onChange={(e) => setFormData({ ...formData, default_daily_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Companies House Reg No.</label>
              <input type="text" value={formData.company_reg_number} onChange={(e) => setFormData({ ...formData, company_reg_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VAT Number</label>
              <input type="text" value={formData.vat_number} onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">HSE / UKAS Registration</label>
              <input type="text" value={formData.hse_registration} onChange={(e) => setFormData({ ...formData, hse_registration: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Insurance Provider</label>
              <input type="text" value={formData.insurance_provider} onChange={(e) => setFormData({ ...formData, insurance_provider: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Policy Number</label>
              <input type="text" value={formData.insurance_policy_number} onChange={(e) => setFormData({ ...formData, insurance_policy_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Insurance Expiry</label>
              <input type="date" value={formData.insurance_expiry || ''} onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Public Liability Limit (GBP)</label>
              <input type="number" value={formData.public_liability_limit} onChange={(e) => setFormData({ ...formData, public_liability_limit: e.target.value })}
                placeholder="e.g. 5000000" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Employers Liability Limit (GBP)</label>
              <input type="number" value={formData.employers_liability_limit} onChange={(e) => setFormData({ ...formData, employers_liability_limit: e.target.value })}
                placeholder="e.g. 10000000" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Professional Indemnity Limit (GBP)</label>
              <input type="number" value={formData.professional_indemnity_limit} onChange={(e) => setFormData({ ...formData, professional_indemnity_limit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Services Offered</label>
              <div className="flex flex-wrap gap-1.5">
                {SERVICE_OPTIONS.map((s) => {
                  const on = (formData.services_offered || []).includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleArrayField('services_offered', s)}
                      className={'px-2.5 py-1 rounded-full text-[11px] font-medium transition ' + (on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Accreditations</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ACCREDITATION_LABELS).map(([key, label]) => {
                  const on = (formData.accreditations || []).includes(key);
                  return (
                    <button key={key} type="button" onClick={() => toggleArrayField('accreditations', key)}
                      className={'px-2.5 py-1 rounded-full text-[11px] font-medium transition ' + (on ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition font-medium text-sm" style={{ background: ACCENT }}>
              {editingId ? 'Update' : 'Add'} Subcontractor
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : contractors.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No subcontractors yet. Add your first above.</div>
      ) : (
        <>
          <div className="mb-5">
            <SearchFilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by name, contact or email..."
              showCount
              totalCount={filtered.length}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No subcontractors match your filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((c) => {
                const cfg = STATUS_CONFIG[c.onboarding_status] || STATUS_CONFIG.pending;
                const insExp = insuranceExpired(c);
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                        {c.contact_name && <p className="text-xs text-slate-500 mt-0.5">{c.contact_name}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ' + cfg.cls}>
                          <span className={'w-1.5 h-1.5 rounded-full ' + cfg.dot} />
                          {cfg.label}
                        </span>
                        {c.cis_status && c.cis_status !== 'pending' && (
                          <span className={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ' + (CIS_STATUS_META[c.cis_status]?.cls || '')} title={CIS_STATUS_META[c.cis_status]?.label}>
                            {c.cis_status === 'verified_gross' || c.cis_status === 'verified_net' ? <BadgeCheck className="w-2.5 h-2.5" /> : <ShieldAlert className="w-2.5 h-2.5" />}
                            {CIS_STATUS_META[c.cis_status]?.short || c.cis_status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {c.contact_email && (
                        <div className="flex items-center gap-2 text-xs text-slate-500"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{c.contact_email}</span></div>
                      )}
                      {c.contact_phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3.5 h-3.5 flex-shrink-0" /><span>{c.contact_phone}</span></div>
                      )}
                      {c.services_offered && c.services_offered.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.services_offered.slice(0, 4).map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">{s}</span>
                          ))}
                        </div>
                      )}
                      {c.accreditations && c.accreditations.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.accreditations.slice(0, 4).map((a) => (
                            <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700"><ShieldCheck className="w-2.5 h-2.5" />{ACCREDITATION_LABELS[a] || a}</span>
                          ))}
                        </div>
                      )}
                      {c.insurance_expiry && (
                        <div className={'flex items-center gap-2 text-xs ' + (insExp ? 'text-rose-600 font-medium' : 'text-slate-500')}>
                          {insExp ? <ShieldAlert className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                          Insurance: {c.insurance_expiry}{insExp ? ' (expired)' : ''}
                        </div>
                      )}
                    </div>
                    {cisMsg[c.id] && (
                      <div className={'mx-4 mt-2 rounded-lg px-2.5 py-1.5 text-[11px] ' + (cisMsg[c.id].ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                        {cisMsg[c.id].msg}
                      </div>
                    )}
                    <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1 flex-wrap">
                      <button onClick={() => setDetailId(c.id)} className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Details
                      </button>
                      {c.utr && c.contractor_type !== 'agency' && (
                        <button onClick={() => handleVerifyCis(c.id)} disabled={verifyingCisId === c.id} className="px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition flex items-center gap-1 disabled:opacity-50" title="Verify against HMRC CIS register">
                          {verifyingCisId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} CIS
                        </button>
                      )}
                      <button onClick={() => sendOnboarding(c)} disabled={busyId === c.id} className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1 disabled:opacity-50">
                        {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Onboard
                      </button>
                      {c.onboarding_status !== 'approved' && (
                        <button onClick={() => setStatus(c, 'approved')} disabled={busyId === c.id} className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1 disabled:opacity-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                      )}
                      {c.onboarding_status === 'approved' && (
                        <button onClick={() => setStatus(c, 'suspended', { rejection_reason: prompt('Reason for suspension:') || '' })} disabled={busyId === c.id} className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 disabled:opacity-50">
                          <ShieldAlert className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetailId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{detail.name}</p>
                <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ' + (STATUS_CONFIG[detail.onboarding_status] || STATUS_CONFIG.pending).cls}>
                  {(STATUS_CONFIG[detail.onboarding_status] || STATUS_CONFIG.pending).label}
                </span>
              </div>
              <button onClick={() => setDetailId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Contact</p>
                <p className="text-slate-700">{detail.contact_name || '—'}</p>
                <p className="text-slate-500 text-xs">{detail.contact_email || '—'}</p>
                <p className="text-slate-500 text-xs">{detail.contact_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Company</p>
                <p className="text-slate-700 text-xs">Reg: {detail.company_reg_number || '—'}</p>
                <p className="text-slate-700 text-xs">VAT: {detail.vat_number || '—'}</p>
                <p className="text-slate-700 text-xs">HSE: {detail.hse_registration || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Insurance</p>
                <p className="text-slate-700 text-xs">{detail.insurance_provider || '—'} · {detail.insurance_policy_number || '—'}</p>
                <p className={'text-xs ' + (insuranceExpired(detail) ? 'text-rose-600 font-medium' : 'text-slate-500')}>Expires: {detail.insurance_expiry || '—'}</p>
                <p className="text-slate-500 text-xs">PL: £{(detail.public_liability_limit || 0).toLocaleString()} · EL: £{(detail.employers_liability_limit || 0).toLocaleString()}</p>
              </div>
              {detail.accreditations && detail.accreditations.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Accreditations</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.accreditations.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700"><ShieldCheck className="w-2.5 h-2.5" />{ACCREDITATION_LABELS[a] || a}</span>
                    ))}
                  </div>
                </div>
              )}
              {detail.services_offered && detail.services_offered.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.services_offered.map((s) => <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">{s}</span>)}
                  </div>
                </div>
              )}
              {detail.safetyculture_email && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">SafetyCulture</p>
                  <p className="text-slate-700 text-xs">{detail.safetyculture_email}</p>
                </div>
              )}
              {detail.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Notes</p>
                  <p className="text-slate-600 text-xs whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
              {detail.rejection_reason && (
                <div className="p-3 bg-rose-50 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wide text-rose-400 mb-1">Rejection / Suspension Reason</p>
                  <p className="text-rose-700 text-xs">{detail.rejection_reason}</p>
                </div>
              )}
              {detail.approved_at && (
                <p className="text-[10px] text-slate-400">Approved {detail.approved_at.slice(0, 10)} by {detail.approved_by_name || '—'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}