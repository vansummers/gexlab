'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';

interface GexStrikeChartProps {
  data: any[];
}

export default function GexStrikeChart({ data }: GexStrikeChartProps) {
  if (!data || data.length === 0) return <div className="text-zinc-600">No data available</div>;

  // Filter strikes close to current price for better visibility (e.g. within 10% or most active)
  const chartData = data
    .sort((a, b) => a.strike - b.strike)
    .map(s => ({
      strike: s.strike,
      gex: s.gex,
      dex: s.dex,
      oi: s.openInterest
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-2xl">
          <p className="text-zinc-400 text-[10px] font-bold uppercase mb-1">Strike {label}</p>
          <p className={`text-sm font-mono ${payload[0].value >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
            GEX: ${(payload[0].value / 1e6).toFixed(2)}M
          </p>
          <p className="text-xs text-zinc-500 font-mono">
            OI: {payload[0].payload.oi.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="strike" 
            stroke="#52525b" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a', opacity: 0.4 }} />
          <ReferenceLine y={0} stroke="#3f3f46" />
          <Bar dataKey="gex">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.gex >= 0 ? '#60a5fa' : '#fb923c'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
