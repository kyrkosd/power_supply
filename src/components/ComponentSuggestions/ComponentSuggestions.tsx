import React from 'react'
import { useDesignStore } from '../../store/design-store'
import {
  suggestInductors,
  suggestCapacitors,
  suggestMosfets,
  type InductorData,
  type CapacitorData,
  type MosfetData,
} from '../../engine/component-selector'
import { computeGateDrive, type GateDriveResult } from '../../engine/gate-drive'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './ComponentSuggestions.module.css'

// ── Topologies that use a high-side switch requiring a bootstrap circuit ───────
const HIGH_SIDE_TOPOLOGIES = new Set(['buck', 'forward'])

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (s < 1e-6) return `${(s * 1e9).toFixed(1)} ns`
  return `${(s * 1e6).toFixed(2)} µs`
}

function fmtCap(f: number): string {
  if (f < 1e-6) return `${(f * 1e9).toFixed(0)} nF`
  return `${(f * 1e6).toFixed(1)} µF`
}

function fmtPower(w: number): string {
  return w < 1 ? `${(w * 1000).toFixed(1)} mW` : `${w.toFixed(2)} W`
}

// ── Gate Drive row sub-component ──────────────────────────────────────────────

function GdrRow({
  label, value, tip,
}: { label: string; value: string; tip: React.ReactNode }) {
  return (
    <div className={styles.gdrRow}>
      <span className={styles.gdrLabel}>
        {label}
        <Tooltip content={tip} side="left">
          <span className={styles.infoIcon}>ⓘ</span>
        </Tooltip>
      </span>
      <span className={styles.gdrValue}>{value}</span>
    </div>
  )
}

// ── MOSFET Vds stress per topology ────────────────────────────────────────
function mosfetVdsRequired(topology: string, vinMax: number, vout: number): number {
  switch (topology) {
    case 'boost':      return vout * 1.25
    case 'buck-boost':
    case 'sepic':      return (vinMax + vout) * 1.25
    case 'flyback':
    case 'forward':    return vinMax * 2 * 1.25
    default:           return vinMax * 1.25  // buck
  }
}

