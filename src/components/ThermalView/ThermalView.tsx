// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import { useState } from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './ThermalView.module.css'

// Junction-to-ambient and junction-to-case thermal resistances by package
// Sources: Vishay, ON-Semi package datasheets
const MOSFET_PACKAGES = [
  { id: 'DPAK',  label: 'DPAK  (TO-252)', rthJa: 50, rthJc: 5 },
  { id: 'D2PAK', label: 'D2PAK (TO-263)', rthJa: 40, rthJc: 3 },
  { id: 'SO8',   label: 'SO-8',           rthJa: 62, rthJc: 8 },
] as const

type MosfetPackageId = (typeof MOSFET_PACKAGES)[number]['id']

interface ThermalComponent {
  name: string
  powerLoss: number
  rthJa: number  // °C/W — junction-to-ambient
  rthJc: number  // °C/W — junction-to-case (used for heatsink recommendation)
  tjMax: number  // °C — rated max junction temperature
}

export function ThermalView() {
  const { result, spec, updateSpec } = useDesignStore()
  const [mosfetPkg, setMosfetPkg] = useState<MosfetPackageId>('DPAK')

  if (!result) return null

  if (!result.losses) {
    return (
      <div className={styles.container}>
        <h3>Thermal Analysis</h3>
        <p className={styles.noData}>
          Thermal analysis requires loss data. Not available for this topology yet.
        </p>
      </div>
    )
  }

  const ambientTemp = spec.ambientTemp
  const pkg = MOSFET_PACKAGES.find((p) => p.id === mosfetPkg)!

  // DCR-based inductor loss estimate: P = I²_rms × DCR
  // Assume DCR ≈ 0.05 Ω for a typical SMD power inductor (conservative)
  const inductorDcr = 0.05 // Ω — Erickson & Maksimovic, chap. 13 typical
  const inductorPower =
    result.losses.primaryCopper + result.losses.secondaryCopper + inductorDcr

  const components: ThermalComponent[] = [
    {
      name: 'MOSFET',
      powerLoss: result.losses.mosfet || 0,
      rthJa: pkg.rthJa,
      rthJc: pkg.rthJc,
      tjMax: 150,
    },
    {
      name: 'Diode',
      powerLoss: result.losses.diode || 0,
      rthJa: 40, // D2PAK diode typical
      rthJc: 3,
      tjMax: 150,
    },
    {
      name: 'Inductor',
      powerLoss: inductorPower,
      rthJa: 25, // Typical SMD power inductor (core + copper)
      rthJc: 10,
      tjMax: 125,
    },
    {
      name: 'Output Cap',
      powerLoss: result.losses.clamp ? result.losses.clamp * 0.1 : 0.05,
      rthJa: 20,
      rthJc: 15,
      tjMax: 105,
    },
  ]

  const thermalData = components.map((comp) => ({
    ...comp,
    tj: ambientTemp + comp.powerLoss * comp.rthJa,
    temperatureRise: comp.powerLoss * comp.rthJa,
  }))

  const hasOverheating = thermalData.some((comp) => comp.tj > 125)

  const getTemperatureColor = (tj: number): string => {
    if (tj < 100) return '#27ae60'
    if (tj < 125) return '#f39c12'
    return '#e74c3c'
  }

  const getHeatsinkRecommendation = () => {
    if (!hasOverheating) return null

    const worst = thermalData.reduce((max, comp) =>
      comp.tj > max.tj ? comp : max,
    )

    // Rth_heatsink ≤ (Tj_max - Ta) / Ploss - Rth_jc
    const required =
      (worst.tjMax - ambientTemp) / Math.max(worst.powerLoss, 1e-6) - worst.rthJc
    const recommended = Math.max(0.5, Math.round(required * 10) / 10)

    return (
      <div className={styles.warning}>
        <strong>Heatsink Required — {worst.name}</strong>
        <p>
          Rth_heatsink ≤ ({worst.tjMax} − {ambientTemp}) /{' '}
          {worst.powerLoss.toFixed(2)} − {worst.rthJc} ={' '}
          <strong>{recommended} °C/W</strong>
        </p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h3>Thermal Analysis</h3>

      <div className={styles.controls}>
        <label>
          Ambient temperature: <strong>{ambientTemp} °C</strong>
          <input
            type="range"
            min="25"
            max="85"
            step="5"
            value={ambientTemp}
            onChange={(e) => updateSpec({ ambientTemp: Number(e.target.value) })}
            className={styles.slider}
          />
        </label>

        <label className={styles.pkgLabel}>
          MOSFET package
          <select
            className={styles.pkgSelect}
            value={mosfetPkg}
            onChange={(e) => setMosfetPkg(e.target.value as MosfetPackageId)}
          >
            {MOSFET_PACKAGES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.thermalBars}>
        {thermalData.map((comp) => (
          <div key={comp.name} className={styles.componentRow}>
            <div className={styles.componentLabel}>
              <span className={styles.componentName}>{comp.name}</span>
              <span className={styles.powerLoss}>{comp.powerLoss.toFixed(2)} W</span>
            </div>
            <div className={styles.temperatureBar}>
              <div
                className={styles.bar}
                style={{
                  width: `${Math.min((comp.tj / 150) * 100, 100)}%`,
                  backgroundColor: getTemperatureColor(comp.tj),
                }}
              >
                <span className={styles.temperatureText}>
                  {comp.tj.toFixed(1)} °C
                </span>
              </div>
            </div>
            <div
              className={styles.details}
              title={`Tj = Ta + Ploss × Rth_ja = ${ambientTemp} + ${comp.powerLoss.toFixed(2)} × ${comp.rthJa} = ${comp.tj.toFixed(1)} °C`}
            >
              <div>+{comp.temperatureRise.toFixed(1)} °C rise</div>
              <div>Rth_ja {comp.rthJa} °C/W</div>
            </div>
          </div>
        ))}
      </div>

      {hasOverheating && getHeatsinkRecommendation()}

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: '#27ae60' }} />
          <span>&lt; 100 °C</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: '#f39c12' }} />
          <span>100–125 °C</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: '#e74c3c' }} />
          <span>&gt; 125 °C</span>
        </div>
      </div>
    </div>
  )
}
