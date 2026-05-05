/**
 * Project file serialisation round-trip tests.
 *
 * These tests verify that a ProjectFile can be JSON-serialised and deserialised
 * without any data loss — the same guarantee that project:save / project:open
 * rely on in the Electron main process.
 *
 * No Electron or DOM imports needed: the ProjectFile interface is a plain data
 * type, and JSON.stringify / JSON.parse are the only serialisers used in the
 * actual IPC handlers. TOPOLOGY_DEFAULTS is imported from the live store so
 * any change to a default spec is automatically covered by these tests.
 */
import { describe, it, expect } from 'vitest'
import type { ProjectFile } from '../../src/types/project'
import type { DesignSpec } from '../../src/engine/types'
import { TOPOLOGY_DEFAULTS } from '../../src/store/design-store'
import type { TopologyId } from '../../src/store/design-store'

// ── Helper ────────────────────────────────────────────────────────────────────

function roundTrip(project: ProjectFile): ProjectFile {
  return JSON.parse(JSON.stringify(project, null, 2)) as ProjectFile
}

function makeProject(topology: TopologyId, spec: DesignSpec, notes = ''): ProjectFile {
  const now = new Date().toISOString()
  return {
    version: 1,
    created: now,
    modified: now,
    topology,
    spec,
    componentOverrides: {},
    notes,
  }
}

const SPECS = TOPOLOGY_DEFAULTS

const SPEC_KEYS: Array<keyof DesignSpec> = [
  'vinMin', 'vinMax', 'vout', 'iout', 'fsw',
  'rippleRatio', 'ambientTemp', 'voutRippleMax', 'efficiency',
]

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectFile JSON round-trip', () => {
  it('preserves all DesignSpec fields for every topology', () => {
    for (const [topology, spec] of Object.entries(SPECS) as [TopologyId, DesignSpec][]) {
      const loaded = roundTrip(makeProject(topology, spec))

      expect(loaded.topology, `${topology}: topology`).toBe(topology)
      expect(loaded.version,  `${topology}: version`).toBe(1)

      for (const key of SPEC_KEYS) {
        expect(loaded.spec[key], `${topology}: spec.${key}`).toBe(spec[key])
      }
    }
  })

  it('preserves floating-point spec values exactly', () => {
    const spec: DesignSpec = {
      ...SPECS.buck,
      rippleRatio: 0.123456789,
      efficiency:  0.876543210,
      voutRippleMax: 0.0075,
    }
    const loaded = roundTrip(makeProject('buck', spec))
    expect(loaded.spec.rippleRatio).toBe(0.123456789)
    expect(loaded.spec.efficiency).toBe(0.876543210)
    expect(loaded.spec.voutRippleMax).toBe(0.0075)
  })

  it('preserves notes field including newlines and special characters', () => {
    const notes = 'Line 1\nLine 2\nSpecial: <>&"\'€µΩ'
    const loaded = roundTrip(makeProject('buck', SPECS.buck, notes))
    expect(loaded.notes).toBe(notes)
  })

  it('preserves ISO 8601 timestamps without modification', () => {
    const ts = '2025-06-15T14:30:00.000Z'
    const project: ProjectFile = {
      version: 1,
      created: ts,
      modified: ts,
      topology: 'boost',
      spec: SPECS.boost,
      componentOverrides: {},
      notes: '',
    }
    const loaded = roundTrip(project)
    expect(loaded.created).toBe(ts)
    expect(loaded.modified).toBe(ts)
  })

  it('preserves componentOverrides as an empty object when nothing is overridden', () => {
    const loaded = roundTrip(makeProject('buck', SPECS.buck))
    expect(loaded.componentOverrides).toEqual({})
  })

  it('JSON output is valid — no NaN or Infinity values sneak into the payload', () => {
    for (const [topology, spec] of Object.entries(SPECS) as [TopologyId, DesignSpec][]) {
      const json = JSON.stringify(makeProject(topology, spec))
      // JSON.parse throws for NaN / Infinity if they were somehow serialised
      // as bare values (they can't be), but we can also check the string itself.
      expect(json).not.toContain('NaN')
      expect(json).not.toContain('Infinity')
    }
  })
})
