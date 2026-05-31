/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { 
  StockData, 
  CDIContract, 
  PricePoint, 
  CDIYieldPoint, 
  MarketCorrelation, 
  ArbitrageOpportunity, 
  AutomaticAlert, 
  EmailLog,
  PortfolioItem
} from "./src/types.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini API client on the server
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// Financial Data Generation Engine (Realistic Brazilian Markets)
// ----------------------------------------------------

// Generator helper for dates (T-180 days to T-0)
function generateHistoryDates(days: number): string[] {
  const dates: string[] = [];
  const baseDate = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    // Format YYYY-MM-DD
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

// Global In-Memory state for Stocks and CDI yields
let stocksStore: StockData[] = [];
let cdiStore: CDIContract[] = [];
let alertsStore: AutomaticAlert[] = [];
let emailLogsStore: EmailLog[] = [];

// Initialize data stores with robust realistic seeds
function initializeData() {
  const dates180 = generateHistoryDates(180);

  // Helper to generate a random walk with high/low bounds, drift & correlation
  function generateRandomWalk(
    startVal: number, 
    drift: number, 
    volatility: number, 
    bondCorrelationFactor: number, // positive means moves same direction as yields, negative means inverse
    cdiPoints: number[]
  ): number[] {
    const points: number[] = [startVal];
    for (let i = 1; i < dates180.length; i++) {
      const prev = points[i - 1];
      // Random shock
      const randShock = (Math.random() - 0.5) * 2; // -1 to 1
      
      // CDI movement relationship
      const cdiShift = (cdiPoints[i] - cdiPoints[i - 1]) / cdiPoints[i - 1];
      const yieldPull = cdiShift * bondCorrelationFactor * prev * 4.5;
      
      let change = prev * drift + prev * volatility * randShock + yieldPull;
      // Absolute daily constraints
      if (Math.abs(change) > prev * 0.08) {
        change = Math.sign(change) * prev * 0.08;
      }
      let newVal = prev + change;
      if (newVal < 1.0) newVal = 1.0; // Floor
      points.push(Number(newVal.toFixed(2)));
    }
    return points;
  }

  // Generates CDI yields (normally trending yields, e.g. macro curve curves)
  function generateCDIYields(startRate: number, curveDrift: number, vol: number): number[] {
    const points: number[] = [startRate];
    for (let i = 1; i < dates180.length; i++) {
      const prev = points[i - 1];
      const randShock = (Math.random() - 0.5) * 2;
      const change = curveDrift + prev * vol * randShock;
      let newVal = prev + change;
      // Yield limits between 8% and 20%
      if (newVal < 8.0) newVal = 8.0;
      if (newVal > 20.0) newVal = 20.0;
      points.push(Number(newVal.toFixed(2)));
    }
    return points;
  }

  // Generate our DI Yield Curve histories first
  // DI1F25 - Short term yield (Jan 2025)
  // DI1F26 - Jan 2026
  // DI1F27 - Jan 2027
  // DI1F29 - Jan 2029 (Medium)
  // DI1F31 - Jan 2031 (Long term)
  const di25History = generateCDIYields(11.25, -0.001, 0.004);
  const di26History = generateCDIYields(11.50, -0.0005, 0.005);
  const di27History = generateCDIYields(11.95, 0.0002, 0.006);
  const di29History = generateCDIYields(12.30, 0.0005, 0.007);
  const di31History = generateCDIYields(12.55, 0.0009, 0.0075);

  const formatPoints = (histList: number[]): CDIYieldPoint[] => {
    return histList.map((val, idx) => ({ date: dates180[idx], rate: val }));
  };

  cdiStore = [
    {
      ticker: "DI1F25",
      label: "DI Futuro Jan/2025 (Curto)",
      maturityYears: 0.5,
      yieldRate: di25History[di25History.length - 1],
      changePercent24h: Number(((di25History[di25History.length - 1] - di25History[di25History.length - 2]) / di25History[di25History.length - 2] * 100).toFixed(2)),
      history30d: formatPoints(di25History.slice(-30)),
      history90d: formatPoints(di25History.slice(-90)),
      history180d: formatPoints(di25History)
    },
    {
      ticker: "DI1F26",
      label: "DI Futuro Jan/2026 (1 Ano)",
      maturityYears: 1.0,
      yieldRate: di26History[di26History.length - 1],
      changePercent24h: Number(((di26History[di26History.length - 1] - di26History[di26History.length - 2]) / di26History[di26History.length - 2] * 100).toFixed(2)),
      history30d: formatPoints(di26History.slice(-30)),
      history90d: formatPoints(di26History.slice(-90)),
      history180d: formatPoints(di26History)
    },
    {
      ticker: "DI1F27",
      label: "DI Futuro Jan/2027 (2 Anos)",
      maturityYears: 2.0,
      yieldRate: di27History[di27History.length - 1],
      changePercent24h: Number(((di27History[di27History.length - 1] - di27History[di27History.length - 2]) / di27History[di27History.length - 2] * 100).toFixed(2)),
      history30d: formatPoints(di27History.slice(-30)),
      history90d: formatPoints(di27History.slice(-90)),
      history180d: formatPoints(di27History)
    },
    {
      ticker: "DI1F29",
      label: "DI Futuro Jan/2029 (Médio)",
      maturityYears: 4.0,
      yieldRate: di29History[di29History.length - 1],
      changePercent24h: Number(((di29History[di29History.length - 1] - di29History[di29History.length - 2]) / di29History[di29History.length - 2] * 100).toFixed(2)),
      history30d: formatPoints(di29History.slice(-30)),
      history90d: formatPoints(di29History.slice(-90)),
      history180d: formatPoints(di29History)
    },
    {
      ticker: "DI1F31",
      label: "DI Futuro Jan/2031 (Longo)",
      maturityYears: 6.0,
      yieldRate: di31History[di31History.length - 1],
      changePercent24h: Number(((di31History[di31History.length - 1] - di31History[di31History.length - 2]) / di31History[di31History.length - 2] * 100).toFixed(2)),
      history30d: formatPoints(di31History.slice(-30)),
      history90d: formatPoints(di31History.slice(-90)),
      history180d: formatPoints(di31History)
    }
  ];

  // Align stock walks based on future DI Yield values
  const templates = [
    {
      ticker: "PETR4",
      name: "Petróleo Brasileiro S.A. - Petrobras (Pref)",
      sector: "Energia / Petróleo",
      startPrice: 37.40,
      drift: 0.0003,
      volatility: 0.018,
      bondCorrelationFactor: -0.3,
      peRatio: 4.25,
      dy: 14.8,
      beta: 1.15,
      stdDev: 22.4,
      atr: 0.95,
      sharpeRatio: 1.25,
      vpa: 32.00,
      lpa: 8.80,
      dividendsPerShare: 5.54,
      debtToEquity: 0.68
    },
    {
      ticker: "VALE3",
      name: "Vale S.A.",
      sector: "Mineração e Siderurgia",
      startPrice: 61.80,
      drift: 0.0001,
      volatility: 0.015,
      bondCorrelationFactor: -0.15,
      peRatio: 6.8,
      dy: 8.5,
      beta: 1.05,
      stdDev: 18.2,
      atr: 1.20,
      sharpeRatio: 0.85,
      vpa: 54.00,
      lpa: 9.09,
      dividendsPerShare: 5.25,
      debtToEquity: 0.42
    },
    {
      ticker: "ITUB4",
      name: "Itaú Unibanco Holding S.A.",
      sector: "Serviços Financeiros",
      startPrice: 34.20,
      drift: 0.0002,
      volatility: 0.013,
      bondCorrelationFactor: 0.1,
      peRatio: 8.1,
      dy: 7.2,
      beta: 0.92,
      stdDev: 15.4,
      atr: 0.58,
      sharpeRatio: 1.12,
      vpa: 21.00,
      lpa: 4.22,
      dividendsPerShare: 2.46,
      debtToEquity: 0.15
    },
    {
      ticker: "WEGE3",
      name: "WEG S.A.",
      sector: "Bens Industriais",
      startPrice: 48.50,
      drift: 0.0005,
      volatility: 0.012,
      bondCorrelationFactor: -0.6,
      peRatio: 24.5,
      dy: 2.8,
      beta: 0.65,
      stdDev: 14.1,
      atr: 0.76,
      sharpeRatio: 1.45,
      vpa: 9.50,
      lpa: 1.98,
      dividendsPerShare: 1.36,
      debtToEquity: 0.08
    },
    {
      ticker: "MGLU3",
      name: "Magazine Luiza S.A.",
      sector: "Comércio Varejista",
      startPrice: 2.15,
      drift: -0.001,
      volatility: 0.038,
      bondCorrelationFactor: -1.8,
      peRatio: 48.0,
      dy: 0.0,
      beta: 1.85,
      stdDev: 46.5,
      atr: 0.12,
      sharpeRatio: -0.45,
      vpa: 1.50,
      lpa: 0.045,
      dividendsPerShare: 0.00,
      debtToEquity: 1.85
    },
    {
      ticker: "LREN3",
      name: "Lojas Renner S.A.",
      sector: "Consumo Cíclico",
      startPrice: 16.50,
      drift: -0.0003,
      volatility: 0.024,
      bondCorrelationFactor: -1.3,
      peRatio: 12.4,
      dy: 4.9,
      beta: 1.48,
      stdDev: 29.8,
      atr: 0.48,
      sharpeRatio: 0.32,
      vpa: 11.20,
      lpa: 1.33,
      dividendsPerShare: 0.81,
      debtToEquity: 0.45
    },
    {
      ticker: "ELET3",
      name: "Centrais Elétricas Brasileiras S.A. - Eletrobras (Ord)",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 40.10,
      drift: 0.0001,
      volatility: 0.014,
      bondCorrelationFactor: -0.85,
      peRatio: 10.2,
      dy: 4.1,
      beta: 0.88,
      stdDev: 19.5,
      atr: 0.82,
      sharpeRatio: 0.65,
      vpa: 48.00,
      lpa: 3.93,
      dividendsPerShare: 1.64,
      debtToEquity: 1.15
    },
    {
      ticker: "BBAS3",
      name: "Banco do Brasil S.A.",
      sector: "Serviços Financeiros",
      startPrice: 27.50,
      drift: 0.0003,
      volatility: 0.016,
      bondCorrelationFactor: 0.05,
      peRatio: 4.8,
      dy: 8.5,
      beta: 0.91,
      stdDev: 18.5,
      atr: 0.62,
      sharpeRatio: 1.15,
      vpa: 58.50,
      lpa: 5.73,
      dividendsPerShare: 2.34,
      debtToEquity: 0.12
    },
    {
      ticker: "BBDC4",
      name: "Banco Bradesco S.A. (Pref)",
      sector: "Serviços Financeiros",
      startPrice: 13.80,
      drift: 0.0001,
      volatility: 0.018,
      bondCorrelationFactor: 0.02,
      peRatio: 8.5,
      dy: 6.5,
      beta: 0.98,
      stdDev: 21.0,
      atr: 0.35,
      sharpeRatio: 0.72,
      vpa: 16.80,
      lpa: 1.62,
      dividendsPerShare: 0.90,
      debtToEquity: 0.18
    },
    {
      ticker: "ITSA4",
      name: "Itaúsa S.A.",
      sector: "Serviços Financeiros",
      startPrice: 10.10,
      drift: 0.0002,
      volatility: 0.012,
      bondCorrelationFactor: 0.06,
      peRatio: 7.5,
      dy: 8.1,
      beta: 0.82,
      stdDev: 15.0,
      atr: 0.22,
      sharpeRatio: 1.19,
      vpa: 9.20,
      lpa: 1.35,
      dividendsPerShare: 0.82,
      debtToEquity: 0.14
    },
    {
      ticker: "ABEV3",
      name: "Ambev S.A.",
      sector: "Consumo Não Cíclico / Bebidas",
      startPrice: 12.20,
      drift: -0.0001,
      volatility: 0.011,
      bondCorrelationFactor: -0.2,
      peRatio: 13.2,
      dy: 5.7,
      beta: 0.55,
      stdDev: 14.5,
      atr: 0.28,
      sharpeRatio: 0.52,
      vpa: 5.80,
      lpa: 0.92,
      dividendsPerShare: 0.70,
      debtToEquity: 0.02
    },
    {
      ticker: "B3SA3",
      name: "B3 S.A. - Brasil, Bolsa, Balcão",
      sector: "Serviços Financeiros",
      startPrice: 11.50,
      drift: -0.0002,
      volatility: 0.019,
      bondCorrelationFactor: -0.7,
      peRatio: 14.1,
      dy: 4.5,
      beta: 1.12,
      stdDev: 22.0,
      atr: 0.32,
      sharpeRatio: 0.48,
      vpa: 4.10,
      lpa: 0.82,
      dividendsPerShare: 0.52,
      debtToEquity: 0.65
    },
    {
      ticker: "BBSE3",
      name: "BB Seguridade Participações S.A.",
      sector: "Serviços Financeiros",
      startPrice: 33.40,
      drift: 0.0003,
      volatility: 0.013,
      bondCorrelationFactor: -0.15,
      peRatio: 9.8,
      dy: 9.6,
      beta: 0.75,
      stdDev: 16.2,
      atr: 0.78,
      sharpeRatio: 1.28,
      vpa: 9.50,
      lpa: 3.41,
      dividendsPerShare: 3.21,
      debtToEquity: 0.05
    },
    {
      ticker: "EGIE3",
      name: "Engie Brasil Energia S.A.",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 42.10,
      drift: 0.0002,
      volatility: 0.012,
      bondCorrelationFactor: -0.55,
      peRatio: 11.2,
      dy: 7.2,
      beta: 0.68,
      stdDev: 15.5,
      atr: 0.85,
      sharpeRatio: 1.05,
      vpa: 16.50,
      lpa: 3.76,
      dividendsPerShare: 3.03,
      debtToEquity: 0.95
    },
    {
      ticker: "TAEE11",
      name: "Transmissora Aliança de Energia Elétrica S.A. - Taesa",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 34.80,
      drift: 0.0001,
      volatility: 0.011,
      bondCorrelationFactor: -0.4,
      peRatio: 9.2,
      dy: 9.8,
      beta: 0.52,
      stdDev: 14.8,
      atr: 0.68,
      sharpeRatio: 1.15,
      vpa: 26.50,
      lpa: 3.78,
      dividendsPerShare: 3.41,
      debtToEquity: 1.18
    },
    {
      ticker: "TRPL4",
      name: "ISA CTEEP - Companhia de Transmissão de Energia Elétrica Paulista",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 25.20,
      drift: 0.0002,
      volatility: 0.011,
      bondCorrelationFactor: -0.3,
      peRatio: 8.1,
      dy: 8.5,
      beta: 0.48,
      stdDev: 14.0,
      atr: 0.52,
      sharpeRatio: 1.35,
      vpa: 24.10,
      lpa: 3.11,
      dividendsPerShare: 2.14,
      debtToEquity: 0.88
    },
    {
      ticker: "CPLE6",
      name: "Copel - Companhia Paranaense de Energia (Pref)",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 9.50,
      drift: 0.0003,
      volatility: 0.014,
      bondCorrelationFactor: -0.45,
      peRatio: 10.5,
      dy: 6.8,
      beta: 0.72,
      stdDev: 17.0,
      atr: 0.21,
      sharpeRatio: 1.08,
      vpa: 8.80,
      lpa: 0.90,
      dividendsPerShare: 0.65,
      debtToEquity: 0.75
    },
    {
      ticker: "CMIG4",
      name: "Companhia Energética de Minas Gerais - Cemig (Pref)",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 11.20,
      drift: 0.0002,
      volatility: 0.015,
      bondCorrelationFactor: -0.5,
      peRatio: 6.5,
      dy: 9.2,
      beta: 0.85,
      stdDev: 19.0,
      atr: 0.24,
      sharpeRatio: 1.12,
      vpa: 12.20,
      lpa: 1.72,
      dividendsPerShare: 1.03,
      debtToEquity: 0.65
    },
    {
      ticker: "SBSP3",
      name: "Companhia de Saneamento Básico do Estado de São Paulo - Sabesp",
      sector: "Utilidade Pública / Saneamento",
      startPrice: 83.50,
      drift: 0.0005,
      volatility: 0.018,
      bondCorrelationFactor: -0.65,
      peRatio: 18.5,
      dy: 2.1,
      beta: 0.95,
      stdDev: 23.0,
      atr: 1.85,
      sharpeRatio: 1.02,
      vpa: 42.50,
      lpa: 4.51,
      dividendsPerShare: 1.75,
      debtToEquity: 0.82
    },
    {
      ticker: "SAPR11",
      name: "Companhia de Saneamento do Paraná - Sanepar (Units)",
      sector: "Utilidade Pública / Saneamento",
      startPrice: 22.80,
      drift: 0.0003,
      volatility: 0.013,
      bondCorrelationFactor: -0.4,
      peRatio: 6.2,
      dy: 6.8,
      beta: 0.58,
      stdDev: 16.5,
      atr: 0.48,
      sharpeRatio: 1.15,
      vpa: 16.20,
      lpa: 3.68,
      dividendsPerShare: 1.55,
      debtToEquity: 0.48
    },
    {
      ticker: "RENT3",
      name: "Localiza Rent a Car S.A.",
      sector: "Logística & Transportes",
      startPrice: 51.20,
      drift: -0.0001,
      volatility: 0.022,
      bondCorrelationFactor: -1.2,
      peRatio: 28.5,
      dy: 1.8,
      beta: 1.35,
      stdDev: 29.0,
      atr: 1.45,
      sharpeRatio: 0.35,
      vpa: 18.50,
      lpa: 1.80,
      dividendsPerShare: 0.92,
      debtToEquity: 1.45
    },
    {
      ticker: "EMBR3",
      name: "Embraer S.A.",
      sector: "Bens Industriais",
      startPrice: 38.50,
      drift: 0.0012,
      volatility: 0.024,
      bondCorrelationFactor: -0.1,
      peRatio: 19.2,
      dy: 0.0,
      beta: 1.22,
      stdDev: 31.0,
      atr: 1.15,
      sharpeRatio: 1.52,
      vpa: 22.00,
      lpa: 2.01,
      dividendsPerShare: 0.00,
      debtToEquity: 0.92
    },
    {
      ticker: "PRIO3",
      name: "Petro Rio S.A. - PRIO",
      sector: "Energia / Petróleo",
      startPrice: 42.60,
      drift: 0.0006,
      volatility: 0.026,
      bondCorrelationFactor: -0.2,
      peRatio: 11.5,
      dy: 0.0,
      beta: 1.18,
      stdDev: 32.5,
      atr: 1.35,
      sharpeRatio: 0.98,
      vpa: 14.80,
      lpa: 3.70,
      dividendsPerShare: 0.00,
      debtToEquity: 0.58
    },
    {
      ticker: "SUZB3",
      name: "Suzano S.A.",
      sector: "Mineração e Siderurgia",
      startPrice: 54.80,
      drift: 0.0002,
      volatility: 0.02,
      bondCorrelationFactor: -0.3,
      peRatio: 10.2,
      dy: 3.8,
      beta: 0.95,
      stdDev: 25.0,
      atr: 1.32,
      sharpeRatio: 0.72,
      vpa: 28.50,
      lpa: 5.37,
      dividendsPerShare: 2.08,
      debtToEquity: 1.35
    },
    {
      ticker: "KLBN11",
      name: "Klabin S.A. (Units)",
      sector: "Mineração e Siderurgia",
      startPrice: 20.20,
      drift: 0.0001,
      volatility: 0.015,
      bondCorrelationFactor: -0.4,
      peRatio: 11.8,
      dy: 8.1,
      beta: 0.72,
      stdDev: 19.5,
      atr: 0.42,
      sharpeRatio: 0.88,
      vpa: 6.80,
      lpa: 1.71,
      dividendsPerShare: 1.64,
      debtToEquity: 1.25
    },
    {
      ticker: "JBSS3",
      name: "JBS S.A.",
      sector: "Mineração e Siderurgia",
      startPrice: 30.50,
      drift: 0.0004,
      volatility: 0.019,
      bondCorrelationFactor: -0.2,
      peRatio: 7.5,
      dy: 6.8,
      beta: 0.88,
      stdDev: 24.5,
      atr: 0.78,
      sharpeRatio: 1.05,
      vpa: 31.25,
      lpa: 4.07,
      dividendsPerShare: 2.07,
      debtToEquity: 1.18
    },
    {
      ticker: "ASAI3",
      name: "Sendas Distribuidora S.A. - Assaí",
      sector: "Comércio Varejista",
      startPrice: 10.40,
      drift: -0.0002,
      volatility: 0.022,
      bondCorrelationFactor: -1.3,
      peRatio: 12.5,
      dy: 1.2,
      beta: 1.15,
      stdDev: 28.0,
      atr: 0.31,
      sharpeRatio: 0.42,
      vpa: 4.20,
      lpa: 0.83,
      dividendsPerShare: 0.12,
      debtToEquity: 1.65
    },
    {
      ticker: "RADL3",
      name: "Raia Drogasil S.A.",
      sector: "Comércio Varejista",
      startPrice: 26.20,
      drift: 0.0004,
      volatility: 0.012,
      bondCorrelationFactor: -0.5,
      peRatio: 31.5,
      dy: 1.1,
      beta: 0.62,
      stdDev: 15.8,
      atr: 0.45,
      sharpeRatio: 1.18,
      vpa: 5.90,
      lpa: 0.83,
      dividendsPerShare: 0.29,
      debtToEquity: 0.52
    },
    {
      ticker: "FLRY3",
      name: "Fleury S.A.",
      sector: "Consumo Cíclico",
      startPrice: 15.20,
      drift: 0.0001,
      volatility: 0.014,
      bondCorrelationFactor: -0.6,
      peRatio: 13.5,
      dy: 5.2,
      beta: 0.70,
      stdDev: 18.0,
      atr: 0.32,
      sharpeRatio: 0.78,
      vpa: 7.55,
      lpa: 1.13,
      dividendsPerShare: 0.79,
      debtToEquity: 0.68
    },
    {
      ticker: "HYPE3",
      name: "Hypera S.A.",
      sector: "Consumo Cíclico",
      startPrice: 29.50,
      drift: -0.0001,
      volatility: 0.015,
      bondCorrelationFactor: -0.85,
      peRatio: 13.8,
      dy: 4.5,
      beta: 0.75,
      stdDev: 19.0,
      atr: 0.68,
      sharpeRatio: 0.62,
      vpa: 18.20,
      lpa: 2.14,
      dividendsPerShare: 1.33,
      debtToEquity: 0.72
    },
    {
      ticker: "CYRE3",
      name: "Cyrela Brazil Realty S.A.",
      sector: "Consumo Cíclico",
      startPrice: 20.80,
      drift: 0.0002,
      volatility: 0.022,
      bondCorrelationFactor: -1.5,
      peRatio: 8.1,
      dy: 7.5,
      beta: 1.45,
      stdDev: 29.5,
      atr: 0.68,
      sharpeRatio: 0.82,
      vpa: 16.80,
      lpa: 2.57,
      dividendsPerShare: 1.56,
      debtToEquity: 0.48
    },
    {
      ticker: "MULT3",
      name: "Multiplan Empreendimentos Imobiliários S.A.",
      sector: "Consumo Cíclico",
      startPrice: 24.50,
      drift: 0.0001,
      volatility: 0.014,
      bondCorrelationFactor: -0.8,
      peRatio: 13.2,
      dy: 4.8,
      beta: 0.88,
      stdDev: 18.0,
      atr: 0.52,
      sharpeRatio: 0.88,
      vpa: 14.50,
      lpa: 1.86,
      dividendsPerShare: 1.18,
      debtToEquity: 0.58
    },
    {
      ticker: "YDUQ3",
      name: "YDUQS Participações S.A.",
      sector: "Consumo Cíclico",
      startPrice: 11.80,
      drift: -0.0005,
      volatility: 0.029,
      bondCorrelationFactor: -1.6,
      peRatio: 12.1,
      dy: 2.2,
      beta: 1.55,
      stdDev: 38.0,
      atr: 0.45,
      sharpeRatio: 0.28,
      vpa: 11.20,
      lpa: 0.98,
      dividendsPerShare: 0.26,
      debtToEquity: 0.95
    },
    {
      ticker: "COGN3",
      name: "Cogna Educação S.A.",
      sector: "Consumo Cíclico",
      startPrice: 2.05,
      drift: -0.0009,
      volatility: 0.033,
      bondCorrelationFactor: -1.7,
      peRatio: -12.0,
      dy: 0.0,
      beta: 1.65,
      stdDev: 44.0,
      atr: 0.09,
      sharpeRatio: -0.35,
      vpa: 3.20,
      lpa: -0.17,
      dividendsPerShare: 0.00,
      debtToEquity: 1.15
    },
    {
      ticker: "CSAN3",
      name: "Cosan S.A.",
      sector: "Energia / Petróleo",
      startPrice: 14.20,
      drift: 0.0001,
      volatility: 0.018,
      bondCorrelationFactor: -0.9,
      peRatio: 16.5,
      dy: 3.1,
      beta: 1.10,
      stdDev: 24.0,
      atr: 0.38,
      sharpeRatio: 0.45,
      vpa: 11.80,
      lpa: 0.86,
      dividendsPerShare: 0.44,
      debtToEquity: 1.38
    },
    {
      ticker: "VBBR3",
      name: "Vibra Energia S.A.",
      sector: "Energia / Petróleo",
      startPrice: 22.80,
      drift: 0.0003,
      volatility: 0.015,
      bondCorrelationFactor: -0.6,
      peRatio: 11.1,
      dy: 5.0,
      beta: 0.85,
      stdDev: 19.5,
      atr: 0.52,
      sharpeRatio: 0.92,
      vpa: 10.50,
      lpa: 2.05,
      dividendsPerShare: 1.14,
      debtToEquity: 0.72
    },
    {
      ticker: "BBDC3",
      name: "Banco Bradesco S.A. (Ord)",
      sector: "Serviços Financeiros",
      startPrice: 12.20,
      drift: 0.0001,
      volatility: 0.018,
      bondCorrelationFactor: 0.02,
      peRatio: 8.1,
      dy: 7.0,
      beta: 0.96,
      stdDev: 21.0,
      atr: 0.31,
      sharpeRatio: 0.75,
      vpa: 16.80,
      lpa: 1.51,
      dividendsPerShare: 0.85,
      debtToEquity: 0.18
    },
    {
      ticker: "PETR3",
      name: "Petróleo Brasileiro S.A. - Petrobras (Ord)",
      sector: "Energia / Petróleo",
      startPrice: 39.10,
      drift: 0.0003,
      volatility: 0.018,
      bondCorrelationFactor: -0.3,
      peRatio: 4.1,
      dy: 15.5,
      beta: 1.18,
      stdDev: 23.5,
      atr: 0.98,
      sharpeRatio: 1.22,
      vpa: 32.00,
      lpa: 9.54,
      dividendsPerShare: 6.06,
      debtToEquity: 0.68
    },
    {
      ticker: "ELET6",
      name: "Centrais Elétricas Brasileiras S.A. - Eletrobras (Pref B)",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 44.50,
      drift: 0.0001,
      volatility: 0.014,
      bondCorrelationFactor: -0.85,
      peRatio: 10.1,
      dy: 4.5,
      beta: 0.86,
      stdDev: 19.0,
      atr: 0.88,
      sharpeRatio: 0.68,
      vpa: 48.00,
      lpa: 4.41,
      dividendsPerShare: 2.00,
      debtToEquity: 1.15
    },
    {
      ticker: "CPFL3",
      name: "CPFL Energia S.A.",
      sector: "Utilidade Pública / Setor Elétrico",
      startPrice: 33.50,
      drift: 0.0002,
      volatility: 0.013,
      bondCorrelationFactor: -0.5,
      peRatio: 11.5,
      dy: 6.5,
      beta: 0.60,
      stdDev: 14.0,
      atr: 0.72,
      sharpeRatio: 1.11,
      vpa: 12.50,
      lpa: 2.91,
      dividendsPerShare: 2.18,
      debtToEquity: 1.12
    },
    {
      ticker: "ALOS3",
      name: "ALLOS S.A. (Malls)",
      sector: "Consumo Cíclico",
      startPrice: 22.10,
      drift: 0.0001,
      volatility: 0.016,
      bondCorrelationFactor: -0.65,
      peRatio: 13.0,
      dy: 3.8,
      beta: 0.85,
      stdDev: 21.0,
      atr: 0.55,
      sharpeRatio: 0.78,
      vpa: 28.50,
      lpa: 1.70,
      dividendsPerShare: 0.84,
      debtToEquity: 0.62
    },
    {
      ticker: "EZTC3",
      name: "EZ TEC Empreendimentos e Participações S.A.",
      sector: "Consumo Cíclico",
      startPrice: 14.50,
      drift: -0.0002,
      volatility: 0.02,
      bondCorrelationFactor: -1.2,
      peRatio: 12.2,
      dy: 5.5,
      beta: 1.15,
      stdDev: 25.0,
      atr: 0.38,
      sharpeRatio: 0.45,
      vpa: 22.50,
      lpa: 1.19,
      dividendsPerShare: 0.80,
      debtToEquity: 0.08
    },
    {
      ticker: "MRVE3",
      name: "MRV Engenharia e Participações S.A.",
      sector: "Consumo Cíclico",
      startPrice: 7.10,
      drift: -0.0008,
      volatility: 0.028,
      bondCorrelationFactor: -1.5,
      peRatio: 22.5,
      dy: 0.0,
      beta: 1.35,
      stdDev: 31.0,
      atr: 0.22,
      sharpeRatio: -0.15,
      vpa: 11.20,
      lpa: 0.32,
      dividendsPerShare: 0.00,
      debtToEquity: 0.92
    },
    {
      ticker: "SMTO3",
      name: "São Martinho S.A.",
      sector: "Bens Industriais",
      startPrice: 29.80,
      drift: 0.0001,
      volatility: 0.015,
      bondCorrelationFactor: -0.4,
      peRatio: 14.5,
      dy: 3.8,
      beta: 0.75,
      stdDev: 22.0,
      atr: 0.75,
      sharpeRatio: 0.95,
      vpa: 19.20,
      lpa: 2.06,
      dividendsPerShare: 1.13,
      debtToEquity: 0.68
    },
    {
      ticker: "RECV3",
      name: "PetroRecôncavo S.A.",
      sector: "Energia / Petróleo",
      startPrice: 18.20,
      drift: 0.0003,
      volatility: 0.021,
      bondCorrelationFactor: -0.3,
      peRatio: 8.1,
      dy: 7.5,
      beta: 1.12,
      stdDev: 26.0,
      atr: 0.48,
      sharpeRatio: 0.85,
      vpa: 13.50,
      lpa: 2.25,
      dividendsPerShare: 1.37,
      debtToEquity: 0.48
    },
    {
      ticker: "GOAU4",
      name: "Metalúrgica Gerdau S.A.",
      sector: "Mineração e Siderurgia",
      startPrice: 11.10,
      drift: 0.0001,
      volatility: 0.016,
      bondCorrelationFactor: -0.2,
      peRatio: 5.2,
      dy: 9.5,
      beta: 1.15,
      stdDev: 22.5,
      atr: 0.28,
      sharpeRatio: 1.05,
      vpa: 16.80,
      lpa: 2.13,
      dividendsPerShare: 1.05,
      debtToEquity: 0.25
    },
    {
      ticker: "USIM5",
      name: "Usiminas S.A. (Pref)",
      sector: "Mineração e Siderurgia",
      startPrice: 7.80,
      drift: -0.0003,
      volatility: 0.022,
      bondCorrelationFactor: -0.4,
      peRatio: 14.1,
      dy: 3.1,
      beta: 1.28,
      stdDev: 26.5,
      atr: 0.21,
      sharpeRatio: 0.32,
      vpa: 18.50,
      lpa: 0.55,
      dividendsPerShare: 0.24,
      debtToEquity: 0.18
    },
    {
      ticker: "CSNA3",
      name: "Companhia Siderúrgica Nacional",
      sector: "Mineração e Siderurgia",
      startPrice: 12.40,
      drift: -0.0004,
      volatility: 0.025,
      bondCorrelationFactor: -0.65,
      peRatio: 11.2,
      dy: 6.5,
      beta: 1.45,
      stdDev: 29.0,
      atr: 0.38,
      sharpeRatio: 0.42,
      vpa: 14.50,
      lpa: 1.11,
      dividendsPerShare: 0.81,
      debtToEquity: 1.85
    },
    {
      ticker: "GGBR4",
      name: "Gerdau S.A.",
      sector: "Mineração e Siderurgia",
      startPrice: 19.55,
      drift: 0.0001,
      volatility: 0.015,
      bondCorrelationFactor: -0.18,
      peRatio: 5.8,
      dy: 8.5,
      beta: 1.12,
      stdDev: 21.5,
      atr: 0.48,
      sharpeRatio: 0.98,
      vpa: 36.50,
      lpa: 3.37,
      dividendsPerShare: 1.66,
      debtToEquity: 0.28
    },
    {
      ticker: "RAIL3",
      name: "Rumo S.A. (Logística)",
      sector: "Logística & Transportes",
      startPrice: 22.40,
      drift: 0.0002,
      volatility: 0.013,
      bondCorrelationFactor: -0.5,
      peRatio: 24.5,
      dy: 0.9,
      beta: 0.98,
      stdDev: 18.5,
      atr: 0.55,
      sharpeRatio: 0.82,
      vpa: 11.80,
      lpa: 0.91,
      dividendsPerShare: 0.20,
      debtToEquity: 1.35
    }
  ];

  const formatStockPoints = (walk: number[]): PricePoint[] => {
    return walk.map((val, idx) => ({ date: dates180[idx], price: val }));
  };

  stocksStore = templates.map(t => {
    const walk = generateRandomWalk(t.startPrice, t.drift, t.volatility, t.bondCorrelationFactor, di27History);
    const lastPrice = walk[walk.length - 1];
    const prevPrice = walk[walk.length - 2];
    const change = Number(((lastPrice - prevPrice) / prevPrice * 100).toFixed(2));
    const currentPrice = lastPrice;
    
    // Maintain coherent proportional fundamentalist inputs
    const lpa = t.peRatio !== 0 ? Number((currentPrice / Math.abs(t.peRatio)).toFixed(2)) : 0.0;
    const dividendsPerShare = Number((currentPrice * (t.dy / 100)).toFixed(2));
    
    return {
      ticker: t.ticker,
      name: t.name,
      sector: t.sector,
      currentPrice,
      changePercent24h: change,
      peRatio: t.peRatio,
      dy: t.dy,
      earningsYield: t.peRatio > 0 ? Number((100 / t.peRatio).toFixed(2)) : 0.0,
      beta: t.beta,
      stdDev: t.stdDev,
      atr: t.atr,
      sharpeRatio: t.sharpeRatio,
      history30d: formatStockPoints(walk.slice(-30)),
      history90d: formatStockPoints(walk.slice(-90)),
      history180d: formatStockPoints(walk),
      vpa: t.vpa,
      lpa: lpa,
      dividendsPerShare,
      debtToEquity: t.debtToEquity
    };
  });

  // Seed default dummy alerts to illustrate functionality
  alertsStore = [
    {
      id: "alert-1",
      email: "renato.jrrod@gmail.com",
      ticker: "MGLU3",
      metric: "correlation",
      condition: "less",
      value: -0.75,
      isTriggered: false,
      createdAt: new Date().toISOString()
    },
    {
      id: "alert-2",
      email: "renato.jrrod@gmail.com",
      ticker: "PETR4",
      metric: "yieldSpread",
      condition: "greater",
      value: 8.0, // spread over CDI future
      isTriggered: false,
      createdAt: new Date().toISOString()
    }
  ];
}

// Perform seed on startup
initializeData();

// ----------------------------------------------------
// Market Calculus / Quantitative Analysis Engines
// ----------------------------------------------------

// Computes the Pearson Correlation coefficient and sensitivity indicators
function calculateCorrelationMetrics(
  stock: StockData, 
  cdi: CDIContract, 
  periodDays: number
): MarketCorrelation {
  let stockPoints: PricePoint[] = [];
  let cdiPoints: CDIYieldPoint[] = [];

  if (periodDays <= 30) {
    stockPoints = stock.history30d;
    cdiPoints = cdi.history30d;
  } else if (periodDays <= 90) {
    stockPoints = stock.history90d;
    cdiPoints = cdi.history90d;
  } else {
    stockPoints = stock.history180d;
    cdiPoints = cdi.history180d;
  }

  // Intersect arrays by matching date keys to guarantee pairs
  const pairs: { stock: number; cdi: number }[] = [];
  stockPoints.forEach(sp => {
    const matchingCDI = cdiPoints.find(cp => cp.date === sp.date);
    if (matchingCDI) {
      pairs.push({ stock: sp.price, cdi: matchingCDI.rate });
    }
  });

  if (pairs.length < 5) {
    return {
      stockTicker: stock.ticker,
      cdiTicker: cdi.ticker,
      periodDays,
      correlation: 0.0,
      rSquared: 0.0,
      betaYield: 0.0,
      interpretedStatus: "Neutra",
      explanation: "Dados históricos insuficientes no período para calcular coeficientes precisos."
    };
  }

  const n = pairs.length;
  let sumS = 0, sumC = 0, sumS2 = 0, sumC2 = 0, sumSC = 0;

  pairs.forEach(p => {
    sumS += p.stock;
    sumC += p.cdi;
    sumS2 += p.stock * p.stock;
    sumC2 += p.cdi * p.cdi;
    sumSC += p.stock * p.cdi;
  });

  // Pearson math formula
  const numerator = (n * sumSC) - (sumS * sumC);
  const denominator = Math.sqrt(((n * sumS2) - (sumS * sumS)) * ((n * sumC2) - (sumC * sumC)));
  
  let r = 0.0;
  if (denominator !== 0) {
    r = numerator / denominator;
  }
  // Clamp r constraints
  if (r > 1.0) r = 1.0;
  if (r < -1.0) r = -1.0;

  const r2 = r * r;

  // Linear Regression Beta (sensitivity of stock to DI yield change)
  // slope = Cov(X, Y) / Var(X)  (where X is CDI rate, Y is Stock price or return)
  // Let's compute slope of percent changes to make it a financial yield elasticity measure
  let sumElasticityX = 0;
  let sumElasticityY = 0;
  let sumElasticityXY = 0;
  let sumElasticityX2 = 0;
  let elasticityPairsCount = 0;

  for (let i = 1; i < pairs.length; i++) {
    const prevC = pairs[i - 1].cdi;
    const currC = pairs[i].cdi;
    const prevS = pairs[i - 1].stock;
    const currS = pairs[i].stock;

    if (prevC !== 0 && prevS !== 0) {
      const xPct = (currC - prevC) / prevC; // CDI pct change
      const yPct = (currS - prevS) / prevS; // Stock pct change

      sumElasticityX += xPct;
      sumElasticityY += yPct;
      sumElasticityXY += xPct * yPct;
      sumElasticityX2 += xPct * xPct;
      elasticityPairsCount++;
    }
  }

  let slopeElasticity = 0;
  if (elasticityPairsCount > 2) {
    const innerNumerator = (elasticityPairsCount * sumElasticityXY) - (sumElasticityX * sumElasticityY);
    const innerDenominator = (elasticityPairsCount * sumElasticityX2) - (sumElasticityX * sumElasticityX);
    if (innerDenominator !== 0) {
      slopeElasticity = innerNumerator / innerDenominator;
    }
  }

  // Interpretations
  let interpretedStatus: MarketCorrelation["interpretedStatus"] = "Neutra";
  let explanation = "";

  if (r <= -0.6) {
    interpretedStatus = "Forte Negativa";
    explanation = `O ativo ${stock.ticker} demonstra comportamento contracíclico pronunciado. Aumentos na taxa de juros futura (${cdi.ticker}) impactam adversamente a precificação do ativo, efeito esperado de sua duration longa ou alavancagem.`;
  } else if (r <= -0.2) {
    interpretedStatus = "Moderada Negativa";
    explanation = `Correlação moderadamente inversa. O stock oscila em sentido contrário à curva de CDI futuro em parte do ciclo, mas responde a outros vetores macro/setoriais.`;
  } else if (r >= 0.6) {
    interpretedStatus = "Forte Positiva";
    explanation = `Correlação robustamente positiva. Alta nos juros futuros caminha com valorização do papel. Indicativo de setores com caixa altamente remuneradora no CDI ou commodities dolarizadas associadas a períodos inflacionários de juros altos (e.g., bancos ou exportadoras de grande porte).`;
  } else if (r >= 0.2) {
    interpretedStatus = "Moderada Positiva";
    explanation = `Sensibilidade macro positiva moderada ao juro futuro. O ativo tendeu a acompanhar flutuações das taxas de juros no período.`;
  } else {
    interpretedStatus = "Neutra";
    explanation = `Descolamento estatístico. Desvios e oscilações no juro futuro possuem baixa relevância direta na determinação dos retornos diários de ${stock.ticker}.`;
  }

  return {
    stockTicker: stock.ticker,
    cdiTicker: cdi.ticker,
    periodDays,
    correlation: Number(r.toFixed(4)),
    rSquared: Number(r2.toFixed(4)),
    betaYield: Number(slopeElasticity.toFixed(2)),
    interpretedStatus,
    explanation
  };
}

// Computes structural risk-adjusted arbitrage metrics
function evaluateArbitrageSpread(
  stock: StockData, 
  cdi: CDIContract, 
  riskPremium: number = 4.5
): ArbitrageOpportunity {
  // Stock Earnings Yield = Earnings / Price (%)  (which is 1 / P/E * 100)
  const ep = stock.earningsYield;
  const cdiYield = cdi.yieldRate;
  
  // Adjusted Spread = (Stock Earnings Yield + Volatility Risk Premium) - CDI Yield Rate
  // If spread is highly positive, stock is yielding more relative to CDI than historical limits demand.
  const adjustedSpread = ep - cdiYield;
  
  // Calculate potential arbitrage score from 0 to 100
  // Spread + riskPremium normalized
  let score = 50 + (adjustedSpread * 4);
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  score = Math.round(score);

  let signal: "COMPRA_ACAO_SHORT_DI" | "COMPRA_DI_SHORT_ACAO" | "HOLD_NEUTRO" = "HOLD_NEUTRO";
  let description = "";

  if (adjustedSpread > 5.0) {
    signal = "COMPRA_ACAO_SHORT_DI";
    description = `Arbitragem Estrutural: O Earnings Yield de ${stock.ticker} (${ep.toFixed(2)}%) supera os juros futuros de ${cdi.ticker} (${cdiYield.toFixed(2)}%) em mais de 5%. Há oportunidade de 'Ações Longas contra DIs Short' devido ao excesso de prêmio de risco patrimonial.`;
  } else if (adjustedSpread < -1.0) {
    signal = "COMPRA_DI_SHORT_ACAO";
    description = `Arbitragem Inversa: O CDI Futuro (${cdiYield.toFixed(2)}%) oferece rendimento de renda fixa sem risco superior ao Earnings Yield de ${stock.ticker} (${ep.toFixed(2)}%) ignorando o prêmio. Indica sobrevalorização expressiva das ações perante a curva de juros futura do país (DI Longo ou Hold Cash).`;
  } else {
    signal = "HOLD_NEUTRO";
    description = `Preço Justo Correlacionado: O prêmio de rentabilidade de ${stock.ticker} contra ${cdi.ticker} está em conformidade com o equilíbrio clássico de mercado (+0% a +4%). Sem desvios passíveis de arbitragem sem cobertura.`;
  }

  return {
    stockTicker: stock.ticker,
    cdiTicker: cdi.ticker,
    stockEarningsYield: Number(ep.toFixed(2)),
    cdiYield: Number(cdiYield.toFixed(2)),
    adjustedSpread: Number(adjustedSpread.toFixed(2)),
    riskPremiumUsed: riskPremium,
    score,
    signal,
    description
  };
}

// ----------------------------------------------------
// DYNAMIC STOCK INSTANTIATION SERVICE (ON-DEMAND B3 STOCK GENERATION)
// ----------------------------------------------------
function getOrCreateStock(ticker: string): StockData {
  const cleanTicker = ticker.trim().toUpperCase();
  let stock = stocksStore.find(s => s.ticker === cleanTicker);
  if (stock) return stock;

  // Real-world names & sectors map for B3 tickers
  const b3NamesMap: Record<string, { name: string; sector: string }> = {
    "ALPA4": { name: "Alpargatas S.A.", sector: "Consumo Cíclico" },
    "AMER3": { name: "Americanas S.A.", sector: "Comércio Varejista" },
    "ARZZ3": { name: "Arezzo Indústria e Comércio S.A.", sector: "Consumo Cíclico" },
    "BPAC11": { name: "Banco BTG Pactual S.A.", sector: "Serviços Financeiros" },
    "BRAP4": { name: "Bradespar S.A.", sector: "Serviços Financeiros" },
    "BRFS3": { name: "BRF S.A.", sector: "Consumo Não Cíclico / Alimentos" },
    "CCRO3": { name: "CCR S.A.", sector: "Logística & Transportes" },
    "CIEL3": { name: "Cielo S.A.", sector: "Serviços Financeiros" },
    "COCE5": { name: "Companhia Energética do Ceará - Coelce", sector: "Utilidade Pública" },
    "CPFE3": { name: "CPFL Energia S.A. (Ord)", sector: "Utilidade Pública" },
    "CRFB3": { name: "Carrefour Brasil - Grupo Carrefour", sector: "Comércio Varejista" },
    "CSMG3": { name: "Companhia de Saneamento de Minas Gerais - Copasa", sector: "Utilidade Pública" },
    "DXCO3": { name: "Dexco S.A.", sector: "Bens Industriais" },
    "ECOR3": { name: "Ecorodovias Infraestrutura e Logística S.A.", sector: "Logística & Transportes" },
    "EQTL3": { name: "Equatorial Energia S.A.", sector: "Utilidade Pública / Setor Elétrico" },
    "FRAS3": { name: "Fras-le S.A.", sector: "Bens Industriais" },
    "GMAT3": { name: "Grupo Mateus S.A.", sector: "Comércio Varejista" },
    "GOLL4": { name: "Gol Linhas Aéreas Inteligentes S.A.", sector: "Logística & Transportes" },
    "GRND3": { name: "Grendene S.A.", sector: "Consumo Cíclico" },
    "GUAR3": { name: "Guararapes Confecções S.A.", sector: "Consumo Cíclico" },
    "IGTI11": { name: "Iguatemi S.A.", sector: "Consumo Cíclico" },
    "IRBR3": { name: "IRB - Brasil Resseguros S.A.", sector: "Serviços Financeiros" },
    "JALL3": { name: "Jalles Machado S.A.", sector: "Bens Industriais" },
    "KEPL3": { name: "Kepler Weber S.A.", sector: "Bens Industriais" },
    "LIGT3": { name: "Light S.A.", sector: "Utilidade Pública / Setor Elétrico" },
    "LOGN3": { name: "Log-In Logística Intermodal S.A.", sector: "Logística & Transportes" },
    "LWSA3": { name: "Locaweb Serviços de Internet S.A.", sector: "Tecnologia / Internet" },
    "MDIA3": { name: "M. Dias Branco S.A.", sector: "Consumo Não Cíclico" },
    "NEOE3": { name: "Neoenergia S.A.", sector: "Utilidade Pública / Setor Elétrico" },
    "ODPV3": { name: "Odontoprev S.A.", sector: "Serviços Financeiros" },
    "ONCO3": { name: "Grupo Oncoclínicas", sector: "Serviços de Saúde" },
    "PSSA3": { name: "Porto Seguro S.A.", sector: "Serviços Financeiros" },
    "RAIZ4": { name: "Raízen S.A.", sector: "Energia / Petróleo" },
    "RAPT4": { name: "Randon S.A. Implementos e Participações", sector: "Bens Industriais" },
    "SANB11": { name: "Banco Santander (Brasil) S.A.", sector: "Serviços Financeiros" },
    "SIMH3": { name: "Simpar S.A.", sector: "Logística & Transportes" },
    "SLCE3": { name: "SLC Agrícola S.A.", sector: "Bens Industriais" },
    "SOMA3": { name: "Grupo de Moda Soma S.A.", sector: "Consumo Cíclico" },
    "TEND3": { name: "Construtora Tenda S.A.", sector: "Consumo Cíclico / Construtoras" },
    "TIMS3": { name: "TIM S.A.", sector: "Telecomunicações" },
    "TOTS3": { name: "Totvs S.A.", sector: "Tecnologia / Software" },
    "UGPA3": { name: "Ultrapar Participações S.A.", sector: "Energia / Distribuidora" },
    "USIM3": { name: "Usiminas S.A. (Ord)", sector: "Mineração e Siderurgia" },
    "VALE5": { name: "Vale S.A. (Class A Pref)", sector: "Mineração e Siderurgia" },
    "VIVA3": { name: "Vivara Participações S.A.", sector: "Consumo Cíclico" },
    "VLID3": { name: "Valid Soluções S.A.", sector: "Tecnologia / Segurança" },
    "WEGE4": { name: "WEG S.A. (Pref)", sector: "Bens Industriais" },
    "ZAMP3": { name: "Zamp S.A. (Burger King Brasil)", sector: "Consumo Cíclico / Alimentação" }
  };

  const info = b3NamesMap[cleanTicker] || {
    name: `${cleanTicker} Empreendimentos e Participações S.A.`,
    sector: cleanTicker.startsWith("PE") || cleanTicker.startsWith("PR")
      ? "Energia / Petróleo"
      : cleanTicker.startsWith("BB") || cleanTicker.startsWith("SA") || cleanTicker.startsWith("IT")
      ? "Serviços Financeiros"
      : cleanTicker.startsWith("EL") || cleanTicker.startsWith("CP") || cleanTicker.startsWith("TA")
      ? "Utilidade Pública"
      : "Outros Setores / B3"
  };

  // Stable deterministic base price via ticker hash
  let hash = 0;
  for (let i = 0; i < cleanTicker.length; i++) {
    hash = cleanTicker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const basePrice = Number((10 + Math.abs(hash % 90) + (Math.abs(hash) % 100) / 100).toFixed(2));
  
  const dates180 = generateHistoryDates(180);
  const di27HistoryFromStore = cdiStore && cdiStore.length > 0 
    ? cdiStore.find(c => c.ticker === "DI1F27")?.history180d.map(p => p.rate) || []
    : [];

  // Generate random walk starting from past 180 days to current base price
  const walk: number[] = [basePrice];
  const relativeVolatility = 0.01 + (Math.abs(hash % 15) / 1000);
  const correlationFactor = -0.1 - (Math.abs(hash % 12) / 10); // -1.3 to -0.1 negative correlation with rate hikes
  
  for (let i = 1; i < dates180.length; i++) {
    const prev = walk[walk.length - 1];
    const rateDiff = di27HistoryFromStore.length > i 
      ? (di27HistoryFromStore[i] - di27HistoryFromStore[i - 1]) / 100 
      : 0;
    
    const randomShock = (Math.random() - 0.5) * 2;
    const ratePull = rateDiff * correlationFactor;
    const changeFactor = 1 + (0.00015 + ratePull + relativeVolatility * randomShock);
    walk.push(Number((prev * changeFactor).toFixed(2)));
  }
  walk.reverse(); // Reverse so latest points are at the end

  const formatStockPoints = (w: number[]): PricePoint[] => {
    return w.map((val, idx) => ({ date: dates180[idx], price: val }));
  };

  const finalPrice = walk[walk.length - 1];
  const prevPrice = walk[walk.length - 2] || finalPrice;
  const changePercent24h = Number(((finalPrice - prevPrice) / prevPrice * 100).toFixed(2));

  // Determine realistic fundamentals
  const peRatio = Number((5 + Math.abs(hash % 20) + (Math.abs(hash) % 10) / 10).toFixed(2));
  const dy = Number((2 + Math.abs(hash % 11) + (Math.abs(hash) % 10) / 10).toFixed(1));
  const lpa = Number((finalPrice / peRatio).toFixed(2));
  const vpa = Number((finalPrice * (0.5 + Math.abs(hash % 8) / 10)).toFixed(2));
  const dividendsPerShare = Number((finalPrice * (dy / 100)).toFixed(2));
  const debtToEquity = Number((0.1 + Math.abs(hash % 15) / 10).toFixed(2));
  const beta = Number((0.6 + Math.abs(hash % 10) / 10).toFixed(2));
  const stdDev = Number((12 + Math.abs(hash % 25)).toFixed(1));
  const atr = Number((finalPrice * 0.024).toFixed(2));
  const sharpeRatio = Number((0.1 + Math.abs(hash % 13) / 10).toFixed(2));

  const newStock: StockData = {
    ticker: cleanTicker,
    name: info.name,
    sector: info.sector,
    currentPrice: finalPrice,
    changePercent24h,
    peRatio,
    dy,
    earningsYield: peRatio > 0 ? Number((100 / peRatio).toFixed(2)) : 0.0,
    beta,
    stdDev,
    atr,
    sharpeRatio,
    history30d: formatStockPoints(walk.slice(-30)),
    history90d: formatStockPoints(walk.slice(-90)),
    history180d: formatStockPoints(walk),
    vpa,
    lpa,
    dividendsPerShare,
    debtToEquity
  };

  stocksStore.push(newStock);
  return newStock;
}

// ----------------------------------------------------
// REST API Endpoint Routes
// ----------------------------------------------------

// Explicit asset activation
app.post("/api/activate-stock", (req, res) => {
  const { ticker } = req.body;
  if (!ticker) {
    return res.status(400).json({ message: "O ticker do ativo é obrigatório." });
  }

  const cleanTicker = String(ticker).trim().toUpperCase();
  if (!/^[A-Z]{4}\d{1,2}$/.test(cleanTicker)) {
    return res.status(400).json({ message: "Formato de ticker inválido. Exemplos válidos: ALOS3, SANB11, PETR4." });
  }

  const stock = getOrCreateStock(cleanTicker);
  res.json({
    message: `Ativo ${cleanTicker} ativado com sucesso!`,
    stock,
    updatedStocks: stocksStore
  });
});

// Retrieve current market assets snapshot
app.get("/api/market-data", (req, res) => {
  res.json({
    stocks: stocksStore,
    cdiContracts: cdiStore,
    asOf: new Date().toISOString()
  });
});

// Compute correlation metrics between selected assets
app.get("/api/correlation", (req, res) => {
  const { stock, cdi, period } = req.query;
  const stockTicker = String(stock || "PETR4");
  const cdiTicker = String(cdi || "DI1F27");
  const periodDays = Number(period || 90);

  const foundStock = getOrCreateStock(stockTicker);
  const foundCDI = cdiStore.find(c => c.ticker === cdiTicker);

  if (!foundStock || !foundCDI) {
    return res.status(404).json({ error: "Stock ou CDI contrato não localizado." });
  }

  const metrics = calculateCorrelationMetrics(foundStock, foundCDI, periodDays);
  res.json(metrics);
});

// Calculate premium arbitrage parameters for all tickers vs selected CDI point
app.get("/api/arbitrage", (req, res) => {
  const { cdi, riskPremium } = req.query;
  const cdiTicker = String(cdi || "DI1F27");
  const premium = Number(riskPremium || 4.5);

  const foundCDI = cdiStore.find(c => c.ticker === cdiTicker);
  if (!foundCDI) {
    return res.status(404).json({ error: "Contrato CDI futuro focado inválido ou não localizado." });
  }

  const results: ArbitrageOpportunity[] = stocksStore.map(stock => {
    return evaluateArbitrageSpread(stock, foundCDI, premium);
  });

  res.json({
    cdiTicker: foundCDI.ticker,
    cdiRate: foundCDI.yieldRate,
    premium,
    results
  });
});

// Alerts endpoints (Create, View, Delete, Evaluate Simulation)
app.get("/api/alerts", (req, res) => {
  res.json(alertsStore);
});

app.post("/api/alerts", (req, res) => {
  const { email, ticker, metric, condition, value } = req.body;
  
  if (!email || !ticker || !metric || !condition || value === undefined) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes para configurar alerta." });
  }

  const newAlert: AutomaticAlert = {
    id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email,
    ticker,
    metric,
    condition,
    value: Number(value),
    isTriggered: false,
    createdAt: new Date().toISOString()
  };

  alertsStore.unshift(newAlert);
  res.status(201).json(newAlert);
});

app.delete("/api/alerts/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = alertsStore.length;
  alertsStore = alertsStore.filter(a => a.id !== id);
  
  if (alertsStore.length < initialLength) {
    res.json({ success: true, message: "Alerta removido." });
  } else {
    res.status(404).json({ error: "Alerta não localizado." });
  }
});