export function ComponentSuggestions() {
  const { result, spec, topology, selectedComponents, setSelectedComponent } = useDesignStore()

  if (!result) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Components</div>
        <div className={styles.empty}>Run a simulation first.</div>
      </div>
    )
  }

  const inductor  = suggestInductors(result.inductance * 1e6, result.peakCurrent)[0]
  const capacitor = suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0]
  const mosfet    = suggestMosfets(mosfetVdsRequired(topology, spec.vinMax, spec.vout))[0]

  const gateDrive: GateDriveResult | null = mosfet
    ? computeGateDrive(spec, result, mosfet)
    : null

  const showBootstrap = HIGH_SIDE_TOPOLOGIES.has(topology)

  const sel = selectedComponents

  const inductanceTooltip = (
    <div>
      <strong>Inductance</strong><br />
      Calculated value: {(result.inductance * 1e6).toFixed(2)} µH<br />
      <code style={{ fontSize: '10px' }}>L = ΔIL / (fsw × Iout)</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>Larger L = smoother current, smaller ripple</small>
    </div>
  )

  const capacitanceTooltip = (
    <div>
      <strong>Capacitance</strong><br />
      Calculated value: {(result.capacitance * 1e6).toFixed(1)} µF<br />
      <code style={{ fontSize: '10px' }}>C ≥ ΔIL / (fsw × ΔVout)</code><br />
      <small style={{ color: 'var(--text-secondary)' }}>Larger C = lower ripple voltage</small>
    </div>
  )

  const mosfetTooltip = (
    <div>
      <strong>Power MOSFET (Q1)</strong><br />
      Vds stress: {mosfetVdsRequired(topology, spec.vinMax, spec.vout).toFixed(0)} V<br />
      Peak current: {result.peakCurrent.toFixed(2)} A<br />
      <small style={{ color: 'var(--text-secondary)' }}>Sorted by lowest Rds_on × Qg figure of merit</small>
    </div>
  )

  const peakCurrentTooltip = (
    <div>
      <strong>Peak Inductor Current</strong><br />
      Value: {result.peakCurrent.toFixed(2)} A<br />
      <small style={{ color: 'var(--text-secondary)' }}>Must choose inductor with Isat rating higher than this</small>
    </div>
  )

  const ccmBoundaryTooltip = (
    <div>
      <strong>CCM/DCM Boundary</strong><br />
      Minimum load current for CCM: {(result.ccm_dcm_boundary ?? 0).toFixed(3)} A<br />
      Operating mode: <strong>{result.operating_mode ?? 'Unknown'}</strong><br />
      <small style={{ color: 'var(--text-secondary)' }}>
        Design equations assume CCM. If load falls below this current, the converter enters DCM and equations become inaccurate.
      </small>
    </div>
  )

  const getModeColor = (mode?: string): string => {
    switch (mode) {
      case 'CCM':      return '#4ade80'
      case 'boundary': return '#fbbf24'
      case 'DCM':      return '#f87171'
      default:         return 'inherit'
    }
  }

  function selectBadge(isSelected: boolean) {
    if (!isSelected) return null
    return (
      <span style={{
        fontSize: '10px', background: '#1a4a2e', color: '#4ade80',
        borderRadius: '3px', padding: '1px 5px', marginLeft: '6px',
      }}>
        ✓ selected
      </span>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Components</div>

      {/* ── MOSFET ──────────────────────────────────────────────── */}
      {mosfet && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            MOSFET (Q1)
            <Tooltip content={mosfetTooltip} side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
            {selectBadge(sel.mosfet?.part_number === mosfet.part_number)}
          </div>
          <MosfetCard
            data={mosfet}
            isSelected={sel.mosfet?.part_number === mosfet.part_number}
            onSelect={() =>
              setSelectedComponent('mosfet',
                sel.mosfet?.part_number === mosfet.part_number ? null : mosfet
              )
            }
          />
        </div>
      )}

      {/* ── Gate Drive ──────────────────────────────────────────── */}
      {gateDrive && (
        <details className={styles.section} open={false}>
          <summary className={styles.gdrSummary}>Gate Drive Design</summary>

          <div className={styles.gdrBody}>
            <GdrRow
              label="Gate Resistor (Rg)"
              value={`${gateDrive.gate_resistor.toFixed(1)} Ω`}
              tip={
                <div>
                  <strong>External gate resistor</strong><br />
                  Limits peak gate current to ~{gateDrive.peak_gate_current.toFixed(1)} A.<br />
                  Too small → fast switching, high EMI and ringing.<br />
                  Too large → slow switching, higher losses.<br />
                  <small>TI SLUA618</small>
                </div>
              }
            />
            <GdrRow
              label="Peak Gate Current"
              value={`${gateDrive.peak_gate_current.toFixed(2)} A`}
              tip={
                <div>
                  <strong>Peak gate current</strong><br />
                  <code style={{ fontSize: '10px' }}>Ig = Vgs / (Rg + Rg_int)</code><br />
                  Higher current = faster switching but harder to control ringing.
                  Typical integrated driver limit: 1–4 A.
                </div>
              }
            />
            <GdrRow
              label="Gate Drive Power"
              value={fmtPower(gateDrive.gate_drive_power)}
              tip={
                <div>
                  <strong>Gate drive dissipation</strong><br />
                  <code style={{ fontSize: '10px' }}>Pgd = Qg × Vgs × fsw</code><br />
                  Energy stored in gate capacitance is lost every cycle in the driver.
                  Scales linearly with frequency. Microchip AN1471.
                </div>
              }
            />
            <GdrRow
              label="Turn-on Time"
              value={fmtTime(gateDrive.turn_on_time)}
              tip={
                <div>
                  <strong>Gate turn-on time</strong><br />
                  <code style={{ fontSize: '10px' }}>t_on ≈ Qg / Ig_peak</code><br />
                  Time to charge the gate fully. Determines dv/dt during turn-on.
                  Infineon AN_201702_PL52_014.
                </div>
              }
            />
            <GdrRow
              label="Turn-off Time"
              value={fmtTime(gateDrive.turn_off_time)}
              tip={
                <div>
                  <strong>Gate turn-off time</strong><br />
                  <code style={{ fontSize: '10px' }}>t_off ≈ Qgd / Ig_peak</code><br />
                  Dominated by the Miller (gate-to-drain) charge Qgd.
                  The Miller plateau controls the output dv/dt during turn-off.
                </div>
              }
            />
            <GdrRow
              label="Dead Time (rec.)"
              value={fmtTime(gateDrive.dead_time_recommended)}
              tip={
                <div>
                  <strong>Recommended dead time</strong><br />
                  <code style={{ fontSize: '10px' }}>t_dead = max(t_on, t_off) × 1.5</code><br />
                  Gap inserted between high-side turn-off and low-side turn-on (and vice versa)
                  to prevent both switches conducting simultaneously (shoot-through).
                  Erickson & Maksimovic §4.3.
                </div>
              }
            />

            {showBootstrap && (
              <>
                <div className={styles.gdrDivider} />
                <GdrRow
                  label="Bootstrap Cap (Cboot)"
                  value={fmtCap(gateDrive.bootstrap_cap)}
                  tip={
                    <div>
                      <strong>Bootstrap capacitor</strong><br />
                      Supplies charge to the high-side gate driver when the switch node
                      flies above the supply rail. The capacitor charges through a diode
                      during the low-side on-time and discharges into the gate during
                      the high-side on-time.<br /><br />
                      <code style={{ fontSize: '10px' }}>Cboot ≥ 10 × Qg / ΔVboot</code><br />
                      <small style={{ color: 'var(--text-secondary)' }}>
                        ΔVboot = 0.2 V max droop; 10× margin for leakage &amp; refresh.<br />
                        TI SLVA301.
                      </small>
                    </div>
                  }
                />
                <GdrRow
                  label="Bootstrap Diode Vr"
                  value={`${gateDrive.bootstrap_diode_vr.toFixed(0)} V`}
                  tip={
                    <div>
                      <strong>Bootstrap diode reverse voltage</strong><br />
                      <code style={{ fontSize: '10px' }}>Vr ≥ Vin_max + Vgs</code><br />
                      When the high-side switch turns on, the diode must block Vin plus
                      the gate supply voltage. Use a fast-recovery or Schottky diode rated
                      above this value.
                    </div>
                  }
                />
              </>
            )}
          </div>
        </details>
      )}

      {/* ── Inductor ────────────────────────────────────────────── */}
      {inductor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Inductor (L1)
            <Tooltip content={inductanceTooltip} side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
            {selectBadge(sel.inductor?.part_number === inductor.part_number)}
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.rank}>#1</span>
              <span className={styles.partNumber}>{inductor.part_number}</span>
            </div>
            <div className={styles.manufacturer}>{inductor.manufacturer}</div>
            <div className={styles.specs}>
              <span className={styles.spec}><strong>{inductor.inductance_uh}</strong> µH</span>
              <span className={styles.spec}>DCR <strong>{inductor.dcr_mohm}</strong> mΩ</span>
              <span className={styles.spec}>
                Isat <Tooltip content={peakCurrentTooltip} side="top">
                  <strong>{inductor.isat_a}</strong>
                </Tooltip> A
              </span>
              <span className={styles.spec}>Irms <strong>{inductor.irms_a}</strong> A</span>
            </div>
            <button
              className={styles.selectButton}
              onClick={() =>
                setSelectedComponent('inductor',
                  sel.inductor?.part_number === inductor.part_number ? null : inductor
                )
              }
            >
              {sel.inductor?.part_number === inductor.part_number ? 'Deselect' : 'Select'}
            </button>
          </div>
        </div>
      )}

      {/* ── Output capacitor ────────────────────────────────────── */}
      {capacitor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Output Cap (Cout)
            <Tooltip content={capacitanceTooltip} side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
            {selectBadge(sel.capacitor?.part_number === capacitor.part_number)}
          </div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.rank}>#1</span>
              <span className={styles.partNumber}>{capacitor.part_number}</span>
            </div>
            <div className={styles.manufacturer}>{capacitor.manufacturer}</div>
            <div className={styles.specs}>
              <span className={styles.spec}><strong>{capacitor.capacitance_uf}</strong> µF</span>
              <span className={styles.spec}><strong>{capacitor.voltage_v}</strong> V</span>
              <span className={styles.spec}>ESR <strong>{capacitor.esr_mohm}</strong> mΩ</span>
              <span className={styles.spec}>{capacitor.type}</span>
            </div>
            <button
              className={styles.selectButton}
              onClick={() =>
                setSelectedComponent('capacitor',
                  sel.capacitor?.part_number === capacitor.part_number ? null : capacitor
                )
              }
            >
              {sel.capacitor?.part_number === capacitor.part_number ? 'Deselect' : 'Select'}
            </button>
          </div>
        </div>
      )}

      {/* ── CCM/DCM mode badge ───────────────────────────────────── */}
      {result.ccm_dcm_boundary != null && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            CCM/DCM Operating Mode
            <Tooltip content={ccmBoundaryTooltip} side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </div>
          <div className={styles.card} style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operating Mode:</span>
              <span style={{ color: getModeColor(result.operating_mode), fontWeight: 'bold', fontSize: '14px' }}>
                {result.operating_mode ?? 'Unknown'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>CCM Boundary:</span>
              <span style={{ fontWeight: 'bold' }}>{result.ccm_dcm_boundary.toFixed(3)} A</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Load current below {result.ccm_dcm_boundary.toFixed(3)} A enters DCM
            </div>
          </div>
        </div>
      )}

      {/* ── Flyback multi-output summary ─────────────────────────── */}
      {result.secondaryOutputResults && result.secondaryOutputResults.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Multi-Output Summary</div>
          <table className={styles.moTable}>
            <thead>
              <tr>
                <th>Output</th>
                <th>Vout</th>
                <th>Ns</th>
                <th>Diode Vr</th>
                <th>Cout</th>
                <th>Cross-Reg</th>
              </tr>
            </thead>
            <tbody>
              {/* Primary output (always regulated) */}
              <tr>
                <td className={styles.moLabel}>Out 1</td>
                <td>{spec.vout.toFixed(1)} V</td>
                <td>{result.secondaryTurns ?? '—'}</td>
                <td>—</td>
                <td>{(result.capacitance * 1e6).toFixed(1)} µF</td>
                <td className={styles.moRegulated}>Regulated</td>
              </tr>
              {result.secondaryOutputResults.map((s) => (
                <tr key={s.label}>
                  <td className={styles.moLabel}>{s.label}</td>
                  <td>{s.vout_nominal.toFixed(1)} V</td>
                  <td>{s.ns}</td>
                  <td>{s.diode_vr_max.toFixed(0)} V</td>
                  <td>{(s.capacitance * 1e6).toFixed(1)} µF</td>
                  <td className={s.crossRegPct > 0 ? styles.moCrossReg : styles.moRegulated}>
                    {s.crossRegPct > 0 ? `±${s.crossRegPct.toFixed(1)} %` : 'Regulated'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.moWarning}>
            ⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.
          </div>
        </div>
      )}
    </div>
  )
}

// ── MOSFET card sub-component ─────────────────────────────────────────────
function MosfetCard({
  data,
  isSelected,
  onSelect,
}: {
  data: MosfetData
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.rank}>#1</span>
        <span className={styles.partNumber}>{data.part_number}</span>
      </div>
      <div className={styles.manufacturer}>{data.manufacturer}</div>
      <div className={styles.specs}>
        <span className={styles.spec}>Vds <strong>{data.vds_v}</strong> V</span>
        <span className={styles.spec}>Rds <strong>{data.rds_on_mohm}</strong> mΩ</span>
        <span className={styles.spec}>Qg <strong>{data.qg_nc}</strong> nC</span>
        <span className={styles.spec}>Id <strong>{data.id_max_a}</strong> A</span>
        <span className={styles.spec}>{data.package}</span>
      </div>
      <button className={styles.selectButton} onClick={onSelect}>
        {isSelected ? 'Deselect' : 'Select'}
      </button>
    </div>
  )
}

// Re-export data types consumed by external code (e.g. Toolbar)
export type { InductorData, CapacitorData, MosfetData }
