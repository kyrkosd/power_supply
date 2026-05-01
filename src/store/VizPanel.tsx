import React from 'react'
import { useDesignStore, type ActiveVizTab } from '../../store/design-store'

// Import all the view components
import { WaveformChart } from '../WaveformChart/WaveformChart'
import { BodePlot } from '../BodePlot/BodePlot'
import { LossBreakdown } from '../LossBreakdown/LossBreakdown'
import { MonteCarloView } from '../MonteCarloView/MonteCarloView'
import ComparisonView from '../ComparisonView/ComparisonView'
import { TransientView } from '../TransientView/TransientView'
import { EMIView } from '../EMIView/EMIView'

// A placeholder for the thermal view
const ThermalView: React.FC = () => <div className="flex items-center justify-center h-full text-gray-400">Thermal View Placeholder</div>

const TABS: Array<{ id: ActiveVizTab; label: string; component: React.FC }> = [
  { id: 'waveforms', label: 'Waveforms', component: WaveformChart },
  { id: 'bode', label: 'Bode Plot', component: BodePlot },
  { id: 'losses', label: 'Losses', component: LossBreakdown },
  { id: 'thermal', label: 'Thermal', component: ThermalView },
  { id: 'monte-carlo', label: 'Monte Carlo', component: MonteCarloView },
  { id: 'transient', label: 'Transient', component: TransientView },
  { id: 'emi', label: 'EMI', component: EMIView },
  { id: 'ltspice-comparison', label: 'LTspice', component: ComparisonView },
]

export const VizPanel: React.FC = () => {
  const activeTab = useDesignStore((state) => state.activeVizTab)
  const setActiveTab = useDesignStore((state) => state.setActiveVizTab)
  const result = useDesignStore((state) => state.result)

  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.component

  // Disable tabs that require a valid simulation result
  const getIsDisabled = (tabId: ActiveVizTab): boolean => {
    if (tabId === 'waveforms') return false
    return !result
  }

  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-200 min-h-0">
      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-gray-700 overflow-x-auto">
        <nav className="flex space-x-1 px-2 py-1" aria-label="Tabs">
          {TABS.map((tab) => {
            const isDisabled = getIsDisabled(tab.id)
            const isActive = tab.id === activeTab

            const className = [
              'px-2 py-1 font-medium text-xs rounded-md whitespace-nowrap flex-shrink-0',
              isDisabled
                ? 'text-gray-500 cursor-not-allowed'
                : isActive
                ? 'bg-gray-900 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white',
            ].join(' ')

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                className={className}
                disabled={isDisabled}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div className="flex-grow overflow-auto">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="p-4">Select a tab</div>
        )}
      </div>
    </div>
  )
}