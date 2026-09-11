import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, Trash2, MessageSquare,
  FileText, Clock, Receipt, Plus,
  CheckSquare, Square,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const DISPUTE_META = {
  none: { label: '—', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
  disputed: { label: 'Disputed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  counter_offered: { label: 'Counter', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  agreed: { label: 'Agreed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  rejected: { label: 'Rejected', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const SOURCE_META = {
  driller_log: { label: 'Log', icon: FileText, color: 'text-blue-600' },
  delivery: { label: 'Del', icon: FileText, color: 'text-amber-600' },
  subcontractor: { label: 'Sub', icon: FileText, color: 'text-violet-600' },
  timesheet: { label: 'TS', icon: Clock, color: 'text-emerald-600' },
  cost: { label: 'Cost', icon: Receipt, color: 'text-rose-600' },
  template: { label: 'Tpl', icon: FileText, color: 'text-slate-600' },
  manual: { label: 'Man', icon: Plus, color: 'text-[#2E5A1A]' },
};

/**
 * AFPDisputeRow — a single line item row in the AFP Builder table.
 * Supports inline editing (draft), dispute status changes (submitted),
 * bulk selection checkboxes, and expandable dispute history.
 */
export default function AFPDisputeRow({ item, canEdit, canDispute, canSelect, selected, onSelect, expanded, onToggleDispute, onUpdate, onAutoSave, onDelete, mobile }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ qty: item.qty, rate: item.rate });
  const [disputeNote, setDisputeNote] = useState(item.dispute_note || '');

  const srcMeta = SOURCE_META[item.source] || SOURCE_META.manual;
  const disputeMeta = DISPUTE_META[item.dispute_status] || DISPUTE_META.none;
  const SrcIcon = srcMeta.icon;

  const saveEdit = async () => {
    const qty = Number(draft.qty) || 0;
    const rate = Number(draft.rate) || 0;
    const amount = qty * rate;
    // Use auto-save (debounced) if available, else immediate update
    if (onAutoSave) {
      onAutoSave(item.id, { qty, rate, amount, agreed_amount: amount });
    } else {
      await onUpdate({ qty, rate, amount, agreed_amount: amount });
    }
    setEditing(false);
  };

  const startEdit = () => {
    setDraft({ qty: item.qty, rate: item.rate });
    setEditing(true);
  };

  const handleDisputeChange = async (newStatus) => {
    const history = [...(item.dispute_history || []), {
      timestamp: new Date().toISOString(),
      action: newStatus,
      note: disputeNote,
    }];
    await onUpdate({
      dispute_status: newStatus,
      dispute_note: disputeNote,
      dispute_history: history,
      ...(newStatus === 'agreed' ? { agreed_amount: item.amount } : {}),
    });
  };

  const handleCounterOffer = async () => {
    const history = [...(item.dispute_history || []), {
      timestamp: new Date().toISOString(),
      action: 'counter_offered',
      note: disputeNote,
      amount: item.amount,
    }];
    await onUpdate({
      dispute_status: 'counter_offered',
      dispute_note: disputeNote,
      dispute_history: history,
    });
  };

  const amount = item.dispute_status === 'rejected' ? 0 : (item.agreed_amount || item.amount || 0);

  // ── Mobile card layout ──
  if (mobile) {
    return (
      <div className={`px-3 py-3 space-y-2 transition ${selected ? 'bg-[#2E5A1A]/5' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {canSelect && (
              <button onClick={onSelect} className="flex-shrink-0 active:scale-95 transition">
                {selected ? <CheckSquare className="w-4 h-4 text-[#2E5A1A]" /> : <Square className="w-4 h-4 text-slate-300" />}
              </button>
            )}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${srcMeta.color} bg-slate-100 flex-shrink-0`}>
              <SrcIcon className="w-2.5 h-2.5" /> {srcMeta.label}
            </span>
            <p className="text-xs text-slate-700 font-medium break-words-mobile">{item.item}</p>
          </div>
          {canEdit && (item.is_manual || item.source === 'manual') && (
            <button onClick={onDelete} className="text-slate-400 hover:text-rose-600 transition flex-shrink-0 p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {item.source_date && (
          <p className="text-[10px] text-slate-400 pl-6">{new Date(item.source_date).toLocaleDateString('en-GB')}</p>
        )}
        <div className="flex items-center justify-between gap-2 pl-6">
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-slate-400">Qty: </span>
              {editing ? (
                <input
                  type="number"
                  value={draft.qty}
                  onChange={e => setDraft(p => ({ ...p, qty: e.target.value }))}
                  onBlur={saveEdit}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-right text-xs"
                  autoFocus
                />
              ) : (
                <span
                  className={`tabular-nums font-semibold ${canEdit ? 'cursor-pointer hover:bg-slate-100 rounded px-1' : ''} ${item.is_manual ? 'text-[#2E5A1A]' : 'text-slate-700'}`}
                  onClick={canEdit ? startEdit : undefined}
                >
                  {item.qty || '—'} {item.unit || ''}
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-400">Rate: </span>
              {editing ? (
                <input
                  type="number"
                  value={draft.rate}
                  onChange={e => setDraft(p => ({ ...p, rate: e.target.value }))}
                  onBlur={saveEdit}
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  className="w-20 px-1.5 py-0.5 border border-slate-200 rounded text-right text-xs"
                />
              ) : (
                <span
                  className={`tabular-nums font-semibold text-slate-700 ${canEdit ? 'cursor-pointer hover:bg-slate-100 rounded px-1' : ''}`}
                  onClick={canEdit ? startEdit : undefined}
                >
                  {fmt(item.rate)}
                </span>
              )}
            </div>
          </div>
          <span className={`text-sm font-bold tabular-nums ${item.dispute_status === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {fmt(amount)}
          </span>
        </div>
        {/* Dispute control */}
        {canDispute ? (
          <div className="flex items-center gap-2 pl-6">
            <select
              value={item.dispute_status || 'none'}
              onChange={e => handleDisputeChange(e.target.value)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${disputeMeta.border} ${disputeMeta.bg} ${disputeMeta.color} cursor-pointer`}
            >
              <option value="none">—</option>
              <option value="disputed">Disputed</option>
              <option value="counter_offered">Counter</option>
              <option value="agreed">Agreed</option>
              <option value="rejected">Rejected</option>
            </select>
            {item.dispute_status !== 'none' && (
              <button onClick={onToggleDispute} className="text-slate-400 hover:text-slate-700 text-[10px] font-semibold">
                {expanded ? 'Hide' : 'History'}
              </button>
            )}
          </div>
        ) : item.dispute_status !== 'none' && (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${disputeMeta.bg} ${disputeMeta.color} ml-6`}>
            {disputeMeta.label}
          </span>
        )}
        {/* Expanded dispute history */}
        {expanded && item.dispute_status !== 'none' && (
          <div className="pt-2 border-t border-slate-100 space-y-2 pl-6">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-1 flex-shrink-0" />
              <input
                type="text"
                placeholder="Add a dispute note…"
                value={disputeNote}
                onChange={e => setDisputeNote(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
              {item.dispute_status === 'disputed' && (
                <button onClick={handleCounterOffer} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">
                  Counter
                </button>
              )}
            </div>
            {item.dispute_history && item.dispute_history.length > 0 && (
              <div className="space-y-1">
                {item.dispute_history.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-400 tabular-nums flex-shrink-0">
                      {new Date(h.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className={`font-semibold ${DISPUTE_META[h.action]?.color || 'text-slate-600'}`}>
                      {DISPUTE_META[h.action]?.label || h.action}
                    </span>
                    {h.note && <span className="text-slate-500 truncate">— {h.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Desktop table row layout ──
  return (
    <>
      <tr className={`hover:bg-slate-50/50 group ${selected ? 'bg-[#2E5A1A]/5' : ''}`}>
        {/* Selection checkbox */}
        <td className="px-3 py-2">
          {canSelect && (
            <button onClick={onSelect} className="transition active:scale-95">
              {selected ? <CheckSquare className="w-4 h-4 text-[#2E5A1A]" /> : <Square className="w-4 h-4 text-slate-300" />}
            </button>
          )}
        </td>

        {/* Source */}
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            {(canDispute && item.dispute_status !== 'none') && (
              <button onClick={onToggleDispute} className="text-slate-400 hover:text-slate-700 transition">
                {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${srcMeta.color} bg-slate-100`}>
              <SrcIcon className="w-2.5 h-2.5" /> {srcMeta.label}
            </span>
          </div>
        </td>

        {/* Description */}
        <td className="px-3 py-2 text-slate-700 whitespace-normal break-words" title={item.item}>
          {item.item}
          {item.source_date && (
            <span className="block text-[9px] text-slate-400">{new Date(item.source_date).toLocaleDateString('en-GB')}</span>
          )}
        </td>

        {/* Unit */}
        <td className="text-right px-3 py-2 text-slate-500">{item.unit || '—'}</td>

        {/* Qty */}
        <td className="text-right px-3 py-2">
          {editing ? (
            <input
              type="number"
              value={draft.qty}
              onChange={e => setDraft(p => ({ ...p, qty: e.target.value }))}
              onBlur={saveEdit}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="w-16 px-1.5 py-1 border border-slate-200 rounded text-right text-xs"
              autoFocus
            />
          ) : (
            <span
              className={`tabular-nums ${canEdit ? 'cursor-pointer hover:bg-slate-100 rounded px-1' : ''} ${item.is_manual ? 'text-[#2E5A1A] font-semibold' : 'text-slate-600'}`}
              onClick={canEdit ? startEdit : undefined}
            >
              {item.qty || '—'}
            </span>
          )}
        </td>

        {/* Rate */}
        <td className="text-right px-3 py-2">
          {editing ? (
            <input
              type="number"
              value={draft.rate}
              onChange={e => setDraft(p => ({ ...p, rate: e.target.value }))}
              onBlur={saveEdit}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              className="w-20 px-1.5 py-1 border border-slate-200 rounded text-right text-xs"
            />
          ) : (
            <span
              className={`tabular-nums ${canEdit ? 'cursor-pointer hover:bg-slate-100 rounded px-1' : ''} text-slate-600`}
              onClick={canEdit ? startEdit : undefined}
            >
              {fmt(item.rate)}
            </span>
          )}
        </td>

        {/* Amount */}
        <td className={`text-right px-3 py-2 font-semibold tabular-nums ${item.dispute_status === 'rejected' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {fmt(amount)}
        </td>

        {/* Dispute status */}
        <td className="text-center px-3 py-2">
          {canDispute ? (
            <select
              value={item.dispute_status || 'none'}
              onChange={e => handleDisputeChange(e.target.value)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${disputeMeta.border} ${disputeMeta.bg} ${disputeMeta.color} cursor-pointer`}
            >
              <option value="none">—</option>
              <option value="disputed">Disputed</option>
              <option value="counter_offered">Counter</option>
              <option value="agreed">Agreed</option>
              <option value="rejected">Rejected</option>
            </select>
          ) : (
            item.dispute_status !== 'none' && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${disputeMeta.bg} ${disputeMeta.color}`}>
                {disputeMeta.label}
              </span>
            )
          )}
        </td>

        {/* Delete */}
        <td className="text-right px-2 py-2">
          {canEdit && (item.is_manual || item.source === 'manual') && (
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>

      {/* Expanded dispute history */}
      {expanded && item.dispute_status !== 'none' && (
        <tr className="bg-slate-50/70">
          <td colSpan={9} className="px-4 py-3">
            <div className="space-y-2">
              {/* Dispute note input */}
              <div className="flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-1.5 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Add a dispute note…"
                  value={disputeNote}
                  onChange={e => setDisputeNote(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
                {item.dispute_status === 'disputed' && (
                  <button
                    onClick={handleCounterOffer}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                  >
                    Counter-Offer
                  </button>
                )}
              </div>

              {/* History */}
              {item.dispute_history && item.dispute_history.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Negotiation History</p>
                  {item.dispute_history.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-slate-400 tabular-nums flex-shrink-0">
                        {new Date(h.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`font-semibold ${DISPUTE_META[h.action]?.color || 'text-slate-600'}`}>
                        {DISPUTE_META[h.action]?.label || h.action}
                      </span>
                      {h.amount != null && <span className="text-slate-600 tabular-nums">{fmt(h.amount)}</span>}
                      {h.note && <span className="text-slate-500">— {h.note}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Original vs Agreed */}
              {item.dispute_status !== 'none' && (
                <div className="flex items-center gap-4 text-xs pt-1">
                  <div>
                    <span className="text-slate-400">Original: </span>
                    <span className="font-semibold text-slate-700 tabular-nums">{fmt(item.original_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Agreed: </span>
                    <span className="font-semibold text-emerald-700 tabular-nums">{fmt(item.agreed_amount || item.amount)}</span>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}