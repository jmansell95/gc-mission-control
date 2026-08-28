import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

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
export default function BackButton({ fallback = '/', label = 'Back', className = '' }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const state = window.history.state;
    const hasHistory = state && typeof state.idx === 'number' && state.idx > 0;
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition active:scale-[0.97] ${className}`}
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </button>
  );
}