// Collapsible Digi-Key live-search panel for a single component requirement.
import React, { useState } from 'react'
import type { ComponentRequirements, ComponentResult } from '../../engine/component-search'
import styles from './ComponentSuggestions.module.css'

interface DigiKeySearchPanelProps {
  /** The electrical requirements used to build the Digi-Key keyword query. */
  requirements: ComponentRequirements
}

/** Single result card rendered for each Digi-Key search hit. */
function DkResultCard({ r }: { r: ComponentResult }): React.ReactElement {
  return (
    <div className={styles.dkCard}>
      <div className={styles.dkCardHeader}>
        <span className={styles.dkPart}>{r.part_number}</span>
        {r.price_usd != null && <span className={styles.dkPrice}>${r.price_usd.toFixed(2)}</span>}
      </div>
      <div className={styles.dkMfr}>{r.manufacturer}</div>
      <div className={styles.dkDesc}>{r.description}</div>
      <div className={styles.dkMeta}>
        {r.stock_qty != null && <span className={styles.dkStock}>{r.stock_qty.toLocaleString()} in stock</span>}
      </div>
      {r.product_url && (
        <a className={styles.dkLink} href={r.product_url} target="_blank" rel="noopener noreferrer">
          View on Digi-Key ↗
        </a>
      )}
    </div>
  )
}

/** Invoke the Digi-Key bridge and update state; shows 'offline' badge when the bridge is absent. */
async function runSearch(
  requirements: ComponentRequirements,
  setLoading: (v: boolean) => void,
  setResults: (v: ComponentResult[] | null) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  if (!window.digikeyAPI) { setError('Digi-Key bridge not available in this environment.'); return }
  setLoading(true); setError(null); setResults(null)
  try {
    const r = await window.digikeyAPI.search(requirements)
    if (r.success) setResults(r.results ?? [])
    else           setError(r.error ?? 'Search failed')
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    setLoading(false)
  }
}

/** Collapsible panel that queries Digi-Key for components matching the given requirements. */
export function DigiKeySearchPanel({ requirements }: DigiKeySearchPanelProps): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ComponentResult[] | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const hasApi = Boolean(window.digikeyAPI)

  return (
    <details className={styles.dkPanel}>
      <summary className={styles.dkSummary}>
        <span>🔍 Search Digi-Key</span>
        {!hasApi && <span className={styles.dkOffline}>offline</span>}
      </summary>
      <div className={styles.dkBody}>
        <button
          className={styles.dkSearchBtn}
          disabled={loading || !hasApi}
          onClick={() => runSearch(requirements, setLoading, setResults, setError)}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
        {error && <div className={styles.dkError}>{error}</div>}
        {results !== null && results.length === 0 && <div className={styles.dkEmpty}>No results found.</div>}
        {results?.map((r) => <DkResultCard key={r.part_number} r={r} />)}
      </div>
    </details>
  )
}
