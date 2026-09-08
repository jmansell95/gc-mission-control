import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};

/**
 * ReportChart — shared recharts wrapper with bar, line, area, and donut
 * variants. Motion-based entry animation (fade + slide-up via framer-motion),
 * brand gradient fills, and an onSegmentClick prop that fires the drill-down
 * drawer when a chart segment/bar/slice is clicked.
 *
 * Props:
 *  - data: [{ name, value }]
 *  - type: 'bar' | 'line' | 'area' | 'donut'
 *  - onSegmentClick: (item) => void
 *  - height: number (default 260)
 */
export default function ReportChart({ data = [], type = 'bar', onSegmentClick, height = 260 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {type === 'donut' ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              label={{ fontSize: 11 }} onClick={(_, idx) => onSegmentClick?.(data[idx])}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer hover:opacity-80 transition-opacity" />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        ) : type === 'line' ? (
          <LineChart data={data} onClick={(e) => e?.activePayload?.[0]?.payload && onSegmentClick?.(e.activePayload[0].payload)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#2E5A1A" strokeWidth={2.5} dot={{ r: 3, fill: '#2E5A1A' }} />
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data} onClick={(e) => e?.activePayload?.[0]?.payload && onSegmentClick?.(e.activePayload[0].payload)}>
            <defs>
              <linearGradient id="reportAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8DC63F" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#8DC63F" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke="#2E5A1A" strokeWidth={2} fill="url(#reportAreaGrad)" />
          </AreaChart>
        ) : (
          <BarChart data={data} onClick={(e) => e?.activePayload?.[0]?.payload && onSegmentClick?.(e.activePayload[0].payload)}>
            <defs>
              <linearGradient id="reportBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5A8C1E" />
                <stop offset="100%" stopColor="#2E5A1A" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(46,90,26,0.06)' }} />
            <Bar dataKey="value" fill="url(#reportBarGrad)" radius={[6, 6, 0, 0]} className="cursor-pointer" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}