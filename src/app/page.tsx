'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FundParams, DEFAULT_FUND_PARAMS, MonteCarloResults, Investment } from '@/types';
import { runMonteCarloSimulation } from '@/lib/simulation';
import { FundConfig } from '@/components/FundConfig';
import { SimulationResults } from '@/components/SimulationResults';
import { Portfolio } from '@/components/Portfolio';
import {
  fetchFund,
  saveFundParams,
  fetchInvestments,
  createInvestmentApi,
  updateInvestmentApi,
  deleteInvestmentApi,
  addValuationApi,
} from '@/lib/api';
import { Play, BarChart2, Briefcase, Settings, Database, AlertCircle } from 'lucide-react';

type Tab = 'simulation' | 'portfolio' | 'config';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('simulation');
  const [params, setParams] = useState<FundParams>(DEFAULT_FUND_PARAMS);
  const [results, setResults] = useState<MonteCarloResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [numSimulations, setNumSimulations] = useState(5000);

  // Track if results are stale (params changed since last simulation)
  const lastSimParamsRef = useRef<string | null>(null);
  const lastSimCountRef = useRef<number | null>(null);

  // Database state
  const [fundId, setFundId] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Portfolio state
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoadingInvestments, setIsLoadingInvestments] = useState(false);

  // Load fund and investments from database on mount
  useEffect(() => {
    async function loadData() {
      try {
        const fund = await fetchFund();
        setFundId(fund.id);
        setParams(fund.params as FundParams);
        setDbConnected(true);

        const invs = await fetchInvestments(fund.id);
        setInvestments(invs);
      } catch (error) {
        console.log('Database not configured, using local state:', error);
        setDbConnected(false);
        setDbError('Database not configured. Data will not persist.');
      }
    }
    loadData();
  }, []);

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      const simulationResults = runMonteCarloSimulation(params, numSimulations);
      setResults(simulationResults);
      // Track the params used for this simulation
      lastSimParamsRef.current = JSON.stringify(params);
      lastSimCountRef.current = numSimulations;
      setIsRunning(false);
    }, 50);
  }, [params, numSimulations]);

  // Check if results are stale (params changed since last simulation)
  const isResultsStale = results !== null && (
    lastSimParamsRef.current !== JSON.stringify(params) ||
    lastSimCountRef.current !== numSimulations
  );

  // Run simulation on mount
  useEffect(() => {
    runSimulation();
  }, []);

  // Save params when they change (debounced)
  useEffect(() => {
    if (!fundId || !dbConnected) return;

    const timer = setTimeout(() => {
      saveFundParams(fundId, params).catch(console.error);
    }, 1000);

    return () => clearTimeout(timer);
  }, [params, fundId, dbConnected]);

  const handleAddInvestment = async (
    data: Omit<Investment, 'id' | 'createdAt' | 'updatedAt' | 'totalInvested'>
  ) => {
    if (dbConnected && fundId) {
      try {
        const newInvestment = await createInvestmentApi(fundId, data);
        setInvestments([newInvestment, ...investments]);
      } catch (error) {
        console.error('Failed to create investment:', error);
        // Fall back to local
        addLocalInvestment(data);
      }
    } else {
      addLocalInvestment(data);
    }
  };

  const addLocalInvestment = (
    data: Omit<Investment, 'id' | 'createdAt' | 'updatedAt' | 'totalInvested'>
  ) => {
    const newInvestment: Investment = {
      ...data,
      id: crypto.randomUUID(),
      totalInvested: data.discoveryAmount + data.convictionAmount + data.followOnAmount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setInvestments([newInvestment, ...investments]);
  };

  const handleUpdateInvestment = async (id: string, updates: Partial<Investment>) => {
    if (dbConnected) {
      try {
        const updated = await updateInvestmentApi(id, updates);
        setInvestments(investments.map((inv) => (inv.id === id ? updated : inv)));
      } catch (error) {
        console.error('Failed to update investment:', error);
        updateLocalInvestment(id, updates);
      }
    } else {
      updateLocalInvestment(id, updates);
    }
  };

  const updateLocalInvestment = (id: string, updates: Partial<Investment>) => {
    setInvestments(
      investments.map((inv) => {
        if (inv.id === id) {
          const updated = { ...inv, ...updates, updatedAt: new Date().toISOString() };
          updated.totalInvested =
            updated.discoveryAmount + updated.convictionAmount + updated.followOnAmount;
          return updated;
        }
        return inv;
      })
    );
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return;

    if (dbConnected) {
      try {
        await deleteInvestmentApi(id);
        setInvestments(investments.filter((inv) => inv.id !== id));
      } catch (error) {
        console.error('Failed to delete investment:', error);
      }
    } else {
      setInvestments(investments.filter((inv) => inv.id !== id));
    }
  };

  const handleAddValuation = async (
    investmentId: string,
    valuation: number,
    date: string,
    notes?: string
  ) => {
    if (dbConnected) {
      try {
        await addValuationApi(investmentId, valuation, date, notes);
        // Refresh investment data
        const invs = await fetchInvestments(fundId!);
        setInvestments(invs);
      } catch (error) {
        console.error('Failed to add valuation:', error);
        updateLocalValuation(investmentId, valuation, date);
      }
    } else {
      updateLocalValuation(investmentId, valuation, date);
    }
  };

  const updateLocalValuation = (investmentId: string, valuation: number, date: string) => {
    setInvestments(
      investments.map((inv) => {
        if (inv.id === investmentId) {
          return {
            ...inv,
            currentValuation: valuation,
            lastValuationDate: date,
            updatedAt: new Date().toISOString(),
          };
        }
        return inv;
      })
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Spectrum</h1>
              <p className="text-sm text-gray-400">Monte Carlo simulation for VC fund outcomes</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Database status indicator */}
              <div
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                  dbConnected === null
                    ? 'bg-gray-800 text-gray-400'
                    : dbConnected
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-yellow-900/50 text-yellow-400'
                }`}
                title={dbConnected ? 'Connected to database' : dbError || 'Checking connection...'}
              >
                {dbConnected === null ? (
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                ) : dbConnected ? (
                  <Database size={12} />
                ) : (
                  <AlertCircle size={12} />
                )}
                {dbConnected === null ? 'Connecting...' : dbConnected ? 'Synced' : 'Local only'}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Simulations:</label>
                <select
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                >
                  <option value={1000}>1,000</option>
                  <option value={5000}>5,000</option>
                  <option value={10000}>10,000</option>
                  <option value={25000}>25,000</option>
                </select>
              </div>
              <button
                onClick={runSimulation}
                disabled={isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play size={16} />
                {isRunning ? 'Running...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <TabButton
              active={activeTab === 'simulation'}
              onClick={() => setActiveTab('simulation')}
              icon={<BarChart2 size={16} />}
              label="Simulation"
            />
            <TabButton
              active={activeTab === 'portfolio'}
              onClick={() => setActiveTab('portfolio')}
              icon={<Briefcase size={16} />}
              label="Portfolio"
            />
            <TabButton
              active={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
              icon={<Settings size={16} />}
              label="Configuration"
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'simulation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <FundConfig params={params} onChange={setParams} />
            </div>
            <div className="lg:col-span-2">
              <SimulationResults results={results} isRunning={isRunning} isStale={isResultsStale} />
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <Portfolio
            investments={investments}
            onAddInvestment={handleAddInvestment}
            onUpdateInvestment={handleUpdateInvestment}
            onDeleteInvestment={handleDeleteInvestment}
            onAddValuation={handleAddValuation}
          />
        )}

        {activeTab === 'config' && (
          <div className="max-w-2xl">
            <FundConfig params={params} onChange={setParams} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          Spectrum &middot; Monte Carlo simulation for VC fund modeling
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
        active ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
