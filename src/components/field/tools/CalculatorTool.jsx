import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator, Delete } from 'lucide-react';

export default function CalculatorTool({ onClose }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const inputDigit = (d) => {
    if (waiting) { setDisplay(d); setWaiting(false); }
    else setDisplay(display === '0' ? d : display + d);
  };

  const inputDecimal = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); }
    else if (!display.includes('.')) setDisplay(display + '.');
  };

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false); };

  const doOp = (nextOp) => {
    const current = parseFloat(display);
    if (prev === null) { setPrev(current); }
    else if (op) {
      const result = compute(prev, current, op);
      setDisplay(String(result));
      setPrev(result);
    }
    setOp(nextOp);
    setWaiting(true);
  };

  const compute = (a, b, op) => {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const current = parseFloat(display);
    const result = compute(prev, current, op);
    setDisplay(String(parseFloat(result.toFixed(8))));
    setPrev(null);
    setOp(null);
    setWaiting(true);
  };

  const keys = [
    ['C', '÷', '×', '⌫'],
    ['7', '8', '9', '−'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '0', '0'],
  ];

  const handleKey = (k) => {
    if (k === 'C') return clear();
    if (k === '⌫') return setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
    if (['+', '−', '×', '÷'].includes(k)) return doOp(k);
    if (k === '=') return equals();
    if (k === '.') return inputDecimal();
    return inputDigit(k);
  };

  // Flatten to a clean grid
  const grid = [
    { label: 'C', type: 'fn', color: 'bg-rose-500 text-white' },
    { label: '⌫', type: 'fn', color: 'bg-slate-200 text-slate-700' },
    { label: '÷', type: 'op', color: 'bg-slate-200 text-slate-700' },
    { label: '×', type: 'op', color: 'bg-slate-200 text-slate-700' },
    { label: '7', type: 'num' }, { label: '8', type: 'num' }, { label: '9', type: 'num' },
    { label: '−', type: 'op', color: 'bg-slate-200 text-slate-700' },
    { label: '4', type: 'num' }, { label: '5', type: 'num' }, { label: '6', type: 'num' },
    { label: '+', type: 'op', color: 'bg-slate-200 text-slate-700' },
    { label: '1', type: 'num' }, { label: '2', type: 'num' }, { label: '3', type: 'num' },
    { label: '=', type: 'eq', color: 'stat-gradient-slate text-white' },
    { label: '0', type: 'num', wide: true }, { label: '.', type: 'num' },
  ];

  return (
    <div className="min-h-full flex flex-col">
      <div className="stat-gradient-slate rounded-3xl m-4 p-5 text-white flex items-center gap-3">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center active:scale-90 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Calculator</h1>
      </div>

      {/* Display */}
      <div className="mx-4 mb-4 field-card p-6 text-right">
        {prev !== null && op && <p className="text-sm text-slate-400">{prev} {op}</p>}
        <motion.p key={display} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-5xl font-bold text-slate-800 truncate">
          {display}
        </motion.p>
      </div>

      {/* Keypad */}
      <div className="flex-1 px-4 pb-4">
        <div className="grid grid-cols-4 gap-2.5">
          {grid.map((key) => (
            <motion.button
              key={key.label}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              onClick={() => handleKey(key.label)}
              className={`h-16 rounded-2xl font-bold text-lg shadow-sm flex items-center justify-center ${
                key.color || 'bg-white text-slate-800'
              } ${key.wide ? 'col-span-2' : ''}`}
            >
              {key.label === '⌫' ? <Delete className="w-5 h-5" /> : key.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}