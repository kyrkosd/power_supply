import React, { useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../../store/design-store'
import { encodeDesign } from '../../export/share-link'
import styles from './ShareModal.module.css'

// ── Share modal — copy a pswb:// link to clipboard ────────────────────────────

export function ShareModal(): React.ReactElement | null {
  const isOpen             = useDesignStore((s) => s.isShareOpen)
  const setIsOpen          = useDesignStore((s) => s.setIsShareOpen)
  const topology           = useDesignStore((s) => s.topology)
  const pluginTopologyId   = useDesignStore((s) => s.pluginTopologyId)
  const spec               = useDesignStore((s) => s.spec)
  const selectedComponents = useDesignStore((s) => s.selectedComponents)

  const [link, setLink]       = useState('')
  const [copied, setCopied]   = useState(false)
  const textareaRef           = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const overrides: Record<string, unknown> = {}
    if (selectedComponents.inductor)  overrides.inductor  = selectedComponents.inductor
    if (selectedComponents.capacitor) overrides.capacitor = selectedComponents.capacitor
    if (selectedComponents.mosfet)    overrides.mosfet    = selectedComponents.mosfet

    const encoded = encodeDesign(pluginTopologyId ?? topology, spec, overrides)
    setLink(encoded)
    setCopied(false)

    // Try to copy immediately on open; if that fails the user can still hit Copy
    navigator.clipboard.writeText(encoded).then(() => setCopied(true)).catch(() => {})
  }, [isOpen, topology, pluginTopologyId, spec, selectedComponents])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: select the text so the user can Ctrl+C
      textareaRef.current?.select()
    }
  }

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Share Design</h2>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <p className={styles.description}>
          Anyone with this link can open your exact design — topology, all parameters, and
          selected components — in their own copy of the app.
        </p>

        <textarea
          ref={textareaRef}
          className={styles.linkBox}
          readOnly
          value={link}
          rows={3}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          spellCheck={false}
        />

        <div className={styles.actions}>
          <button className={styles.copyBtn} onClick={handleCopy}>
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
          <span className={styles.hint}>
            {copied
              ? 'Paste anywhere — chat, email, issue tracker.'
              : 'Or click the text above to select it.'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Paste / deep-link confirmation — offer to load a detected design ──────────

export function PasteConfirmModal(): React.ReactElement | null {
  const pending    = useDesignStore((s) => s.pendingShareDesign)
  const setpending = useDesignStore((s) => s.setPendingShareDesign)
  const loadDesign = useDesignStore((s) => s.loadDesignSpec)

  useEffect(() => {
    if (!pending) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setpending(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, setpending])

  if (!pending) return null

  const { topology, spec } = pending

  function handleLoad() {
    if (!pending) return
    // TopologyId guard: loadDesignSpec only accepts built-in IDs, but the
    // store's setPluginTopology path handles community ones.  For simplicity
    // we cast — the worker will reject unknown IDs gracefully.
    loadDesign(topology as import('../../store/workbenchStore').TopologyId, spec)
    setpending(null)
  }

  const vinStr = spec.vinMin === spec.vinMax
    ? `${spec.vinMin} V`
    : `${spec.vinMin}–${spec.vinMax} V`
  const fswStr = spec.fsw >= 1e6
    ? `${(spec.fsw / 1e6).toFixed(1)} MHz`
    : `${(spec.fsw / 1e3).toFixed(0)} kHz`

  return (
    <div className={styles.overlay} onClick={() => setpending(null)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Load Shared Design?</h2>
          <button className={styles.closeBtn} onClick={() => setpending(null)}>✕</button>
        </div>

        <p className={styles.description}>
          A shared design link was detected. Load it? This will replace your current design.
        </p>

        <table className={styles.specTable}>
          <tbody>
            <tr><td className={styles.specKey}>Topology</td><td className={styles.specVal}>{topology}</td></tr>
            <tr><td className={styles.specKey}>Vin</td>      <td className={styles.specVal}>{vinStr}</td></tr>
            <tr><td className={styles.specKey}>Vout</td>     <td className={styles.specVal}>{spec.vout} V</td></tr>
            <tr><td className={styles.specKey}>Iout</td>     <td className={styles.specVal}>{spec.iout} A</td></tr>
            <tr><td className={styles.specKey}>fsw</td>      <td className={styles.specVal}>{fswStr}</td></tr>
          </tbody>
        </table>

        <div className={styles.actions}>
          <button className={styles.copyBtn} onClick={handleLoad}>Load Design</button>
          <button className={styles.cancelBtn} onClick={() => setpending(null)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
