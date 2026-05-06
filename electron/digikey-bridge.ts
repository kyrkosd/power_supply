// Digi-Key API bridge — runs in the Electron main process.
// Keeps credentials encrypted via safeStorage, manages OAuth2 tokens,
// enforces a token-bucket rate limiter, and caches results for 1 hour.
//
// Digi-Key API v4 reference: https://developer.digikey.com/products/product-information/v4/

import { ipcMain, safeStorage, app } from 'electron'
import { promises as fsp } from 'fs'
import { join } from 'path'
import type { ComponentRequirements, ComponentResult } from '../src/engine/component-search'

// ── Credential storage ────────────────────────────────────────────────────────

interface DigiKeyCredentials {
  clientId: string
  clientSecret: string
}

function credsPath(): string {
  return join(app.getPath('userData'), 'digikey-creds.enc')
}

async function saveCredentials(creds: DigiKeyCredentials): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('System keychain not available — credentials cannot be saved securely.')
  }
  const json = JSON.stringify(creds)
  const encrypted = safeStorage.encryptString(json)
  await fsp.writeFile(credsPath(), encrypted)
}

async function loadCredentials(): Promise<DigiKeyCredentials | null> {
  try {
    const encrypted = await fsp.readFile(credsPath())
    const json = safeStorage.decryptString(encrypted)
    const parsed = JSON.parse(json)
    if (typeof parsed.clientId === 'string' && typeof parsed.clientSecret === 'string') {
      return parsed as DigiKeyCredentials
    }
    return null
  } catch {
    return null
  }
}

// ── OAuth2 token management ───────────────────────────────────────────────────

interface TokenCache {
  accessToken: string
  expiresAt: number  // ms since epoch
}

let _tokenCache: TokenCache | null = null

async function getAccessToken(creds: DigiKeyCredentials): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiresAt > now + 30_000) {
    return _tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  })

  const res = await fetch('https://api.digikey.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DigiKey OAuth2 failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return _tokenCache.accessToken
}

// ── Token-bucket rate limiter (5 req/min = 1 per 12 s) ───────────────────────

const RATE_BUCKET_MAX = 5
const RATE_REFILL_MS  = 12_000  // one token every 12 seconds

let _rateTokens   = RATE_BUCKET_MAX
let _lastRefillAt = Date.now()

function acquireRateToken(): void {
  const now = Date.now()
  const refilled = Math.floor((now - _lastRefillAt) / RATE_REFILL_MS)
  if (refilled > 0) {
    _rateTokens    = Math.min(RATE_BUCKET_MAX, _rateTokens + refilled)
    _lastRefillAt += refilled * RATE_REFILL_MS
  }
  if (_rateTokens <= 0) {
    throw new Error('Digi-Key rate limit reached — please wait a moment before searching again.')
  }
  _rateTokens--
}

// ── Result cache (1-hour TTL) ─────────────────────────────────────────────────

interface CacheEntry {
  timestamp: number
  results: ComponentResult[]
}

const _resultCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000

function cacheKey(req: ComponentRequirements): string {
  return `${req.type}:${JSON.stringify(req)}`
}

function getCached(req: ComponentRequirements): ComponentResult[] | null {
  const entry = _resultCache.get(cacheKey(req))
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _resultCache.delete(cacheKey(req))
    return null
  }
  return entry.results
}

function setCached(req: ComponentRequirements, results: ComponentResult[]): void {
  _resultCache.set(cacheKey(req), { timestamp: Date.now(), results })
}

// ── Digi-Key search keyword builder ──────────────────────────────────────────

function buildKeyword(req: ComponentRequirements): string {
  if (req.type === 'inductor') return `inductor ${req.inductance_uh}uH`
  if (req.type === 'capacitor') return `capacitor ${req.capacitance_uf}uF ${req.voltage_min_v}V`
  return `N-channel MOSFET ${req.vds_min_v}V`
}

// ── Response parser ───────────────────────────────────────────────────────────

// Digi-Key v4 product parameter IDs (partial list relevant to our components).
// A full list is at developer.digikey.com → Product Search → Parameter Definitions.
const PARAM = {
  INDUCTANCE:       2049,
  DCR:              2073,
  ISAT:             2064,
  IRMS:             2065,
  CAPACITANCE:      1939,
  VOLTAGE_RATED:    1942,
  ESR:              2112,
  RDS_ON:           134,
  VDS:              133,
  ID_CONT:          67,
}

