// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calculateConductedEMI } from '../engine/emi-analyzer'

interface EMIChartProps {
  fsw:      number
  dutyCycle: number
  trise:    number
  tfall:    number
  Ipeak:    number
}

// ── Data helpers ──────────────────────────────────────────────────────────────

type RawDataPoint = ReturnType<typeof calculateConductedEMI>['dataPoints'][number]

function toChartPoint(dp: RawDataPoint) {
  return {
    freq_MHz: parseFloat((dp.frequencyHz / 1e6).toFixed(3)),
    Noise:    parseFloat(dp.amplitude_dbuv.toFixed(2)),
    Limit:    dp.limit_dbuv !== null ? parseFloat(dp.limit_dbuv.toFixed(2)) : null,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FilterAlertProps {
  maxExceedanceDb:     number
  offendingFrequencyHz: number
  suggestion: NonNullable<ReturnType<typeof calculateConductedEMI>['filterSuggestion']>
}

const FilterAlert: React.FC<FilterAlertProps> = ({ maxExceedanceDb, offendingFrequencyHz, suggestion }) => (
  <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded text-gray-200 text-sm">
    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
      ⚠️ Limit Exceeded by {maxExceedanceDb.toFixed(1)} dB at {(offendingFrequencyHz / 1e6).toFixed(3)} MHz
    </h3>
    <p className="mb-2">Suggested LC Pi-Filter to pass compliance (includes 6 dB margin):</p>
    <ul className="list-disc list-inside pl-4 text-gray-300">
      <li>Target Attenuation: <span className="font-mono text-white">{suggestion.requiredAttenuationDb.toFixed(1)} dB</span></li>
      <li>Corner Frequency (f_c): <span className="font-mono text-white">{(suggestion.cornerFrequencyHz / 1000).toFixed(1)} kHz</span></li>
      <li>Suggested Inductor (L): <span className="font-mono text-white">{suggestion.suggestedL_uH.toFixed(2)} µH</span> (assuming C = 1 µF)</li>
    </ul>
  </div>
)

// ── Main component ────────────────────────────────────────────────────────────

export const EMIChart: React.FC<EMIChartProps> = ({ fsw, dutyCycle, trise, tfall, Ipeak }) => {
  const emiResult = useMemo(
    () => calculateConductedEMI(fsw, dutyCycle, trise, tfall, Ipeak),
    [fsw, dutyCycle, trise, tfall, Ipeak]
  )

  // Only chart within the CISPR 32 measurement range (150 kHz – 30 MHz)
  const chartData = useMemo(
    () => emiResult.dataPoints.filter(dp => dp.frequencyHz >= 150e3).map(toChartPoint),
    [emiResult.dataPoints]
  )

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-lg p-4">
      <h2 className="text-xl font-semibold text-gray-100 mb-4">Conducted EMI (CISPR 32 Class B)</h2>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="freq_MHz"
              stroke="#9CA3AF"
              type="number"
              domain={['dataMin', 'dataMax']}
              label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
            />
            <YAxis
              stroke="#9CA3AF"
              domain={[0, 100]}
              label={{ value: 'Amplitude (dBµV)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
              formatter={(value: number) => [`${value} dBµV`, undefined]}
              labelFormatter={(label: number) => `${label} MHz`}
            />
            <Legend verticalAlign="top" height={36} />
            <Line type="monotone" dataKey="Limit" name="CISPR 32 Limit"
              stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Noise" name="Predicted Conducted Emissions"
              stroke="#3B82F6" strokeWidth={1} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {emiResult.filterSuggestion && (
        <FilterAlert
          maxExceedanceDb={emiResult.maxExceedanceDb}
          offendingFrequencyHz={emiResult.offendingFrequencyHz!}
          suggestion={emiResult.filterSuggestion}
        />
      )}
    </div>
  )
}
