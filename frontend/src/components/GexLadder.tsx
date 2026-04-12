'use client';

import React from 'react';

interface GexLadderProps {
  strikes: any[];
  levels: any;
  spot: number;
}

export default function GexLadder({ strikes, levels, spot }: GexLadderProps) {
  if (!strikes || strikes.length === 0) return null;

  // Filter strikes around spot (+/- 20 strikes)
  const sorted = strikes.sort((a, b) => b.strike - a.strike);
  const spotIdx = sorted.findIndex(s => s.strike <= spot);
  const ladder = sorted.slice(Math.max(0, spotIdx - 15), Math.min(sorted.length, spotIdx + 25));

  const isLevel = (strike: number) => {
    if (Math.abs(strike - levels?.gammaFlip) < 1) return { name: 'FLIP', color: 'bg-emerald-500' };
    if (strike === levels?.callWall) return { name: 'CALL WALL', color: 'bg-blue-500' };
    if (strike === levels?.putWall) return { name: 'PUT WALL', color: 'bg-orange-600' };
    if (strike === levels?.vannaMagnet) return { name: 'VANNA', color: 'bg-purple-500' };
    return null;
  };

  return (
    <div className="bg-zinc-900/20 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 tracking-tighter">
        Live Price Ladder
      </div>
      <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
        {ladder.map((s, i) => {
          const level = isLevel(s.strike);
          const isAtSpot = Math.abs(s.strike - spot) < 2;

          return (
            <div key={i} className={`flex items-center h-10 border-b border-zinc-900/50 hover:bg-zinc-800/30 transition-colors ${isAtSpot ? 'bg-zinc-800/40' : ''}`}>
              <div className="w-16 text-center text-xs font-mono text-zinc-400 border-r border-zinc-800/50">
                {s.strike}
              </div>
              <div className="flex-1 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {level && (
                    <span className={`${level.color} text-black text-[9px] font-bold px-1 rounded`}>
                      {level.name}
                    </span>
                  )}
                  {isAtSpot && <span className="text-zinc-500 text-[10px] animate-pulse">SPOT</span>}
                </div>
                <div className="text-[10px] font-mono text-zinc-700">
                  {Math.abs(s.gex / 1e6).toFixed(1)}M
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
