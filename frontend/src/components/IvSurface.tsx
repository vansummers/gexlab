'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Plotly is heavy, load dynamically
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface IvSurfaceProps {
  surfaceData: {
    expiries: string[];
    strikes: number[];
    matrix: number[][];
  };
}

export default function IvSurface({ surfaceData }: IvSurfaceProps) {
  if (!surfaceData || !surfaceData.matrix) return <div className="text-zinc-600">Loading Surface...</div>;

  return (
    <div className="w-full h-96 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-900">
      <Plot
        data={[
          {
            z: surfaceData.matrix,
            x: surfaceData.strikes,
            y: surfaceData.expiries,
            type: 'surface',
            colorscale: 'Viridis',
            showscale: false,
            contours: {
              z: {
                show: true,
                usecolormap: true,
                highlightcolor: "#42f4f4",
                project: { z: true }
              }
            }
          },
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { l: 0, r: 0, b: 0, t: 0 },
          scene: {
            xaxis: { 
              title: { text: 'Strike', font: { color: '#a1a1aa', size: 10 } },
              gridcolor: '#27272a',
              zerolinecolor: '#27272a',
              tickfont: { color: '#71717a', size: 9 }
            },
            yaxis: { 
              title: { text: 'Expiry', font: { color: '#a1a1aa', size: 10 } },
              gridcolor: '#27272a',
              zerolinecolor: '#27272a',
              tickfont: { color: '#71717a', size: 9 }
            },
            zaxis: { 
              title: { text: 'IV', font: { color: '#a1a1aa', size: 10 } },
              gridcolor: '#27272a',
              zerolinecolor: '#27272a',
              tickfont: { color: '#71717a', size: 9 }
            },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.2 }
            }
          }
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}
