import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Printer, X } from 'lucide-react';
import { buildPickListHtml, printPickListHtml } from './pickListHtml';

/**
 * Viewable + printable warehouse pick list modal. Renders an on-screen
 * preview of the pick sheet (via an iframe using the shared HTML generator)
 * with a Print button that triggers the existing window.open + print flow.
 *
 * Self-sufficient: if `job` or `vehicle` are not supplied, it fetches them by
 * ID so every trigger surface only needs to pass the delivery record.
 *
 * Props:
 *   delivery   — the DeliveryLog record
 *   job        — optional Job record (reference / what3words / site contact)
 *   vehicle    — optional Vehicle record (reg + height for loading bay)
 *   driverName — optional driver display name
 *   open       — boolean, whether the modal is visible
 *   onClose    — callback to close the modal
 */
export default function PickListModal({ delivery, job, vehicle, driverName, open, onClose }) {
  // Fetch the job if not supplied (e.g. field card / job-detail list only pass delivery)
  const { data: fetchedJob } = useQuery({
    queryKey: ['picklist-job', delivery?.job_id],
    queryFn: () => base44.entities.Job.get(delivery.job_id),
    enabled: open && !!delivery?.job_id && !job,
  });
  // Fetch the vehicle if not supplied (e.g. admin board card / table don't pass it)
  const { data: fetchedVehicle } = useQuery({
    queryKey: ['picklist-vehicle', delivery?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.get(delivery.vehicle_id),
    enabled: open && !!delivery?.vehicle_id && !vehicle,
  });

  const resolvedJob = job || fetchedJob || null;
  const resolvedVehicle = vehicle || fetchedVehicle || null;

  const html = useMemo(() => {
    if (!open || !delivery) return '';
    return buildPickListHtml({ delivery, job: resolvedJob, vehicle: resolvedVehicle, driverName });
  }, [open, delivery, resolvedJob, resolvedVehicle, driverName]);

  if (!open || !delivery) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 pt-6 sm:pt-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-pop-in">
        {/* Brand header strip — matches the print sheet */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold truncate leading-tight">Warehouse Pick List</h3>
              <p className="text-[11px] text-white/70 truncate">
                {delivery?.job_name || 'Drop'}
                {delivery?.optimized_sequence_index ? ` · Stop ${delivery.optimized_sequence_index}` : ' · Single drop'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/15 rounded-lg transition flex-shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* On-screen preview — identical to the printed sheet (shared generator) */}
        <iframe
          srcDoc={html}
          title="Pick List Preview"
          className="w-full flex-1 min-h-[52vh] border-0 bg-white"
        />

        {/* Sticky footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition">
            Close
          </button>
          <button
            onClick={() => printPickListHtml(html)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#244715] transition shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}