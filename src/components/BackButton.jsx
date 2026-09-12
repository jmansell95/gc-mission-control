import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { resolveBackFallback } from '@/utils/backFallback';

/**
 * Universal BackButton — appears in every hub/page header.
 *
 * Uses browser history (react-router's navigate(-1)) when there's a real
 * previous entry to return to; otherwise falls back to a provided route.
 * React Router v6 stores the current history index in window.history.state.idx,
 * so idx > 0 means there's a page to go back to.
 *
 * Props:
 *  - fallback: route to navigate to when there's no history (default '/')
 *  - label: button text (default 'Back')
 *  - className: extra classes
 */
export default function BackButton({ fallback, label = 'Back', className = '' }) {
  const navigate = useNavigate();
  const resolvedFallback = fallback || resolveBackFallback(window.location.pathname);

  const handleClick = () => {
    const state = window.history.state;
    const hasHistory = state && typeof state.idx === 'number' && state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(resolvedFallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 h-9 px-3 rounded-xl text-ui-caption font-semibold text-slate-500 hover:text-primary hover:bg-primary/5 transition active:scale-[0.97] ${className}`}
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </button>
  );
}