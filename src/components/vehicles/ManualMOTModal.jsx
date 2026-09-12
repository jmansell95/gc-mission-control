import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldX, ShieldAlert, Gauge } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

const RESULT_OPTIONS = [
  { val: 'pass', label: 'Passed', Icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { val: 'fail', label: 'Failed', Icon: ShieldX, cls: 'bg-red-50 text-red-700 border-red-200' },
  { val: 'advisory', label: 'Advisories', Icon: ShieldAlert, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { val: 'prs', label: 'PRS (Minor Defects)', Icon: ShieldAlert, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
];

export default function ManualMOTModal({ open, onClose, vehicle }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState('pass');
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [advisoryNotes, setAdvisoryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setResult('pass');
      setTestDate(new Date().toISOString().slice(0, 10));
      setExpiryDate('');
      setOdometer(vehicle?.current_mileage ? String(vehicle.current_mileage) : '');
      setTestNumber('');
      setAdvisoryNotes('');
    }
  }, [open, vehicle]);

  if (!open || !vehicle) return null;

  const handleSubmit = async () => {
    if (!testDate) {
      toast({ title: 'Test date is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Create the MOT history record
      await base44.entities.VehicleMOTHistory.create({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        test_date: testDate,
        result,
        expiry_date: expiryDate || undefined,
        odometer: odometer ? Number(odometer) : undefined,
        test_number: testNumber || undefined,
        advisory_notes: advisoryNotes || undefined,
        source: 'manual',
      });

      // If the MOT failed, clear the vehicle's MOT expiry so compliance
      // status reflects the failure (vehicle becomes non-compliant), and
      // auto-create a maintenance booking for the retest/repair.
      if (result === 'fail') {
        await base44.entities.Vehicle.update(vehicle.id, { mot_expiry: undefined });
        // Auto-create a maintenance booking for the retest
        await base44.entities.VehicleMaintenanceBooking.create({
          vehicle_id: vehicle.id,
          vehicle_name: vehicle.name,
          booking_type: 'mot',
          status: 'requested',
          booking_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          notes: `Auto-booked after MOT FAIL on ${testDate}.${advisoryNotes ? ` Failure reasons: ${advisoryNotes}` : ''} Booked for retest within 7 days.`,
        });
      } else if ((result === 'pass' || result === 'prs' || result === 'advisory') && expiryDate) {
        await base44.entities.Vehicle.update(vehicle.id, { mot_expiry: expiryDate });
      }

      queryClient.invalidateQueries(['vehicle-mot-history', vehicle.id]);
      queryClient.invalidateQueries(['vehicles']);
      queryClient.invalidateQueries(['vehicles-maintenance-bookings']);
      toast({
        title: `MOT ${result === 'pass' ? 'pass' : result} logged`,
        description: result === 'fail'
          ? `${vehicle.registration_number} — retest booking auto-created`
          : `${vehicle.registration_number} — ${testDate}`,
      });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to log MOT', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="hero-gradient text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="font-bold">Log MOT Result</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-2.5">
            <span className="font-mono font-bold text-slate-700">{vehicle.registration_number}</span>
            <span className="text-slate-400 ml-2">{vehicle.name}</span>
          </div>

          {/* Result selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Test Result</label>
            <div className="grid grid-cols-2 gap-2">
              {RESULT_OPTIONS.map(opt => {
                const Icon = opt.Icon;
                return (
                  <button key={opt.val} onClick={() => setResult(opt.val)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${result === opt.val ? opt.cls + ' ring-2 ring-offset-1' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <Icon className="w-4 h-4" /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test date */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Test Date</label>
            <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Expiry date — only for pass/prs/advisory */}
          {result !== 'fail' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">New Expiry Date (if known)</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
          )}

          {/* Odometer */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block flex items-center gap-1"><Gauge className="w-3 h-3" /> Odometer (miles)</label>
            <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Test number */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">MOT Test Number (optional)</label>
            <input type="text" value={testNumber} onChange={e => setTestNumber(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>

          {/* Advisory notes */}
          {result !== 'pass' && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Advisory Notes / Failure Reasons</label>
              <textarea value={advisoryNotes} onChange={e => setAdvisoryNotes(e.target.value)} rows={3}
                placeholder={result === 'fail' ? 'e.g. Nearside front brake pad worn below 1.5mm' : 'e.g. Nearside rear tyre wearing thin'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
          )}

          {result === 'fail' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <strong>⚠️ Vehicle will be flagged as non-compliant.</strong> The MOT expiry will be cleared and the vehicle will show a "MOT Failed" warning on its card until a retest is logged.
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:brightness-110 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Log MOT Result'}
          </button>
        </div>
      </div>
    </div>
  );
}