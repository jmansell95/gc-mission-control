import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const fmt = (n) => {
  const v = Number(n || 0);
  if (isNaN(v)) return '—';
  return '£' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
};

/**
 * EditableCell — inline-editable table cell. Shows the value as text; on click
 * becomes an input. On blur or Enter, calls onSave(newValue). Shows a spinner
 * while saving. Used across CVR line items, variations, and AFP tables.
 */
export default function EditableCell({ value, onSave, type = 'number', prefix = '£', className = '', displayFn, editable = true }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setVal(value ?? '');
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    setEditing(false);
    const newVal = type === 'number' ? parseFloat(val) || 0 : val;
    if (newVal === value) return;
    setSaving(true);
    try {
      await onSave(newVal);
    } catch (e) {
      setVal(value ?? '');
    }
    setSaving(false);
  };

  const displayValue = displayFn ? displayFn(value) : (type === 'number' ? fmt(value) : (value || '—'));

  if (!editable) {
    return <span className={`tabular-nums ${className}`}>{displayValue}</span>;
  }

  if (saving) {
    return <span className={`inline-flex items-center gap-1 ${className}`}><Loader2 className="w-3 h-3 animate-spin text-slate-400" /></span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === 'number' ? 'number' : 'text'}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setVal(value ?? ''); } }}
        className={`w-full bg-white border border-primary rounded px-1.5 py-0.5 text-xs tabular-nums outline-none ${className}`}
        step={type === 'number' ? '0.01' : undefined}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 rounded px-1 -mx-1 py-0.5 transition tabular-nums ${className}`}
    >
      {displayValue}
    </span>
  );
}