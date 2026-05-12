import type { DesignSpec } from '../engine/types'
import type { TopologyId } from './workbenchStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Snapshot {
  topology: TopologyId
  spec: DesignSpec
}

const MAX_HISTORY = 50
const DEBOUNCE_MS = 300

// History arrays live outside Zustand state so snapshots don't appear in devtools
// and don't interfere with Zustand's own change-detection. Single-store app only.
const undoHistory: Snapshot[] = []
const redoHistory: Snapshot[] = []

let debounceTimer: ReturnType<typeof setTimeout> | null = null
/** State captured at the START of each drag window. */
let pendingSnapshot: Snapshot | null = null

type SetFn<T> = (partial: T | Partial<T> | ((s: T) => T | Partial<T>), replace?: boolean) => void
type GetFn<T> = () => T

/** Fields the middleware expects the store state to contain. */
interface UndoableStore {
  topology: TopologyId
  spec: DesignSpec
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  result: unknown
  waveforms: unknown
  mcResult: unknown
  transientResult: unknown
  emiResult: unknown
  isComputing: boolean
  isModified: boolean
}

// ── History helpers ───────────────────────────────────────────────────────────

/** Push `snap` onto `history`, honoring the MAX_HISTORY cap. */
function pushCapped(history: Snapshot[], snap: Snapshot): void {
  history.push(snap)
  if (history.length > MAX_HISTORY) history.shift()
}

/** Commit `pendingSnapshot` to `undoHistory` and set `canUndo: true`. */
function commitPending(set: SetFn<UndoableStore>): void {
  if (!pendingSnapshot) return
  pushCapped(undoHistory, pendingSnapshot)
  pendingSnapshot = null
  set({ canUndo: true } as Partial<UndoableStore>)
}

/**
 * Flush the in-flight debounce window and commit the pending snapshot immediately.
 * Called before undo so that Ctrl+Z during a drag commits and then reverts.
 */
function flush(set: SetFn<UndoableStore>): void {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  commitPending(set)
}

/**
 * Return `partial` augmented with `{ canRedo: false }` when redoHistory is non-empty,
 * merging into a single `originalSet` call to avoid an extra re-render.
 */
function withRedoClear<T>(
  partial: T | Partial<T> | ((s: T) => T | Partial<T>),
  updates: Partial<T>,
): typeof partial {
  if (redoHistory.length === 0) return partial
  redoHistory.length = 0
  return typeof partial === 'function'
    ? (s: T) => ({ ...(partial as (s: T) => Partial<T>)(s), canRedo: false } as Partial<T>)
    : ({ ...updates, canRedo: false } as Partial<T>)
}

/** Shared payload shape written by both undo and redo after applying a snapshot. */
function restorePayload(
  snap: Snapshot,
  canUndo: boolean,
  canRedo: boolean,
): Partial<UndoableStore> {
  return {
    topology: snap.topology,
    spec: snap.spec,
    canUndo,
    canRedo,
    result: null, waveforms: null, mcResult: null,
    transientResult: null, emiResult: null,
    isComputing: true, isModified: true,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Reset all history — intended for test teardown only. */
export function clearUndoHistory(): void {
  undoHistory.length = 0
  redoHistory.length = 0
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  pendingSnapshot = null
}

/**
 * Zustand middleware that records `{ topology, spec }` snapshots on every
 * spec/topology change, with a 300 ms debounce so rapid slider drags
 * produce a single undo step.
 *
 * The creator must initialise `canUndo`, `canRedo`, `undo`, and `redo` with stubs;
 * the middleware replaces them with real implementations before returning.
 */
export function undoMiddleware<T extends UndoableStore>(
  creator: (set: SetFn<T>, get: GetFn<T>, api: unknown) => T
): (set: SetFn<T>, get: GetFn<T>, api: unknown) => T {
  return (originalSet, get, api) => {
    const setU = originalSet as unknown as SetFn<UndoableStore>

    const wrappedSet: SetFn<T> = (partial, replace?) => {
      const state = get()
      const updates = typeof partial === 'function' ? partial(state) : partial

      // Only intercept spec/topology changes; pass everything else straight through.
      if (!('spec' in updates || 'topology' in updates)) {
        originalSet(partial, replace)
        return
      }

      // Capture pre-change state at the start of each debounce window.
      if (!debounceTimer) pendingSnapshot = { topology: state.topology, spec: state.spec }

      // Reset/start the debounce timer.
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        commitPending(setU)
      }, DEBOUNCE_MS)

      originalSet(withRedoClear(partial, updates as Partial<T>), replace)
    }

    const store = creator(wrappedSet, get, api)

    // Replace stub undo/redo with real implementations that call originalSet directly,
    // bypassing wrappedSet so they never re-record history.
    store.undo = () => {
      flush(setU)
      if (undoHistory.length === 0) return
      const snap = undoHistory.pop()!
      const state = get()
      pushCapped(redoHistory, { topology: state.topology, spec: state.spec })
      originalSet(restorePayload(snap, undoHistory.length > 0, true) as Partial<T>)
    }

    store.redo = () => {
      if (redoHistory.length === 0) return
      const snap = redoHistory.pop()!
      const state = get()
      pushCapped(undoHistory, { topology: state.topology, spec: state.spec })
      originalSet(restorePayload(snap, true, redoHistory.length > 0) as Partial<T>)
    }

    return store
  }
}
