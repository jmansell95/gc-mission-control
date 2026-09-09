import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Briefcase, CalendarDays, Users, PoundSterling, StickyNote, FileText, Upload, Eye, Download, RefreshCw, X, Ruler, ChevronRight, ChevronLeft, Check, MapPin, Loader2 } from 'lucide-react';
import { getJobDisciplines } from '@/utils/jobDisciplines';
import EquipmentManager from '@/components/EquipmentManager';
import FormSection from '@/components/forms/FormSection';
import ChipMultiSelect from '@/components/forms/ChipMultiSelect';
import DisciplineBuilder from '@/components/disciplines/DisciplineBuilder';
import JobDocumentsStep from '@/components/jobs/JobDocumentsStep';
import { useScopedEntity } from '@/hooks/useScopedEntity';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

function Field({ label, children, full, hint, required }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}{hint && <span className="text-xs text-slate-400 font-normal ml-1">· {hint}</span>}</label>
      {children}
    </div>
  );
}

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Details', 'Schedule & Contacts', 'Costing', 'Documents', 'Review'];

export default function JobForm({ formData, setFormData, onSubmit, onCancel, editingId, clients, contractors, onFileUpload, uploadingFile }) {
  const [step, setStep] = useState(1);
  const num = (key) => formData[key] === undefined || formData[key] === null ? '' : formData[key];
  const setNum = (key, v) => setFormData({ ...formData, [key]: v === '' ? null : parseFloat(v) });
  const { data: teams = [] } = useScopedEntity('Team', { queryKey: ['teams'] });
  const { data: jobTypes = [] } = useQuery({ queryKey: ['job-types'], queryFn: () => base44.entities.JobType.list('-order') });

  const disciplines = getJobDisciplines(formData);
  const showMeterage = disciplines.some(d => d.type === 'drilling');

  const stepValid = () => {
    if (step === 1) return !!formData.name?.trim() && !!formData.location?.trim();
    if (step === 2) return !!formData.start_date && !!formData.end_date && new Date(formData.end_date) >= new Date(formData.start_date);
    return true;
  };

  const isLastStep = step >= TOTAL_STEPS;

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-emerald-200 shadow-sm space-y-5 mb-6">
      {/* Stepper */}
      {!editingId && (
        <div className="px-5 md:px-6 pt-5">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const s = i + 1;
              const active = s === step;
              const done = s < step;
              return (
                <React.Fragment key={s}>
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${active ? 'bg-emerald-700 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : s}
                  </div>
                  {i < TOTAL_STEPS - 1 && <div className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            {STEP_LABELS.map((l, i) => (
              <span key={l} className={`text-[10px] font-medium ${i + 1 === step ? 'text-emerald-700' : 'text-slate-400'}`}>{l}</span>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 md:px-6 pb-2 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Job' : 'New Job'}</h2>
        <span className="text-xs text-slate-400">{editingId ? 'Update job details' : `Step ${step} of ${TOTAL_STEPS}`}</span>
      </div>

      <div className="px-5 md:px-6 space-y-6">
        {/* STEP 1 — Details */}
        {(editingId || step === 1) && (
          <FormSection title="Job Details" icon={Briefcase}>
            <Field label="Job Name" required>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={inputCls} />
            </Field>
            <Field label="Job Reference" hint="PO / quote no.">
              <input type="text" value={formData.job_reference || ''} onChange={(e) => setFormData({ ...formData, job_reference: e.target.value })} placeholder="e.g. PO-10245" className={inputCls} />
            </Field>
            <Field label="Disciplines" hint="Stack one or more work tracks" full>
              <DisciplineBuilder
                disciplines={Array.isArray(formData.disciplines) ? formData.disciplines : []}
                onChange={(disciplines) => setFormData({ ...formData, disciplines })}
                teams={teams}
              />
            </Field>
            <Field label="Location" full required>
              <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required className={inputCls} />
            </Field>
            <Field label="Site GPS Coordinates" hint="For Geotab auto-timesheet geofencing" full>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" step="any" value={num('site_lat')} onChange={(e) => setNum('site_lat', e.target.value)} placeholder="Latitude (e.g. 51.5074)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <input type="number" step="any" value={num('site_lng')} onChange={(e) => setNum('site_lng', e.target.value)} placeholder="Longitude (e.g. -0.1278)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <GeocodeButton address={formData.location} onResult={(lat, lng) => setFormData(prev => ({ ...prev, site_lat: lat, site_lng: lng }))} />
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">what3words Address</label>
                <input type="text" value={formData.what3words || ''} onChange={(e) => setFormData({ ...formData, what3words: e.target.value })} placeholder="e.g. filled.count.soap" className={inputCls + ' font-mono'} />
                <p className="text-[11px] text-slate-400 mt-0.5">3 words separated by dots — pinpoints a 3m × 3m square. Used by field crews to find the exact site entrance.</p>
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Geofence Radius Override (metres) — blank = global default</label>
                <input type="number" min="0" step="1" value={num('geofence_radius_override')} onChange={(e) => setNum('geofence_radius_override', e.target.value)} placeholder="e.g. 150" className={inputCls + ' max-w-[200px]'} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Set the site's GPS coordinates to enable automatic arrival/departure detection from Geotab vehicle tracking. Override the radius for large sites.</p>
            </Field>
          </FormSection>
        )}

        {/* STEP 2 — Schedule & Contacts */}
        {(editingId || step === 2) && (
          <>
            <FormSection title="Schedule" icon={CalendarDays}>
              <Field label="Start Date" required>
                <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required className={inputCls} />
              </Field>
              <Field label="End Date" required>
                <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} required className={inputCls} />
              </Field>
              {formData.start_date && formData.end_date && new Date(formData.end_date) < new Date(formData.start_date) && (
                <p className="sm:col-span-2 text-[11px] text-red-600 -mt-2">End date is before start date.</p>
              )}
            </FormSection>
            <FormSection title="Clients & Contacts" icon={Users}>
              <Field label="Client">
                <select value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className={inputCls}>
                  <option value="">Select Client (Optional)</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </Field>
              <Field label="Contractor">
                <select value={formData.contractor_id} onChange={(e) => setFormData({ ...formData, contractor_id: e.target.value })} className={inputCls}>
                  <option value="">Select Contractor (Optional)</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Project Manager">
                <input type="text" value={formData.project_manager || ''} onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })} placeholder="Person responsible" className={inputCls} />
              </Field>
              <Field label="Site Contact Name">
                <input type="text" value={formData.site_contact_name || ''} onChange={(e) => setFormData({ ...formData, site_contact_name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Site Contact Phone">
                <input type="tel" value={formData.site_contact_phone || ''} onChange={(e) => setFormData({ ...formData, site_contact_phone: e.target.value })} placeholder="On-site contact number" className={inputCls} />
              </Field>
            </FormSection>
          </>
        )}

        {/* STEP 3 — Costing & Notes */}
        {(editingId || step === 3) && (
          <>
            {showMeterage && (
              <FormSection title="Drilling Details" icon={Ruler}>
                <Field label="Total Meterage (m)" hint="Overrides shift meterage for costing">
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input type="number" min="0" step="0.1" value={num('meterage')} onChange={(e) => setNum('meterage', e.target.value)} placeholder="Leave blank to auto-sum from logs" className={`${inputCls} pl-9`} />
                  </div>
                </Field>
                <Field label="Meterage Rate (£/m)" hint="Per-metre charge rate — blank to use rate card">
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                    <input type="number" min="0" step="0.01" value={num('meterage_rate')} onChange={(e) => setNum('meterage_rate', e.target.value)} placeholder="Auto from rate card" className={`${inputCls} pl-9`} />
                  </div>
                </Field>
                <Field label="Meterage Target (m)" hint="Target metres to drill">
                  <input type="number" min="0" step="0.1" value={num('meterage_target')} onChange={(e) => setNum('meterage_target', e.target.value)} placeholder="0.0" className={inputCls} />
                </Field>
              </FormSection>
            )}
            <FormSection title="Notes" icon={StickyNote}>
              <Field label="Job Notes" full>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" className={inputCls} />
              </Field>
            </FormSection>
            {!editingId && (
              <div>
                <EquipmentManager
                  items={formData.equipment_items || []}
                  onItemsChange={(items) => setFormData({ ...formData, equipment_items: items })}
                  job={formData}
                />
              </div>
            )}
            <FormSection title="Requisition List" icon={FileText} columns={false}>
              {formData.requisition_list_url ? (
                <div className="border border-emerald-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50">
                    <FileText className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                    <span className="text-sm text-emerald-800 font-medium flex-1 truncate">{formData.requisition_list_name || 'Requisition List'}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-emerald-100">
                    <a href={formData.requisition_list_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"><Eye className="w-3.5 h-3.5" /> View</a>
                    <a href={formData.requisition_list_url} download={formData.requisition_list_name || 'requisition-list'} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"><Download className="w-3.5 h-3.5" /> Download</a>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition cursor-pointer">
                      {uploadingFile ? <span>Uploading...</span> : <><RefreshCw className="w-3.5 h-3.5" /> Replace</>}
                      <input type="file" className="hidden" onChange={onFileUpload} disabled={uploadingFile} />
                    </label>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, requisition_list_url: '', requisition_list_name: '' }))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition ml-auto"><X className="w-3.5 h-3.5" /> Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-emerald-400 transition">
                  {uploadingFile ? <span className="text-sm text-slate-500">Uploading...</span> : (<><Upload className="w-5 h-5 text-slate-400" /><span className="text-sm text-slate-500">Click to upload requisition list (PDF, Excel, Word, etc.)</span></>)}
                  <input type="file" className="hidden" onChange={onFileUpload} disabled={uploadingFile} />
                </label>
              )}
            </FormSection>
          </>
        )}

        {/* STEP 4 — Documents */}
        {(editingId || step === 4) && (
          <FormSection title="Work Order & Documents" icon={FileText} columns={false}>
            <JobDocumentsStep
              jobId={editingId || null}
              stagedFiles={formData._stagedDocs || []}
              onStagedFilesChange={(docs) => setFormData({ ...formData, _stagedDocs: docs })}
            />
          </FormSection>
        )}

        {/* STEP 5 — Review (new jobs only) */}
        {!editingId && step === 5 && (
          <FormSection title="Review & Confirm" icon={Check} columns={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <ReviewRow label="Name" value={formData.name} />
              <ReviewRow label="Location" value={formData.location} />
              <ReviewRow label="Disciplines" value={disciplines.map(d => {
                const teamCount = (d.required_team_ids || []).length;
                return `${d.type}${teamCount ? ` (${teamCount} team${teamCount !== 1 ? 's' : ''})` : ''}`;
              }).join(', ') || '—'} />
              <ReviewRow label="Schedule" value={formData.start_date && formData.end_date ? `${formData.start_date} → ${formData.end_date}` : ''} />
              <ReviewRow label="Client" value={clients.find(c => c.id === formData.client_id)?.name} />
              <ReviewRow label="Meterage" value={num('meterage') ? `${num('meterage')}m` : 'Auto from logs'} />
              <ReviewRow label="Equipment items" value={(formData.equipment_items?.length || 0) + ' item(s)'} />
            </div>
            <p className="text-xs text-slate-400">Check the details above, then create the job. You can edit everything later from the job page.</p>
          </FormSection>
        )}
      </div>

      {/* Footer / navigation */}
      <div className="flex gap-3 px-5 md:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
        {!editingId && step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition border border-slate-200 flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        {!editingId && !isLastStep ? (
          <button type="button" onClick={() => stepValid() && setStep(step + 1)} disabled={!stepValid()} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-40 flex items-center justify-center gap-1.5">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" className="flex-1 px-5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">{editingId ? 'Update Job' : 'Create Job'}</button>
        )}
        <button type="button" onClick={onCancel} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm">Cancel</button>
      </div>
    </form>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-slate-50 rounded-lg">
      <span className="text-xs text-slate-400 font-medium min-w-[80px]">{label}</span>
      <span className="text-sm text-slate-800 font-medium flex-1 break-words">{value || '—'}</span>
    </div>
  );
}

function GeocodeButton({ address, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeocode = async () => {
    if (!address?.trim()) { setError('Enter a location first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Return the GPS latitude and longitude of this UK site address as a JSON object: "${address}". Use only valid numeric coordinates. If the address is ambiguous, return the most likely match for the UK.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        }
      });
      if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
        onResult(res.lat, res.lng);
      } else {
        setError('Could not geocode this address');
      }
    } catch (e) {
      setError(e.message || 'Geocode failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={handleGeocode} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition disabled:opacity-60 flex-shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        Auto-fill
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}