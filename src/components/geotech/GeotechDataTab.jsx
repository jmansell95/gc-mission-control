import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Truck, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BoreholeCardGrid from '@/components/geotech/BoreholeCardGrid';
import SampleFormModal from '@/components/geotech/SampleFormModal';
import MonitoringWellManager from '@/components/geotech/MonitoringWellManager';
import EquipmentCalibrationManager from '@/components/geotech/EquipmentCalibrationManager';

const STAT_TILES = [
  { key: 'total', label: 'Total Samples', gradient: 'linear-gradient(135deg, #2EFF7D 0%, #00A3FF 100%)', icon: FlaskConical },
  { key: 'inTransit', label: 'In Transit/Testing', gradient: 'linear-gradient(135deg, #FFC300 0%, #FF5733 100%)', icon: FlaskConical },
  { key: 'resultsBack', label: 'Results Returned', gradient: 'linear-gradient(135deg, #00F0FF 0%, #007DFF 100%)', icon: FlaskConical },
  { key: 'needsCollection', label: 'Need Collection', gradient: 'linear-gradient(135deg, #00D4FF 0%, #008CFF 100%)', icon: Truck },
];

export default function GeotechDataTab({ job, allStaff, suppliers, assets }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingSample, setEditingSample] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples-for-job', job.id],
    queryFn: () => base44.entities.Sample.filter({ job_id: job.id }, '-collection_date'),
  });

  const { data: sampleDeliveries = [] } = useQuery({
    queryKey: ['sample-deliveries-for-job', job.id],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: job.id }, '-scheduled_date'),
  });

  // Build sample delivery status maps
  const { scheduledSampleIds, sampleDeliveryStatus } = useMemo(() => {
    const scheduled = new Set();
    const status = new Map();
    sampleDeliveries.forEach(d => {
      if ((d.delivery_type === 'sample_collection' || d.delivery_type === 'sample_delivery') && d.sample_ids) {
        d.sample_ids.split(',').map(id => id.trim()).filter(Boolean).forEach(id => {
          scheduled.add(id);
          const entry = status.get(id) || {};
          if (d.delivery_type === 'sample_collection') entry.collection = d.status;
          if (d.delivery_type === 'sample_delivery') entry.delivery = d.status;
          status.set(id, entry);
        });
      }
    });
    return { scheduledSampleIds: scheduled, sampleDeliveryStatus: status };
  }, [sampleDeliveries]);

  const stats = useMemo(() => ({
    total: samples.length,
    inTransit: samples.filter(s => ['dispatched', 'received_at_lab', 'testing'].includes(s.status)).length,
    resultsBack: samples.filter(s => s.status === 'results_returned').length,
    needsCollection: samples.filter(s => s.status === 'collected' && !scheduledSampleIds.has(s.sample_id)).length,
  }), [samples, scheduledSampleIds]);

  const labs = suppliers?.filter(s => s.name?.match(/lab|geol|soil|test|analy/i)) || [];

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const payload = { ...formData, job_id: job.id, status_changed_at: new Date().toISOString() };
      if (editingSample) {
        await base44.entities.Sample.update(editingSample.id, payload);
        toast({ title: 'Sample updated' });
      } else {
        await base44.entities.Sample.create(payload);
        toast({ title: 'Sample registered' });
      }
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      setShowForm(false);
      setEditingSample(null);
    } catch (e) {
      toast({ title: 'Error saving sample', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const advanceStatus = async (sample, newStatus) => {
    try {
      const updates = { status: newStatus, status_changed_at: new Date().toISOString() };
      if (newStatus === 'dispatched' && !sample.dispatch_date) updates.dispatch_date = new Date().toISOString().slice(0, 10);
      if (newStatus === 'received_at_lab' && !sample.lab_receipt_date) updates.lab_receipt_date = new Date().toISOString().slice(0, 10);
      await base44.entities.Sample.update(sample.id, updates);
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      toast({ title: `Sample marked as ${newStatus.replace(/_/g, ' ')}` });
    } catch (e) {
      toast({ title: 'Error updating status', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (sample) => {
    if (!confirm(`Delete sample ${sample.sample_id}?`)) return;
    try {
      await base44.entities.Sample.delete(sample.id);
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', job.id] });
      toast({ title: 'Sample deleted' });
    } catch (e) {
      toast({ title: 'Error deleting', description: e.message, variant: 'destructive' });
    }
  };

  const handleScheduleRun = (sampleSubset) => {
    const pool = sampleSubset || samples;
    const eligible = pool.filter(s => s.status === 'collected' && !scheduledSampleIds.has(s.sample_id));
    if (eligible.length === 0) {
      toast({ title: 'No samples ready for collection', description: 'Only samples with "Collected" status can be scheduled.', variant: 'destructive' });
      return;
    }
    const sampleIds = eligible.map(s => s.id);
    const itemsList = eligible.map(s => `${s.sample_id}${s.borehole_ref ? ' (' + s.borehole_ref + ')' : ''}`).join(', ');
    navigate('/admin/logistics', {
      state: {
        prefill: {
          sampleIds,
          items: `Samples: ${itemsList}`,
          jobId: job.id,
          jobName: job.name,
          pickupAddress: job.location || '',
          deliveryType: 'sample_collection',
        },
      },
    });
  };

  return (
    <div className="bg-[#0B1A0B] rounded-2xl p-4 md:p-5 space-y-4">
      {/* Mission-control header */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2EFF7D] to-[#00A3FF] flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-5 h-5 text-[#0B1A0B]" />
            </div>
            <div>
              <h3 className="font-bold text-[#E0E0E0] text-base">Geotechnical Data Management</h3>
              <p className="text-xs text-[#A0A0A0] mt-0.5 max-w-md">
                Sample chain of custody, laboratory test tracking, monitoring well installations, and field equipment calibration.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats.needsCollection > 0 && (
              <button onClick={() => handleScheduleRun()}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF9F1C] text-[#1a1a1a] rounded-lg hover:brightness-110 transition text-xs font-semibold">
                <Truck className="w-3.5 h-3.5" /> Schedule Run ({stats.needsCollection})
              </button>
            )}
            <button onClick={() => { setEditingSample(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1C201C] border border-[#2a3a2a] text-[#E0E0E0] rounded-lg hover:border-[#FF9F1C]/50 transition text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Register Sample
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_TILES.map(tile => {
            const value = stats[tile.key];
            const Icon = tile.icon;
            return (
              <div key={tile.key} className="relative rounded-xl p-3 overflow-hidden" style={{ background: tile.gradient }}>
                <div className="absolute inset-0 bg-[#0B1A0B]/20" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                    <p className="text-[10px] font-medium text-white/80 uppercase tracking-wide mt-0.5">{tile.label}</p>
                  </div>
                  <Icon className="w-6 h-6 text-white/40" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Borehole card grid */}
      <BoreholeCardGrid
        samples={samples}
        allStaff={allStaff}
        suppliers={suppliers}
        job={job}
        scheduledSampleIds={scheduledSampleIds}
        sampleDeliveryStatus={sampleDeliveryStatus}
        onAdvanceStatus={advanceStatus}
        onRegister={handleSave}
        onDelete={handleDelete}
        onScheduleCollection={handleScheduleRun}
        isLoading={isLoading}
      />

      {/* Monitoring wells + Equipment calibration (restyled dark) */}
      <MonitoringWellManager job={job} allStaff={allStaff} />
      <EquipmentCalibrationManager job={job} assets={assets} />

      {/* Sample form modal */}
      {showForm && (
        <SampleFormModal
          sample={editingSample}
          job={job}
          allStaff={allStaff}
          labs={labs}
          suppliers={suppliers}
          saving={saving}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingSample(null); }}
        />
      )}
    </div>
  );
}