import React from 'react';

const catBadgeConfig = {
  hired_equipment: { label: 'Hired', cls: 'bg-amber-100 text-amber-700' },
  purchased_equipment: { label: 'Purchased', cls: 'bg-purple-100 text-purple-700' },
  internal_equipment: { label: 'Internal', cls: 'bg-blue-100 text-blue-700' },
  labour: { label: 'Labour', cls: 'bg-emerald-100 text-emerald-700' },
  contractor_supplied: { label: 'Contractor', cls: 'bg-indigo-100 text-indigo-700' },
  client_supplied: { label: 'Client', cls: 'bg-slate-100 text-slate-600' },
};

export function CategoryBadge({ category }) {
  const cfg = catBadgeConfig[category];
  if (!cfg) return null;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function CategoryBadges({ items }) {
  const categories = [...new Set((items || []).map(i => i.category).filter(Boolean))];
  if (categories.length === 0) return null;
  return (
    <>
      {categories.map(cat => <CategoryBadge key={cat} category={cat} />)}
    </>
  );
}