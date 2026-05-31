/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  StockData, 
  CDIContract, 
  PortfolioItem, 
  AutomaticAlert, 
  EmailLog, 
  MarketCorrelation, 
  ArbitrageOpportunity,
  GeminiAnalysisResponse
} from "./types.js";
import YieldCurveChart from "./components/YieldCurveChart.js";
import CorrelationChart from "./components/CorrelationChart.js";
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  SlidersHorizontal, 
  Briefcase, 
  Bell, 
  Cpu, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  Sparkles, 
  Inbox, 
  ArrowRightLeft, 
  HelpCircle, 
  Database,
  ArrowUpRight,
  User,
  AlertTriangle,
  Mail,
  CheckCircle2,
  Bookmark,
  ChevronRight,
  Info
} from "lucide-react";

export default function App() {
  // Navigation & Active States
  const [activeTab, setActiveTab] = useState<"dashboard" | "portfolio" | "alerts" | "sandbox">("dashboard");
  const [viewMode, setViewMode] = useState<"quant" | "valuation">("quant");
  const [targetYield, setTargetYield] = useState<number>(6.0); // Barsi/Bazin target Yield %
  const [selectedStockTicker, setSelectedStockTicker] = useState<string>("PETR4");
  const [selectedCDITicker, setSelectedCDITicker] = useState<string>("DI1F27");
  const [periodDays, setPeriodDays] = useState<number>(90);

  // Raw Database states
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [cdiContracts, setCdiContracts] = useState<CDIContract[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<AutomaticAlert[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  
  // Calculated analytic parameters
  const [activeCorrelation, setActiveCorrelation] = useState<MarketCorrelation | null>(null);
  const [arbitrageSpreads, setArbitrageSpreads] = useState<ArbitrageOpportunity[]>([]);
  const [riskPremium, setRiskPremium] = useState<number>(4.5);

  // Filter States (Painel Geral)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [volatilityFilter, setVolatilityFilter] = useState<string>("all");
  const [betaFilter, setBetaFilter] = useState<string>("all");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [signalFilter, setSignalFilter] = useState<string>("all");

  // Interaction feedback states
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationLog, setSimulationLog] = useState<string>("");
  const [isSuccessToast, setIsSuccessToast] = useState<string | null>(null);

  // Gemini analyst state
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysisResponse | null>(null);
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);
  const [geminiNotes, setGeminiNotes] = useState<string>("");
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Interactive Custom Form states
  const [portfolioForm, setPortfolioForm] = useState({ ticker: "", shares: "", avgPrice: "" });
  const [alertForm, setAlertForm] = useState({ 
    email: "renato.jrrod@gmail.com", 
    ticker: "MGLU3", 
    metric: "correlation" as AutomaticAlert["metric"], 
    condition: "less" as AutomaticAlert["condition"], 
    value: "" 
  });
  const [customStockForm, setCustomStockForm] = useState({
    ticker: "",
    name: "",
    sector: "Serviços Financeiros",
    price: "",
    peRatio: "",
    dy: "",
    stdDev: "",
    beta: "",
    vpa: "",
    lpa: "",
    dividendsPerShare: "",
    debtToEquity: ""
  });

  // Fetch core API data
  const loadMarketAndStateData = async (toastMessage?: string) => {
    try {
      const marketRes = await fetch("/api/market-data");
      const marketData = await marketRes.json();
      setStocks(marketData.stocks);
      setCdiContracts(marketData.cdiContracts);

      const portfolioRes = await fetch("/api/portfolio");
      const portfolioData = await portfolioRes.json();
      setPortfolio(portfolioData);

      const alertsRes = await fetch("/api/alerts");
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);

      const logsRes = await fetch("/api/email-logs");
      const logsData = await logsRes.json();
      setEmailLogs(logsData);

      if (toastMessage) {
        setIsSuccessToast(toastMessage);
        setTimeout(() => setIsSuccessToast(null), 4000);
      }
    } catch (e) {
      console.error("Erro ao sincronizar dados com o servidor:", e);
    }
  };

  // Triggered on page load
  useEffect(() => {
    loadMarketAndStateData();
  }, []);

  // Recalculates correlations whenever tickers or periods alter
  useEffect(() => {
    if (selectedStockTicker && selectedCDITicker) {
      fetch(`/api/correlation?stock=${selectedStockTicker}&cdi=${selectedCDITicker}&period=${periodDays}`)
        .then((res) => res.json())
        .then((data) => setActiveCorrelation(data))
        .catch(console.error);
    }
  }, [selectedStockTicker, selectedCDITicker, periodDays, stocks, cdiContracts]);

  // Recalculates arbitrage opportunities whenever CDI contract or risk premium alters
  useEffect(() => {
    if (selectedCDITicker) {
      fetch(`/api/arbitrage?cdi=${selectedCDITicker}&riskPremium=${riskPremium}`)
        .then((res) => res.json())
        .then((data) => setArbitrageSpreads(data.results || []))
        .catch(console.error);
    }
  }, [selectedCDITicker, riskPremium, stocks, cdiContracts]);

  // Handle simulated volatility ticks
  const handleSimulateTick = async () => {
    setIsSimulating(true);
    setSimulationLog("Executando simulação de liquidez no fechamento...");
    try {
      const res = await fetch("/api/market/simulate-tick", { method: "POST" });
      const data = await res.json();
      
      setStocks(data.updatedStocks);
      setCdiContracts(data.updatedCDI);
      setAlerts(data.alerts);
      
      // Fetch latest logs to check for virtual emails
      const logsRes = await fetch("/api/email-logs");
      const logsData = await logsRes.json();
      setEmailLogs(logsData);

      const messages = [
        "Ajuste quantitativo de fechamento simulado.",
        `B3 Ativos flutuados de acordo com volatilidades históricas.`,
        `Curva de juros futura (DIv) recalculada.`
      ];
      setSimulationLog(messages[Math.floor(Math.random() * messages.length)]);
      
      setIsSuccessToast("Preços de mercado flutuados! Triggers de e-mail reavaliados.");
      setTimeout(() => {
        setIsSuccessToast(null);
        setSimulationLog("");
      }, 5000);

    } catch (err) {
      console.error("Simulado tick falhou", err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Portfolio actions
  const handleAddToPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ticker, shares, avgPrice } = portfolioForm;
    if (!ticker || !shares || !avgPrice) return;

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase().trim(),
          shares: Number(shares),
          averagePrice: Number(avgPrice)
        })
      });

      if (res.ok) {
        setPortfolioForm({ ticker: "", shares: "", avgPrice: "" });
        loadMarketAndStateData("Ativo adicionado à sua carteira com sucesso.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePortfolioItem = async (id: string) => {
    try {
      const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadMarketAndStateData("Ativo removido da carteira.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom Alert actions
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const { email, ticker, metric, condition, value } = alertForm;
    if (value === "") return;

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ticker,
          metric,
          condition,
          value: Number(value)
        })
      });

      if (res.ok) {
        setAlertForm({ email: "renato.jrrod@gmail.com", ticker: "MGLU3", metric: "correlation", condition: "less", value: "" });
        loadMarketAndStateData("Alerta programado! Rodar simulação caso deseje forçar disparo.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadMarketAndStateData("Alerta excluído.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearEmailLogs = async () => {
    try {
      const res = await fetch("/api/email-logs/clear", { method: "POST" });
      if (res.ok) {
        loadMarketAndStateData("Caixa postal virtual limpa.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom Stock sandbox creation action
  const handleCreateCustomStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ticker, name, sector, price, peRatio, dy, stdDev, beta, vpa, lpa, dividendsPerShare, debtToEquity } = customStockForm;
    if (!ticker || !name || !sector) return;

    try {
      const res = await fetch("/api/custom-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase().trim(),
          name,
          sector,
          price: price ? Number(price) : undefined,
          peRatio: peRatio ? Number(peRatio) : undefined,
          dy: dy ? Number(dy) : undefined,
          stdDev: stdDev ? Number(stdDev) : undefined,
          beta: beta ? Number(beta) : undefined,
          vpa: vpa ? Number(vpa) : undefined,
          lpa: lpa ? Number(lpa) : undefined,
          dividendsPerShare: dividendsPerShare ? Number(dividendsPerShare) : undefined,
          debtToEquity: debtToEquity ? Number(debtToEquity) : undefined
        })
      });

      if (res.ok) {
        setCustomStockForm({
          ticker: "",
          name: "",
          sector: "Serviços Financeiros",
          price: "",
          peRatio: "",
          dy: "",
          stdDev: "",
          beta: "",
          vpa: "",
          lpa: "",
          dividendsPerShare: "",
          debtToEquity: ""
        });
        setSelectedStockTicker(ticker.toUpperCase().trim());
        loadMarketAndStateData(`Ativo B3 ${ticker.toUpperCase()} criado e inserido no monitorador.`);
        setActiveTab("dashboard");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Activate any Brazilian stock ticker from B3 on-demand
  const handleActivateStock = async (tickerToActivate: string) => {
    const cleanTicker = tickerToActivate.trim().toUpperCase();
    if (!cleanTicker) return;

    try {
      const res = await fetch("/api/activate-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: cleanTicker })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedStockTicker(cleanTicker);
        setSearchQuery("");
        loadMarketAndStateData(`Ativo ${cleanTicker} ativado com sucesso na B3 e integrado ao monitoramento.`);
      } else {
        setIsSuccessToast(data.message || "Erro no formato do ticker.");
        setTimeout(() => setIsSuccessToast(null), 4500);
      }
    } catch (err) {
      console.error(err);
      setIsSuccessToast("Erro ao conectar com o serviço de ativação.");
      setTimeout(() => setIsSuccessToast(null), 4500);
    }
  };

  // Call server-side Gemini Quantitative Analysis
  const runGeminiAnalysis = async () => {
    setGeminiLoading(true);
    setGeminiError(null);
    setGeminiAnalysis(null);

    try {
      const res = await fetch("/api/gemini-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockTicker: selectedStockTicker,
          cdiTicker: selectedCDITicker,
          userContext: geminiNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGeminiAnalysis(data);
      } else {
        setGeminiError(data.message || "Erro desconhecido ao chamar modelo parceiro.");
      }
    } catch (e) {
      setGeminiError("Falha crítica na rede ou timeout ao processar IA do Gemini.");
    } finally {
      setGeminiLoading(false);
    }
  };

  // Quantitative Filter Logic for general dashboard listings
  const filteredStocks = stocks.filter((stock) => {
    // Search query
    const matchesSearch = stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          stock.name.toLowerCase().includes(searchQuery.toLowerCase());

    // Volatility Filter
    let matchesVolatility = true;
    if (volatilityFilter === "low") matchesVolatility = stock.stdDev < 18.0;
    else if (volatilityFilter === "mod") matchesVolatility = stock.stdDev >= 18.0 && stock.stdDev <= 30.0;
    else if (volatilityFilter === "high") matchesVolatility = stock.stdDev > 30.0;

    // Beta Filter
    let matchesBeta = true;
    if (betaFilter === "defensive") matchesBeta = stock.beta < 0.8;
    else if (betaFilter === "beta-1") matchesBeta = stock.beta >= 0.8 && stock.beta <= 1.2;
    else if (betaFilter === "aggressive") matchesBeta = stock.beta > 1.2;

    // Sector Filter
    let matchesSector = true;
    if (sectorFilter === "energy") matchesSector = stock.sector.toLowerCase().includes("energia");
    else if (sectorFilter === "mining") matchesSector = stock.sector.toLowerCase().includes("miner") || stock.sector.toLowerCase().includes("sider");
    else if (sectorFilter === "retail") matchesSector = stock.sector.toLowerCase().includes("varejo") || stock.sector.toLowerCase().includes("consumo");
    else if (sectorFilter === "utility") matchesSector = stock.sector.toLowerCase().includes("útil") || stock.sector.toLowerCase().includes("elétr");
    else if (sectorFilter === "banks") matchesSector = stock.sector.toLowerCase().includes("finan") || stock.sector.toLowerCase().includes("banc");

    // Signal filter Match against calculated spreads
    let matchesSignal = true;
    if (signalFilter !== "all") {
      const opObj = arbitrageSpreads.find(a => a.stockTicker === stock.ticker);
      if (opObj) {
        if (signalFilter === "buy_stock") matchesSignal = opObj.signal === "COMPRA_ACAO_SHORT_DI";
        else if (signalFilter === "buy_di") matchesSignal = opObj.signal === "COMPRA_DI_SHORT_ACAO";
        else if (signalFilter === "hold") matchesSignal = opObj.signal === "HOLD_NEUTRO";
      } else {
        matchesSignal = false;
      }
    }

    return matchesSearch && matchesVolatility && matchesBeta && matchesSector && matchesSignal;
  });

  // Calculate Weighted Portfolio Statistics
  const calculatePortfolioStats = () => {
    if (portfolio.length === 0) return null;

    let totalInvested = 0;
    let totalCurrentVal = 0;
    let weightedYieldSum = 0;
    let weightedBetaSum = 0;
    let weightedStdDevSum = 0;

    portfolio.forEach((item) => {
      const stock = stocks.find((s) => s.ticker === item.ticker);
      const currentPrice = stock ? stock.currentPrice : item.averagePrice;
      const earningsYield = stock ? stock.earningsYield : 10.0;
      const betaVal = stock ? stock.beta : 1.0;
      const stdDev = stock ? stock.stdDev : 20.0;

      const itemCost = item.shares * item.averagePrice;
      const itemCurrent = item.shares * currentPrice;

      totalInvested += itemCost;
      totalCurrentVal += itemCurrent;

      weightedYieldSum += earningsYield * itemCurrent;
      weightedBetaSum += betaVal * itemCurrent;
      weightedStdDevSum += stdDev * itemCurrent;
    });

    const portfolioReturnPct = totalInvested > 0 
      ? ((totalCurrentVal - totalInvested) / totalInvested) * 100 
      : 0;

    const weightedEarningsYield = totalCurrentVal > 0 
      ? weightedYieldSum / totalCurrentVal 
      : 0;

    const weightedBeta = totalCurrentVal > 0 
      ? weightedBetaSum / totalCurrentVal 
      : 1.0;

    const weightedVolatility = totalCurrentVal > 0 
      ? weightedStdDevSum / totalCurrentVal 
      : 20.0;

    // Compare with selected CDI Contract rate
    const refDI = cdiContracts.find(c => c.ticker === selectedCDITicker) || cdiContracts[2];
    const diRate = refDI ? refDI.yieldRate : 11.5;

    // Index vs DI comparison score
    const pYieldSpreadPercent = weightedEarningsYield - diRate;

    return {
      totalInvested,
      totalCurrentVal,
      pYieldSpreadPercent,
      portfolioReturnPct,
      weightedEarningsYield,
      weightedBeta,
      weightedVolatility,
      diRate,
      diTicker: refDI ? refDI.ticker : "DI1F27"
    };
  };

  const portfolioStats = calculatePortfolioStats();
  const focusedStockObj = stocks.find((s) => s.ticker === selectedStockTicker);
  const focusedCDIObj = cdiContracts.find((c) => c.ticker === selectedCDITicker);
  const focusedArbitrageObj = arbitrageSpreads.find((a) => a.stockTicker === selectedStockTicker);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" id="arbitrage-app">
      {/* Dynamic Success alerts */}
      {isSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-800 text-emerald-300 px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3.5 transition-all duration-300 animate-slide-up" id="toast-success">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block">Reflexão de Mercado</span>
            <span>{isSuccessToast}</span>
          </div>
        </div>
      )}

      {/* TOP HEADER CONTROLS */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white font-sans">
                Arbitragem de Ações B3 & CDI Futuro
              </h1>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              Mapeamento quantitativo de correlação de volatilidade, arbitragem patrimonial e swaps implícitos
            </p>
          </div>

          {/* Global actions: DI Future contract focus selection & Simulation Engine */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 font-mono">CONTRATO DI ALVO:</p>
              <select
                id="global-di-selector"
                value={selectedCDITicker}
                onChange={(e) => setSelectedCDITicker(e.target.value)}
                className="bg-transparent text-xs text-emerald-400 font-bold border-none focus:outline-none cursor-pointer"
              >
                {cdiContracts.map((c) => (
                  <option key={c.ticker} value={c.ticker} className="bg-slate-900 text-slate-200">
                    {c.ticker} ({c.yieldRate.toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-slate-400 font-mono">PRÊMIO RISCO:</p>
              <input
                id="risk-premium-input"
                type="number"
                step="0.5"
                min="0"
                max="15"
                value={riskPremium}
                onChange={(e) => setRiskPremium(Number(e.target.value))}
                className="bg-transparent text-xs text-emerald-400 font-bold border-none w-10 text-center focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">%</span>
            </div>

            <button
              id="simulation-tick-btn"
              onClick={handleSimulateTick}
              disabled={isSimulating}
              className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all border shadow ${
                isSimulating
                  ? "bg-slate-800/50 text-slate-500 border-slate-700 cursor-not-allowed"
                  : "bg-emerald-500 text-slate-950 border-emerald-400 hover:bg-emerald-400"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? "animate-spin" : ""}`} />
              <span>{isSimulating ? "Calculando..." : "Flutuar Mercado BRL"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* QUICK SYSTEM FEED STATUS */}
      {simulationLog && (
        <div className="bg-emerald-950/20 border-b border-emerald-950 text-emerald-400 py-2 text-[11px] font-mono" id="feed-log-banner">
          <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              <span>Feed Quant B3: {simulationLog}</span>
            </div>
            <span className="text-slate-400">Live UTC</span>
          </div>
        </div>
      )}

      {/* PRIMARY NAVIGATION TABS */}
      <nav className="border-b border-slate-800 bg-slate-900/10">
        <div className="max-w-7xl mx-auto w-full px-6 flex space-x-5">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab("dashboard")}
            className={`py-3 text-xs font-medium tracking-wide border-b-2 transition-all ${
              activeTab === "dashboard"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Painel Geral & Correlação
          </button>
          <button
            id="tab-portfolio"
            onClick={() => setActiveTab("portfolio")}
            className={`py-3 text-xs font-medium tracking-wide flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === "portfolio"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Minha Carteira</span>
            {portfolio.length > 0 && (
              <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {portfolio.length}
              </span>
            )}
          </button>
          <button
            id="tab-alerts"
            onClick={() => setActiveTab("alerts")}
            className={`py-3 text-xs font-medium tracking-wide flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === "alerts"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alertas E-mail</span>
            {alerts.filter(a => !a.isTriggered).length > 0 && (
              <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded-full">
                {alerts.filter(a => !a.isTriggered).length}
              </span>
            )}
          </button>
          <button
            id="tab-sandbox"
            onClick={() => setActiveTab("sandbox")}
            className={`py-3 text-xs font-medium tracking-wide flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === "sandbox"
                ? "border-emerald-400 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cadastrar Ativo</span>
          </button>
        </div>
      </nav>

      {/* MAIN LAYOUT */}
      <div className="max-w-7xl mx-auto w-full flex-1">
        <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* PRIMARY WORKSPACE */}
          <section className="lg:col-span-12 flex flex-col space-y-6">

            {/* TAB 1: DASHBOARD & ACTIVE MONITORING */}
          {activeTab === "dashboard" && (
            <div className="space-y-6" id="dashboard-tab-content">
              
              {/* CDI FUTURES SUMMARY CARDS HEADER */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {cdiContracts.map((di) => {
                  const isSelected = di.ticker === selectedCDITicker;
                  return (
                    <div
                      id={`di-summary-card-${di.ticker}`}
                      key={di.ticker}
                      onClick={() => setSelectedCDITicker(di.ticker)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-slate-900 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.1)] scale-[1.01]"
                          : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">
                        {di.ticker === "DI1F25" ? "Curto Prazo" : di.ticker === "DI1F27" ? "Médio Prazo - 2A" : di.ticker === "DI1F31" ? "Longo Prazo - 6A" : "DI Terminal"}
                      </span>
                      <div className="text-base font-mono font-extrabold text-white mt-1">
                        {di.yieldRate.toFixed(2)}% <span className="text-[10px] font-normal text-slate-400">a.a.</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                        <span>{di.ticker}</span>
                        <span className={di.changePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {di.changePercent24h >= 0 ? "+" : ""}{di.changePercent24h}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TWO CHART PAIRINGS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Curve plotted */}
                <YieldCurveChart 
                  cdiContracts={cdiContracts} 
                  selectedContract={selectedCDITicker} 
                  onSelectContract={setSelectedCDITicker}
                  stocks={stocks}
                />

                {/* 2. Focused Dual Graph overlay */}
                {focusedStockObj && focusedCDIObj ? (
                  <CorrelationChart 
                    stock={focusedStockObj} 
                    cdi={focusedCDIObj} 
                    periodDays={periodDays} 
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-center text-slate-400 text-xs">
                    Selecione um ativo na tabela para renderizar a divergência diária.
                  </div>
                )}
              </div>

              {/* B3 STOCKS TABLE SEARCH & ADVANCED FILTERS CONTAINER */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5" id="stock-list-container">
                <div className="flex flex-col space-y-4 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-sans font-semibold text-sm text-slate-200">
                      Oportunidades de Arbitragem vs Curva {selectedCDITicker} ({focusedCDIObj?.yieldRate.toFixed(2)}% a.a.)
                    </h3>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        id="stock-search-input"
                        type="text"
                        placeholder="Buscar ativo por ticker ou nome..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg pl-9 pr-3 py-2 w-full sm:w-64 focus:outline-none focus:border-emerald-500/80 transition-all font-sans text-slate-200"
                      />
                    </div>
                  </div>

                  {/* ADVANCED QUANT FILTERS ROW */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-slate-800/60 pt-4 text-xs font-sans">
                    {/* Volatility Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-semibold">FILTRO VOLATILIDADE</label>
                      <select
                        id="filter-volatility"
                        value={volatilityFilter}
                        onChange={(e) => setVolatilityFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 w-full text-slate-300 focus:outline-none"
                      >
                        <option value="all">Todas</option>
                        <option value="low">Baixa (&lt;18%)</option>
                        <option value="mod">Moderada (18%-30%)</option>
                        <option value="high">Alta (&gt;30%)</option>
                      </select>
                    </div>

                    {/* Beta Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-semibold font-sans">COEFICIENTE BETA</label>
                      <select
                        id="filter-beta"
                        value={betaFilter}
                        onChange={(e) => setBetaFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 w-full text-slate-300 focus:outline-none"
                      >
                        <option value="all">Todos</option>
                        <option value="defensive">Defensivos (Beta &lt; 0.8)</option>
                        <option value="beta-1">Mercado (0.8 - 1.2)</option>
                        <option value="aggressive">Agressivos (Beta &gt; 1.2)</option>
                      </select>
                    </div>

                    {/* Sector Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-semibold">SETOR B3</label>
                      <select
                        id="filter-sector"
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 w-full text-slate-300 focus:outline-none"
                      >
                        <option value="all">Todos os setores</option>
                        <option value="banks">Finanças & Bancos</option>
                        <option value="energy">Petróleo & Energia</option>
                        <option value="retail">Consumo & Varejo</option>
                        <option value="utility">Utilidade Pública</option>
                        <option value="mining">Mineração & Metólogos</option>
                      </select>
                    </div>

                    {/* Signal Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-semibold">RECOMENDAÇÃO</label>
                      <select
                        id="filter-signal"
                        value={signalFilter}
                        onChange={(e) => setSignalFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-1.5 w-full text-slate-300 focus:outline-none"
                      >
                        <option value="all">Qualquer Sinal</option>
                        <option value="buy_stock">COMPRA AÇÃO (Long Stock/Short DI)</option>
                        <option value="buy_di">COMPRA DI (Long DI/Short Stock)</option>
                        <option value="hold">HOLD NEUTRO</option>
                      </select>
                    </div>

                    {/* Clear Filters indicator Button */}
                    <div className="flex items-end">
                      <button
                        id="clear-filters-btn"
                        onClick={() => {
                          setVolatilityFilter("all");
                          setBetaFilter("all");
                          setSectorFilter("all");
                          setSignalFilter("all");
                          setSearchQuery("");
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono px-3 py-2 rounded-lg w-full transition-all text-center"
                      >
                        Resetar Filtros
                      </button>
                    </div>
                  </div>
                </div>

                {/* HISTORICAL TIMEFRAME SELECTORS */}
                <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-slate-800/50 pt-3.5 mb-3 gap-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-slate-400 text-[11px] block">
                      Mostrando <strong className="text-slate-300">{filteredStocks.length}</strong> de <strong className="text-slate-300">{stocks.length}</strong> ativos cadastrados
                    </span>
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 select-none">
                      <button
                        id="view-mode-quant-btn"
                        type="button"
                        onClick={() => setViewMode("quant")}
                        className={`px-3 py-1 text-[10px] rounded-md transition-all font-semibold ${
                          viewMode === "quant"
                            ? "bg-slate-800 text-emerald-400 font-extrabold border border-slate-705"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Arbitragem vs CDI (Quant)
                      </button>
                      <button
                        id="view-mode-valuation-btn"
                        type="button"
                        onClick={() => setViewMode("valuation")}
                        className={`px-3 py-1 text-[10px] rounded-md transition-all font-semibold ${
                          viewMode === "valuation"
                            ? "bg-slate-800 text-emerald-400 font-extrabold border border-slate-705"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Valuation Fundamentalista (Barsi/Bazin/Graham)
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {viewMode === "valuation" && (
                      <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                        <span className="text-[9px] text-slate-400 font-mono">D.Y. ALVO:</span>
                        <input
                          id="target-yield-val-input"
                          type="number"
                          step="0.5"
                          min="1"
                          max="20"
                          value={targetYield}
                          onChange={(e) => setTargetYield(Number(e.target.value))}
                          className="bg-transparent text-[10px] font-mono text-emerald-400 font-bold w-10 text-center focus:outline-none border-none"
                        />
                        <span className="text-[9px] text-slate-500 font-mono">%</span>
                      </div>
                    )}
                    <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                      {[30, 90, 180].map((days) => (
                        <button
                          id={`period-btn-${days}`}
                          key={days}
                          onClick={() => setPeriodDays(days)}
                          className={`px-3 py-1 text-[10px] font-mono rounded-md transition-all ${
                            periodDays === days
                              ? "bg-emerald-500 text-slate-950 font-extrabold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {days === 180 ? "6 MESES" : days === 90 ? "3 MESES" : "30 DIAS"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MAIN ASSETS DATAGRID */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      {viewMode === "quant" ? (
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                          <th className="py-2.5 px-3">Ticker</th>
                          <th className="py-2.5 px-2">Preço spot</th>
                          <th className="py-2.5 px-2">Volatilidade (std)</th>
                          <th className="py-2.5 px-2">E/P (Lucro/P)</th>
                          <th className="py-2.5 px-2">E/P vs CDI</th>
                          <th className="py-2.5 px-2">Arbitragem Score</th>
                          <th className="py-2.5 px-3 text-right">Direcionamento</th>
                        </tr>
                      ) : (
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                          <th className="py-2.5 px-3">Ticker / Setor</th>
                          <th className="py-2.5 px-2">Preço Spot</th>
                          <th className="py-2.5 px-2">VPA & LPA</th>
                          <th className="py-2.5 px-2">Preço Justo (Graham)</th>
                          <th className="py-2.5 px-3">Preço Teto (Barsi)</th>
                          <th className="py-2.5 px-3">Bazin (6% Yield Alvo)</th>
                          <th className="py-2.5 px-3 text-right">Recomendação Graham/Barsi</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredStocks.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <span>Nenhum ativo localizado com os filtros vigentes.</span>
                              {searchQuery && (
                                <div className="mt-2 text-slate-350 bg-slate-950/60 p-4 border border-slate-850 rounded-xl max-w-sm mx-auto shadow-inner">
                                  <p className="text-[11px] mb-2 text-slate-400 leading-relaxed font-sans">
                                    Quer monitorar uma nova ação brasileira que não está pré-carregada?
                                  </p>
                                  {/^[A-Za-z]{4}\d{1,2}$/.test(searchQuery) ? (
                                    <button
                                      id="activate-missing-search-btn"
                                      type="button"
                                      onClick={() => handleActivateStock(searchQuery)}
                                      className="w-full inline-flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-sans text-[11px] select-none transition-all duration-150 shadow-md transform active:scale-95"
                                    >
                                      <span>Ativar e Monitorar "{searchQuery.toUpperCase()}"</span>
                                    </button>
                                  ) : (
                                    <div className="text-[10px] text-slate-500 italic mt-1 font-mono">
                                      Digite um ticker válido (ex: SANB11, ALOS3, AMER3) para ativar na B3
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStocks.map((stock) => {
                          const isSelected = stock.ticker === selectedStockTicker;
                          const opObj = arbitrageSpreads.find((a) => a.stockTicker === stock.ticker);
                          
                          if (viewMode === "quant") {
                            // Ep Spread vs Active CDI
                            const epSpread = stock.earningsYield - (focusedCDIObj?.yieldRate || 11.5);
                            return (
                              <tr
                                id={`stock-row-${stock.ticker}`}
                                key={stock.ticker}
                                onClick={() => setSelectedStockTicker(stock.ticker)}
                                className={`cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-slate-800/65 text-white"
                                    : "hover:bg-slate-850/40 text-slate-300"
                                }`}
                              >
                                <td className="py-3 px-3 font-mono">
                                  <div className="font-extrabold text-white flex items-center space-x-1">
                                    <span>{stock.ticker}</span>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">{stock.name}</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="font-bold">R$ {stock.currentPrice.toFixed(2)}</div>
                                  <div className={`text-[10px] ${stock.changePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {stock.changePercent24h >= 0 ? "+" : ""}{stock.changePercent24h.toFixed(2)}%
                                  </div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="font-semibold text-slate-200">{stock.stdDev.toFixed(1)}%</div>
                                  <div className="text-[10.5px] text-slate-400 font-sans">Beta: {stock.beta.toFixed(2)}</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="font-semibold text-slate-200">{stock.earningsYield.toFixed(2)}%</div>
                                  <div className="text-[10px] text-slate-400 font-sans">DY: {stock.dy.toFixed(1)}%</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className={`font-semibold ${epSpread >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {epSpread >= 0 ? "+" : ""}{epSpread.toFixed(2)}%
                                  </div>
                                  <div className="text-[9.5px] text-slate-500 font-sans">Spread Real</div>
                                </td>
                                <td className="py-3 px-2">
                                  {opObj && (
                                    <div className="flex items-center space-x-2">
                                      <div className="w-10 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                        <div 
                                          className={`h-full ${
                                            opObj.score >= 70 ? "bg-emerald-500" : opObj.score >= 40 ? "bg-amber-500" : "bg-rose-500"
                                          }`} 
                                          style={{ width: `${opObj.score}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-mono font-bold text-[11px] text-slate-200">{opObj.score}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  {opObj && (
                                    <span className={`inline-block text-[9.5px] font-mono font-bold px-2 py-1 rounded ${
                                      opObj.signal === "COMPRA_ACAO_SHORT_DI"
                                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-900/40"
                                        : opObj.signal === "COMPRA_DI_SHORT_ACAO"
                                          ? "bg-rose-950/80 text-rose-300 border border-rose-900/40"
                                          : "bg-slate-800 text-slate-300"
                                    }`}>
                                      {opObj.signal === "COMPRA_ACAO_SHORT_DI"
                                        ? "COMPRAR STOCK / SELL DI"
                                        : opObj.signal === "COMPRA_DI_SHORT_ACAO"
                                          ? "COMPRAR DI / RETRAÇÃO"
                                          : "HOLD / PREÇO JUSTO"}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          } else {
                            // Valuation logic
                            const stockVpa = stock.vpa || Number((stock.currentPrice * 0.85).toFixed(2));
                            const stockLpa = stock.lpa || (stock.peRatio > 0 ? Number((stock.currentPrice / stock.peRatio).toFixed(2)) : 0.0);
                            const stockDpa = stock.dividendsPerShare !== undefined ? stock.dividendsPerShare : Number((stock.currentPrice * (stock.dy / 100)).toFixed(2));
                            
                            // Benjamin Graham Fair Price (VI)
                            const grahamMult = 22.5;
                            const product = grahamMult * stockVpa * stockLpa;
                            const grahamPrice = product > 0 ? Math.sqrt(product) : null;
                            const grahamSafety = grahamPrice ? ((grahamPrice - stock.currentPrice) / grahamPrice) * 100 : null;

                            // Luiz Barsi Ceiling Price (DPA / targetYield)
                            const targetYieldPct = targetYield / 100;
                            const barsiPrice = targetYieldPct > 0 ? stockDpa / targetYieldPct : 0;
                            const barsiSafety = barsiPrice > 0 ? ((barsiPrice - stock.currentPrice) / barsiPrice) * 100 : null;

                            // Décio Bazin (6% flat target + Leverage filter)
                            // Bazin specifies Net Debt/Equity < 1.2 normally. Otherwise "Alerta Alavancagem"
                            const bazinPrice = stockDpa / 0.06;
                            const bazinDebtAlert = stock.debtToEquity > 1.2;
                            const isBazinApproved = stockDpa > 0 && !bazinDebtAlert;

                            // Consolidated valuation recommendation
                            let recText = "HOLD / NEUTRO";
                            let recClass = "bg-slate-850 text-slate-300";
                            
                            const isGrahamBuy = grahamPrice && stock.currentPrice < grahamPrice;
                            const isBarsiBuy = barsiPrice > 0 && stock.currentPrice < barsiPrice;

                            if (isGrahamBuy && isBarsiBuy) {
                              recText = "COMPRA FORTE";
                              recClass = "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50";
                            } else if (isGrahamBuy) {
                              recText = "GRAHAM UP";
                              recClass = "bg-teal-950/80 text-teal-300 border border-teal-800/40";
                            } else if (isBarsiBuy) {
                              recText = "BARSI UP";
                              recClass = "bg-indigo-950/80 text-indigo-300 border border-indigo-800/40";
                            } else if (stock.currentPrice > (grahamPrice || 9999) && stock.currentPrice > barsiPrice) {
                              recText = "PREÇO TETO EXCEDIDO";
                              recClass = "bg-rose-950/40 text-rose-400 border border-rose-955";
                            }

                            return (
                              <tr
                                id={`stock-row-val-${stock.ticker}`}
                                key={stock.ticker}
                                onClick={() => setSelectedStockTicker(stock.ticker)}
                                className={`cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-slate-800/65 text-white"
                                    : "hover:bg-slate-850/40 text-slate-300"
                                }`}
                              >
                                <td className="py-3 px-3 font-mono">
                                  <div className="font-extrabold text-white flex items-center space-x-1">
                                    <span>{stock.ticker}</span>
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-sans truncate max-w-[130px]">{stock.sector}</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="font-bold">R$ {stock.currentPrice.toFixed(2)}</div>
                                  <div className="text-[9.5px] text-slate-500 font-sans">DY: {stock.dy.toFixed(1)}%</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="text-slate-200 font-medium">VPA: R$ {stockVpa.toFixed(2)}</div>
                                  <div className="text-slate-400 text-[10px]">LPA: R$ {stockLpa.toFixed(2)}</div>
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  {grahamPrice ? (
                                    <>
                                      <div className="font-bold text-slate-200">R$ {grahamPrice.toFixed(2)}</div>
                                      <div className={`text-[9.5px] font-sans ${grahamSafety && grahamSafety >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                                        {grahamSafety && grahamSafety >= 0 ? `Margem: +${grahamSafety.toFixed(0)}%` : `Margem: ${grahamSafety?.toFixed(0)}%`}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-500 italic text-[11px]">N/A (Prejuízo)</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  {barsiPrice > 0 ? (
                                    <>
                                      <div className="font-bold text-slate-200">R$ {barsiPrice.toFixed(2)}</div>
                                      <div className={`text-[9.5px] font-sans ${barsiSafety && barsiSafety >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                                        {barsiSafety && barsiSafety >= 0 ? `Margem: +${barsiSafety.toFixed(0)}%` : `Margem: ${barsiSafety?.toFixed(0)}%`}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">Sem Divs</span>
                                  )}
                                </td>
                                <td className="py-3 px-2 font-mono">
                                  <div className="font-semibold text-slate-200">R$ {bazinPrice.toFixed(2)}</div>
                                  <div className={`text-[9.5px] font-sans flex items-center gap-1 ${isBazinApproved ? "text-emerald-400" : "text-amber-500"}`}>
                                    <span>PL/Div: {stock.debtToEquity.toFixed(2)}x</span>
                                    <span>{stock.debtToEquity > 1.2 ? "(Dívida!)" : "✓"}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <span className={`inline-block text-[9.5px] font-mono font-bold px-2.5 py-1 rounded border ${recClass}`}>
                                    {recText}
                                  </span>
                                </td>
                              </tr>
                            );
                          }
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Helpful Legend */}
                <div className="mt-4 border-t border-slate-850 pt-3 text-[10px] text-slate-400 leading-relaxed font-sans flex items-start space-x-2">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <p>
                    <strong>Arbitrage Score:</strong> Indica a conformidade entre o prêmio de risco histórico do papel contra o rendimento sem risco da curva DI Futura. Pontuações acima de 70 indicam defasagem excessiva do valuation da ação perante os juros implícitos do mercado (compra expressiva). Pontuações abaixo de 40 sugerem exaustão do ganho real frente ao custo de oportunidade da renda fixa DI.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PORTFOLIO ENGINE WORKSPACE */}
          {activeTab === "portfolio" && (
            <div className="space-y-6" id="portfolio-tab-content">
              
              {/* Portfolio Performance statistics cards */}
              {portfolioStats ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white">
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Patrimônio Líquido Estimado</span>
                    <div className="text-xl font-mono font-extrabold text-white mt-1.5 flex items-baseline">
                      R$ {portfolioStats.totalCurrentVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] font-mono mt-3.5">
                      <span className="text-slate-400">Retorno Total da Carteira:</span>
                      <span className={portfolioStats.portfolioReturnPct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {portfolioStats.portfolioReturnPct >= 0 ? "+" : ""}{portfolioStats.portfolioReturnPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white">
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Earnings Yield Médio de Carteira (EP)</span>
                    <div className="text-xl font-mono font-extrabold text-emerald-400 mt-1.5">
                      {portfolioStats.weightedEarningsYield.toFixed(2)}% <span className="text-xs text-slate-400 font-normal">a.a.</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] font-mono mt-3.5">
                      <span className="text-slate-400">Spread vs Curve {portfolioStats.diTicker}:</span>
                      <span className={`font-bold ${portfolioStats.pYieldSpreadPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {portfolioStats.pYieldSpreadPercent >= 0 ? "+" : ""}{portfolioStats.pYieldSpreadPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white">
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Métricas de Volatilidade de Carteira</span>
                    <div className="text-xl font-mono font-extrabold text-slate-200 mt-1.5">
                      {portfolioStats.weightedVolatility.toFixed(1)}% <span className="text-xs text-slate-400 font-normal">vol</span>
                    </div>
                    <div className="flex items-center space-x-3.5 text-[11px] font-mono mt-3.5">
                      <span className="text-slate-400">Beta Médio de Risco:</span>
                      <span className="text-emerald-400 font-bold">{portfolioStats.weightedBeta.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-950/15 border border-amber-900/60 p-5 rounded-xl text-amber-300 text-xs flex items-center space-x-3.5">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>Sua carteira de investimentos está vazia ou sem pesos definidos no momento. Use o formulário abaixo para registrar seus ativos ativos.</p>
                </div>
              )}

              {/* LIST OF PORTFOLIO CURRENT HOLDINGS */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-sans font-semibold text-sm text-slate-200">
                    Posições Patrimoniais & Arbitragem Própria
                  </h3>
                  <span className="text-slate-400 text-xs font-mono bg-slate-950 border border-slate-800 px-2 rounded py-0.5">
                    Modo Carteira Ativa
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[10px]">
                        <th className="py-2.5 px-3">Ticker</th>
                        <th className="py-2.5 px-2">Qtd Ações</th>
                        <th className="py-2.5 px-2">Preço Médio (Custódia)</th>
                        <th className="py-2.5 px-2">Preço Spot (Tempo Real)</th>
                        <th className="py-2.5 px-2">Lucro / Prejuízo</th>
                        <th className="py-2.5 px-2">Earnings Yield (E/P)</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {portfolio.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                            Nenhum ativo registrado na carteira pessoal. Insira posições abaixo.
                          </td>
                        </tr>
                      ) : (
                        portfolio.map((item) => {
                          const stock = stocks.find((s) => s.ticker === item.ticker);
                          
                          const currentPrice = stock ? stock.currentPrice : item.averagePrice;
                          const change24h = stock ? stock.changePercent24h : 0.0;
                          const earningsYield = stock ? stock.earningsYield : 0.0;
                          
                          const costPriceTotal = item.shares * item.averagePrice;
                          const currentPriceTotal = item.shares * currentPrice;
                          const profitVal = currentPriceTotal - costPriceTotal;
                          const profitPct = costPriceTotal > 0 ? (profitVal / costPriceTotal) * 100 : 0.0;

                          return (
                            <tr id={`portfolio-row-${item.id}`} key={item.id} className="hover:bg-slate-850/20 text-slate-300">
                              <td className="py-3 px-3 font-mono">
                                <span className="font-extrabold text-white block">{item.ticker}</span>
                                <span className="text-[10px] text-slate-500 font-sans">{stock ? stock.name : "Cadastrado temporariamente"}</span>
                              </td>
                              <td className="py-3 px-2 font-mono font-semibold text-slate-200">
                                {item.shares.toLocaleString("pt-BR")}
                              </td>
                              <td className="py-3 px-2 font-mono">
                                R$ {item.averagePrice.toFixed(2)}
                              </td>
                              <td className="py-3 px-2 font-mono">
                                <div className="font-semibold text-slate-200">R$ {currentPrice.toFixed(2)}</div>
                                <div className={`text-[9.5px] ${change24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                                </div>
                              </td>
                              <td className="py-3 px-2 font-mono">
                                <div className={`font-bold ${profitVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  R$ {profitVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className={`text-[10px] ${profitVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                  {profitVal >= 0 ? "+" : ""}{profitPct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="py-3 px-2 font-mono text-slate-200 font-semibold">
                                {earningsYield.toFixed(2)}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  id={`delete-portfolio-item-${item.id}`}
                                  onClick={() => handleDeletePortfolioItem(item.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-all"
                                  title="Remover da Minha Carteira"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CARD: COMPARE WITH ARBITRAGE OPPORTUNITY / PORTFOLIO RECOMMENDATION */}
              {portfolioStats && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-3 block">Recomendação de Hedge para sua Carteira</h4>
                  
                  {portfolioStats.pYieldSpreadPercent > 2.0 ? (
                    <div className="bg-emerald-950/20 border border-emerald-900/60 p-4 rounded-lg">
                      <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold text-xs mb-2">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>Carteira Excelente de Ativos Arbitrada</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        O Earnings Yield ponderado da sua carteira ({portfolioStats.weightedEarningsYield.toFixed(2)}%) supera os juros futuros sem risco de {portfolioStats.diTicker} ({portfolioStats.diRate.toFixed(2)}%) em <strong>{portfolioStats.pYieldSpreadPercent.toFixed(2)}%</strong> mais o prêmio de risco esperado. 
                        Isso indica que as empresas que você mantém em custódia estão altamente baratas e com lucros consistentes perante o custo de capital do país. Recomendação: <strong>Manter posições compradas (Long) e se desejar fazer hedge, vender contratos do CDI Futuro correspondente proporcionalmente.</strong>
                      </p>
                    </div>
                  ) : portfolioStats.pYieldSpreadPercent < -2.0 ? (
                    <div className="bg-rose-950/20 border border-rose-900/60 p-4 rounded-lg">
                      <div className="flex items-center space-x-2.5 text-rose-400 font-semibold text-xs mb-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span>Alerta de Risco: Exposição à Taxa de Juros terminal Elevada</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Seu Earnings Yield de carteira ({portfolioStats.weightedEarningsYield.toFixed(2)}%) está substancialmente abaixo da remuneração garantida sem risco do CDI Futuro ({portfolioStats.diRate.toFixed(2)}%). 
                        Você está incorrendo em risco de patrimônio de ações brasileiras sem o respectivo prêmio de rentabilidade proporcional, geralmente associada a posições em empresas caras ou endividadas de duration elevado (ex: MGLU3). 
                        Recomendação: <strong>Considere realizar lucro parcial ou reciclar capital direcionando liquidez para títulos de renda fixa DI ou ações de valor com múltiplos de P/L inferiores.</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg text-slate-300 text-xs leading-relaxed">
                      Seu portfólio de ações está em equilíbrio neutro em relação aos rendimentos das curvas DI ({portfolioStats.pYieldSpreadPercent.toFixed(2)}% spread). 
                      As flutuações cotidianas de preços respondem predominantemente a variações macro micro-específicas de cada um dos setores isoladamente. O rendimento total compensa de forma justa o risco assumido.
                    </div>
                  )}
                </div>
              )}

              {/* CARD FORM ADD ACTION TO PORTFOLIO */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-slate-200 mb-4 font-sans">Adicionar Nova Custódia de Ativo à Carteira</h4>
                <form onSubmit={handleAddToPortfolio} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block font-mono">SELECIONAR ATIVO</label>
                    <select
                      id="forms-portfolio-ticker"
                      value={portfolioForm.ticker}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, ticker: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 w-full text-slate-200 focus:outline-none"
                    >
                      <option value="">Selecione...</option>
                      {stocks.map((s) => (
                        <option key={s.ticker} value={s.ticker}>
                          {s.ticker} - {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block font-mono">QUANTIDADE DE AÇÕES</label>
                    <input
                      id="forms-portfolio-shares"
                      type="number"
                      placeholder="Ex: 100"
                      value={portfolioForm.shares}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, shares: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block font-mono">PREÇO MÉDIO DE COMPRA (R$)</label>
                    <input
                      id="forms-portfolio-price"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 34.50"
                      value={portfolioForm.avgPrice}
                      onChange={(e) => setPortfolioForm({ ...portfolioForm, avgPrice: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                    />
                  </div>

                  <button
                    id="add-portfolio-submit-btn"
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 px-4 rounded-lg transition-all h-9 flex items-center justify-center space-x-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Ativo</span>
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* TAB 3: ALERTS & NOTIFICATIONS LOG */}
          {activeTab === "alerts" && (
            <div className="space-y-6" id="alerts-tab-content">
              
              {/* ALERTS SETUP DUAL VIEW */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Register alert form */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="font-sans font-semibold text-sm text-slate-200 mb-4">
                    Configurar Alerta Automático via E-mail
                  </h3>
                  <form onSubmit={handleCreateAlert} className="space-y-4 text-xs">
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-mono block">E-MAIL DE NOTIFICAÇÃO</label>
                      <input
                        id="form-alert-email"
                        type="email"
                        required
                        value={alertForm.email}
                        onChange={(e) => setAlertForm({ ...alertForm, email: e.target.value })}
                        className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-250 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono block">ATIVO MONITORADO</label>
                        <select
                          id="form-alert-ticker"
                          value={alertForm.ticker}
                          onChange={(e) => setAlertForm({ ...alertForm, ticker: e.target.value })}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 w-full text-slate-200 focus:outline-none"
                        >
                          {stocks.map((s) => (
                            <option key={s.ticker} value={s.ticker}>{s.ticker}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono block">MÉTRICA DE GATILHO</label>
                        <select
                          id="form-alert-metric"
                          value={alertForm.metric}
                          onChange={(e) => setAlertForm({ ...alertForm, metric: e.target.value as AutomaticAlert["metric"] })}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 w-full text-slate-200 focus:outline-none"
                        >
                          <option value="volatility">Volatilidade (stdDev)</option>
                          <option value="correlation">Correlação Pearson 90d</option>
                          <option value="yieldSpread">EP Spread vs Curve</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono block">CONDIÇÃO</label>
                        <select
                          id="form-alert-condition"
                          value={alertForm.condition}
                          onChange={(e) => setAlertForm({ ...alertForm, condition: e.target.value as AutomaticAlert["condition"] })}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 w-full text-slate-205 focus:outline-none"
                        >
                          <option value="greater">Ser Maior que (&gt;)</option>
                          <option value="less">Ser Menor que (&lt;)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono block">VALOR LIMIAR (THRESHOLD)</label>
                        <input
                          id="form-alert-value"
                          type="number"
                          step="0.01"
                          required
                          placeholder={alertForm.metric === "volatility" ? "Ex: 25.0 (%)" : alertForm.metric === "correlation" ? "Ex: -0.50 (Pearson)" : "Ex: 8.0 (%)"}
                          value={alertForm.value}
                          onChange={(e) => setAlertForm({ ...alertForm, value: e.target.value })}
                          className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      id="create-alert-submit-btn"
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-lg transition-all w-full flex items-center justify-center space-x-2 shadow"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Cadastrar Gatilho de Alerta</span>
                    </button>
                  </form>
                </div>

                {/* 2. Registered alerts listings */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
                  <h3 className="font-sans font-semibold text-sm text-slate-200 mb-3 block">
                    Gatilhos de Monitoramento Ativos
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[250px]">
                    {alerts.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-10">Nenhum gatilho de e-mail programado.</p>
                    ) : (
                      alerts.map((al) => (
                        <div
                          id={`alert-card-${al.id}`}
                          key={al.id}
                          className={`p-3 rounded-lg border text-xs flex justify-between items-start transition-all ${
                            al.isTriggered
                              ? "bg-emerald-950/15 border-emerald-900/60 text-emerald-300"
                              : "bg-slate-950 border-slate-850 text-slate-300"
                          }`}
                        >
                          <div className="space-y-1 pr-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-white bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[10px]">{al.ticker}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{al.email}</span>
                            </div>
                            <div className="text-[11px] leading-relaxed">
                              Alerta dispara se <strong className="text-slate-100">{al.metric === "volatility" ? "Volatilidade" : al.metric === "correlation" ? "Correlação 90d" : "EP Spread contra DI Futuro"}</strong> for <strong className="text-slate-100">{al.condition === "greater" ? "Maior que" : "Menor que"}</strong> <strong className="text-emerald-400 font-mono">{al.value}</strong>.
                            </div>
                            <div className="text-[10px] text-slate-550 flex items-center space-x-1">
                              {al.isTriggered ? (
                                <span className="bg-emerald-500 text-slate-950 font-bold font-sans text-[8.5px] px-1 rounded-sm">DISPARADO EM {al.triggeredAt ? new Date(al.triggeredAt).toLocaleTimeString("pt-BR") : "Live"}</span>
                              ) : (
                                <span className="text-slate-400">● Aguardando oscilação B3</span>
                              )}
                            </div>
                          </div>
                          <button
                            id={`delete-alert-${al.id}`}
                            onClick={() => handleDeleteAlert(al.id)}
                            className="text-slate-400 hover:text-rose-400 transition-all p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* VIRTUAL POSTBOX OUTBOX (RECEPIENT CORNER) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="virtual-mailbox-logs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Inbox className="w-4.5 h-4.5 text-emerald-400" />
                    <h3 className="font-sans font-semibold text-sm text-slate-250">
                      Caixa de Entrada Virtual (renato.jrrod@gmail.com)
                    </h3>
                  </div>
                  {emailLogs.length > 0 && (
                    <button
                      id="clear-email-logs-btn"
                      onClick={handleClearEmailLogs}
                      className="text-xs font-semibold font-mono text-rose-400 hover:text-rose-300"
                    >
                      Limpar Histórico
                    </button>
                  )}
                </div>

                {emailLogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-sans text-xs">
                    Nenhum e-mail de alerta quantitativo disparado neste ciclo. 
                    Experimente apertar <strong>"Flutuar Mercado BRL"</strong> para forçar oscilações que rompam os limiares configurados.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailLogs.map((log) => (
                      <div
                        id={`email-log-${log.id}`}
                        key={log.id}
                        className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-2 text-xs font-sans transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-900 pb-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 block font-mono">Assunto:</span>
                            <span className="text-slate-100 font-semibold text-xs">{log.subject}</span>
                          </div>
                          <div className="text-slate-500 text-[10px] font-mono sm:text-right">
                            <span>Disparado em: {log.sentAt}</span>
                          </div>
                        </div>
                        <div 
                          className="pt-2 text-slate-300 leading-relaxed max-h-[140px] overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: log.body }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: SANDBOX ATIVO MANAGER */}
          {activeTab === "sandbox" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5" id="sandbox-tab-content">
              <h3 className="font-sans font-semibold text-sm text-slate-200 mb-1">
                Introduzir Ativo Customizado (Google Finance Simulator)
              </h3>
              <p className="text-slate-400 text-xs mb-5 leading-normal">
                Adicione qualquer ticker brasileiro da B3 não configurado por padrão (ex: BBAS3, B3SA3, EGIE3, BOVA11). 
                Nossa engine quantitativa server-side irá rodar o modelo estatístico, construindo 180 dias de histórico alinhados às curvas DI.
              </p>

              <form onSubmit={handleCreateCustomStock} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono block">TICKER DO ATIVO</label>
                  <input
                    id="form-sandbox-ticker"
                    type="text"
                    required
                    placeholder="Ex: BBAS3"
                    value={customStockForm.ticker}
                    onChange={(e) => setCustomStockForm({ ...customStockForm, ticker: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono block">NOME DA COMPANHIA</label>
                  <input
                    id="form-sandbox-name"
                    type="text"
                    required
                    placeholder="Ex: Banco do Brasil S.A."
                    value={customStockForm.name}
                    onChange={(e) => setCustomStockForm({ ...customStockForm, name: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-250 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono block">SETOR DA ECONOMIA</label>
                  <select
                    id="form-sandbox-sector"
                    value={customStockForm.sector}
                    onChange={(e) => setCustomStockForm({ ...customStockForm, sector: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-2.5 py-2 w-full text-slate-200 focus:outline-none"
                  >
                    <option value="Serviços Financeiros">Serviços Financeiros</option>
                    <option value="Energia / Petróleo">Energia / Petróleo</option>
                    <option value="Mineração e Siderurgia">Mineração e Siderurgia</option>
                    <option value="Comércio Varejista">Comércio Varejista</option>
                    <option value="Consumo Cíclico">Consumo Cíclico</option>
                    <option value="Utilidade Pública / Setor Elétrico">Utilidade Pública / Setor Elétrico</option>
                    <option value="Logística & Transportes">Logística & Transportes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono block">PREÇO SPOT INICIAL (R$)</label>
                  <input
                    id="form-sandbox-price"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 27.80"
                    value={customStockForm.price}
                    onChange={(e) => setCustomStockForm({ ...customStockForm, price: e.target.value })}
                    className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">RELAÇÃO PREÇO / LUCRO (P/L)</label>
                    <input
                      id="form-sandbox-pe"
                      type="number"
                      step="0.1"
                      placeholder="Ex: 6.2 (peRatio)"
                      value={customStockForm.peRatio}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, peRatio: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">DIVIDEND YIELD CORRENTE (%)</label>
                    <input
                      id="form-sandbox-dy"
                      type="number"
                      step="0.1"
                      placeholder="Ex: 8.5"
                      value={customStockForm.dy}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, dy: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">VALOR PATRIMONIAL POR AÇÃO (VPA)</label>
                    <input
                      id="form-sandbox-vpa"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 34.50"
                      value={customStockForm.vpa}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, vpa: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">LUCRO POR AÇÃO (LPA)</label>
                    <input
                      id="form-sandbox-lpa"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 4.80"
                      value={customStockForm.lpa}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, lpa: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">DIVIDENDOS POR AÇÃO (DPA ANUAL R$)</label>
                    <input
                      id="form-sandbox-dpa"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 2.10 (Barsi/Bazin Dividend)"
                      value={customStockForm.dividendsPerShare}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, dividendsPerShare: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block font-mono">RELAÇÃO DÍVIDA LÍQUIDA / PL (DEBT/EQUITY)</label>
                    <input
                      id="form-sandbox-debt"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 0.65 (Bazin Limiar: 1.2)"
                      value={customStockForm.debtToEquity}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, debtToEquity: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">DESVIO PADRÃO MENSUAL (VOL %)</label>
                    <input
                      id="form-sandbox-vol"
                      type="number"
                      step="1"
                      placeholder="Ex: 22 (%)"
                      value={customStockForm.stdDev}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, stdDev: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono block">COEFICIENTE BETA vs IBOVESPA</label>
                    <input
                      id="form-sandbox-beta"
                      type="number"
                      step="0.01"
                      placeholder="Ex: 1.12"
                      value={customStockForm.beta}
                      onChange={(e) => setCustomStockForm({ ...customStockForm, beta: e.target.value })}
                      className="bg-slate-950 border border-slate-800 text-xs rounded-lg px-3 py-2 w-full text-slate-205 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 pt-2">
                  <button
                    id="sandbox-stock-submit-btn"
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 px-4 rounded-lg transition-all w-full flex items-center justify-center space-x-2 shadow"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Gerar Ativo e Atualizar Feed</span>
                  </button>
                </div>

              </form>
            </div>
          )}          {/* FOCUSED STOCK HIGHLIGHT */}
          {focusedStockObj ? (
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 text-white" id="stock-detail-panel">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div>
                  <span className="bg-slate-950 text-[10px] font-mono text-emerald-400 font-extrabold border border-slate-800 px-2 py-0.5 rounded uppercase">
                    Foco Analítico
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 font-mono mt-1 flex items-baseline space-x-1.5">
                    <span>{focusedStockObj.ticker}</span>
                    <span className="text-[10px] font-normal text-slate-400 font-sans truncate pr-2">({focusedStockObj.name})</span>
                  </h3>
                </div>
                <Bookmark className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>

              {/* QUICK KEY-VALUE ATTRIBUTES GRID */}
              <div className="grid grid-cols-2 gap-3 text-xs font-sans">
                <div className="bg-slate-950/65 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-mono">ÚLTIMO PREÇO</span>
                  <span className="font-mono text-xs font-bold text-slate-200 block mt-1">R$ {focusedStockObj.currentPrice.toFixed(2)}</span>
                  <span className={`text-[9.5px] font-mono ${focusedStockObj.changePercent24h >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {focusedStockObj.changePercent24h >= 0 ? "+" : ""}{focusedStockObj.changePercent24h.toFixed(2)}%
                  </span>
                </div>

                <div className="bg-slate-950/65 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-mono">EARNINGS YIELD (E/P)</span>
                  <span className="font-mono text-xs font-bold text-emerald-400 block mt-1">{focusedStockObj.earningsYield.toFixed(2)}%</span>
                  <span className="text-[9.5px] text-slate-500 font-sans block">Retorno em Lucro</span>
                </div>

                <div className="bg-slate-950/65 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-mono">VOLATILIDADE (STD)</span>
                  <span className="font-mono text-xs font-bold text-slate-200 block mt-1">{focusedStockObj.stdDev.toFixed(1)}%</span>
                  <span className="text-[9.5px] text-slate-500 font-sans block">Desvio Anualizado</span>
                </div>

                <div className="bg-slate-950/65 border border-slate-850 p-2.5 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-mono">BETA VS IBOV</span>
                  <span className="font-mono text-xs font-bold text-slate-200 block mt-1">{focusedStockObj.beta.toFixed(2)}</span>
                  <span className="text-[9.5px] text-slate-500 font-sans block">Sensibilidade Geral</span>
                </div>
              </div>

              {/* INTEGRATED graham, barsi & bazin valuation cards */}
              {(() => {
                const stockVpa = focusedStockObj.vpa || Number((focusedStockObj.currentPrice * 0.85).toFixed(2));
                const stockLpa = focusedStockObj.lpa || (focusedStockObj.peRatio > 0 ? Number((focusedStockObj.currentPrice / focusedStockObj.peRatio).toFixed(2)) : 0.0);
                const stockDpa = focusedStockObj.dividendsPerShare !== undefined ? focusedStockObj.dividendsPerShare : Number((focusedStockObj.currentPrice * (focusedStockObj.dy / 100)).toFixed(2));
                const stockDebt = focusedStockObj.debtToEquity !== undefined ? focusedStockObj.debtToEquity : 0.5;

                // Benjamin Graham Formulas
                const grahamMult = 22.5;
                const product = grahamMult * stockVpa * stockLpa;
                const grahamPrice = product > 0 ? Math.sqrt(product) : null;
                const grahamMargin = grahamPrice ? ((grahamPrice - focusedStockObj.currentPrice) / grahamPrice) * 100 : null;

                // Luiz Barsi Formulas
                const targetPct = targetYield / 100;
                const barsiPrice = targetPct > 0 ? stockDpa / targetPct : 0.0;
                const barsiMargin = barsiPrice > 0 ? ((barsiPrice - focusedStockObj.currentPrice) / barsiPrice) * 100 : null;

                // Décio Bazin Formulas
                const bazinPrice = stockDpa / 0.06;
                const bazinDebtSafety = stockDebt <= 1.2;
                const isBazinApproved = stockDpa > 0 && bazinDebtSafety;

                return (
                  <div className="mt-5 border-t border-slate-800 pt-4 space-y-4 font-sans">
                    <h4 className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Valuations Fundamentalistas</span>
                      <span className="text-[9px] text-slate-400 normal-case">(Alvo: {targetYield}% Yield Barsi)</span>
                    </h4>

                    {/* BENJAMIN GRAHAM */}
                    <div className="bg-slate-950/70 border border-slate-850 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-mono font-medium text-slate-400">Preço Justo (Benjamin Graham)</span>
                        <span className="text-[9px] font-mono font-semibold text-slate-500">VI = √(22.5 × VPA × LPA)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          {grahamPrice ? (
                            <>
                              <span className="text-sm font-mono font-bold text-slate-100">R$ {grahamPrice.toFixed(2)}</span>
                              <span className="text-[9.5px] text-slate-500 ml-1.5">vs R$ {focusedStockObj.currentPrice.toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-rose-400 text-[11px] italic font-medium">Prejuízo (VPA ou LPA negativo)</span>
                          )}
                        </div>
                        {grahamPrice && (
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            grahamMargin !== null && grahamMargin >= 0 ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                          }`}>
                            {grahamMargin !== null && grahamMargin >= 0 ? `Margem: +${grahamMargin.toFixed(1)}%` : `Margem: ${grahamMargin?.toFixed(1)}%`}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans grid grid-cols-2 gap-1 border-t border-slate-900/60 pt-1">
                        <span>LPA: R$ {stockLpa.toFixed(2)}</span>
                        <span>VPA: R$ {stockVpa.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* LUIZ BARSI */}
                    <div className="bg-slate-950/70 border border-slate-850 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-mono font-medium text-slate-400">Preço Teto (Luiz Barsi)</span>
                        <span className="text-[9px] font-mono font-semibold text-slate-500">DPA / {targetYield}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          {barsiPrice > 0 ? (
                            <>
                              <span className="text-sm font-mono font-bold text-slate-100">R$ {barsiPrice.toFixed(2)}</span>
                              <span className="text-[9.5px] text-slate-500 ml-1.5">vs R$ {focusedStockObj.currentPrice.toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Sem dividendos distribuídos</span>
                          )}
                        </div>
                        {barsiPrice > 0 && (
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            barsiMargin !== null && barsiMargin >= 0 ? "bg-indigo-950 text-indigo-400" : "bg-rose-955 text-rose-400"
                          }`}>
                            {barsiMargin !== null && barsiMargin >= 0 ? `Margem: +${barsiMargin.toFixed(1)}%` : `Margem: ${barsiMargin?.toFixed(1)}%`}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex justify-between border-t border-slate-900/60 pt-1">
                        <span>DPA anual: R$ {stockDpa.toFixed(2)}</span>
                        <span>Yield Atual: {focusedStockObj.dy.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* DÉCIO BAZIN */}
                    <div className="bg-slate-950/70 border border-slate-850 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] font-mono font-medium text-slate-400">Filtro Décio Bazin (6% Yield Alvo)</span>
                        <span className="text-[9px] font-mono font-semibold text-slate-500">DPA / 0.06 & Dív/PL</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-mono font-bold text-slate-100">R$ {bazinPrice.toFixed(2)}</span>
                          <span className="text-[9.5px] text-slate-500 ml-1.5">Teto Bazin</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          isBazinApproved ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                        }`}>
                          {isBazinApproved ? "APROVADO" : stockDpa <= 0 ? "SEM REND" : "EVITAR (Dívida)"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono grid grid-cols-2 gap-1 border-t border-slate-900/60 pt-1">
                        <span className={stockDebt > 1.2 ? "text-rose-400 font-semibold" : "text-slate-400"}>Dívida líquida/PL: {stockDebt.toFixed(2)}x</span>
                        <span>Status: {bazinDebtSafety ? "✓ Sob Controle" : "⚠️ Alavancada"}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CORRELATION ANALYSIS COEFFICIENTS CARD */}
              {activeCorrelation && (
                <div className="mt-5 border-t border-slate-800 pt-4 space-y-3 font-sans">
                  <h4 className="text-[11px] font-mono text-slate-400 uppercase">Elasticidade Estatística vs {selectedCDITicker}</h4>
                  
                  <div className="flex justify-between items-center bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs">
                    <span className="text-slate-400">Pearson R (180d):</span>
                    <span className={`font-mono font-bold ${
                      Math.abs(activeCorrelation.correlation) >= 0.6 
                        ? "text-orange-400" 
                        : "text-slate-300"
                    }`}>
                      {activeCorrelation.correlation.toFixed(4)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-350 leading-relaxed font-sans bg-slate-950/40 p-3 rounded-lg border border-slate-850/60">
                    <strong className="text-slate-200 block mb-1">Status: Juros e ativo em Correlação {activeCorrelation.interpretedStatus}</strong>
                    {activeCorrelation.explanation}
                  </p>
                </div>
              )}

              {/* ARBITRAGE SPECIFIC SIGNALLER */}
              {focusedArbitrageObj && (
                <div className={`mt-4 p-4 rounded-lg font-sans text-xs border ${
                  focusedArbitrageObj.signal === "COMPRA_ACAO_SHORT_DI"
                    ? "bg-emerald-950/15 border-emerald-900/60 text-emerald-300"
                    : focusedArbitrageObj.signal === "COMPRA_DI_SHORT_ACAO"
                      ? "bg-rose-950/15 border-rose-900/60 text-rose-300"
                      : "bg-slate-950 border-slate-850 text-slate-350"
                }`}>
                  <span className="text-[10px] uppercase font-mono block mb-1.5">Algoritmo de Arbitragem Spot/Curve</span>
                  <strong className="block text-slate-200 mb-1">Spread: {focusedArbitrageObj.adjustedSpread.toFixed(2)}%</strong>
                  <p className="leading-snug">{focusedArbitrageObj.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-400 text-xs text-center font-sans">
              Selecione qualquer ativo B3 para avaliar os múltiplos e sinal quantitativo.
            </div>
          )}

          {/* ADVANCED QUANT GEMINI IA ANALYST */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-white" id="gemini-macro-analyst">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Cpu className="text-emerald-400 w-4.5 h-4.5 shrink-0" />
                <h3 className="text-sm font-semibold text-slate-100 font-sans">
                  Analista Macro Institutional Gemini
                </h3>
              </div>
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>

            <div className="space-y-4 text-xs font-sans">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Rode o modelo quantitativo server-side. O Gemini formulará as etapas táticas de arbitragem cruzada, calibrado à realidade fiscal brasileira.
              </p>

              {/* Notes to contextualize analysis */}
              <div className="space-y-1">
                <label className="text-[10.5px] text-slate-400 font-mono block font-bold">NOTAS DO DIRETOR OPERACIONAL (OPCIONAL)</label>
                <textarea
                  id="gemini-notes-input"
                  rows={2}
                  placeholder="Ex: Considerando inflação alta do IPCA ou estresse na ponta longa da curva..."
                  value={geminiNotes}
                  onChange={(e) => setGeminiNotes(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 w-full text-slate-200 focus:outline-none placeholder:text-slate-600 resize-none"
                />
              </div>

              <button
                id="run-gemini-analysis-btn"
                onClick={runGeminiAnalysis}
                disabled={geminiLoading}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs font-sans flex items-center justify-center space-x-2 border transition-all ${
                  geminiLoading 
                    ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed" 
                    : "bg-slate-100 hover:bg-white text-slate-950 border-slate-100 shadow"
                }`}
              >
                <Cpu className={`w-3.5 h-3.5 ${geminiLoading ? "animate-spin" : ""}`} />
                <span>{geminiLoading ? "Estruturando Tese BRL..." : `Analisar ${selectedStockTicker} vs ${selectedCDITicker}`}</span>
              </button>

              {/* Loader */}
              {geminiLoading && (
                <div className="py-4 text-center space-y-2 border border-dashed border-slate-850 rounded-lg" id="gemini-analysis-loader">
                  <div className="inline-block w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[11px] text-slate-350 block">Conectando modelos Google AI e computando taxas...</p>
                </div>
              )}

              {/* Errors rendering */}
              {geminiError && (
                <div className="bg-rose-950/15 border border-rose-900/60 p-3.5 rounded-lg text-rose-300 text-[11px] font-sans" id="gemini-analysis-error">
                  <span className="font-bold block mb-1">Aviso do Servidor:</span>
                  <span>{geminiError}</span>
                </div>
              )}

              {/* SUCCESS RESULTS */}
              {geminiAnalysis && (
                <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg space-y-4 animate-fade-in" id="gemini-analysis-results">
                  
                  <div className="border-b border-slate-850 pb-2">
                    <span className="text-[9.5px] uppercase font-mono text-slate-400 block">Thesis Score de Arbitragem</span>
                    <strong className="text-xl font-mono text-emerald-400 block mt-0.5">{geminiAnalysis.score} / 100</strong>
                  </div>

                  {/* Thesis core block */}
                  <div className="space-y-1">
                    <span className="text-[9.5px] uppercase font-mono text-emerald-400 block font-semibold">Tese Macro de Alocação</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans text-justify">
                      {geminiAnalysis.thesis}
                    </p>
                  </div>

                  {/* Specific actionable steps */}
                  <div className="space-y-1.5 border-t border-slate-900 pt-3">
                    <span className="text-[9.5px] uppercase font-mono text-cyan-400 block font-semibold">Instruções Operacionais B3</span>
                    <ol className="list-decimal list-outside pl-4 space-y-1 text-[11px] text-slate-300">
                      {geminiAnalysis.arbitrageSteps.map((step, idx) => (
                        <li key={`step-${idx}`} className="pl-1">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Risks section */}
                  <div className="space-y-1.5 border-t border-slate-900 pt-3">
                    <span className="text-[9.5px] uppercase font-mono text-rose-400 block font-semibold">Riscos de Cauda Identificados</span>
                    <ul className="list-disc list-outside pl-4 space-y-1 text-[11px] text-slate-300">
                      {geminiAnalysis.risks.map((risk, idx) => (
                        <li key={`risk-${idx}`} className="pl-1">
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Immediate final recommendation text */}
                  {geminiAnalysis.recommendation && (
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-850 text-[11px] text-slate-200 bg-emerald-950/20 text-emerald-300 border-emerald-900/40">
                      <strong className="block mb-0.5 font-bold uppercase text-[9px] font-mono text-emerald-400">Decisão Consultiva</strong>
                      {geminiAnalysis.recommendation}
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>

        </section>

      </main>
    </div>

    {/* FOOTER */}
    <footer className="border-t border-slate-800 bg-slate-900/40 font-sans">
      <div className="max-w-7xl mx-auto w-full py-4 px-6 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="font-mono">Ambiente de Operações Quantitativa BRL © 2026-05-31</span>
        <span className="text-slate-500">Desenvolvido com IA Gemini & Google Finance Simulado em Tempo Real</span>
      </div>
    </footer>
    </div>
  );
}
