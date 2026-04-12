'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [status, setStatus] = useState<{ status: string; service: string; polling: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health');
        if (!res.ok) throw new Error('Backend unreachable');
        const data = await res.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        setError('Backend is offline. (Start FastAPI on port 8000)');
        setStatus(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          GexLab v2
        </h1>
        <p className="text-zinc-500 mt-2">Institutional-Grade Options Flow Suite</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4">Core Engine</h2>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${status ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-2xl font-semibold">
              {status ? 'Operational' : 'Disconnected'}
            </span>
          </div>
          {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
          {status && (
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Service</span>
                <span className="text-zinc-300">{status.service}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Real-time Polling</span>
                <span className={`font-medium ${status.polling ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {status.polling ? 'Active' : 'Idle'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Placeholder for Data Ingestion */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl opacity-50">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-4">Data Ingestion</h2>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold">yfinance</span>
          </div>
          <p className="text-xs text-zinc-500 mt-4">Calculates GEX/Greeks across 5+ expiries.</p>
        </div>
      </main>

      <footer className="mt-20 pt-8 border-t border-zinc-900 text-zinc-600 text-xs">
        <p>© 2026 GexLab Quants • TradingView Bridge v2.0</p>
      </footer>
    </div>
  );
}
