/**
 * Unit tests for undoMiddleware (src/store/undo-middleware.ts).
 *
 * A minimal Zustand store is created here so we never touch Electron/DOM APIs.
 * The module-level history arrays in undo-middleware.ts are fresh for each
 * Vitest test file because Vitest isolates module caches between files.
 *
 * Fake timers are used to skip the 300 ms debounce window.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { create } from 'zustand'
import { undoMiddleware, clearUndoHistory } from '../../src/store/undo-middleware'
import type { DesignSpec } from '../../src/engine/types'

// ── Minimal store that satisfies the UndoableStore interface ─────────────────

const DEFAULT_SPEC: DesignSpec = {
  vinMin: 10, vinMax: 15, vout: 5, iout: 2,
  fsw: 200_000, rippleRatio: 0.3, ambientTemp: 25, voutRippleMax: 0.01, efficiency: 0.9,
}

interface TestState {
  topology: string
  spec: DesignSpec
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  result: null
  waveforms: null
  mcResult: null
  transientResult: null
  emiResult: null
  isComputing: boolean
  isModified: boolean
  setSpec: (updates: Partial<DesignSpec>) => void
  setTopology: (t: string) => void
}

// Create a FRESH store for each test to avoid shared-history leakage.
function makeStore() {
  return create<TestState>(
    undoMiddleware<TestState>((set) => ({
      topology: 'buck',
      spec: { ...DEFAULT_SPEC },
      canUndo: false,
      canRedo: false,
      undo: () => {},
      redo: () => {},
      result: null,
      waveforms: null,
      mcResult: null,
      transientResult: null,
      emiResult: null,
      isComputing: false,
      isModified: false,
      setSpec: (updates) => set((s) => ({ spec: { ...s.spec, ...updates } })),
      setTopology: (t) => set({ topology: t }),
    }))
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('undoMiddleware — 3 sequential changes, undo order, redo', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    clearUndoHistory()
    store = makeStore()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('canUndo starts as false and becomes true after one committed change', () => {
    expect(store.getState().canUndo).toBe(false)

    store.getState().setSpec({ vout: 10 })
    vi.advanceTimersByTime(400)  // flush debounce

    expect(store.getState().canUndo).toBe(true)
    expect(store.getState().canRedo).toBe(false)
  })

  it('restores 3 sequential spec changes in reverse order', () => {
    // Change 1: vout 5 → 10
    store.getState().setSpec({ vout: 10 })
    vi.advanceTimersByTime(400)

    // Change 2: vout 10 → 15
    store.getState().setSpec({ vout: 15 })
    vi.advanceTimersByTime(400)

    // Change 3: vout 15 → 20
    store.getState().setSpec({ vout: 20 })
    vi.advanceTimersByTime(400)

    expect(store.getState().spec.vout).toBe(20)

    // Undo 3 → should see 15
    store.getState().undo()
    expect(store.getState().spec.vout).toBe(15)

    // Undo 2 → should see 10
    store.getState().undo()
    expect(store.getState().spec.vout).toBe(10)

    // Undo 1 → should see original 5
    store.getState().undo()
    expect(store.getState().spec.vout).toBe(5)

    // No more history
    expect(store.getState().canUndo).toBe(false)
  })

  it('redo restores state forward after undo', () => {
    store.getState().setSpec({ vout: 10 })
    vi.advanceTimersByTime(400)
    store.getState().setSpec({ vout: 15 })
    vi.advanceTimersByTime(400)

    // Undo once: back to 10
    store.getState().undo()
    expect(store.getState().spec.vout).toBe(10)
    expect(store.getState().canRedo).toBe(true)

    // Redo: forward to 15
    store.getState().redo()
    expect(store.getState().spec.vout).toBe(15)
    expect(store.getState().canRedo).toBe(false)
  })

  it('a new change after undo clears redo history', () => {
    store.getState().setSpec({ vout: 10 })
    vi.advanceTimersByTime(400)
    store.getState().setSpec({ vout: 15 })
    vi.advanceTimersByTime(400)

    store.getState().undo()          // back to 10
    expect(store.getState().canRedo).toBe(true)

    // New change clears redo
    store.getState().setSpec({ vout: 99 })
    vi.advanceTimersByTime(400)
    expect(store.getState().canRedo).toBe(false)
  })

  it('calling undo() while a debounce window is in flight commits the pending snapshot first', () => {
    store.getState().setSpec({ vout: 10 })
    // Do NOT advance timer — debounce still pending

    store.getState().undo()  // flush() should commit the pending snapshot, then undo
    // After undo we should be back to original vout = 5
    expect(store.getState().spec.vout).toBe(5)
  })

  it('topology changes are also undoable', () => {
    store.getState().setTopology('boost')
    vi.advanceTimersByTime(400)

    expect(store.getState().topology).toBe('boost')

    store.getState().undo()
    expect(store.getState().topology).toBe('buck')
  })
})
