'use client';

import { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, BarChart3, Layers, Globe } from 'lucide-react';
import GexStrikeChart from '../components/GexStrikeChart';
import IvSkewChart from '../components/IvSkewChart';
import IvSurface from '../components/IvSurface';
import GexHeatmap from '../components/GexHeatmap';
import GexLadder from '../components/GexLadder';
import OptionChainTable from '../components/OptionChainTable';

export default function Home() {
  const [status, setStatus] = useState<{ status: string; service: string; polling: boolean } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'exposure' | 'vol' | 'table'>('exposure');

  const handleCopy = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/metrics/bridge');
      const data = await res.json();
      if (data.payload) {
        await navigator.clipboard.writeText(data.payload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy bridge payload');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const healthRes = await fetch('http://localhost:8000/api/health');
        if (!healthRes.ok) throw new Error('Backend unreachable');
        const healthData = await healthRes.json();
        setStatus(healthData);

        const analyticsRes = await fetch('http://localhost:8000/api/metrics/analytics');
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        }
        setError(null);
      } catch (err) {
        setError('Backend is offline.');
        setStatus(null);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center bg-zinc-900/10 p-4 rounded-2xl border border-zinc-800/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Activity size={24} className="text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase italic">GexLab v2</h1>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1"><Globe size={10} /> SPY</span>
              <span className="w-1 h-1 rounded-full bg-zinc-800" />
              <span>Real-time Quant Suite</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">SPOT PRICE</p>
              <p className="text-xl font-mono font-bold tracking-tighter text-zinc-100">
                 {analytics?.summary?.spotPrice?.toFixed(2) || '---'}
              </p>
           </div>
           <button 
              onClick={handleCopy}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all border ${
                copied 
                  ? 'bg-emerald-500 text-black border-emerald-400 scale-95' 
                  : 'bg-white text-black border-white hover:bg-zinc-200 shadow-xl shadow-white/5'
              }`}
            >
              {copied ? '✓ COPIED' : 'COPY TV PAYLOAD'}
            </button>
        </div>
      </header>

      <main className="space-y-6">
        {/* Top Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           {/* Regime & Total GEX */}
           <div className="lg:col-span-1 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Market Regime</p>
                <div className={`text-4xl font-black tracking-tighter uppercase italic ${analytics?.summary?.totalNetGex > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                   {analytics?.summary?.totalNetGex > 0 ? 'Stable' : 'Volatile'}
                </div>
                <p className="text-[10px] text-zinc-600 mt-2 font-medium leading-relaxed uppercase">
                  {analytics?.summary?.totalNetGex > 0 
                    ? "Dealers Long Gamma. Volatility Suppressed." 
                    : "Dealers Short Gamma. Volatility Amplified."}
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-zinc-800/50">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Total Net GEX</p>
                 <p className={`text-2xl font-mono font-black ${analytics?.summary?.totalNetGex > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                    ${(analytics?.summary?.totalNetGex / 1e9).toFixed(2)}B
                 </p>
              </div>
           </div>

           {/* Metrics Grid */}
           <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
              <AnalyticsCard title="Net DEX" value={analytics?.summary?.totalNetDex} unit="B" desc="Delta Risk" />
              <AnalyticsCard title="Vanna" value={analytics?.strikes?.reduce((a:any, s:any) => a + s.vex, 0)} unit="M" desc="Vol Sensitivity" />
              <AnalyticsCard title="Charm" value={analytics?.strikes?.reduce((a:any, s:any) => a + s.chex, 0)} unit="M" desc="Time Decay" />
              <AnalyticsCard title="ATM IV" value={analytics?.summary?.riskFreeRate * 100} unit="%" desc="Treasury Yld" />
              
              <LevelTinyCard label="Gamma Flip" value={analytics?.levels?.gammaFlip} color="text-emerald-400" />
              <LevelTinyCard label="Call Wall" value={analytics?.levels?.callWall} color="text-blue-400" />
              <LevelTinyCard label="Put Wall" value={analytics?.levels?.putWall} color="text-orange-500" />
              <LevelTinyCard label="Max Pain" value={analytics?.levels?.maxPain} color="text-zinc-500" />
           </div>
        </div>

        {/* Workspace Hub */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
           {/* Sidebar: Ladder */}
           <div className="xl:col-span-3 hidden xl:block">
              <GexLadder strikes={analytics?.strikes} levels={analytics?.levels} spot={analytics?.summary?.spotPrice} />
           </div>

           {/* Central Hub */}
           <div className="xl:col-span-9 space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-zinc-900/50 border border-zinc-800 w-fit rounded-xl">
                 <TabBtn active={activeTab === 'exposure'} onClick={() => setActiveTab('exposure')} label="Exposure Engine" />
                 <TabBtn active={activeTab === 'vol'} onClick={() => setActiveTab('vol')} label="Volatility Studio" />
                 <TabBtn active={activeTab === 'table'} onClick={() => setActiveTab('table')} label="Option Chain" />
              </div>

              {/* Viewports */}
              <div className="min-h-[600px]">
                 {activeTab === 'exposure' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                       <div className="lg:col-span-2 space-y-6">
                          <VisualSection title="GEX Distribution" sub="Institutional Net Exposure by Strike">
                             <GexStrikeChart data={analytics?.strikes} />
                          </VisualSection>
                          <VisualSection title="Volatility Skew" sub="IV Smile Concentration (Strike vs Implied Vol)">
                             <IvSkewChart data={analytics?.strikes} />
                          </VisualSection>
                       </div>
                       <div className="lg:col-span-1">
                          <VisualSection title="GEX Heatmap" sub="Relative Strike Intensity">
                             <GexHeatmap data={analytics?.strikes} />
                          </VisualSection>
                       </div>
                    </div>
                 )}

                 {activeTab === 'vol' && (
                    <div className="space-y-6">
                        <VisualSection title="3D Volatility Surface" sub="Implied Volatility across Price and Time (Strike x Expiry)">
                           <IvSurface surfaceData={analytics?.surface} />
                        </VisualSection>
                        <div className="grid grid-cols-2 gap-6">
                           <VisualSection title="Zero-Coeff GEX" sub="Magnitude Clusters">
                              <div className="h-40 bg-zinc-900/20 rounded-xl border border-zinc-800/50 flex items-center justify-center text-zinc-600 text-xs font-mono italic">
                                 Analyzing Gamma Topography...
                              </div>
                           </VisualSection>
                           <VisualSection title="Regime Profile" sub="Mean Reversion vs Trend">
                              <div className="h-40 bg-zinc-900/20 rounded-xl border border-zinc-800/50 flex items-center justify-center text-zinc-600 text-xs font-mono italic">
                                 Calculating Mechanial Flow Probabilities...
                              </div>
                           </VisualSection>
                        </div>
                    </div>
                 )}

                 {activeTab === 'table' && (
                    <div className="space-y-4">
                       <div className="flex justify-between items-center">
                          <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Full Option Chain Data</h2>
                          <span className="text-zinc-600 text-[9px] font-mono">{analytics?.raw?.length} Contracts Parsed</span>
                       </div>
                       <OptionChainTable data={analytics?.raw} />
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>

      <footer className="mt-20 pt-8 border-t border-zinc-900 text-zinc-700 text-[9px] font-bold uppercase tracking-widest flex justify-between items-center">
        <p>© 2026 GexLab Quants • TradingView Bridge v2.0</p>
        <div className="flex gap-4">
           <span>Status: <span className={status ? 'text-emerald-500' : 'text-red-500'}>{status ? 'OPERATIONAL' : 'OFFLINE'}</span></span>
           <span>Latency: 12ms</span>
        </div>
      </footer>
    </div>
  );
}

function AnalyticsCard({ title, value, unit, desc }: any) {
  const isPos = value >= 0;
  const displayVal = Math.abs(value || 0);
  let formatted = displayVal.toLocaleString();
  if (displayVal >= 1e9) formatted = (displayVal / 1e9).toFixed(2);
  else if (displayVal >= 1e6) formatted = (displayVal / 1e6).toFixed(2);

  return (
    <div className="bg-zinc-900/20 border border-zinc-800/60 p-4 rounded-xl hover:bg-zinc-900/40 transition-colors group">
       <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{title}</p>
       <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-black tracking-tighter ${isPos ? 'text-zinc-100' : 'text-orange-400'}`}>
             {isPos ? '' : '-'}{formatted}
          </span>
          <span className="text-zinc-600 text-[10px] font-mono">{unit}</span>
       </div>
       <p className="text-[9px] text-zinc-600 uppercase mt-2 group-hover:text-zinc-400 transition-colors font-bold">{desc}</p>
    </div>
  );
}

function LevelTinyCard({ label, value, color }: any) {
   return (
      <div className="bg-zinc-900/10 border border-zinc-800/30 p-4 rounded-xl flex flex-col justify-center">
         <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
         <p className={`text-lg font-mono font-black tracking-tighter ${color}`}>
            {value?.toFixed(2) || '---'}
         </p>
      </div>
   );
}

function TabBtn({ active, onClick, label }: any) {
   return (
      <button 
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
           active ? 'bg-zinc-100 text-black shadow-lg shadow-white/5' : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
         {label}
      </button>
   );
}

function VisualSection({ title, sub, children }: any) {
   return (
      <div className="bg-zinc-900/20 border border-zinc-800 p-6 rounded-2xl space-y-6">
         <div>
            <h2 className="text-zinc-100 text-sm font-black uppercase tracking-widest">{title}</h2>
            <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-tighter mt-1">{sub}</p>
         </div>
         {children}
      </div>
   );
}
