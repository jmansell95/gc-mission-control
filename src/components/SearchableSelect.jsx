import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

/**
 * SearchableSelect — a combobox dropdown with text search filtering.
 * Replaces bare <select> elements that have too many options to scroll through.
 *
 * Props:
 *   value: string — currently selected value
 *   onChange: (value) => void — called when an option is selected
 *   options: [{ value, label }] — the options to choose from
 *   placeholder: string — placeholder text when nothing selected
 *   searchPlaceholder: string — placeholder text in the search box
 *   emptyText: string — text shown when no options match the search
 *   className: string — extra classes for the trigger button
 *   disabled: boolean
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Choose…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found',
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => (o.label || '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        onChange(filtered[highlightIdx].value);
        setOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlightIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left transition ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-400 cursor-pointer'
        } ${open ? 'border-primary ring-2 ring-primary/10' : ''}`}
      >
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="relative border-b border-slate-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2.5 text-sm border-0 focus:outline-none focus:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">{emptyText}</p>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  data-idx={i}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition ${
                    i === highlightIdx ? 'bg-primary/5' : 'hover:bg-slate-50'
                  } ${opt.value === value ? 'font-semibold text-primary' : 'text-slate-700'}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && <Check className="w-4 h-4 flex-shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}