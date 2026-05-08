import React, { useEffect, useRef, useState } from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './Settings.module.css'

type TestStatus = 'idle' | 'pending' | 'ok' | 'error'

export function Settings(): React.ReactElement | null {
  const isOpen             = useDesignStore((s) => s.isSettingsOpen)
  const setIsOpen          = useDesignStore((s) => s.setIsSettingsOpen)
  const digiKeyEnabled     = useDesignStore((s) => s.digiKeyEnabled)
  const setEnabled         = useDesignStore((s) => s.setDigiKeyEnabled)
  const plugins            = useDesignStore((s) => s.plugins)
  const togglePlugin       = useDesignStore((s) => s.togglePlugin)
  const requestPluginReload = useDesignStore((s) => s.requestPluginReload)

  const [clientId, setClientId]         = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving]             = useState(false)
  const [testStatus, setTestStatus]     = useState<TestStatus>('idle')
  const [testMsg, setTestMsg]           = useState('')

  const firstInputRef = useRef<HTMLInputElement>(null)

  // Load saved client ID (secret is never returned) on open
  useEffect(() => {
    if (!isOpen) return
    window.digikeyAPI?.getCredentials().then((r) => {
      if (r.success && r.clientId) setClientId(r.clientId)
    })
    setClientSecret('')
    setTestStatus('idle')
    setTestMsg('')
    setTimeout(() => firstInputRef.current?.focus(), 50)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  async function handleSave() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setSaving(true)
    try {
      const r = await window.digikeyAPI!.setCredentials(clientId.trim(), clientSecret.trim())
      if (!r.success) setTestMsg(r.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTestStatus('pending')
    setTestMsg('Testing…')
    try {
      const r = await window.digikeyAPI!.testConnection()
      if (r.success) {
        setTestStatus('ok')
        setTestMsg('Connected')
      } else {
        setTestStatus('error')
        setTestMsg(r.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestStatus('error')
      setTestMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const hasApi = Boolean(window.digikeyAPI)

  return (
    <div className={styles.overlay} onClick={() => setIsOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionTitle}>Digi-Key API</p>

          {!hasApi && (
            <span className={styles.statusErr} style={{ fontSize: '0.8rem' }}>
              Running outside Electron — Digi-Key integration unavailable.
            </span>
          )}

          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Enable Digi-Key search</span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={digiKeyEnabled}
                disabled={!hasApi}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className={styles.slider} />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Client ID</label>
            <input
              ref={firstInputRef}
              className={styles.input}
              type="text"
              value={clientId}
              placeholder="e.g. abc123def456"
              disabled={!hasApi}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Client Secret</label>
            <input
              className={styles.input}
              type="password"
              value={clientSecret}
              placeholder="••••••••••••"
              disabled={!hasApi}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.saveBtn}
              disabled={!hasApi || saving || !clientId.trim() || !clientSecret.trim()}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              className={styles.testBtn}
              disabled={!hasApi || testStatus === 'pending'}
              onClick={handleTest}
            >
              Test Connection
            </button>

            {testMsg && (
              <span className={
                testStatus === 'ok'      ? `${styles.status} ${styles.statusOk}` :
                testStatus === 'error'   ? `${styles.status} ${styles.statusErr}` :
                `${styles.status} ${styles.statusPending}`
              }>
                {testMsg}
              </span>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #888)', margin: 0 }}>
          Credentials are encrypted at rest using the OS keychain via Electron safeStorage.
          Get your keys at <strong>developer.digikey.com</strong>.
        </p>

        <div className={styles.divider} />

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
              {plugins.map(p => (
                <div key={p.id} className={styles.pluginCard}>
                  <div className={styles.pluginInfo}>
                    <span className={styles.pluginName}>{p.name}</span>
                    <span className={styles.pluginMeta}>v{p.version} · {p.author}</span>
                    {p.error && <span className={styles.pluginError}>{p.error}</span>}
                  </div>
                  <label className={styles.toggle} title={p.error ? 'Plugin failed to load' : undefined}>
                    <input
                      type="checkbox"
                      checked={p.enabled && !p.error}
                      disabled={Boolean(p.error)}
                      onChange={() => togglePlugin(p.id)}
                    />
                    <span className={styles.slider} />
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.testBtn}
              disabled={!window.pluginAPI}
              onClick={() => window.pluginAPI?.openPluginsFolder()}
            >
              Open Folder
            </button>
            <button
              className={styles.testBtn}
              disabled={!window.pluginAPI}
              onClick={requestPluginReload}
            >
              Reload Plugins
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
