import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Phone, Mail, User } from 'lucide-react';

/**
 * ExpandableContacts — shows a count badge ("3 contacts") that expands
 * on tap to reveal each contact's name, role, phone and email.
 * Used by Client, Subcontractor and Agency cards for a consistent display.
 */
export default function ExpandableContacts({ contacts = [], label = 'contact' }) {
  const [expanded, setExpanded] = useState(false);
  const list = Array.isArray(contacts) ? contacts : [];
  const count = list.length;

  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition active:scale-95"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {count} {label}{count !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 animate-slide-up">
          {list.map((c, i) => (
            <div key={i} className="text-xs space-y-0.5 pl-2 border-l-2 border-slate-100">
              {c.name && (
                <p className="flex items-center gap-1 font-medium text-slate-700">
                  <User className="w-2.5 h-2.5 text-slate-400" /> {c.name}
                </p>
              )}
              {c.role && <p className="text-slate-400 text-[10px] pl-3.5">{c.role}</p>}
              {c.phone && (
                <p className="flex items-center gap-1 text-slate-500">
                  <Phone className="w-2.5 h-2.5 text-slate-400" /> {c.phone}
                </p>
              )}
              {c.email && (
                <p className="flex items-center gap-1 text-slate-500 truncate">
                  <Mail className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" /> {c.email}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}