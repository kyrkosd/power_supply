import type { DesignSpec } from '../engine/types'
import type { TopologyId } from './workbenchStore'

export interface Snapshot {
  topology: TopologyId
  spec: DesignSpec
}

const MAX_HISTORY = 50
const DEBOUNCE_MS = 300

// History arrays live outside Zustand state so snapshots don't appear in devtools
// and don't interfere with Zustand's own change-detection.  Single-store app only.
const undoHistory: Snapshot[] = []
const redoHistory: Snapshot[] = []

// Debounce state
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingSnapshot: Snapshot | null = null  // state captured at the START of each drag window

type SetFn<T> = (partial: T | Partial<T> | ((s: T) => T | Partial<T>), replace?: boolean) => void
type GetFn<T> = () => T

// Fields the middleware expects the store state to contain
interface UndoableStore {
  topology: TopologyId
  spec: DesignSpec
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  // Compute-reset fields (set by undo/redo to trigger worker recomputation)
  result: unknown
  waveforms: unknown
  mcResult: unknown
  transientResult: unknown
  emiResult: unknown
  isComputing: boolean
  isModified: boolean
}

// Flush any in-flight debounce window and commit the snapshot immediately.
// Call this before undo() so that Ctrl+Z while dragging commits + reverts the drag.
function flush(get: GetFn<UndoableStore>, originalSet: SetFn<UndoableStore>): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (pendingSnapshot) {
    undoHistory.push(pendingSnapshot)
    if (undoHistory.length > MAX_HISTORY) undoHistory.shift()
    pendingSnapshot = null
    originalSet({ canUndo: true } as Partial<UndoableStore>)
  }
}

/**
 * Zustand middleware that records { topology, spec } snapshots on every
 * spec/topology change, with a 300 ms debounce so rapid slider drags
 * produce a single undo step.
 *
 * The creator must initialise canUndo/canRedo/undo/redo with stubs;
 * the middleware replaces them with real implementations before returning.
 */
export function undoMiddleware<T extends UndoableStore>(
  creator: (set: SetFn<T>, get: GetFn<T>, api: unknown) => T
): (set: SetFn<T>, get: GetFn<T>, api: unknown) => T {
  return (originalSet, get, api) => {
    // wrappedSet is what the creator's actions call via their captured `set`
    const wrappedSet: SetFn<T> = (partial, replace?) => {
      const state = get()
      const updates = typeof partial === 'function' ? partial(state) : partial

      // Intercept user-driven spec/topology changes only.
      // Undo/redo call originalSet directly so they never hit this branch.
      if ('spec' in updates || 'topology' in updates) {
        // Capture the pre-change state at the START of the debounce window
        if (!debounceTimer) {
          pendingSnapshot = { topology: state.topology, spec: state.spec }
        }

        // Any new spec change clears redo — merge canRedo:false into this update
        // so we only call originalSet once (no extra re-render)
        let finalPartial: typeof partial = partial
        if (redoHistory.length > 0) {
          redoHistory.length = 0
          finalPartial = typeof partial === 'function'
            ? (s: T) => ({ ...(partial as (s: T) => Partial<T>)(s), canRedo: false } as Partial<T>)
            : ({ ...updates, canRedo: false } as Partial<T>)
        }

        // Reset / start the debounce timer
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          if (pendingSnapshot) {
            undoHistory.push(pendingSnapshot)
            if (undoHistory.length > MAX_HISTORY) undoHistory.shift()
            pendingSnapshot = null
            originalSet({ canUndo: true } as Partial<T>)
          }
        }, DEBOUNCE_MS)

        originalSet(finalPartial, replace)
        return
      }

      originalSet(partial, replace)
    }

    // Build the store using the wrapped setter
    const store = creator(wrappedSet, get, api)

    // Replace stub undo/redo with real implementations that use originalSet
    // directly, bypassing wrappedSet so they never re-record history.
    store.undo = () => {
      flush(get as GetFn<UndoableStore>, originalSet as SetFn<UndoableStore>)
      if (undoHistory.length === 0) return
      const snapshot = undoHistory.pop()!
      const state = get()
      redoHistory.push({ topology: state.topology, spec: state.spec })
      if (redoHistory.length > MAX_HISTORY) redoHistory.shift()
      originalSet({
        topology: snapshot.topology,
        spec: snapshot.spec,
        canUndo: undoHistory.length > 0,
        canRedo: true,
        result: null, waveforms: null, mcResult: null,
        transientResult: null, emiResult: null,
        isComputing: true, isModified: true,
      } as Partial<T>)
    }

    store.redo = () => {
      if (redoHistory.length === 0) return
      const snapshot = redoHistory.pop()!
      const state = get()
      undoHistory.push({ topology: state.topology, spec: state.spec })
      if (undoHistory.length > MAX_HISTORY) undoHistory.shift()
      originalSet({
        topology: snapshot.topology,
        spec: snapshot.spec,
        canUndo: true,
        canRedo: redoHistory.length > 0,
        result: null, waveforms: null, mcResult: null,
        transientResult: null, emiResult: null,
        isComputing: true, isModified: true,
      } as Partial<T>)
    }

    return store
  }
}
