'use client';

import React from 'react';

interface OptionChainTableProps {
  data: any[];
}

export default function OptionChainTable({ data }: OptionChainTableProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-x-auto">
      <table className="w-full text-left text-[10px] font-mono border-collapse">
        <thead>
          <tr className="bg-zinc-900/50 text-zinc-500 uppercase tracking-tighter border-b border-zinc-800">
            <th className="px-4 py-3">Expiry</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Strike</th>
            <th className="px-4 py-3 text-right">Delta</th>
            <th className="px-4 py-3 text-right">Gamma</th>
            <th className="px-4 py-3 text-right">Vanna</th>
            <th className="px-4 py-3 text-right">IV</th>
            <th className="px-4 py-3 text-right">GEX</th>
            <th className="px-4 py-3 text-right">OI</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-b border-zinc-900/50 hover:bg-zinc-900 transition-colors">
              <td className="px-4 py-2 text-zinc-400">{row.expiry}</td>
              <td className={`px-4 py-2 font-bold ${row.type === 'call' ? 'text-blue-500' : 'text-orange-500'}`}>
                {row.type.toUpperCase()}
              </td>
              <td className="px-4 py-2 text-white font-bold">{row.strike}</td>
              <td className="px-4 py-2 text-right text-zinc-400">{row.delta?.toFixed(3)}</td>
              <td className="px-4 py-2 text-right text-zinc-400">{row.gamma?.toFixed(4)}</td>
              <td className="px-4 py-2 text-right text-zinc-400">{row.vanna?.toFixed(4)}</td>
              <td className="px-4 py-2 text-right text-purple-400">{(row.iv * 100).toFixed(1)}%</td>
              <td className={`px-4 py-2 text-right font-bold ${row.gex >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                {(row.gex / 1e6).toFixed(2)}M
              </td>
              <td className="px-4 py-2 text-right text-zinc-500">{row.openInterest?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
         <div className="p-4 text-center text-[10px] text-zinc-600 italic">
            Displaying first 100 of {data.length} contracts...
         </div>
      )}
    </div>
  );
}
