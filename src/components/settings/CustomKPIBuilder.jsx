import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { KPI_ICON_MAP } from '@/components/dashboard/CustomKPITile';
import { Check, ChevronRight, Plus, Trash2, Eye } from 'lucide-react';

const ENTITY_OPTIONS = [
  'Job', 'Staff', 'Client', 'Contractor', 'RotaAssignment', 'Timesheet',
  'Invoice', 'AFP', 'AFPLineItem', 'CVR', 'SiteAsset', 'Vehicle',
  'SafetyReport', 'ComplianceItem', 'TrainingBooking', 'DeliveryLog',
  'InvestigationLog', 'JobCostItem', 'DailyCost', 'SubcontractorLog',
  'Absence', 'StaffTask', 'InboxItem', 'PurchaseOrder', 'Sample',
];

const AGGREGATION_OPTIONS = [
  { key: 'count', label: 'Count', description: 'Number of matching records' },
  { key: 'sum', label: 'Sum', description: 'Total of a numeric field' },
  { key: 'avg', label: 'Average', description: 'Average of a numeric field' },
  { key: 'min', label: 'Minimum', description: 'Lowest value of a field' },
  { key: 'max', label: 'Maximum', description: 'Highest value of a field' },
];

const FORMAT_OPTIONS = [
  { key: 'number', label: 'Number' },
  { key: 'currency', label: 'Currency (£)' },
  { key: 'percent', label: 'Percent (%)' },
  { key: 'raw', label: 'Raw' },
];

const STEPS = ['Entity', 'Aggregation', 'Filter', 'Display'];

/**
 * CustomKPIBuilder — step-by-step wizard for creating custom KPI tiles.
 *
 * Lets an admin define a KPI tile by selecting an entity, aggregation
 * function, filter conditions, and display options. The tile definition
 * is stored in the Division entity's dashboard_config.custom_kpi_tiles.
 */
export default function CustomKPIBuilder({ existingTiles, onSave, onDelete }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(null);

  const startNew = () => {
    setEditing({
      id: `custom-kpi-${Date.now()}`,
      label: '',
      entity_name: '',
      aggregation: 'count',
      value_field: '',
      filter: {},
      icon: 'Activity',
      color: '#2E5A1A',
      format: 'number',
    });
    setStep(0);
  };

  if (!editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Custom KPI Tiles</h4>
            <p className="text-xs text-slate-400 mt-0.5">Build custom KPI tiles from your entity data</p>
          </div>
          <Button size="sm" onClick={startNew}>
            <Plus className="w-3.5 h-3.5" /> New Tile
          </Button>
        </div>
        {existingTiles.length === 0 ? (
          <div className="hub-glass rounded-xl p-6 text-center">
            <p className="text-sm text-slate-400">No custom KPI tiles yet. Click "New Tile" to create one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {existingTiles.map(tile => {
              const Icon = KPI_ICON_MAP[tile.icon] || KPI_ICON_MAP.Activity;
              return (
                <div key={tile.id} className="hub-glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${tile.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: tile.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{tile.label}</p>
                    <p className="text-xs text-slate-400">{tile.aggregation} of {tile.entity_name}{tile.value_field ? `.${tile.value_field}` : ''}</p>
                  </div>
                  <button onClick={() => { setEditing(tile); setStep(3); }} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                  <button onClick={() => onDelete(tile.id)} className="text-rose-500 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const update = (field, value) => setEditing(prev => ({ ...prev, [field]: value }));

  const canNext = () => {
    if (step === 0) return editing.entity_name;
    if (step === 1) return editing.aggregation === 'count' || editing.value_field;
    if (step === 2) return true;
    if (step === 3) return editing.label;
    return false;
  };

  const handleSave = () => {
    onSave(editing);
    setEditing(null);
    toast({ title: 'KPI tile saved' });
  };

  return (
    <div className="hub-glass rounded-2xl p-5 space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => i < step && setStep(i)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                i === step ? 'bg-primary text-white' : i < step ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Entity</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ENTITY_OPTIONS.map(name => (
              <button
                key={name}
                onClick={() => update('entity_name', name)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                  editing.entity_name === name ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Aggregation Function</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AGGREGATION_OPTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => update('aggregation', a.key)}
                  className={`text-left p-3 rounded-lg border transition ${
                    editing.aggregation === a.key ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800">{a.label}</p>
                  <p className="text-xs text-slate-400">{a.description}</p>
                </button>
              ))}
            </div>
          </div>
          {editing.aggregation !== 'count' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Value Field</label>
              <input
                value={editing.value_field}
                onChange={e => update('value_field', e.target.value)}
                placeholder="e.g. budget_amount, meterage, amount"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Conditions (optional)</label>
          <p className="text-xs text-slate-400">Add field=value conditions. Leave empty for no filter.</p>
          {Object.entries(editing.filter || {}).map(([field, value]) => (
            <div key={field} className="flex items-center gap-2">
              <input
                value={field}
                readOnly
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
              />
              <span className="text-slate-400 text-xs">=</span>
              <input
                value={value}
                onChange={e => update('filter', { ...editing.filter, [field]: e.target.value })}
                className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
              <button onClick={() => { const f = { ...editing.filter }; delete f[field]; update('filter', f); }} className="text-rose-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              id="new-filter-field"
              placeholder="field name"
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
            <input
              id="new-filter-value"
              placeholder="value"
              className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const f = document.getElementById('new-filter-field');
                  const v = document.getElementById('new-filter-value');
                  if (f?.value && v?.value) {
                    update('filter', { ...editing.filter, [f.value]: v.value });
                    f.value = ''; v.value = '';
                  }
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => {
              const f = document.getElementById('new-filter-field');
              const v = document.getElementById('new-filter-value');
              if (f?.value && v?.value) {
                update('filter', { ...editing.filter, [f.value]: v.value });
                f.value = ''; v.value = '';
              }
            }}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Label</label>
            <input
              value={editing.label}
              onChange={e => update('label', e.target.value)}
              placeholder="e.g. Active Boreholes"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Icon</label>
              <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto p-1 border border-slate-200 rounded-lg">
                {Object.entries(KPI_ICON_MAP).map(([name, Icon]) => (
                  <button
                    key={name}
                    onClick={() => update('icon', name)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      editing.icon === name ? 'bg-primary text-white' : 'hover:bg-slate-100 text-slate-500'
                    }`}
                    title={name}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.color} onChange={e => update('color', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                  <input type="text" value={editing.color} onChange={e => update('color', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Format</label>
                <select
                  value={editing.format}
                  onChange={e => update('format', e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                >
                  {FORMAT_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Live preview */}
          <div className="hub-glass rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${editing.color}15` }}>
              {(() => { const Icon = KPI_ICON_MAP[editing.icon] || KPI_ICON_MAP.Activity; return <Icon className="w-6 h-6" style={{ color: editing.color }} />; })()}
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: editing.color }}>123</p>
              <p className="text-xs text-slate-400">{editing.label || 'Tile label'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canNext()}>Next</Button>
          ) : (
            <Button size="sm" onClick={handleSave}><Check className="w-3.5 h-3.5" /> Save Tile</Button>
          )}
        </div>
      </div>
    </div>
  );
}