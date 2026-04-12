'use client';

import React from 'react';

interface GexHeatmapProps {
  data: any[]; // Strikes with multi-expiry data or aggregated
}

export default function GexHeatmap({ data }: GexHeatmapProps) {
  if (!data || data.length === 0) return <div className="text-zinc-600">No data</div>;

  // For a true heatmap, we usually need [Expiry x Strike] matrix.
  // We'll simplify this to a "Relative Exposure Intensity" across strikes.
  const maxAbsGex = Math.max(...data.map(s => Math.abs(s.gex)));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[8px] text-zinc-600 uppercase font-bold tracking-widest mb-2">
         <span>Out the Money</span>
         <span>Strike Ladder</span>
         <span>In the Money</span>
      </div>
      <div className="grid grid-cols-1 gap-[2px]">
        {data.sort((a, b) => b.strike - a.strike).slice(0, 40).map((s, i) => {
          const intensity = (Math.abs(s.gex) / maxAbsGex) * 100;
          const color = s.gex >= 0 ? `rgba(96, 165, 250, ${intensity / 100})` : `rgba(251, 146, 60, ${intensity / 100})`;
          
          return (
            <div key={i} className="flex items-center gap-2 h-4 text-[9px] font-mono">
              <div className="w-12 text-zinc-500 text-right">{s.strike}</div>
              <div 
                className="flex-1 h-full rounded-sm transition-all duration-500"
                style={{ backgroundColor: color, borderLeft: `2px solid ${s.gex >= 0 ? '#60a5fa' : '#fb923c'}` }}
              >
                {intensity > 30 && (
                   <span className="px-2 text-white opacity-40">
                      {Math.abs(s.gex / 1e6).toFixed(1)}M
                   </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
