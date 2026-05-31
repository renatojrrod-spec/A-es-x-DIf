/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { StockData, CDIContract } from "../types.js";
import { ArrowUpRight, TrendingUp } from "lucide-react";

interface CorrelationChartProps {
  stock: StockData;
  cdi: CDIContract;
  periodDays: number;
}

export default function CorrelationChart({
  stock,
  cdi,
  periodDays
}: CorrelationChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Pick correct history arrays based on the filters
  const stockHistory = periodDays === 30 
    ? stock.history30d 
    : periodDays === 90 
      ? stock.history90d 
      : stock.history180d;

  const cdiHistory = periodDays === 30 
    ? cdi.history30d 
    : periodDays === 90 
      ? cdi.history90d 
      : cdi.history180d;

  if (!stockHistory || !cdiHistory || stockHistory.length === 0 || cdiHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-slate-400 text-xs">Aguardando dados de correlação...</p>
      </div>
    );
  }

  // Ensure arrays are synchronized and matched by date
  const dataPoints: { date: string; stockPrice: number; cdiRate: number }[] = [];
  stockHistory.forEach((sp) => {
    const matchingCDI = cdiHistory.find((cp) => cp.date === sp.date);
    if (matchingCDI) {
      dataPoints.push({
        date: sp.date,
        stockPrice: sp.price,
        cdiRate: matchingCDI.rate,
      });
    }
  });

  if (dataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-52 bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-slate-400 text-xs">Incompatibilidade de datas históricas.</p>
      </div>
    );
  }

  // Find min/max for scaling
  const stockPrices = dataPoints.map((d) => d.stockPrice);
  const cdiRates = dataPoints.map((d) => d.cdiRate);

  const minStock = Math.min(...stockPrices) * 0.98;
  const maxStock = Math.max(...stockPrices) * 1.02;

  const minCDI = Math.min(...cdiRates) * 0.99;
  const maxCDI = Math.max(...cdiRates) * 1.01;

  // Chart configuration
  const width = 640;
  const height = 280;
  const paddingX = 55;
  const paddingY = 35;

  const getX = (index: number) => {
    return paddingX + (index / (dataPoints.length - 1)) * (width - 2 * paddingX);
  };

  const getStockY = (price: number) => {
    const range = maxStock - minStock || 1;
    return height - paddingY - ((price - minStock) / range) * (height - 2 * paddingY);
  };

  const getCDIY = (rate: number) => {
    const range = maxCDI - minCDI || 1;
    return height - paddingY - ((rate - minCDI) / range) * (height - 2 * paddingY);
  };

  // Build stock line SVG path
  let stockLine = `M ${getX(0)} ${getStockY(dataPoints[0].stockPrice)}`;
  for (let i = 1; i < dataPoints.length; i++) {
    stockLine += ` L ${getX(i)} ${getStockY(dataPoints[i].stockPrice)}`;
  }

  // Build CDI line SVG path
  let cdiLine = `M ${getX(0)} ${getCDIY(dataPoints[0].cdiRate)}`;
  for (let i = 1; i < dataPoints.length; i++) {
    cdiLine += ` L ${getX(i)} ${getCDIY(dataPoints[i].cdiRate)}`;
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    
    // Scale clientX back to the SVG width viewport
    const svgX = (clientX / svgRect.width) * width;
    
    // Find closest index
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < dataPoints.length; i++) {
      const dist = Math.abs(getX(i) - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    setHoveredIndex(bestIndex);
  };

  return (
    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5" id="correlation-chart">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center">
              Divergência de Arbitragem: <span className="text-emerald-400 font-mono ml-1">{stock.ticker}</span> vs <span className="text-cyan-400 font-mono ml-1">{cdi.ticker}</span>
            </h4>
          </div>
          <p className="text-slate-400 text-[11px] leading-snug mt-1">
            Gráfico de dupla escala comparando o fechamento diário da ação (Eixo Esquerdo) com a curva terminal DI (Eixo Direito).
          </p>
        </div>
        <div className="flex gap-4 self-end sm:self-auto text-xs font-mono text-slate-300">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block rounded-full"></span>
            <span>Ação (R$)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded-full"></span>
            <span>Juros DI (% a.a.)</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Y-Axis Grid Stock */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const stockVal = minStock + ratio * (maxStock - minStock);
            const cdiVal = minCDI + ratio * (maxCDI - minCDI);
            const y = height - paddingY - ratio * (height - 2 * paddingY);

            return (
              <g key={`y-grid-${ratio}`}>
                <line 
                  x1={paddingX} 
                  y1={y} 
                  x2={width - paddingX} 
                  y2={y} 
                  stroke="#1e293b" 
                  strokeWidth={0.8}
                  strokeDasharray="2 3"
                />
                {/* Left labels: Stock Price */}
                <text 
                  x={paddingX - 8} 
                  y={y + 3} 
                  fill="#10b981" 
                  fontSize={9} 
                  fontFamily="JetBrains Mono, monospace" 
                  textAnchor="end"
                >
                  R$ {stockVal.toFixed(2)}
                </text>
                {/* Right labels: CDI Rate */}
                <text 
                  x={width - paddingX + 8} 
                  y={y + 3} 
                  fill="#22d3ee" 
                  fontSize={9} 
                  fontFamily="JetBrains Mono, monospace" 
                  textAnchor="start"
                >
                  {cdiVal.toFixed(2)}%
                </text>
              </g>
            );
          })}

          {/* Lines */}
          <path
            d={stockLine}
            fill="none"
            stroke="#10b981"
            strokeWidth={2.2}
            strokeLinecap="round"
            className="drop-shadow-[0_1px_4px_rgba(16,185,129,0.2)]"
          />

          <path
            d={cdiLine}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2.2}
            strokeLinecap="round"
            className="drop-shadow-[0_1px_4px_rgba(34,211,238,0.2)]"
          />

          {/* Interactive cursor line */}
          {hoveredIndex !== null && hoveredIndex < dataPoints.length && (
            <g>
              <line 
                x1={getX(hoveredIndex)} 
                y1={paddingY} 
                x2={getX(hoveredIndex)} 
                y2={height - paddingY} 
                stroke="#64748b" 
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              
              {/* Dots on lines */}
              <circle 
                cx={getX(hoveredIndex)} 
                cy={getStockY(dataPoints[hoveredIndex].stockPrice)} 
                r={5.5} 
                fill="#10b981" 
                stroke="#fff" 
                strokeWidth={1.5}
              />

              <circle 
                cx={getX(hoveredIndex)} 
                cy={getCDIY(dataPoints[hoveredIndex].cdiRate)} 
                r={5.5} 
                fill="#22d3ee" 
                stroke="#fff" 
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Timeline Date labels */}
          <text 
            x={paddingX} 
            y={height - 10} 
            fill="#475569" 
            fontSize={9} 
            fontFamily="JetBrains Mono, monospace" 
            textAnchor="start"
          >
            {dataPoints[0].date}
          </text>
          
          <text 
            x={width / 2} 
            y={height - 10} 
            fill="#475569" 
            fontSize={9} 
            fontFamily="JetBrains Mono, monospace" 
            textAnchor="middle"
          >
            Médio Período ({Math.floor(dataPoints.length / 2)}d)
          </text>

          <text 
            x={width - paddingX} 
            y={height - 10} 
            fill="#475569" 
            fontSize={9} 
            fontFamily="JetBrains Mono, monospace" 
            textAnchor="end"
          >
            Hoje ({dataPoints[dataPoints.length - 1].date})
          </text>
        </svg>
      </div>

      {/* Synchronized Tooltip Box beneath */}
      <div className="mt-4 bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-slate-300 font-sans tracking-wide">
            {hoveredIndex !== null && hoveredIndex < dataPoints.length ? (
              <>
                Sessão em <strong className="text-slate-100">{dataPoints[hoveredIndex].date}</strong>:
              </>
            ) : (
              "Passe o cursor sobre o gráfico para consultar as cotações sincronizadas:"
            )}
          </span>
        </div>
        <div className="flex gap-4 font-mono text-[11px]">
          <div className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 px-2.5 py-1 rounded">
            Ação: <span className="font-bold text-slate-100">R$ {
              (hoveredIndex !== null && hoveredIndex < dataPoints.length 
                ? dataPoints[hoveredIndex].stockPrice 
                : stock.currentPrice
              ).toFixed(2)
            }</span>
          </div>
          <div className="bg-cyan-950/40 text-cyan-400 border border-cyan-900/60 px-2.5 py-1 rounded">
            CDI Juros: <span className="font-bold text-slate-100">{
              (hoveredIndex !== null && hoveredIndex < dataPoints.length 
                ? dataPoints[hoveredIndex].cdiRate 
                : cdi.yieldRate
              ).toFixed(2)
            }% a.a.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