// Email log reader
app.get("/api/email-logs", (req, res) => {
  res.json(emailLogsStore);
});

// CLEAR virtual mailbox log
app.post("/api/email-logs/clear", (req, res) => {
  emailLogsStore = [];
  res.json({ success: true, message: "Histórico de e-mails disparados limpo com sucesso." });
});

// SIMULATION: Fluctuate Brazilian market indices, stocks and CDI, then evaluate alerts reactive triggers
app.post("/api/market/simulate-tick", (req, res) => {
  const dateTodayStr = new Date().toISOString().split("T")[0];

  // Fluctuate CDI Futures rates mildly
  cdiStore = cdiStore.map(contract => {
    const shock = (Math.random() - 0.5) * 0.15; // DI Yield swing up or down
    const oldRate = contract.yieldRate;
    let newRate = Number((oldRate + shock).toFixed(2));
    if (newRate < 8.0) newRate = 8.0;
    if (newRate > 20.0) newRate = 20.0;

    // Mutate the latest element inside details histories to capture trend
    const history180 = [...contract.history180d];
    if (history180.length > 0) {
      history180[history180.length - 1].rate = newRate;
    }
    const history90 = [...contract.history90d];
    if (history90.length > 0) {
      history90[history90.length - 1].rate = newRate;
    }
    const history30 = [...contract.history30d];
    if (history30.length > 0) {
      history30[history30.length - 1].rate = newRate;
    }

    return {
      ...contract,
      yieldRate: newRate,
      changePercent24h: Number(((newRate - oldRate) / oldRate * 100).toFixed(2)),
      history180d: history180,
      history90d: history90,
      history30d: history30
    };
  });

  // Fluctuate Stocks prices mildly
  stocksStore = stocksStore.map(stock => {
    const baseVolatility = stock.stdDev / 100;
    // Shock factors
    const sectorShock = (Math.random() - 0.5) * 0.02;
    const individualShock = (Math.random() - 0.5) * baseVolatility * 0.2;
    
    // Check if future CDI yields climbed or crashed overall
    const avgCDIYield = cdiStore.reduce((acc, curve) => acc + curve.yieldRate, 0) / cdiStore.length;
    // Higher CDI pulls retail stock down, mildly pulls cash banks up
    let cdiPull = 0;
    if (stock.ticker === "MGLU3" || stock.ticker === "LREN3") {
      cdiPull = (11.5 - avgCDIYield) * 0.05; // Rates up pulls price down
    } else if (stock.ticker === "ITUB4") {
      cdiPull = (avgCDIYield - 11.5) * 0.02; // Rates up pulls banks mildly up
    }

    const priceShock = sectorShock + individualShock + cdiPull;
    const oldPrice = stock.currentPrice;
    let newPrice = Number((oldPrice * (1 + priceShock)).toFixed(2));
    if (newPrice < 0.2) newPrice = 0.2;

    // Adjust dividend and earnings yield calculations based on new prices!
    // Earnings Yield = 1 / PE * 100. P/E changes directly with Price.
    const originalEarnings = (1 / stock.peRatio) * oldPrice; // Constant EPS proxy
    const newPeRatio = Number((newPrice / originalEarnings).toFixed(1));
    const newEarningsYield = Number(((1 / newPeRatio) * 100).toFixed(2));
    
    // Dividend Yield also scales inversely with price
    const originalDividends = (stock.dy / 100) * oldPrice;
    const newDy = Number(((originalDividends / newPrice) * 100).toFixed(1));

    // Update histories
    const history180 = [...stock.history180d];
    if (history180.length > 0) {
      history180[history180.length - 1].price = newPrice;
    }
    const history90 = [...stock.history90d];
    if (history90.length > 0) {
      history90[history90.length - 1].price = newPrice;
    }
    const history30 = [...stock.history30d];
    if (history30.length > 0) {
      history30[history30.length - 1].price = newPrice;
    }

    return {
      ...stock,
      currentPrice: newPrice,
      changePercent24h: Number(((newPrice - oldPrice) / oldPrice * 100).toFixed(2)),
      peRatio: newPeRatio > 0 ? newPeRatio : 1.0,
      earningsYield: newEarningsYield > 0 ? newEarningsYield : 1.0,
      dy: newDy >= 0 ? newDy : 0.0,
      history180d: history180,
      history90d: history90,
      history30d: history30
    };
  });

  // Evaluate Alerts against mutated prices
  const triggeredAlertsThisTurn: AutomaticAlert[] = [];
  const activeFocusCDI = cdiStore.find(c => c.ticker === "DI1F27") || cdiStore[2]; // use 2-year DI model as reference

  alertsStore = alertsStore.map(alert => {
    // Skip if already evaluated and triggered
    if (alert.isTriggered) return alert;

    const stock = stocksStore.find(s => s.ticker === alert.ticker);
    if (!stock) return alert;

    let triggerBreached = false;
    let actualValueString = "";

    if (alert.metric === "volatility") {
      // standard deviation threshold
      const valueToCheck = stock.stdDev;
      actualValueString = `${valueToCheck.toFixed(1)}% (Desvio Padrão)`;
      if (alert.condition === "greater" && valueToCheck > alert.value) triggerBreached = true;
      if (alert.condition === "less" && valueToCheck < alert.value) triggerBreached = true;

    } else if (alert.metric === "correlation") {
      // correlation with benchmark (DI1F27 / DI curve foward)
      const corrResult = calculateCorrelationMetrics(stock, activeFocusCDI, 90);
      const valueToCheck = corrResult.correlation;
      actualValueString = `${valueToCheck.toFixed(3)} (Correlação vs ${activeFocusCDI.ticker})`;
      if (alert.condition === "greater" && valueToCheck > alert.value) triggerBreached = true;
      if (alert.condition === "less" && valueToCheck < alert.value) triggerBreached = true;

    } else if (alert.metric === "yieldSpread") {
      // yield spread (Stock Earnings yield - DI1F27 rate)
      const epSpread = stock.earningsYield - activeFocusCDI.yieldRate;
      actualValueString = `${epSpread.toFixed(2)}% (Spread E/P vs ${activeFocusCDI.ticker})`;
      if (alert.condition === "greater" && epSpread > alert.value) triggerBreached = true;
      if (alert.condition === "less" && epSpread < alert.value) triggerBreached = true;
    }

    if (triggerBreached) {
      const emailId = `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      const emailSubject = `⚠️ ALERTA AUTOMÁTICO: Limiar de Arbitragem Atingido em ${stock.ticker}`;
      const emailBody = `
        <h3>Olá Investidor,</h3>
        <p>Este é o sistema automático de monitoramento de arbitragem financeira do <strong>Mercado de Ações & CDI Futuro</strong>.</p>
        <p>Sua regra de monitoramento para o ativo <strong>${stock.ticker}</strong> disparou com sucesso em conformidade com as flutuações de mercado.</p>
        <hr/>
        <ul>
          <li><strong>Métrica Monitorada:</strong> ${alert.metric === "correlation" ? "Correlação de Mercado (90d)" : alert.metric === "volatility" ? "Volatilidade (Desvio Padrão)" : "Spread de Rendimento (Earnings Yield - CDI Futuro)"}</li>
          <li><strong>Condição Programada:</strong> deve ser <em>${alert.condition === "greater" ? "Maior que" : "Menor que"}</em> <strong>${alert.value}</strong></li>
          <li><strong>Valor Constatado em Tempo Real:</strong> ${actualValueString}</li>
          <li><strong>Preço Atual do Ativo:</strong> R$ ${stock.currentPrice.toFixed(2)} (${stock.changePercent24h >= 0 ? "+" : ""}${stock.changePercent24h}%)</li>
          <li><strong>Retorno Futuro DI de Referência (${activeFocusCDI.ticker}):</strong> ${activeFocusCDI.yieldRate.toFixed(2)}% a.a.</li>
        </ul>
        <hr/>
        <p>Identificamos este desvio como uma excelente janela para verificação de estratégias de hedging ou trade de correlação cruzada entre debêntures, contratos operacionais futuros e carteira de ações.</p>
        <p>Abra a plataforma para rodar uma análise de inteligência via IA com o Gemini para estruturar passivamente a sua operação de trade.</p>
        <br/>
        <p><em>Equipe de Arbitragem Quantitativa BRL</em></p>
      `;

      // Log triggered emails
      const sentEmail: EmailLog = {
        id: emailId,
        to: alert.email,
        subject: emailSubject,
        body: emailBody,
        sentAt: new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      emailLogsStore.unshift(sentEmail);
      
      return {
        ...alert,
        isTriggered: true,
        triggeredAt: new Date().toISOString()
      };
    }

    return alert;
  });

  res.json({
    success: true,
    message: "Preço flutuado, indicadores atualizados, triggers checados.",
    updatedStocks: stocksStore,
    updatedCDI: cdiStore,
    alerts: alertsStore,
    newEmailsSentCount: triggeredAlertsThisTurn.length
  });
});

// ----------------------------------------------------
// server-side integration of Google Gemini API (gemini-3.5-flash as default)
// ----------------------------------------------------
app.post("/api/gemini-analysis", async (req, res) => {
  const { stockTicker, cdiTicker, userContext } = req.body;

  if (!stockTicker || !cdiTicker) {
    return res.status(400).json({ error: "Ativos ausentes para processar inteligência analítica." });
  }

  const stock = getOrCreateStock(stockTicker);
  const cdi = cdiStore.find(c => c.ticker === cdiTicker);

  if (!stock || !cdi) {
    return res.status(404).json({ error: "Par de ativos não pôde ser resgatado nos bancos de dados." });
  }

  const correlation = calculateCorrelationMetrics(stock, cdi, 180);
  const arbitrage = evaluateArbitrageSpread(stock, cdi);

  const prompt = `
    Você é um analista chefe quantitativo institucional brasileiro (especialista em macroeconomia, renda fixa brasileira DIs e mercado de capitais B3).
    Por favor, analise a oportunidade de arbitragem e correlação estatística entre o seguinte par de ativos no Brasil:
    
    1. Ação: ${stock.ticker} (${stock.name})
       - Preço atual: R$ ${stock.currentPrice.toFixed(2)}
       - P/L: ${stock.peRatio.toFixed(1)}x
       - Dividend Yield: ${stock.dy.toFixed(1)}%
       - Earnings Yield (E/P): ${stock.earningsYield.toFixed(2)}%
       - Volatilidade (Desvio Padrão Mensal): ${stock.stdDev.toFixed(1)}%
       - Sensibilidade Beta vs Ibov: ${stock.beta.toFixed(2)}
       - Setor: ${stock.sector}
       
    2. Curva de CDI Futuro: ${cdi.ticker} (${cdi.label})
       - Taxa de Rendimento Futura (YTM): ${cdi.yieldRate.toFixed(2)}% ao ano
       - Duration / Vencimento Estimado: ${cdi.maturityYears.toFixed(1)} anos
       
    3. Métricas Calculadas em Tempo Real:
       - Correlação de Pearson (180 dias): ${correlation.correlation.toFixed(4)} (${correlation.interpretedStatus})
       - Elasticidade Beta-Rendimento (Sensibilidade): ${correlation.betaYield.toFixed(2)} (variação da ação para cada 1% de oscilação do juros)
       - Spread de Rendimentos (Earnings Yield - CDI Futuro Yield): ${arbitrage.adjustedSpread.toFixed(2)}%
       - Sinal Operacional Indicado pelo Algoritmo: ${arbitrage.signal}
       - Score Geral de Viabilidade (0-100): ${arbitrage.score}

    ${userContext ? `Contexto Adicional Enviado pelo Usuário: "${userContext}"` : ""}

    Instruções de Resposta:
    Você deve obrigatoriamente retornar um objeto JSON válido, contendo as seguintes propriedades descritas:
    - "stockTicker": ticker da ação (string)
    - "cdiTicker": ticker do DI (string)
    - "score": score de arbitragem de 0 a 100 (number)
    - "thesis": Uma tese de investimento analítica, clara, sem rodeios e contextualizada na realidade financeira brasileira (incluindo política fiscal, COPOM, inflação recente, duration das ações e fluxo de investimento estrangeiro) com cerca de 180 a 250 palavras em português. (string)
    - "arbitrageSteps": Um passo a passo tático (operacional) de como montar essa operação de arbitragem de correlação no mercado brasileiro (por exemplo, como operar comprado nas ações, vendido em DIs futuros via mesa, ou vice-versa, e controle de risco de oscilação). Retorne de 3 a 5 passos diretos e profissionais. (array de strings)
    - "risks": Principais riscos de cauda dessa arbitragem de tese no Brasil (mínimo de 3 riscos, ex: risco fiscal, risco liquidez de DIs, variação de câmbio ou ciclo de commodities). (array de strings)
    - "recommendation": Uma recomendação conclusiva de ação imediata ou de prudência monitorada. (string)

    Retorne APENAS um JSON estrito. Não envolva o JSON em marcadores de código como \`\`\`json ou \`\`\`. O JSON deve ser imediatamente interpretável usando JSON.parse().
  `;

  try {
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const parsedResponse = JSON.parse(result.text || "{}");
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("Gemini analysis execution error:", error);
    // Retorna fallback consistente no fracasso das chamadas da API
    res.status(500).json({
      error: true,
      message: error.message || "Erro de timeout ou autenticação na chamada da IA Gemini.",
      stockTicker,
      cdiTicker,
      score: arbitrage.score,
      thesis: `A tese quantitativa para ${stockTicker} contra ${cdiTicker} indica um spread ajustado de ${arbitrage.adjustedSpread.toFixed(2)}%. Estatisticamente, a correlação histórica de 180 dias está em ${correlation.correlation.toFixed(3)} (${correlation.interpretedStatus}). Atualmente, a indicação para este par é classificada como ${arbitrage.signal === "COMPRA_ACAO_SHORT_DI" ? "Comprar Ações e Vender DI futuro" : arbitrage.signal === "COMPRA_DI_SHORT_ACAO" ? "Aportar no CDI e Reduzir Exposição em Equities" : "Manter Posição Neutra e aguardar desvios estatísticos superiores"}.`,
      arbitrageSteps: [
        `Passo 1: Monitorar se o spread real entre o Earnings Yield da ação (${stock.earningsYield.toFixed(2)}%) e a taxa terminal do DI (${cdi.yieldRate.toFixed(2)}%) ultrapassa o desvio padrão histórico.`,
        `Passo 2: No caso de Arbitragem Ativa, operar comprado no papel Spot e assumir posição vendedora (Short) no DI Futuro correlacionado de vencimento compatível.`,
        `Passo 3: Dimensionar o hedge de modo a neutralizar a duration setorial das ações compradas.`
      ],
      risks: [
        "Risco Fiscal Elevado: Ruídos inflacionários que forcem o Banco Central do Brasil a manter ou elevar a Selic terminal prejudicam a duration das ações compradas.",
        "Risco de Liquidez Setorial: Ativos de menor liquidez (e.g. MGLU3) sofrem agressividade de custódia em momentos de 'risk-off' macroeconômico.",
        "Aceleração de Beta Cambial: Para exportadoras, depreciações excessivas do Real podem neutralizar a elasticidade estatística aos juros brasileiros."
      ],
      recommendation: `Decisão Algorítmica Conclusiva: Atuação estratégica baseada no sinal ${arbitrage.signal} com margem de segurança ajustada de volatilidade.`
    });
  }
});

// ----------------------------------------------------
// Portfolio & Custom Stock Addition API (Google Finance Real-Time Simulator)
// ----------------------------------------------------

let portfolioStore: PortfolioItem[] = [
  { id: "p-1", ticker: "PETR4", shares: 150, averagePrice: 32.50 },
  { id: "p-2", ticker: "ITUB4", shares: 200, averagePrice: 28.90 }
];

app.get("/api/portfolio", (req, res) => {
  res.json(portfolioStore);
});

app.post("/api/portfolio", (req, res) => {
  const { ticker, shares, averagePrice } = req.body;
  if (!ticker || !shares || !averagePrice) {
    return res.status(400).json({ error: "Parâmetros de carteira incompletos." });
  }

  const cleanTicker = ticker.trim().toUpperCase();
  const index = portfolioStore.findIndex(p => p.ticker === cleanTicker);

  // If stock is not already in the global stock store, seed it with generic real-time data
  const stockExists = stocksStore.some(s => s.ticker === cleanTicker);
  if (!stockExists) {
    // Generate standard simulated asset attributes
    const dummyNames: Record<string, string> = {
      "BBAS3": "Banco do Brasil S.A.",
      "VALE3": "Vale S.A.",
      "EQTL3": "Equatorial Energia S.A.",
      "B3SA3": "B3 S.A. - Brasil, Bolsa, Balcão",
      "VBBR3": "Vibra Energia S.A.",
      "CSNA3": "Companhia Siderúrgica Nacional",
      "GGBR4": "Gerdau S.A."
    };
    const defaultName = dummyNames[cleanTicker] || `${cleanTicker} Empreendimentos S.A.`;
    const defaultSectors: Record<string, string> = {
      "BBAS3": "Serviços Financeiros",
      "B3SA3": "Serviços Financeiros",
      "EQTL3": "Utilidade Pública",
      "VBBR3": "Distribuição e Combustível"
    };
    const defaultSector = defaultSectors[cleanTicker] || "Outros Setores / B3";

    const basePrice = Number(averagePrice);
    const dates180 = generateHistoryDates(180);
    const mockWalk: number[] = [basePrice];
    
    for (let i = 1; i < dates180.length; i++) {
      const prev = mockWalk[mockWalk.length - 1];
      const randShock = (Math.random() - 0.5) * 2;
      const val = prev * (1 - 0.0002 + 0.015 * randShock);
      mockWalk.push(Number(val.toFixed(2)));
    }
    mockWalk.reverse();

    const formatStockPoints = (walk: number[]): PricePoint[] => {
      return walk.map((val, idx) => ({ date: dates180[idx], price: val }));
    };

    const newStock: StockData = {
      ticker: cleanTicker,
      name: defaultName,
      sector: defaultSector,
      currentPrice: basePrice,
      changePercent24h: 0.45,
      peRatio: 7.8,
      dy: 6.2,
      earningsYield: 12.82,
      beta: 1.0,
      stdDev: 21.0,
      atr: Number((basePrice * 0.022).toFixed(2)),
      sharpeRatio: 0.95,
      history30d: formatStockPoints(mockWalk.slice(-30)),
      history90d: formatStockPoints(mockWalk.slice(-90)),
      history180d: formatStockPoints(mockWalk),
      vpa: Number((basePrice * 0.85).toFixed(2)),
      lpa: Number((basePrice / 7.8).toFixed(2)),
      dividendsPerShare: Number((basePrice * 0.062).toFixed(2)),
      debtToEquity: 0.55
    };
    stocksStore.push(newStock);
  }

  if (index >= 0) {
    portfolioStore[index] = {
      ...portfolioStore[index],
      shares: Number(shares),
      averagePrice: Number(averagePrice)
    };
    return res.json(portfolioStore[index]);
  } else {
    const newItem: PortfolioItem = {
      id: `p-${Date.now()}`,
      ticker: cleanTicker,
      shares: Number(shares),
      averagePrice: Number(averagePrice)
    };
    portfolioStore.push(newItem);
    return res.status(201).json(newItem);
  }
});

app.delete("/api/portfolio/:id", (req, res) => {
  const { id } = req.params;
  portfolioStore = portfolioStore.filter(p => p.id !== id);
  res.json({ success: true, message: "Ativo removido da carteira." });
});

// Create a custom stock directly in the market sandbox (representing real-time user action)
app.post("/api/custom-stocks", (req, res) => {
  const { ticker, name, sector, price, peRatio, dy, stdDev, beta, vpa, lpa, dividendsPerShare, debtToEquity } = req.body;
  
  if (!ticker || !name || !sector) {
    return res.status(400).json({ error: "Ticker, Nome e Setor são campos obrigatórios." });
  }

  const cleanTicker = ticker.trim().toUpperCase();
  const currentPrice = Number(price || 30.0);
  const pe = Number(peRatio || 10.0);
  const divYield = Number(dy || 5.0);
  const sd = Number(stdDev || 20.0);
  const b = Number(beta || 1.0);

  // Fallbacks for valuation metrics
  const finalVpa = vpa ? Number(vpa) : Number((currentPrice / 1.2).toFixed(2));
  const finalLpa = lpa ? Number(lpa) : (pe > 0 ? Number((currentPrice / pe).toFixed(2)) : 0.0);
  const finalDpa = dividendsPerShare ? Number(dividendsPerShare) : Number((currentPrice * (divYield / 100)).toFixed(2));
  const finalDebtToEquity = debtToEquity ? Number(debtToEquity) : 0.6;

  const dates180 = generateHistoryDates(180);
  const history: number[] = [currentPrice];
  const volatilityDayFactor = sd / 100 / 12; // approximate daily relative volatility

  for (let i = 1; i < dates180.length; i++) {
    const prev = history[history.length - 1];
    const randShock = (Math.random() - 0.5) * 2;
    let val = prev * (1 + 0.0001 + volatilityDayFactor * randShock * 0.25);
    if (val < 0.5) val = 0.5;
    history.push(Number(val.toFixed(2)));
  }
  history.reverse();

  const formatStockPoints = (walk: number[]): PricePoint[] => {
    return walk.map((val, idx) => ({ date: dates180[idx], price: val }));
  };

  const newStock: StockData = {
    ticker: cleanTicker,
    name: name.trim(),
    sector: sector.trim(),
    currentPrice,
    changePercent24h: 0.0,
    peRatio: pe,
    dy: divYield,
    earningsYield: pe > 0 ? Number(((1 / pe) * 100).toFixed(2)) : 0.0,
    beta: b,
    stdDev: sd,
    atr: Number((currentPrice * 0.024).toFixed(2)),
    sharpeRatio: Number((0.3 + Math.random() * 0.9).toFixed(2)),
    history30d: formatStockPoints(history.slice(-30)),
    history90d: formatStockPoints(history.slice(-90)),
    history180d: formatStockPoints(history),
    vpa: finalVpa,
    lpa: finalLpa,
    dividendsPerShare: finalDpa,
    debtToEquity: finalDebtToEquity
  };

  const existingIdx = stocksStore.findIndex(s => s.ticker === cleanTicker);
  if (existingIdx >= 0) {
    stocksStore[existingIdx] = newStock;
  } else {
    stocksStore.push(newStock);
  }

  res.status(201).json(newStock);
});

// ----------------------------------------------------
// Front-end Server Mounting & Bundling Setup
// ----------------------------------------------------
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
