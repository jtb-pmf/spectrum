'use client';

import { FundParams, FUND_PRESETS, DEFAULT_FUND_PARAMS } from '@/types';
import { formatMoney, formatPercent } from '@/lib/format';

interface FundConfigProps {
  params: FundParams;
  onChange: (params: FundParams) => void;
}

export function FundConfig({ params, onChange }: FundConfigProps) {
  const handlePresetChange = (preset: string) => {
    const presetParams = FUND_PRESETS[preset];
    if (presetParams) {
      onChange({
        ...DEFAULT_FUND_PARAMS,
        ...presetParams,
      });
    }
  };

  const handleChange = (field: keyof FundParams, value: number) => {
    onChange({
      ...params,
      [field]: value,
    });
  };

  // Calculate derived values
  const totalFees = Array.from({ length: params.fundLife }, (_, i) => {
    const year = i + 1;
    if (year <= params.mgmtFeeFullYears) {
      return params.mgmtFeeRate * params.fundSize;
    }
    return params.mgmtFeeStepdown * params.mgmtFeeRate * params.fundSize;
  }).reduce((a, b) => a + b, 0);

  const investableCapital = params.fundSize - totalFees;
  const followOnReserve = investableCapital * params.followOnReservePercent;
  const deployableCapital = investableCapital - followOnReserve;

  // Derive discovery count from target conviction count and graduation rate
  const derivedDiscoveryCount = Math.round(params.targetConvictionCount / params.graduationRate);
  const discoveryTotal = derivedDiscoveryCount * params.discoveryCheckSize;
  const convictionTotal = params.targetConvictionCount * params.convictionCheckSize;
  const earlyStageTotal = discoveryTotal + convictionTotal;

  const capitalUtilization = earlyStageTotal / deployableCapital;

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4 text-white">Fund Configuration</h2>

      {/* Fund Size Presets */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Fund Size Preset
        </label>
        <div className="flex gap-2">
          {Object.keys(FUND_PRESETS).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                params.fundSize === FUND_PRESETS[preset].fundSize
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Parameters */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Fund Size
          </label>
          <input
            type="number"
            value={params.fundSize}
            onChange={(e) => handleChange('fundSize', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Fund Life (years)
          </label>
          <input
            type="number"
            value={params.fundLife}
            onChange={(e) => handleChange('fundLife', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
      </div>

      {/* Investment Parameters */}
      <h3 className="text-lg font-medium text-gray-300 mb-3">Investment Parameters</h3>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Target Conviction Count
          </label>
          <input
            type="number"
            value={params.targetConvictionCount}
            onChange={(e) => handleChange('targetConvictionCount', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Graduation Rate
          </label>
          <input
            type="number"
            step="0.01"
            value={params.graduationRate}
            onChange={(e) => handleChange('graduationRate', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.graduationRate)}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Discovery Check Size
          </label>
          <input
            type="number"
            value={params.discoveryCheckSize}
            onChange={(e) => handleChange('discoveryCheckSize', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Conviction Check Size
          </label>
          <input
            type="number"
            value={params.convictionCheckSize}
            onChange={(e) => handleChange('convictionCheckSize', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
        </div>
      </div>

      {/* Fee & Carry */}
      <h3 className="text-lg font-medium text-gray-300 mb-3">Fee & Carry</h3>
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Management Fee
          </label>
          <input
            type="number"
            step="0.001"
            value={params.mgmtFeeRate}
            onChange={(e) => handleChange('mgmtFeeRate', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.mgmtFeeRate)}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Carry
          </label>
          <input
            type="number"
            step="0.01"
            value={params.carry}
            onChange={(e) => handleChange('carry', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.carry)}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Follow-on Reserve
          </label>
          <input
            type="number"
            step="0.01"
            value={params.followOnReservePercent}
            onChange={(e) => handleChange('followOnReservePercent', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.followOnReservePercent)}</span>
        </div>
      </div>

      {/* Success Rates */}
      <h3 className="text-lg font-medium text-gray-300 mb-3">Base Success Rates</h3>
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Discovery Success Rate
          </label>
          <input
            type="number"
            step="0.01"
            value={params.discoverySuccessRate}
            onChange={(e) => handleChange('discoverySuccessRate', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.discoverySuccessRate)} return &gt;1x</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Conviction Success Rate
          </label>
          <input
            type="number"
            step="0.01"
            value={params.convictionSuccessRate}
            onChange={(e) => handleChange('convictionSuccessRate', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
          />
          <span className="text-xs text-gray-500">{formatPercent(params.convictionSuccessRate)} return &gt;1x</span>
        </div>
      </div>

      {/* Calculated Summary */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-medium text-gray-300 mb-3">Capital Allocation</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="text-gray-400">Fund Size:</div>
          <div className="text-white font-medium">{formatMoney(params.fundSize)}</div>

          <div className="text-gray-400">Total Fees (10y):</div>
          <div className="text-red-400">{formatMoney(totalFees)}</div>

          <div className="text-gray-400">Investable Capital:</div>
          <div className="text-white">{formatMoney(investableCapital)}</div>

          <div className="text-gray-400">Follow-on Reserve:</div>
          <div className="text-yellow-400">{formatMoney(followOnReserve)}</div>

          <div className="text-gray-400">Deployable (Early Stage):</div>
          <div className="text-white font-medium">{formatMoney(deployableCapital)}</div>

          <div className="col-span-2 border-t border-gray-700 my-2"></div>

          <div className="text-gray-400">Target Conviction:</div>
          <div className="text-white">{params.targetConvictionCount} x {formatMoney(params.convictionCheckSize)} = {formatMoney(convictionTotal)}</div>

          <div className="text-gray-400">Discovery Checks (derived):</div>
          <div className="text-white">{derivedDiscoveryCount} x {formatMoney(params.discoveryCheckSize)} = {formatMoney(discoveryTotal)}</div>

          <div className="text-gray-400">Total Early Stage:</div>
          <div className="text-white font-medium">{formatMoney(earlyStageTotal)}</div>

          <div className="text-gray-400">Capital Utilization:</div>
          <div className={capitalUtilization > 1 ? 'text-red-400' : 'text-green-400'}>
            {formatPercent(capitalUtilization)}
            {capitalUtilization > 1 && ' (Over budget!)'}
          </div>
        </div>
      </div>
    </div>
  );
}
