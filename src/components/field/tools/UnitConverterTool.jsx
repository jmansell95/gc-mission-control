import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, Ruler, Thermometer, Beaker, Weight } from 'lucide-react';

const CATEGORIES = [
  { id: 'length', label: 'Length', icon: Ruler, gradient: 'stat-gradient-cyan',
    units: [
      { id: 'mm', label: 'mm', factor: 0.001 },
      { id: 'cm', label: 'cm', factor: 0.01 },
      { id: 'm', label: 'm', factor: 1 },
      { id: 'km', label: 'km', factor: 1000 },
      { id: 'in', label: 'inch', factor: 0.0254 },
      { id: 'ft', label: 'ft', factor: 0.3048 },
    ],
  },
  { id: 'temp', label: 'Temperature', icon: Thermometer, gradient: 'stat-gradient-rose',
    units: [{ id: 'C', label: '°C' }, { id: 'F', label: '°F' }, { id: 'K', label: 'K' }],
    custom: true,
  },
  { id: 'volume', label: 'Volume', icon: Beaker, gradient: 'stat-gradient-violet',
    units: [
      { id: 'ml', label: 'ml', factor: 0.001 },
      { id: 'L', label: 'L', factor: 1 },
      { id: 'gal', label: 'gal (US)', factor: 3.78541 },
      { id: 'gal_uk', label: 'gal (UK)', factor: 4.54609 },
      { id: 'pt', label: 'pint', factor: 0.568261 },
    ],
  },
  { id: 'weight', label: 'Weight', icon: Weight, gradient: 'stat-gradient-amber',
    units: [
      { id: 'g', label: 'g', factor: 0.001 },
      { id: 'kg', label: 'kg', factor: 1 },
      { id: 't', label: 'tonne', factor: 1000 },
      { id: 'lb', label: 'lb', factor: 0.453592 },
      { id: 'oz', label: 'oz', factor: 0.0283495 },
    ],
  },
];

function convertTemp(val, from, to) {
  let c;
  if (from === 'C') c = val;
  else if (from === 'F') c = (val - 32) * 5 / 9;
  else c = val - 273.15;
  if (to === 'C') return c;
  if (to === 'F') return c * 9 / 5 + 32;
  return c + 273.15;
}

export default function UnitConverterTool({ onClose }) {
  const [catId, setCatId] = useState('length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [input, setInput] = useState('1');
  const cat = CATEGORIES.find(c => c.id === catId);

  const switchCategory = (id) => {
    const c = CATEGORIES.find(x => x.id === id);
    setCatId(id);
    setFromUnit(c.units[0].id);
    setToUnit(c.units[1]?.id || c.units[0].id);
  };

  const result = (() => {
    const val = parseFloat(input) || 0;
    if (cat.custom) return convertTemp(val, fromUnit, toUnit);
    const from = cat.units.find(u => u.id === fromUnit);
    const to = cat.units.find(u => u.id === toUnit);
    return (val * from.factor) / to.factor;
  })();

  const swap = () => { setFromUnit(toUnit); setToUnit(fromUnit); };

  const CatIcon = cat.icon;

  return (
    <div className="min-h-full flex flex-col">
      <div className={`${cat.gradient} rounded-3xl m-4 p-5 text-white flex items-center gap-3`}>
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Unit Converter</h1>
      </div>

      {/* Category selector */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map(c => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => switchCategory(c.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                catId === c.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-4 space-y-4">
        {/* Input */}
        <div className="field-card p-4">
          <select
            value={fromUnit}
            onChange={e => setFromUnit(e.target.value)}
            className="w-full bg-transparent text-sm font-bold text-slate-500 mb-2 outline-none"
          >
            {cat.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <input
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full text-4xl font-bold text-slate-800 bg-transparent outline-none"
            placeholder="0"
          />
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <motion.button whileTap={{ scale: 0.85, rotate: 180 }} onClick={swap} className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-lg">
            <ArrowLeftRight className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Result */}
        <div className="field-card p-4">
          <select
            value={toUnit}
            onChange={e => setToUnit(e.target.value)}
            className="w-full bg-transparent text-sm font-bold text-slate-500 mb-2 outline-none"
          >
            {cat.units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <AnimatePresence mode="wait">
            <motion.p
              key={`${catId}-${fromUnit}-${toUnit}-${input}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-cyan-600"
            >
              {result.toFixed(4).replace(/\.?0+$/, '')}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}