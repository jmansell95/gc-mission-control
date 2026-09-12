import React, { useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Trash2, Plus, AlertTriangle,
  Building2, PoundSterling, Percent, Ruler, Clock, Package,
  HardHat, Mountain, Layers, Shovel, Truck, Boxes, User, FileText, MapPin,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WORK_TYPES = [
  { val: 'drilling', label: 'Drilling', icon: HardHat, color: 'bg-amber-100 text-amber-700' },
  { val: 'coring', label: 'Coring', icon: Mountain, color: 'bg-orange-100 text-orange-700' },
  { val: 'groundworks', label: 'Groundworks', icon: Layers, color: 'bg-emerald-100 text-emerald-700' },
  { val: 'trial_pit', label: 'Trial Pit', icon: Shovel, color: 'bg-blue-100 text-blue-700' },
  { val: 'enabling_works', label: 'Enabling', icon: Truck, color: 'bg-violet-100 text-violet-700' },
  { val: 'equipment_hire', label: 'Equipment Hire', icon: Boxes, color: 'bg-cyan-100 text-cyan-700' },
  { val: 'materials_supply', label: 'Materials', icon: Package, color: 'bg-slate-100 text-slate-700' },
  { val: 'transport', label: 'Transport', icon: Truck, color: 'bg-indigo-100 text-indigo-700' },
  { val: 'supervision', label: 'Supervision', icon: User, color: 'bg-purple-100 text-purple-700' },
  { val: 'other', label: 'Other', icon: FileText, color: 'bg-slate-100 text-slate-500' },
];

const RATE_BASIS = [
  { val: 'day_rate', label: 'Day Rate' },
  { val: 'hourly_rate', label: 'Hourly' },
  { val: 'per_metre', label: 'Per Metre' },
  { val: 'per_unit', label: 'Per Unit' },
  { val: 'flat_fee', label: 'Flat Fee' },
  { val: 'item_cost', label: 'Item Cost' },
];

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm transition";

function computePurchaseCost(a) {
  const rate = parseFloat(a.purchase_rate) || 0;
  const basis = a.purchase_rate_basis;
  if (basis === 'flat_fee' || basis === 'item_cost') return rate;
  if (basis === 'day_rate') return rate * 1;
  if (basis === 'hourly_rate') return rate * (parseFloat(a.hours_worked) || 0);
  if (basis === 'per_metre') return rate * (parseFloat(a.metres_drilled) || 0);
  if (basis === 'per_unit') return rate * (parseFloat(a.units_completed) || 0);
  return rate;
}

function computeMargin(a) {
  const buy = computePurchaseCost(a);
  const markup = parseFloat(a.markup_percentage) || 0;
  const sell = buy * (1 + markup / 100);
  const marginNet = sell - buy;
  const marginPct = sell > 0 ? (marginNet / sell) * 100 : 0;
  return { buy, sell, marginNet, marginPct };
}

const emptyAssignment = {
  id: null, subcontractor_id: '', work_type: 'drilling', description: '',
  borehole_ref: '', purchase_rate_basis: 'day_rate', purchase_rate: '',
  hours_worked: '', metres_drilled: '', units_completed: '', units_label: '',
  markup_percentage: 15, po_number: '', _date: new Date().toISOString().slice(0, 10),
  crew_lead_name: '', crew_second_name: '', worker_name: '',
};

export default function SubcontractorAssignments({ assignments, onChange, contractors }) {
  const approvedSubs = contractors.filter(c => !c.onboarding_status || c.onboarding_status === 'approved');

  const totals = useMemo(() => {
    return assignments.reduce((acc, a) => {
      const { buy, sell, marginNet } = computeMargin(a);
      acc.buy += buy;
      acc.sell += sell;
      acc.margin += marginNet;
      return acc;
    }, { buy: 0, sell: 0, margin: 0 });
  }, [assignments]);

  const avgMarginPct = totals.sell > 0 ? (totals.margin / totals.sell) * 100 : 0;

  const addAssignment = () => {
    onChange([...assignments, { ...emptyAssignment }]);
  };

  const updateAssignment = (index, field, value) => {
    const next = [...assignments];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const removeAssignment = (index) => {
    const next = [...assignments];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-800">Subcontractor Assignments</h3>
        <button type="button" onClick={addAssignment}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition">
          <Plus className="w-3.5 h-3.5" /> Add Subcontractor
        </button>
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-2">
        Assign subcontractors for different parts of this job (e.g. 3 boreholes subbed to one driller, groundworks to another). These are saved as pending logs — manage them from the Financials tab after creation.
      </p>

      {/* Summary bar */}
      {assignments.length > 0 && (
        <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-center">
            <p className="text-[9px] text-slate-400 uppercase font-medium">Assigned</p>
            <p className="text-sm font-bold text-slate-700">{assignments.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-400 uppercase font-medium">Buy (Cost)</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{fmt(totals.buy)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-400 uppercase font-medium">Sell (Revenue)</p>
            <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(totals.sell)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-400 uppercase font-medium">Margin ({avgMarginPct.toFixed(0)}%)</p>
            <p className="text-sm font-bold text-primary tabular-nums">{fmt(totals.margin)}</p>
          </div>
        </div>
      )}

      {/* Assignment cards */}
      {assignments.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Building2 className="w-6 h-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No subcontractors assigned</p>
          <p className="text-xs text-slate-400 mt-0.5">Tap "Add Subcontractor" above to assign one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((a, i) => (
            <SubcontractorAssignmentCard
              key={i}
              assignment={a}
              index={i}
              onChange={updateAssignment}
              onRemove={removeAssignment}
              contractors={approvedSubs}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubcontractorAssignmentCard({ assignment, index, onChange, onRemove, contractors }) {
  const [expanded, setExpanded] = React.useState(true);
  const { buy, sell, marginNet, marginPct } = computeMargin(assignment);
  const wt = WORK_TYPES.find(w => w.val === assignment.work_type) || WORK_TYPES[0];
  const WtIcon = wt.icon;
  const sub = contractors.find(c => c.id === assignment.subcontractor_id);
  const showQty = ['hourly_rate', 'per_metre', 'per_unit'].includes(assignment.purchase_rate_basis);
  const hasZeroMargin = buy > 0 && marginNet <= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-3 py-2.5 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </button>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${wt.color}`}>
          <WtIcon className="w-3 h-3" /> {wt.label}
        </span>
        <p className="text-sm font-semibold text-slate-800 truncate flex-1">
          {sub?.name || `Subcontractor ${index + 1}`}
          {assignment.borehole_ref && <span className="text-slate-400 font-normal"> · {assignment.borehole_ref}</span>}
        </p>
        {buy > 0 && (
          <span className="text-xs text-slate-500">Buy: <strong className="text-slate-700 tabular-nums">{fmt(buy)}</strong> → Sell: <strong className="text-emerald-700 tabular-nums">{fmt(sell)}</strong></span>
        )}
        <button type="button" onClick={() => onRemove(index)}
          className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-medium hover:bg-red-100 transition flex-shrink-0">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>

      {/* Card body */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Row 1: Subcontractor + Work type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subcontractor <span className="text-red-500">*</span></label>
              <select value={assignment.subcontractor_id} onChange={e => onChange(index, 'subcontractor_id', e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Work Type</label>
              <select value={assignment.work_type} onChange={e => onChange(index, 'work_type', e.target.value)} className={inputCls}>
                {WORK_TYPES.map(w => <option key={w.val} value={w.val}>{w.label}</option>)}
              </select>
            </div>
          </div>

          {/* Crew names — adapts to work type */}
          {['drilling', 'coring'].includes(assignment.work_type) ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Lead Driller</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" value={assignment.crew_lead_name || ''} onChange={e => onChange(index, 'crew_lead_name', e.target.value)} placeholder="Lead driller name" className={`${inputCls} pl-9`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Second Man</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" value={assignment.crew_second_name || ''} onChange={e => onChange(index, 'crew_second_name', e.target.value)} placeholder="Second man name" className={`${inputCls} pl-9`} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Worker Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={assignment.worker_name || ''} onChange={e => onChange(index, 'worker_name', e.target.value)} placeholder="Worker name" className={`${inputCls} pl-9`} />
              </div>
            </div>
          )}

          {/* Row 2: Scope description + borehole refs */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Borehole / Area Ref</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="text" value={assignment.borehole_ref} onChange={e => onChange(index, 'borehole_ref', e.target.value)} placeholder="BH-01, BH-02" className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Scope Description</label>
              <input type="text" value={assignment.description} onChange={e => onChange(index, 'description', e.target.value)} placeholder="e.g. Rotary coring BH-01 to BH-03, 15m depth each" className={inputCls} />
            </div>
          </div>

          {/* Row 3: Rate basis + rate + markup + PO */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rate Basis</label>
              <select value={assignment.purchase_rate_basis} onChange={e => onChange(index, 'purchase_rate_basis', e.target.value)} className={inputCls}>
                {RATE_BASIS.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rate (£) <span className="text-red-500">*</span></label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" min="0" step="0.01" value={assignment.purchase_rate} onChange={e => onChange(index, 'purchase_rate', e.target.value)} placeholder="0.00" className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Markup %</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="number" min="0" step="0.1" value={assignment.markup_percentage} onChange={e => onChange(index, 'markup_percentage', e.target.value)} className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">PO Number</label>
              <input type="text" value={assignment.po_number} onChange={e => onChange(index, 'po_number', e.target.value)} placeholder="Optional" className={inputCls} />
            </div>
          </div>

          {/* Row 4: Quantity fields (contextual) */}
          {showQty && (
            <div className="grid grid-cols-3 gap-3">
              {assignment.purchase_rate_basis === 'hourly_rate' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hours</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="number" min="0" step="0.5" value={assignment.hours_worked} onChange={e => onChange(index, 'hours_worked', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                  </div>
                </div>
              )}
              {assignment.purchase_rate_basis === 'per_metre' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Metres</label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="number" min="0" step="0.1" value={assignment.metres_drilled} onChange={e => onChange(index, 'metres_drilled', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                  </div>
                </div>
              )}
              {assignment.purchase_rate_basis === 'per_unit' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Units</label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input type="number" min="0" step="0.5" value={assignment.units_completed} onChange={e => onChange(index, 'units_completed', e.target.value)} placeholder="0" className={`${inputCls} pl-9`} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unit Label</label>
                    <input type="text" value={assignment.units_label} onChange={e => onChange(index, 'units_label', e.target.value)} placeholder="e.g. trial pits, core runs" className={inputCls} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Live margin preview */}
          {buy > 0 && (
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${hasZeroMargin ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Buy</p>
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(buy)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Sell ({assignment.markup_percentage || 0}%)</p>
                  <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(sell)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Margin</p>
                  <p className="text-sm font-bold text-primary tabular-nums">{fmt(marginNet)} <span className="text-[10px] font-normal">({marginPct.toFixed(1)}%)</span></p>
                </div>
              </div>
              {hasZeroMargin && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-medium">Zero margin</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}