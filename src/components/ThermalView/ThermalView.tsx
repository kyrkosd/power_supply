// Thermal analysis view: junction temperature estimates and heatsink recommendation.
import React, { useState } from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './ThermalView.module.css'

/** Junction-to-ambient and junction-to-case thermal resistances by MOSFET package.
 *  Sources: Vishay, ON-Semi package datasheets. */
const MOSFET_PACKAGES = [
  { id: 'DPAK',  label: 'DPAK  (TO-252)', rthJa: 50, rthJc: 5 },
  { id: 'D2PAK', label: 'D2PAK (TO-263)', rthJa: 40, rthJc: 3 },
  { id: 'SO8',   label: 'SO-8',           rthJa: 62, rthJc: 8 },
] as const

type MosfetPackageId = (typeof MOSFET_PACKAGES)[number]['id']

/** Thermal model for a single component. */
interface ThermalComp {
  name: string; powerLoss: number
  rthJa: number; rthJc: number; tjMax: number
}

/** Maps temperature to a traffic-light colour string. */
function tempColor(tj: number): string {
  if (tj < 100) return '#27ae60'
  if (tj < 125) return '#f39c12'
  return '#e74c3c'
}

/** Extracts MOSFET and diode loss totals from the two possible loss-object shapes. */
function deriveLosses(losses: Record<string, unknown>): { mosfet: number; diode: number; clamp: number; winding: number } {
  const isXfmr = 'primaryCopper' in losses || 'secondaryCopper' in losses
  if (isXfmr) {
    return {
      mosfet:  (losses.mosfet  as number) ?? 0,
      diode:   (losses.diode   as number) ?? 0,
      clamp:   (losses.clamp   as number) ?? 0,
      winding: ((losses.primaryCopper as number) ?? 0) + ((losses.secondaryCopper as number) ?? 0),
    }
  }
  return {
    mosfet:  ((losses.mosfet_conduction as number) ?? 0) + ((losses.mosfet_switching as number) ?? 0),
    diode:   (losses.diode_conduction as number) ?? 0,
    clamp:   0,
    winding: 0,
  }
}

/** Builds the array of thermal components to analyse. */
function buildComponents(
  losses: Record<string, unknown>, pkg: (typeof MOSFET_PACKAGES)[number],
): ThermalComp[] {
  const L = deriveLosses(losses)
  return [
    { name: 'MOSFET',    powerLoss: L.mosfet,                      rthJa: pkg.rthJa, rthJc: pkg.rthJc, tjMax: 150 },
    { name: 'Diode',     powerLoss: L.diode,                       rthJa: 40,        rthJc: 3,         tjMax: 150 },
    { name: 'Inductor',  powerLoss: L.winding + 0.05,              rthJa: 25,        rthJc: 10,        tjMax: 125 },
    { name: 'Output Cap',powerLoss: L.clamp ? L.clamp * 0.1 : 0.05, rthJa: 20,       rthJc: 15,        tjMax: 105 },
  ]
}

/** Props for the HeatsinkWarning sub-component. */
interface HeatsinkProps { comp: ThermalComp & { tj: number }; ambientTemp: number }

/** Displays a heatsink requirement when junction temperature exceeds 125 °C. */
function HeatsinkWarning({ comp, ambientTemp }: HeatsinkProps): React.ReactElement {
  const required    = (comp.tjMax - ambientTemp) / Math.max(comp.powerLoss, 1e-6) - comp.rthJc
  const recommended = Math.max(0.5, Math.round(required * 10) / 10)
  return (
    <div className={styles.warning}>
      <strong>Heatsink Required — {comp.name}</strong>
      <p>
        Rth_heatsink ≤ ({comp.tjMax} − {ambientTemp}) /{' '}
        {comp.powerLoss.toFixed(2)} − {comp.rthJc} = <strong>{recommended} °C/W</strong>
      </p>
    </div>
  )
}

/** Renders a single component's temperature bar row. */
function ComponentRow({ comp, ambientTemp }: { comp: ThermalComp; ambientTemp: number }): React.ReactElement {
  const tj   = ambientTemp + comp.powerLoss * comp.rthJa
  const rise = comp.powerLoss * comp.rthJa
  return (
    <div className={styles.componentRow}>
      <div className={styles.componentLabel}>
        <span className={styles.componentName}>{comp.name}</span>
        <span className={styles.powerLoss}>{comp.powerLoss.toFixed(2)} W</span>
      </div>
      <div className={styles.temperatureBar}>
        <div className={styles.bar}
          style={{ width: `${Math.min((tj / 150) * 100, 100)}%`, backgroundColor: tempColor(tj) }}>
          <span className={styles.temperatureText}>{tj.toFixed(1)} °C</span>
        </div>
      </div>
      <div className={styles.details}
        title={`Tj = Ta + Ploss × Rth_ja = ${ambientTemp} + ${comp.powerLoss.toFixed(2)} × ${comp.rthJa} = ${tj.toFixed(1)} °C`}>
        <div>+{rise.toFixed(1)} °C rise</div>
        <div>Rth_ja {comp.rthJa} °C/W</div>
      </div>
    </div>
  )
}

/** Colour legend strip for the temperature-bar scale. */
const LEGEND_ITEMS = [
  { color: '#27ae60', label: '< 100 °C' },
  { color: '#f39c12', label: '100–125 °C' },
  { color: '#e74c3c', label: '> 125 °C' },
] as const

/** Thermal analysis view: package selector, junction temperature bars, heatsink advisory. */
export function ThermalView(): React.ReactElement | null {
  const { result, spec, updateSpec } = useDesignStore()
  const [mosfetPkg, setMosfetPkg]    = useState<MosfetPackageId>('DPAK')

  if (!result) return null
  if (!result.losses) {
    return (
      <div className={styles.container}>
        <h3>Thermal Analysis</h3>
        <p className={styles.noData}>Thermal analysis requires loss data. Not available for this topology yet.</p>
      </div>
    )
  }

  const pkg        = MOSFET_PACKAGES.find((p) => p.id === mosfetPkg)!
  const components = buildComponents(result.losses as Record<string, unknown>, pkg)
  const thermalData = components.map((c) => ({ ...c, tj: spec.ambientTemp + c.powerLoss * c.rthJa }))
  const overheated  = thermalData.find((c) => c.tj > 125) ?? null

  return (
    <div className={styles.container}>
      <h3>Thermal Analysis</h3>

      <div className={styles.controls}>
        <label>
          Ambient temperature: <strong>{spec.ambientTemp} °C</strong>
          <input type="range" min="25" max="85" step="5" value={spec.ambientTemp}
            onChange={(e) => updateSpec({ ambientTemp: Number(e.target.value) })}
            className={styles.slider} />
        </label>
        <label className={styles.pkgLabel}>
          MOSFET package
          <select className={styles.pkgSelect} value={mosfetPkg}
            onChange={(e) => setMosfetPkg(e.target.value as MosfetPackageId)}>
            {MOSFET_PACKAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.thermalBars}>
        {components.map((c) => <ComponentRow key={c.name} comp={c} ambientTemp={spec.ambientTemp} />)}
      </div>

      {overheated && <HeatsinkWarning comp={overheated} ambientTemp={spec.ambientTemp} />}

      <div className={styles.legend}>
        {LEGEND_ITEMS.map(({ color, label }) => (
          <div key={label} className={styles.legendItem}>
            <div className={styles.colorBox} style={{ backgroundColor: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