function paramVal(params: Array<{ ParameterId: number; ValueText: string }>, id: number): number | undefined {
  const p = params.find((x) => x.ParameterId === id)
  if (!p) return undefined
  // Strip trailing units and convert: '10 µH' → 10, '0.05 Ω' → 0.05 etc.
  const num = parseFloat(p.ValueText.replace(/[^\d.eE+-]/g, ''))
  return isNaN(num) ? undefined : num
}

interface DigiKeyProduct {
  ManufacturerProductNumber: string
  Manufacturer: { Name: string }
  Description: { ProductDescription: string }
  Parameters: Array<{ ParameterId: number; ValueText: string }>
  UnitPrice: number
  QuantityAvailable: number
  DatasheetUrl?: string
  ProductUrl?: string
}

function parseProduct(p: DigiKeyProduct, req: ComponentRequirements): ComponentResult {
  const params = p.Parameters ?? []
  const base: ComponentResult = {
    part_number:  p.ManufacturerProductNumber,
    manufacturer: p.Manufacturer?.Name ?? '',
    description:  p.Description?.ProductDescription ?? '',
    price_usd:    p.UnitPrice,
    stock_qty:    p.QuantityAvailable,
    datasheet_url: p.DatasheetUrl,
    product_url:   p.ProductUrl,
    source: 'digikey',
  }

  if (req.type === 'inductor') {
    return {
      ...base,
      inductance_uh: paramVal(params, PARAM.INDUCTANCE),
      dcr_mohm:      paramVal(params, PARAM.DCR),
      isat_a:        paramVal(params, PARAM.ISAT),
      irms_a:        paramVal(params, PARAM.IRMS),
    }
  }
  if (req.type === 'capacitor') {
    return {
      ...base,
      capacitance_uf: paramVal(params, PARAM.CAPACITANCE),
      voltage_v:      paramVal(params, PARAM.VOLTAGE_RATED),
      esr_mohm:       paramVal(params, PARAM.ESR),
    }
  }
  // mosfet
  return {
    ...base,
    vds_v:       paramVal(params, PARAM.VDS),
    rds_on_mohm: paramVal(params, PARAM.RDS_ON),
    id_max_a:    paramVal(params, PARAM.ID_CONT),
  }
}

// ── Core search function ──────────────────────────────────────────────────────

async function searchDigiKey(req: ComponentRequirements): Promise<ComponentResult[]> {
  const cached = getCached(req)
  if (cached) return cached

  const creds = await loadCredentials()
  if (!creds) throw new Error('No Digi-Key credentials configured. Open Settings to add them.')

  acquireRateToken()

  const token = await getAccessToken(creds)

  const body = JSON.stringify({
    Keywords: buildKeyword(req),
    Limit: 10,
    FilterOptionsRequest: { InStock: true },
  })

  const res = await fetch('https://api.digikey.com/products/v4/search/keyword', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-DIGIKEY-Client-Id': creds.clientId,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (res.status === 429) throw new Error('Digi-Key rate limit exceeded. Try again in a minute.')
    throw new Error(`Digi-Key search failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { Products?: DigiKeyProduct[] }
  const results = (data.Products ?? []).map((p) => parseProduct(p, req))
  setCached(req, results)
  return results
}

// ── IPC setup ─────────────────────────────────────────────────────────────────

export function setupDigiKeyIPC(): void {
  ipcMain.handle('digikey:set-credentials', async (_event, creds: DigiKeyCredentials) => {
    try {
      await saveCredentials(creds)
      _tokenCache = null  // invalidate cached token when credentials change
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('digikey:get-credentials', async () => {
    const creds = await loadCredentials()
    if (!creds) return { success: false, error: 'No credentials saved' }
    // Return client ID only (never expose the secret back to the renderer)
    return { success: true, clientId: creds.clientId }
  })

  ipcMain.handle('digikey:test-connection', async () => {
    try {
      const creds = await loadCredentials()
      if (!creds) return { success: false, error: 'No credentials configured.' }
      await getAccessToken(creds)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('digikey:search', async (_event, req: ComponentRequirements) => {
    try {
      const results = await searchDigiKey(req)
      return { success: true, results }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
