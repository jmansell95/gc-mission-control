import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IdCard, Car, ShieldCheck, Award, CreditCard, FileText, Plus, X,
  AlertTriangle, CheckCircle2, Clock, Loader2, RotateCw, ExternalLink,
} from 'lucide-react';
import { formatComplianceDate, complianceDaysUntil } from '@/utils/complianceDate';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import SmartUploadWizard from './SmartUploadWizard';

const ICON_MAP = { IdCard, Car, ShieldCheck, Award, CreditCard, FileText };

function getStatus(item) {
  if (item.status_override === 'missing') return { label: 'Missing', bg: 'bg-red-500', text: 'text-white', dot: 'bg-red-400' };
  if (item.status_override === 'not_required') return { label: 'N/A', bg: 'bg-slate-400', text: 'text-white', dot: 'bg-slate-300' };
  if (!item.expiry_date) return { label: 'No Expiry', bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-300' };
  const days = complianceDaysUntil(item.expiry_date);
  if (days === null) return { label: 'No Expiry', bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-300' };
  if (days < 0) return { label: 'Expired', bg: 'bg-red-500', text: 'text-white', dot: 'bg-red-400' };
  if (days <= 30) return { label: `${days}d left`, bg: 'bg-amber-500', text: 'text-white', dot: 'bg-amber-300' };
  return { label: 'Valid', bg: 'bg-emerald-600', text: 'text-white', dot: 'bg-emerald-300' };
}

/** Resolves a private URI to a viewable signed URL; public URLs pass through. */
function useSignedUrl(url) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    if (url.startsWith('http://') || url.startsWith('https://')) { setSrc(url); return; }
    setLoading(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: url })
      .then(res => setSrc(res?.signed_url || null))
      .catch(() => setSrc(null))
      .finally(() => setLoading(false));
  }, [url]);
  return { src, loading };
}

/** A visual flip-card for card-type credentials (CSCS, CPCS, etc). */
function FlipCard({ item, accentColor }) {
  const [flipped, setFlipped] = useState(false);
  const { src: frontSrc, loading: frontLoading } = useSignedUrl(item.document_url);
  const { src: backSrc, loading: backLoading } = useSignedUrl(item.back_document_url);
  const st = getStatus(item);
  const hasBack = !!item.back_document_url;

  return (
    <div className="group flip-card-perspective">
      <div
        className="relative w-full aspect-[1.586/1] transition-transform duration-500 flip-card-3d"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front face */}
        <div className="absolute inset-0 flip-card-backface rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
          {frontLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
          ) : frontSrc ? (
            <img src={frontSrc} alt={`${item.title} front`} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
              <CreditCard className="w-10 h-10" />
              <span className="text-xs font-medium">No front image</span>
            </div>
          )}
          {/* Status badge */}
          <div className={`absolute top-2 right-2 ${st.bg} ${st.text} text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm`}>
            {st.label}
          </div>
          {/* Label bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <p className="text-white text-xs font-bold truncate">{item.title}</p>
            {item.card_number && <p className="text-white/70 text-[10px] truncate">#{item.card_number}</p>}
          </div>
          {/* Flip hint */}
          {hasBack && (
            <button
              onClick={() => setFlipped(true)}
              className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-600" />
            </button>
          )}
        </div>
        {/* Back face */}
        {hasBack && (
          <div className="absolute inset-0 flip-card-backface flip-card-rotate-180 rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-slate-100">
            {backLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
            ) : backSrc ? (
              <img src={backSrc} alt={`${item.title} back`} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                <CreditCard className="w-10 h-10" />
                <span className="text-xs font-medium">No back image</span>
              </div>
            )}
            <button
              onClick={() => setFlipped(false)}
              className="absolute top-2 left-2 bg-white/80 backdrop-blur-sm p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white transition touch-manipulation active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
              <p className="text-white text-xs font-bold truncate">{item.title} — Back</p>
            </div>
          </div>
        )}
      </div>
      {/* Expiry info below card */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-1.5">
          {item.issue_date && <span className="text-[10px] text-slate-400">Issued {formatComplianceDate(item.issue_date)}</span>}
          {item.expiry_date && <span className="text-[10px] text-slate-400">· Expires {formatComplianceDate(item.expiry_date)}</span>}
        </div>
        <a href={frontSrc || '#'} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-600 font-medium hover:underline flex items-center gap-0.5">
          <ExternalLink className="w-2.5 h-2.5" /> Open
        </a>
      </div>
    </div>
  );
}

