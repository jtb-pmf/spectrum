'use client';

import { MonteCarloResults } from '@/types';
import { formatMoney, formatMultiple, formatPercent } from '@/lib/format';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface SimulationResultsProps {
  results: MonteCarloResults | null;
  isRunning: boolean;
  isStale?: boolean;
}

export function SimulationResults({ results, isRunning, isStale = false }: SimulationResultsProps) {
  if (isRunning) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Running simulation...</span>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-center h-64 text-gray-500">
          Configure fund parameters and run simulation to see results
        </div>
      </div>
    );
  }

  // Build histogram data for TVPI distribution
  const tvpiValues = results.simulations.map(s => s.netTvpi);
  const bins = 20;
  const minTvpi = Math.min(...tvpiValues);
  const maxTvpi = Math.max(...tvpiValues);
  const binWidth = (maxTvpi - minTvpi) / bins;

  const histogramData = Array.from({ length: bins }, (_, i) => {
    const binStart = minTvpi + i * binWidth;
    const binEnd = binStart + binWidth;
    const count = tvpiValues.filter(v => v >= binStart && v < binEnd).length;
    return {
      range: `${binStart.toFixed(1)}x`,
      count,
      frequency: count / results.numSimulations,
    };
  });

  return (
    <div className="space-y-6">
      {/* Stale indicator */}
      {isStale && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 flex items-center gap-2 text-yellow-400 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Configuration changed — results may not reflect current settings
        </div>
      )}

      {/* Key Metrics */}
      <div className={`bg-gray-900 rounded-lg p-6 border border-gray-800 ${isStale ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold mb-4 text-white">Key Metrics</h2>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="Median Net TVPI"
            value={formatMultiple(results.summary.netTvpi.p50)}
            subtitle={`${formatMultiple(results.summary.netTvpi.p25)} - ${formatMultiple(results.summary.netTvpi.p75)} IQR`}
          />
          <MetricCard
            label="Mean Net TVPI"
            value={formatMultiple(results.summary.netTvpi.mean)}
            subtitle={`${formatMultiple(results.summary.grossTvpi.mean)} gross`}
          />
          <MetricCard
            label="Median IRR"
            value={formatPercent(results.summary.irrNet.p50)}
            subtitle={`${formatPercent(results.summary.irrNet.mean)} mean`}
          />
          <MetricCard
            label="90th Percentile"
            value={formatMultiple(results.summary.netTvpi.p90)}
            subtitle="Net TVPI"
          />
        </div>

        {/* Probability Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <ProbabilityCard
            label="P(Return Fund)"
            probability={results.probReturnFund}
            description="TVPI >= 1.0x"
          />
          <ProbabilityCard
            label="P(2x Return)"
            probability={results.prob2x}
            description="TVPI >= 2.0x"
          />
          <ProbabilityCard
            label="P(3x Return)"
            probability={results.prob3x}
            description="TVPI >= 3.0x"
          />
        </div>
      </div>

      {/* Distribution Chart */}
      <div className={`bg-gray-900 rounded-lg p-6 border border-gray-800 ${isStale ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold mb-4 text-white">Net TVPI Distribution</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="range"
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: '#9CA3AF' }}
                tickFormatter={(v) => formatPercent(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#F9FAFB' }}
                formatter={(value) => [formatPercent(value as number), 'Frequency']}
              />
              <ReferenceLine x={`${results.summary.netTvpi.p50.toFixed(1)}x`} stroke="#10B981" strokeDasharray="5 5" />
              <Bar dataKey="frequency" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center mt-2 text-sm text-gray-500">
          <span className="flex items-center">
            <span className="w-4 h-0.5 bg-green-500 mr-2"></span>
            Median
          </span>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className={`bg-gray-900 rounded-lg p-6 border border-gray-800 ${isStale ? 'opacity-50' : ''}`}>
        <h2 className="text-xl font-semibold mb-4 text-white">Distribution Statistics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Metric</th>
                <th className="text-right py-2">Min</th>
                <th className="text-right py-2">10th</th>
                <th className="text-right py-2">25th</th>
                <th className="text-right py-2">Median</th>
                <th className="text-right py-2">75th</th>
                <th className="text-right py-2">90th</th>
                <th className="text-right py-2">Max</th>
                <th className="text-right py-2">Mean</th>
              </tr>
            </thead>
            <tbody className="text-white">
              <tr className="border-b border-gray-800">
                <td className="py-2 text-gray-400">Gross TVPI</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.min)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.p10)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.p25)}</td>
                <td className="text-right font-medium">{formatMultiple(results.summary.grossTvpi.p50)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.p75)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.p90)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.max)}</td>
                <td className="text-right">{formatMultiple(results.summary.grossTvpi.mean)}</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 text-gray-400">Net TVPI</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.min)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.p10)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.p25)}</td>
                <td className="text-right font-medium">{formatMultiple(results.summary.netTvpi.p50)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.p75)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.p90)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.max)}</td>
                <td className="text-right">{formatMultiple(results.summary.netTvpi.mean)}</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-2 text-gray-400">Net IRR</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.min)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.p10)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.p25)}</td>
                <td className="text-right font-medium">{formatPercent(results.summary.irrNet.p50)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.p75)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.p90)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.max)}</td>
                <td className="text-right">{formatPercent(results.summary.irrNet.mean)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Based on {results.numSimulations.toLocaleString()} Monte Carlo simulations
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}

function ProbabilityCard({
  label,
  probability,
  description,
}: {
  label: string;
  probability: number;
  description: string;
}) {
  const color =
    probability >= 0.8
      ? 'text-green-400'
      : probability >= 0.5
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{formatPercent(probability)}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}
