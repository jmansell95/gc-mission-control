import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { IdCard, Download, Printer, QrCode } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Generates a QR code string using a public API (no package needed).
// The QR encodes a vCard-like JSON payload with the staff member's details.
const buildQrPayload = (staff) => {
  return JSON.stringify({
    type: 'GC_STAFF_ID',
    id: staff.id,
    name: staff.name,
    job_title: staff.job_title || '',
    email: staff.email || '',
    phone: staff.phone || '',
    team_id: staff.team_id || '',
  });
};

const qrUrl = (data, size = 200) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

export default function StaffIDCard() {
  const [selectedId, setSelectedId] = useState(null);
  const cardRef = useRef(null);
  const { toast } = useToast();

  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  const activeStaff = staff.filter(s => s.is_active !== false);
  const selected = activeStaff.find(s => s.id === selectedId);
  const team = selected ? teams.find(t => t.id === selected.team_id) : null;

  const handlePrint = () => {
    if (!cardRef.current) return;
    const printWindow = window.open('', '_blank');
    const cardHtml = cardRef.current.outerHTML;
    printWindow.document.write(`
      <html><head><title>Staff ID Card - ${selected?.name || ''}</title>
      <style>
        body { margin: 0; padding: 20px; display: flex; justify-content: center; }
        @media print { @page { margin: 0; } }
      </style>
      </head><body>${cardHtml}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
          <IdCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Digital Staff ID Cards</h3>
          <p className="text-xs text-slate-500">Generate scannable ID cards with QR codes for site access and verification</p>
        </div>
      </div>

      {/* Staff selector */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Select Staff Member</label>
        <select value={selectedId || ''} onChange={e => setSelectedId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary">
          <option value="">Choose a staff member...</option>
          {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}{s.job_title ? ` — ${s.job_title}` : ''}</option>)}
        </select>
      </div>

      {/* ID Card preview */}
      {selected && (
        <div className="space-y-3">
          <div ref={cardRef} className="relative w-full max-w-sm mx-auto aspect-[1.586/1] rounded-2xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #2E5A1A 0%, #1c4a12 100%)' }}>
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(141,198,63,0.4) 0%, transparent 50%)' }} />

            {/* Header */}
            <div className="absolute top-0 left-0 right-0 px-5 pt-4 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm tracking-tight">GROUND CONTROL</p>
                <p className="text-white/60 text-[8px] tracking-widest uppercase">Site Access Card</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
                <IdCard className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Body */}
            <div className="absolute inset-0 flex items-center px-5 pt-10 pb-4">
              <div className="flex items-center gap-3 w-full">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-xl bg-white/15 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selected.avatar_url ? (
                    <img src={selected.avatar_url} alt={selected.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xl font-bold">{(selected.name || '?').charAt(0)}</span>
                  )}
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base leading-tight truncate">{selected.name}</p>
                  {selected.job_title && <p className="text-white/80 text-xs mt-0.5 truncate">{selected.job_title}</p>}
                  {team && <p className="text-white/60 text-[10px] mt-0.5 truncate">{team.name}</p>}
                  {selected.email && <p className="text-white/50 text-[9px] mt-1 truncate">{selected.email}</p>}
                </div>
              </div>
            </div>

            {/* QR code */}
            <div className="absolute bottom-3 right-3">
              <div className="bg-white rounded-lg p-1.5 shadow-md">
                <img src={qrUrl(buildQrPayload(selected), 80)} alt="QR Code" className="w-16 h-16" />
              </div>
            </div>

            {/* Footer line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8DC63F] to-[#6fa828]" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition">
              <Printer className="w-4 h-4" /> Print Card
            </button>
            <a href={qrUrl(buildQrPayload(selected), 400)} download={`id-card-${selected.name?.replace(/\s+/g, '-').toLowerCase()}.png`} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition">
              <Download className="w-4 h-4" /> Download QR
            </a>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <QrCode className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-700">Scan the QR code to verify staff identity, role, and contact details on site.</p>
          </div>
        </div>
      )}

      {!selected && (
        <div className="flex flex-col items-center justify-center py-10 text-center hub-glass rounded-xl">
          <IdCard className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Select a staff member to generate their digital ID card.</p>
        </div>
      )}
    </div>
  );
}