/** A document-style card for certificate-type items. */
function CertificateCard({ item }) {
  const { src, loading } = useSignedUrl(item.document_url);
  const st = getStatus(item);
  const isImg = item.document_url?.match(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/i);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white">
      <div className="h-40 bg-slate-50 flex items-center justify-center relative">
        {loading ? (
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        ) : src && isImg ? (
          <a href={src} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img src={src} alt={item.title} className="w-full h-full object-cover" />
          </a>
        ) : src ? (
          <a href={src} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition">
            <FileText className="w-10 h-10" />
            <span className="text-xs font-medium">View PDF</span>
          </a>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Award className="w-10 h-10" />
            <span className="text-xs font-medium">No document</span>
          </div>
        )}
        <div className={`absolute top-2 right-2 ${st.bg} ${st.text} text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm`}>{st.label}</div>
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-slate-900 truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
          {item.issue_date && <span>Issued {formatComplianceDate(item.issue_date)}</span>}
          {item.expiry_date && <span>· Expires {formatComplianceDate(item.expiry_date)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ComplianceWallet({ staffId, staffName }) {
  const [showWizard, setShowWizard] = useState(false);
  const { toast } = useToast();

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
    enabled: !!staffId
  });

  const myItems = allItems
    .filter(i => i.reference_id === staffId || (staffName && i.reference_name === staffName))
    .filter(i => i.document_url || i.back_document_url);

  const cardTypes = ['cscs_card', 'cpcs_card', 'npors_card', 'driver_license'];
  const cards = myItems.filter(i => cardTypes.includes(i.qualification_type));
  const certificates = myItems.filter(i => !cardTypes.includes(i.qualification_type));

  // Summary stats
  const valid = myItems.filter(i => getStatus(i).label === 'Valid' || getStatus(i).label === 'No Expiry').length;
  const expiring = myItems.filter(i => getStatus(i).label.includes('d left')).length;
  const expired = myItems.filter(i => getStatus(i).label === 'Expired' || getStatus(i).label === 'Missing').length;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm">
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="stat-gradient-emerald rounded-xl p-3 text-white relative overflow-hidden shadow-sm">
          <CheckCircle2 className="absolute right-2 top-2 w-5 h-5 opacity-20" />
          <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Valid</p>
          <p className="text-2xl font-extrabold tabular-nums">{valid}</p>
        </div>
        <div className="stat-gradient-amber rounded-xl p-3 text-white relative overflow-hidden shadow-sm">
          <Clock className="absolute right-2 top-2 w-5 h-5 opacity-20" />
          <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Expiring</p>
          <p className="text-2xl font-extrabold tabular-nums">{expiring}</p>
        </div>
        <div className="stat-gradient-rose rounded-xl p-3 text-white relative overflow-hidden shadow-sm">
          <AlertTriangle className="absolute right-2 top-2 w-5 h-5 opacity-20" />
          <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">Expired</p>
          <p className="text-2xl font-extrabold tabular-nums">{expired}</p>
        </div>
      </div>

      {/* Cards section */}
      {cards.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <IdCard className="w-4 h-4 text-violet-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">My Cards</h3>
              <p className="text-[11px] text-slate-500">Tap a card to flip · {cards.length} card{cards.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(item => <FlipCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Certificates section */}
      {certificates.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Award className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Certificates & Documents</h3>
              <p className="text-[11px] text-slate-500">{certificates.length} document{certificates.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.map(item => <CertificateCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {myItems.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <EmptyState
            icon={IdCard}
            title="Your wallet is empty"
            message="Your CSCS cards, certificates and other credentials will appear here as visual cards once uploaded."
            actionLabel="Add Document"
            onAction={() => setShowWizard(true)}
          />
        </div>
      )}

      {/* Add button */}
      {myItems.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-semibold hover:bg-emerald-800 active:scale-95 transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Document
          </button>
        </div>
      )}

      {showWizard && (
        <SmartUploadWizard
          staffId={staffId}
          staffName={staffName}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}