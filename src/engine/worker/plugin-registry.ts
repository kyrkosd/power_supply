// Plugin registry: loaded TopologyPlugins evaluated in a Function() sandbox.
// Exposes resolveTopology + computeAny + generateWaveformsAny used by every handler.

import { compute, generateWaveforms, getTopology } from '../index'
import type { Topology, DesignSpec, DesignResult } from '../types'
import type { WaveformSet } from '../topologies/types'
import type { TopologyId } from '../../store/workbenchStore'
import type { TopologyPlugin, PluginMeta } from '../plugin-types'
import { validatePlugin } from '../plugin-types'
import type { LoadPluginsPayload, PluginsLoadedResponse } from './types'

const pluginRegistry    = new Map<string, TopologyPlugin>()
const disabledPluginIds = new Set<string>()

/** Evaluate a plugin source string in a sandboxed scope (no DOM, no imports). */
function evaluatePluginSource(source: string): unknown {
  const mod = { exports: {} as Record<string, unknown> }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', source)(mod, mod.exports)
  return mod.exports.default ?? mod.exports
}

function pluginToTopology(plugin: TopologyPlugin): Topology {
  return {
    id:                  plugin.id,
    name:                plugin.name,
    compute:             (spec) => plugin.compute(spec),
    generateWaveforms:   plugin.generateWaveforms   ? (spec) => plugin.generateWaveforms!(spec)              : undefined,
    getTransferFunction: plugin.getTransferFunction ? (spec, result) => plugin.getTransferFunction!(spec, result) : undefined,
  }
}

export function resolveTopology(id: string): Topology {
  const plugin = pluginRegistry.get(id)
  if (plugin) return pluginToTopology(plugin)
  return getTopology(id as TopologyId)
}

export function computeAny(topologyId: string, spec: DesignSpec): DesignResult {
  const plugin = pluginRegistry.get(topologyId)
  if (plugin) {
    if (disabledPluginIds.has(topologyId)) throw new Error(`Plugin '${topologyId}' is disabled`)
    return plugin.compute(spec)
  }
  return compute(topologyId as TopologyId, spec)
}

export function generateWaveformsAny(topologyId: string, spec: DesignSpec): WaveformSet | null {
  const plugin = pluginRegistry.get(topologyId)
  if (plugin) return plugin.generateWaveforms ? plugin.generateWaveforms(spec) : null
  return generateWaveforms(topologyId as TopologyId, spec)
}

/** Stub meta for an unloadable plugin source — surfaces the failure to the Settings UI. */
function failedMeta(filename: string, error: string): PluginMeta {
  return { id: filename, name: filename, version: '?', author: '?', description: '', filename, enabled: false, error }
}

function loadOne(filename: string, source: string): PluginMeta {
  try {
    const exported = evaluatePluginSource(source)
    if (!validatePlugin(exported)) return failedMeta(filename, 'Missing required fields (id, name, compute)')
    pluginRegistry.set(exported.id, exported)
    return {
      id: exported.id, name: exported.name, version: exported.version,
      author: exported.author, description: exported.description,
      filename, enabled: !disabledPluginIds.has(exported.id),
    }
  } catch (err) {
    return failedMeta(filename, String(err))
  }
}

/** Load, validate, and register all plugin sources; post PLUGINS_LOADED when done. */
export function handleLoadPlugins(payload: LoadPluginsPayload): void {
  const { sources, disabledIds } = payload
  pluginRegistry.clear()
  disabledPluginIds.clear()
  disabledIds.forEach(id => disabledPluginIds.add(id))

  const plugins = sources.map(({ filename, source }) => loadOne(filename, source))
  const response: PluginsLoadedResponse = { type: 'PLUGINS_LOADED', payload: { plugins } }
  self.postMessage(response)
}
