/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PricePoint {
  date: string;
  price: number;
}

export interface CDIYieldPoint {
  date: string;
  rate: number;
}

export interface StockData {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  changePercent24h: number;
  peRatio: number;
  dy: number; // Dividend Yield %
  earningsYield: number; // E/P ratio (represented as %)
  beta: number; // vs Ibovespa
  stdDev: number; // Volatility % (monthly)
  atr: number; // Average True Range (BRL)
  sharpeRatio: number;
  history30d: PricePoint[];
  history90d: PricePoint[];
  history180d: PricePoint[];
  vpa: number; // Valor Patrimonial por Ação
  lpa: number; // Lucro por Ação
  dividendsPerShare: number; // Dividendos por Ação nos últimos 12m
  debtToEquity: number; // Dívida Líquida / Patrimônio Líquido
}

export interface CDIContract {
  ticker: string; // e.g., DI1F25, DI1F27
  label: string; // e.g., Jan/2025, Jan/2027
  maturityYears: number; // Years from now
  yieldRate: number; // e.g., 11.85 (%)
  changePercent24h: number;
  history30d: CDIYieldPoint[];
  history90d: CDIYieldPoint[];
  history180d: CDIYieldPoint[];
}

export interface MarketCorrelation {
  stockTicker: string;
  cdiTicker: string;
  periodDays: number;
  correlation: number; // Pearson correlation coefficient
  rSquared: number;
  betaYield: number; // Sensitivity of stock to 1% change in future CDI
  interpretedStatus: "Forte Negativa" | "Moderada Negativa" | "Neutra" | "Moderada Positiva" | "Forte Positiva";
  explanation: string;
}

export interface ArbitrageOpportunity {
  stockTicker: string;
  cdiTicker: string;
  stockEarningsYield: number;
  cdiYield: number;
  adjustedSpread: number; // (Stock Earnings Yield + Risk Premium) - CDI Yield
  riskPremiumUsed: number; // Typically 4-5%
  score: number; // Arbitrage potential score from 0 to 100
  signal: "COMPRA_ACAO_SHORT_DI" | "COMPRA_DI_SHORT_ACAO" | "HOLD_NEUTRO";
  description: string;
}

export interface AutomaticAlert {
  id: string;
  email: string;
  ticker: string;
  metric: "correlation" | "yieldSpread" | "volatility";
  condition: "greater" | "less";
  value: number; // Threshold value
  isTriggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

export interface GeminiAnalysisRequest {
  stockTicker: string;
  cdiTicker: string;
  userContext?: string;
}

export interface GeminiAnalysisResponse {
  stockTicker: string;
  cdiTicker: string;
  score: number;
  thesis: string;
  arbitrageSteps: string[];
  risks: string[];
  recommendation: string;
}

export interface PortfolioItem {
  id: string;
  ticker: string;
  shares: number;
  averagePrice: number;
}

