/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CDIContract, StockData } from "../types.js";
import { TrendingUp, Award, Calendar } from "lucide-react";

interface YieldCurveChartProps {
  cdiContracts: CDIContract[];
  selectedContract: string;
  onSelectContract: (ticker: string) => void;
  stocks: StockData[];
}

export default function YieldCurveChart({
  cdiContracts,
  selectedContract,
  onSelectContract,
  stocks
}: YieldCurveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    label: string;
    rate: number;
  } | null>(null);

  // Sort contracts by duration to plot a logical yield curve
  const sortedPoints = [...cdiContracts].sort((a, b) => a.maturityYears - b.maturityYears);

  // Setup dimensions for SVG
  const width = 500;
  const height = 240;
  const paddingX = 45;
  const paddingY = 30;

  const minYears = 0;
  const maxYears = 6.5; // Max maturityYears in our seeds is 6.0
  const minRate = 8.0;
  const maxRate = 14.5; // Max yieldRate usually is around 12-13%

  const getX = (years: number) => {
    return paddingX + ((years - minYears) / (maxYears - minYears)) * (width - 2 * paddingX);
  };

  const getY = (rate: number) => {
    return height - paddingY - ((rate - minRate) / (maxRate - minRate)) * (height - 2 * paddingY);
  };

  // Generate SVG path for the CDI Yield Curve
  let linePath = "";
  if (sortedPoints.length > 0) {
    linePath = `M ${getX(sortedPoints[0].maturityYears)} ${getY(sortedPoints[0].yieldRate)}`;
    for (let i = 1; i < sortedPoints.length; i++) {
      linePath += ` L ${getX(sortedPoints[i].maturityYears)} ${getY(sortedPoints[i].yieldRate)}`;
    }
  }

  // Generate axis gridlines
  const yTicks = [9.0, 10.0, 11.0, 12.0, 13.0, 14.0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white" id="yield-curve-chart">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="font-sans font-semibold text-base tracking-tight text-slate-100">
            Curva de Juros Futura (CDI BMF)
          </h3>
        </div>
        <span className="font-mono text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
          Curva Terminal DI
        </span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={paddingX}
                y1={getY(tick)}
                x2={width - paddingX}
                y2={getY(tick)}
                stroke="#1e293b"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 8}
                y={getY(tick) + 4}
                fill="#64748b"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                textAnchor="end"
              >
                {tick.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Curve Path */}
          <path
            d={linePath}
            fill="none"
            stroke="#10b981"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
          />

          {/* Maturity Dots */}
          {sortedPoints.map((pt) => {
            const cx = getX(pt.maturityYears);
            const cy = getY(pt.yieldRate);
            const isSelected = pt.ticker === selectedContract;

            return (
              <g key={pt.ticker}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 8 : 5}
                  fill={isSelected ? "#10b981" : "#1e293b"}
                  stroke="#10b981"
                  strokeWidth={2.5}
                  className="cursor-pointer transition-all duration-150 hover:r-7"
                  onClick={() => onSelectContract(pt.ticker)}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      x: cx,
                      y: cy,
                      label: pt.label,
                      rate: pt.yieldRate,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                <text
                  x={cx}
                  y={cy - 12}
                  fill={isSelected ? "#34d399" : "#94a3b8"}
                  fontSize={10}
                  fontWeight={isSelected ? "bold" : "normal"}
                  fontFamily="Inter, sans-serif"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {pt.ticker}
                </text>
              </g>
            );
          })}

          {/* X Axis maturity Labels */}
          {sortedPoints.map((pt) => (
            <text
              key={`x-lbl-${pt.ticker}`}
              x={getX(pt.maturityYears)}
              y={height - 10}
              fill="#64748b"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
            >
              {pt.maturityYears === 0.5 ? "6M" : `${pt.maturityYears}A`}
            </text>
          ))}

          {/* Interactive Tooltip Overlay */}
          {hoveredPoint && (
            <g className="pointer-events-none">
              <rect
                x={Math.max(10, Math.min(width - 130, hoveredPoint.x - 60))}
                y={hoveredPoint.y - 50}
                width={120}
                height={35}
                rx={4}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={1}
              />
              <text
                x={Math.max(10, Math.min(width - 130, hoveredPoint.x - 60)) + 60}
                y={hoveredPoint.y - 38}
                fill="#f1f5f9"
                fontSize={9}
                fontWeight="500"
                fontFamily="Inter, sans-serif"
                textAnchor="middle"
              >
                {hoveredPoint.label}
              </text>
              <text
                x={Math.max(10, Math.min(width - 130, hoveredPoint.x - 60)) + 60}
                y={hoveredPoint.y - 24}
                fill="#34d399"
                fontSize={11}
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
                textAnchor="middle"
              >
                CDI: {hoveredPoint.rate.toFixed(2)}% a.a.
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Helper Legend explaining maturity points */}
      <div className="grid grid-cols-5 gap-1.5 mt-5 border-t border-slate-800 pt-3">
        {sortedPoints.map((pt) => {
          const isSelected = pt.ticker === selectedContract;
          return (
            <button
              id={`select-contract-btn-${pt.ticker}`}
              key={pt.ticker}
              onClick={() => onSelectContract(pt.ticker)}
              className={`p-1.5 rounded text-center transition-all ${
                isSelected
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 scale-[1.03]"
                  : "bg-slate-800/40 text-slate-300 border border-transparent hover:bg-slate-800/80"
              }`}
            >
              <div className="font-mono text-xs font-bold">{pt.ticker}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{pt.yieldRate.toFixed(2)}%</div>
            </button>
          );
        })}
      </div>

      {/* Explanatory Context */}
      <div className="mt-4 bg-slate-800/30 border border-slate-800/60 p-3 rounded-lg flex items-start space-x-2.5">
        <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
          A curva de juros futura (BMF) projeta as expectativas inflacionárias e fiscais do Brasil. 
          Ações de <strong>alta duration</strong> (como tecnologia e varejo) dependem crucialmente das taxas de vencimento longo 
          (<strong>DI1F29 / DI1F31</strong>), enquanto bancos e exportadoras são avaliados contra taxas curtas.
        </p>
      </div>
    </div>
  );
}
