// Community plugins section for the Settings modal.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './Settings.module.css'

// ── Plugins section ───────────────────────────────────────────────────────────

/**
 * Community plugins section: per-plugin enable/disable toggles, open plugins
 * folder in the OS file manager, and reload all plugins from disk.
 */
export function PluginsSection(): React.ReactElement {
  const plugins             = useDesignStore((s) => s.plugins)
  const togglePlugin        = useDesignStore((s) => s.togglePlugin)
  const requestPluginReload = useDesignStore((s) => s.requestPluginReload)

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>Community Plugins</p>
      {!window.pluginAPI && (
        <span className={styles.statusErr} style={{ fontSize: '0.8rem' }}>
          Running outside Electron — plugin system unavailable.
        </span>
      )}
      {plugins.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #888)', margin: 0 }}>
          No plugins loaded. Drop <code>.js</code> plugin files into the plugins folder, then click Reload.
        </p>
      ) : (
        <div className={styles.pluginList}>
          {plugins.map((p) => (
            <div key={p.id} className={styles.pluginCard}>
              <div className={styles.pluginInfo}>
                <span className={styles.pluginName}>{p.name}</span>
                <span className={styles.pluginMeta}>v{p.version} · {p.author}</span>
                {p.error && <span className={styles.pluginError}>{p.error}</span>}
              </div>
              <label className={styles.toggle} title={p.error ? 'Plugin failed to load' : undefined}>
                <input type="checkbox" checked={p.enabled && !p.error} disabled={Boolean(p.error)}
                  onChange={() => togglePlugin(p.id)} />
                <span className={styles.slider} />
              </label>
            </div>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <button className={styles.testBtn} disabled={!window.pluginAPI}
          onClick={() => window.pluginAPI?.openPluginsFolder()}>Open Folder</button>
        <button className={styles.testBtn} disabled={!window.pluginAPI}
          onClick={requestPluginReload}>Reload Plugins</button>
      </div>
    </div>
  )
}
