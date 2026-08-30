import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import AutopilotToastBanner from '@/components/autopilot/AutopilotToastBanner';

const AutopilotToastContext = createContext(null);

/**
 * AutopilotToastProvider — subscribes to SystemAuditLog create events and
 * surfaces autonomous-agent decisions as subtle toast banners with an
 * 'Autopilot' badge and a one-tap 'Review' action. Never blocks the UI
 * (no modal interruptions). Tapping 'Review' navigates to the Autopilot
 * Control panel.
 */
export function AutopilotToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('gc-autopilot-dismissed') || '[]')); }
    catch { return new Set(); }
  });

  const pushToast = useCallback((decision) => {
    setToasts(prev => {
      // De-dup by audit log id
      if (prev.find(t => t.id === decision.id)) return prev;
      return [...prev, decision].slice(-5); // keep last 5
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem('gc-autopilot-dismissed', JSON.stringify([...next].slice(-50))); } catch {}
      return next;
    });
  }, []);

  // Subscribe to SystemAuditLog create events — autonomous decisions arrive
  // as new audit entries with source 'scheduled' or actor_name starting with
  // 'Autopilot' / 'Agent'.
  useEffect(() => {
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.SystemAuditLog.subscribe((event) => {
        if (event.type !== 'create') return;
        const entry = event.data;
        if (!entry) return;
        // Only surface autonomous decisions
        const isAutopilot =
          entry.source === 'scheduled' ||
          entry.source === 'entity_automation' && entry.actor_name?.toLowerCase().includes('auto') ||
          entry.actor_name?.toLowerCase().startsWith('autopilot') ||
          entry.actor_name?.toLowerCase().startsWith('agent');
        if (!isAutopilot) return;
        if (dismissedIds.has(entry.id)) return;
        pushToast({
          id: entry.id,
          actor: entry.actor_name || 'Autopilot',
          summary: entry.record_summary || 'Autonomous action taken',
          action: entry.action,
          entity: entry.entity_name,
          timestamp: entry.created_date,
        });
      });
    } catch { /* subscription not available — silent */ }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [pushToast, dismissedIds]);

  return (
    <AutopilotToastContext.Provider value={{ pushToast, dismiss }}>
      {children}
      <AutopilotToastBanner toasts={toasts} onDismiss={dismiss} />
    </AutopilotToastContext.Provider>
  );
}

export function useAutopilotToast() {
  const ctx = useContext(AutopilotToastContext);
  return ctx || { pushToast: () => {}, dismiss: () => {} };
}