import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShoppingCart, Plus, Package, Truck, CheckCircle2, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * ProcurementPipeline — full procurement flow:
 * raise a material/hire request from a job → auto-create a Purchase Order →
 * supplier confirms → goods-in scan → auto-attach cost to the job.
 * Closes the gap between ordering equipment and billing it.
 */
export default function ProcurementPipeline({ jobId, job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRequest, setShowRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    description: '',
    quantity: '1',
    unit_label: 'each',
    supplier_id: '',
    estimated_cost: '',
    notes: '',
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['procurement-pos', jobId],
    queryFn: () => jobId ? base44.entities.PurchaseOrder.filter({ job_id: jobId }) : [],
    enabled: !!jobId,
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['procurement-suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: costItems = [] } = useQuery({
    queryKey: ['procurement-cost-items', jobId],
    queryFn: () => jobId ? base44.entities.JobCostItem.filter({ job_id: jobId }) : [],
    enabled: !!jobId,
  });

  const handleSubmit = async () => {
    if (!form.description || !jobId) return;
    setSubmitting(true);
    try {
      // Create a Purchase Order
      const po = await base44.entities.PurchaseOrder.create({
        job_id: jobId,
        job_name: job?.name || '',
        supplier_id: form.supplier_id || '',
        status: 'draft',
        po_number: `PO-${Date.now().toString().slice(-6)}`,
        line_items: [{
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unit: form.unit_label,
          unit_cost: Number(form.estimated_cost) || 0,
          total: (Number(form.estimated_cost) || 0) * (Number(form.quantity) || 1),
        }],
        total_amount: (Number(form.estimated_cost) || 0) * (Number(form.quantity) || 1),
        notes: form.notes,
      });

      // Also create a draft cost item on the job so it's tracked
      await base44.entities.JobCostItem.create({
        job_id: jobId,
        category: 'hired_equipment',
        description: form.description,
        quantity: Number(form.quantity) || 1,
        unit_label: form.unit_label,
        unit_cost: Number(form.estimated_cost) || 0,
        supplier_id: form.supplier_id || '',
        po_number: po.po_number,
        hire_status: 'pending_delivery',
        notes: `Procurement request — PO ${po.po_number}. ${form.notes || ''}`,
      });

      queryClient.invalidateQueries({ queryKey: ['procurement-pos', jobId] });
      queryClient.invalidateQueries({ queryKey: ['procurement-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });

      toast({ title: 'Procurement request raised', description: `PO ${po.po_number} created and linked to this job.` });
      setShowRequest(false);
      setForm({ description: '', quantity: '1', unit_label: 'each', supplier_id: '', estimated_cost: '', notes: '' });
    } catch (err) {
      toast({ title: 'Failed to raise request', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const updatePoStatus = async (poId, newStatus) => {
    try {
      await base44.entities.PurchaseOrder.update(poId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['procurement-pos', jobId] });
      toast({ title: 'PO updated', description: `Status changed to ${newStatus}.` });
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const STAGES = [
    { key: 'draft', label: 'Draft', icon: ShoppingCart, color: 'slate' },
    { key: 'sent', label: 'Sent', icon: Truck, color: 'blue' },
    { key: 'acknowledged', label: 'Acknowledged', icon: Package, color: 'amber' },
    { key: 'received', label: 'Received', icon: CheckCircle2, color: 'emerald' },
    { key: 'closed', label: 'Closed', icon: CheckCircle2, color: 'emerald' },
  ];

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <ShoppingCart className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Procurement Pipeline</h3>
            <p className="text-xs text-slate-500">Raise requests → PO → supplier → goods-in → job cost</p>
          </div>
        </div>
        {jobId && (
          <button
            onClick={() => setShowRequest(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-xs font-bold hover:bg-[#1c4a12] active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Raise Request
          </button>
        )}
      </div>

      {/* Pipeline stages */}
      {!jobId ? (
        <p className="text-sm text-slate-400 text-center py-6">Select a job to view its procurement pipeline.</p>
      ) : purchaseOrders.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No procurement requests yet. Raise one to get started.</p>
      ) : (
        <div className="space-y-3">
          {purchaseOrders.slice(0, 10).map(po => {
            const stage = STAGES.find(s => s.key === po.status) || STAGES[0];
            const StageIcon = stage.icon;
            const supplier = suppliers.find(s => s.id === po.supplier_id);
            return (
              <div key={po.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${stage.color}-100`}>
                      <StageIcon className={`w-3.5 h-3.5 text-${stage.color}-600`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{po.po_number}</p>
                      <p className="text-xs text-slate-500">
                        {po.line_items?.[0]?.description || 'No items'} · {supplier?.name || 'No supplier'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    £{Number(po.total_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Stage progress */}
                <div className="flex items-center gap-1 mt-2">
                  {STAGES.map((s, i) => {
                    const currentIdx = STAGES.findIndex(st => st.key === po.status);
                    const isDone = i <= currentIdx;
                    return (
                      <div key={s.key} className="flex-1">
                        <div className={`h-1.5 rounded-full transition ${isDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                        <p className={`text-[9px] mt-1 text-center ${isDone ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                          {s.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {/* Action buttons */}
                <div className="flex gap-2 mt-2">
                  {po.status === 'draft' && (
                    <button onClick={() => updatePoStatus(po.id, 'sent')} className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition">
                      Mark as Sent
                    </button>
                  )}
                  {po.status === 'sent' && (
                    <button onClick={() => updatePoStatus(po.id, 'acknowledged')} className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100 transition">
                      Mark Acknowledged
                    </button>
                  )}
                  {po.status === 'acknowledged' && (
                    <button onClick={() => updatePoStatus(po.id, 'received')} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition">
                      Mark Received
                    </button>
                  )}
                  {po.status === 'received' && (
                    <button onClick={() => updatePoStatus(po.id, 'closed')} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200 transition">
                      Close PO
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request modal */}
      {showRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRequest(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Raise Procurement Request</h3>
              <button onClick={() => setShowRequest(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Item / Equipment</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Excavator 5-ton hire"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Unit</label>
                  <input
                    value={form.unit_label}
                    onChange={e => setForm(f => ({ ...f, unit_label: e.target.value }))}
                    placeholder="day, each, bag"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Estimated Cost (£)</label>
                <input
                  type="number"
                  value={form.estimated_cost}
                  onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Delivery instructions, urgency, etc."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#2E5A1A]"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!form.description || submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl font-bold text-sm hover:bg-[#1c4a12] active:scale-95 transition disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? 'Creating…' : 'Raise Request & Create PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}