// Shared sub-components, data constants, and hooks for HelpPanel tabs.
import React, { useEffect } from 'react'
import styles from './HelpPanel.module.css'

// ── TipBanner ─────────────────────────────────────────────────────────────────

const BANNER_STYLE: React.CSSProperties = {
  background: 'rgba(50,201,230,0.07)', border: '1px solid rgba(50,201,230,0.2)',
  borderRadius: 6, padding: '9px 12px', marginBottom: 14, fontSize: 12, lineHeight: 1.5,
}

/** Blue highlighted tip box for help tab introductions. */
export function TipBanner({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div style={BANNER_STYLE}>{children}</div>
}

// ── Abbreviations ─────────────────────────────────────────────────────────────

/** One row in the Quick Start abbreviations reference table. */
export interface AbbrevRow { abbr: string; definition: string }

/** Standard abbreviations shown in the Quick Start abbreviations table. */
export const ABBREVS: AbbrevRow[] = [
  { abbr: 'D',        definition: 'Duty cycle (0–1): ratio of switch-on time to switching period' },
  { abbr: 'L',        definition: 'Inductance in µH (microhenries) or mH (millihenries)' },
  { abbr: 'C',        definition: 'Capacitance in µF (microfarads) or nF (nanofarads)' },
  { abbr: 'fsw',      definition: 'Switching frequency in kHz or MHz' },
  { abbr: 'η (eta)',  definition: 'Efficiency: output power / input power × 100 % (goal: >85 %)' },
  { abbr: 'PM',       definition: 'Phase margin: stability indicator (>45° = stable, <30° = risky)' },
]

/** Renders the abbreviations reference table from the ABBREVS constant. */
export function AbbreviationsTable(): React.ReactElement {
  return (
    <table className={styles.table}>
      <tbody>
        {ABBREVS.map((r) => (
          <tr key={r.abbr}><td><strong>{r.abbr}</strong></td><td>{r.definition}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Topology cards ────────────────────────────────────────────────────────────

/** Data record for a single topology reference card. */
export interface TopoData {
  name: string
  applications: string
  pros: string
  cons: string
  duty?: string
  pitfalls: string
}

/** All six supported topologies with their key attributes and common pitfalls. */
export const TOPO_DATA: TopoData[] = [
  {
    name: 'Buck (Step-Down)',
    applications: 'USB PD chargers, computer PSUs, battery chargers.',
    pros: 'Simple, low EMI, good efficiency (>90 %).',
    cons: 'Output must be lower than input.',
    duty: 'D = Vout / Vin (typical 0.3–0.7).',
    pitfalls: 'Forgetting input bulk cap; not sizing Cout for transient response.',
  },
  {
    name: 'Boost (Step-Up)',
    applications: 'USB-C PD sources, battery-powered tools, solar micro-inverters.',
    pros: 'Boosts voltage efficiently.',
    cons: 'Output must exceed input; higher EMI; diode carries peak current.',
    duty: 'D ≈ 1 − (Vin / Vout).',
    pitfalls: 'Underestimating peak IL = Iout / (1 − D); not derating for DCM.',
  },
  {
    name: 'Buck-Boost (Inverting)',
    applications: 'Negative rail generation, arbitrary voltage scaling.',
    pros: 'Output can be above or below input; flexible.',
    cons: 'Inverting output; lower efficiency; more components.',
    duty: 'D = Vout / (Vin + Vout).',
    pitfalls: 'Polarity confusion; undersizing both capacitors.',
  },
  {
    name: 'SEPIC',
    applications: 'Non-inverting buck-boost; battery management.',
    pros: 'Non-inverting; flexible output range.',
    cons: 'More complex; higher part count.',
    pitfalls: 'Forgetting coupling capacitor Cc; not derating Cc for high ripple current.',
  },
  {
    name: 'Flyback (Isolated)',
    applications: 'Isolated supplies for safety (medical, telecom); <100 W; multiple outputs.',
    pros: 'Galvanic isolation; simple (one switch); energy stored in transformer.',
    cons: 'Leakage inductance causes voltage spikes; needs clamp/snubber.',
    pitfalls: 'Missing clamp snubber; wrong turns ratio; not accounting for core reset.',
  },
  {
    name: 'Forward',
    applications: 'Isolated, high power >100 W; telecom; server power.',
    pros: 'Galvanic isolation; continuous output current; high power capability.',
    cons: 'More switches and diodes; complex reset winding.',
    pitfalls: 'Miscalculating reset voltage; under-sized output filter.',
  },
]

/** Renders a single topology reference card with pros, cons, duty cycle, and pitfalls. */
export function TopoCard({ t }: { t: TopoData }): React.ReactElement {
  return (
    <div className={styles.topoCard}>
      <h5>{t.name}</h5>
      <p><strong>Applications:</strong> {t.applications}</p>
      <p><strong>Pros:</strong> {t.pros}</p>
      <p><strong>Cons:</strong> {t.cons}</p>
      {t.duty && <p><strong>{t.duty}</strong></p>}
      <p><strong>Pitfalls:</strong> {t.pitfalls}</p>
    </div>
  )
}

// ── Panel hooks ───────────────────────────────────────────────────────────────

/** Registers "?" to open and Escape to close the panel; skips text-input elements. */
export function usePanelKeyboard(isOpen: boolean, onOpen: () => void, onClose: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && isOpen) { onClose(); return }
      if (e.key === '?' && !isOpen)     { e.preventDefault(); onOpen() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onOpen, onClose])
}

/** Closes the panel on any click outside both the panel element and the toggle button. */
export function useOutsideClick(isOpen: boolean, panelId: string, btnId: string, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      const panel = document.getElementById(panelId)
      const btn   = document.getElementById(btnId)
      if (panel && !panel.contains(e.target as Node) &&
          btn   && !btn.contains(e.target as Node)) onClose()
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [isOpen, panelId, btnId, onClose])
}
