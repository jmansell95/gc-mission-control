import { useRef, useCallback, useState } from 'react';

/**
 * useAutoSave — debounced auto-save for entity line items.
 *
 * Returns:
 *  - saveStatus: 'idle' | 'saving' | 'saved'
 *  - scheduleSave(id, updates): queue a debounced update (~1s after last call)
 *  - flushPending(): await any pending save immediately (call on AFP switch)
 *  - pendingCount: number of items with unsaved edits
 *
 * Usage:
 *   const { saveStatus, scheduleSave, flushPending } = useAutoSave(base44.entities.AFPLineItem, queryClient, queryKey);
 *   scheduleSave(item.id, { qty: 5, rate: 100 });
 *   await flushPending(); // before switching AFP
 */
export default function useAutoSave(entityClient, queryClient, queryKey) {
  const pendingRef = useRef(new Map()); // id -> updates
  const timerRef = useRef(null);
  const savingRef = useRef(Promise.resolve());
  const [saveStatus, setSaveStatus] = useState('idle');
  const [pendingCount, setPendingCount] = useState(0);

  const flushPending = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    setSaveStatus('saving');

    // Use bulkUpdate for efficiency — different updates per record
    const bulkPayload = entries.map(([id, updates]) => ({ id, ...updates }));
    try {
      await entityClient.bulkUpdate(bulkPayload);
      // Only clear pending once the save has actually landed on the server
      for (const [id] of entries) pending.delete(id);
      setPendingCount(pending.size);
      if (queryClient && queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (e) {
      // Keep the pending edits so they aren't lost — user can retry or switch back
      console.error('Auto-save failed:', e);
      setSaveStatus('idle');
    }
  }, [entityClient, queryClient, queryKey]);

  const scheduleSave = useCallback((id, updates) => {
    pendingRef.current.set(id, { ...(pendingRef.current.get(id) || {}), ...updates });
    setPendingCount(pendingRef.current.size);
    setSaveStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushPending();
    }, 1000);
  }, [flushPending]);

  return { saveStatus, scheduleSave, flushPending, pendingCount };
}