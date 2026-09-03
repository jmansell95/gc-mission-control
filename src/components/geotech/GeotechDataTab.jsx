import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, Truck, Mountain, TestTube, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BoreholeCardGrid from '@/components/geotech/BoreholeCardGrid';
import SampleFormModal from '@/components/geotech/SampleFormModal';
import MonitoringWellManager from '@/components/geotech/MonitoringWellManager';
import EquipmentCalibrationManager from '@/components/geotech/EquipmentCalibrationManager';

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
    <div className="space-y-4">
      {/* KPI ribbon — matches the Borehole Data Summary panel */}
      <div className="hero-gradient rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5" />
          <h2 className="text-lg font-bold">Geotechnical Data</h2>
          <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">{stats.total} samples</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={FlaskConical} label="Total Samples" value={stats.total} />
          <KpiTile icon={TestTube} label="In Transit/Testing" value={stats.inTransit} />
          <KpiTile icon={Clock} label="Results Returned" value={stats.resultsBack} />
          <KpiTile icon={Truck} label="Need Collection" value={stats.needsCollection} />
        </div>
      </div>

      {/* Sample management — insight-card matching the Borehole Data Explorer */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <Mountain className="w-5 h-5 text-emerald-700" />
          <h3 className="font-semibold text-slate-900 text-sm">Sample Management</h3>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {stats.total} sample{stats.total !== 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {stats.needsCollection > 0 && (
              <button onClick={() => handleScheduleRun()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-xs font-semibold">
                <Truck className="w-3.5 h-3.5" /> Schedule Run ({stats.needsCollection})
              </button>
            )}
            <button onClick={() => { setEditingSample(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Register Sample
            </button>
          </div>
        </div>
        <div className="p-4">
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
        </div>
      </div>

      {/* Monitoring wells + Equipment calibration (light insight-cards) */}
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

function KpiTile({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-white/70" />
        <p className="text-[10px] uppercase font-medium text-white/70 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}