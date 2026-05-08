# Community Plugins

Power Supply Workbench supports community-built topology engines via a plugin system. Plugins are plain JavaScript files that export a topology object conforming to the `TopologyPlugin` interface. No build step required.

---

## Installation

1. Open the **Settings** modal (⚙ Settings in the toolbar).
2. Click **Open Folder** in the Plugins section — this opens the plugins directory in your file manager.
3. Drop your `.js` plugin file into that folder.
4. Click **Reload Plugins** — the plugin appears in the **Community Plugins** dropdown in the topology selector.

The plugins directory is located at:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\power-supply-workbench\plugins\` |
| macOS    | `~/Library/Application Support/power-supply-workbench/plugins/` |
| Linux    | `~/.config/power-supply-workbench/plugins/` |

---

## Plugin Interface

Each plugin file must assign `module.exports` (CommonJS style) to an object matching the following shape:

```js
module.exports = {
  // Required fields
  id:          'my-topology',        // unique kebab-case identifier
  name:        'My Topology',        // display name in the dropdown
  version:     '1.0.0',
  author:      'Your Name',
  description: 'One-line summary',

  // Required: computes component values from the design spec
  compute(spec) {
    // spec: DesignSpec — see field list below
    // Must return a DesignResult object
    return { /* ... */ }
  },

  // Optional: transfer function for the Bode plot
  getTransferFunction(spec, result) {
    return {
      evaluate(freq_hz) {
        return { magnitude_db: 0, phase_deg: 0 }
      }
    }
  },

  // Optional: time-domain waveform data
  generateWaveforms(spec) {
    const N = 1000
    return {
      time:             new Float32Array(N),
      inductor_current: new Float32Array(N),
      switch_node:      new Float32Array(N),
      output_ripple:    new Float32Array(N),
      diode_current:    new Float32Array(N),
    }
  },

  // Optional: inline SVG schematic (returned as a string)
  getSchematicSVG() {
    return '<svg>...</svg>'
  },

  // Optional: extra UI sliders shown in the input panel
  customInputs: [
    { key: 'turns_ratio', label: 'Turns Ratio', unit: '', min: 0.1, max: 20, default: 4 },
  ],

  // Optional: default spec values for this topology
  defaultSpec: {
    vinMin: 36, vinMax: 72, vout: 12, iout: 5, fsw: 200e3,
  },
}
```

---

## DesignSpec fields (inputs to `compute`)

All physical quantities use SI base units internally.

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `vinMin` | number | V | Minimum input voltage |
| `vinMax` | number | V | Maximum input voltage |
| `vout` | number | V | Target output voltage |
| `iout` | number | A | Maximum output current |
| `fsw` | number | Hz | Switching frequency |
| `rippleRatio` | number | — | Inductor ripple ratio ΔIL/IL (0–1) |
| `voutRippleMax` | number | V | Maximum allowed output voltage ripple |
| `efficiency` | number | — | Estimated efficiency (0–1) |
| `ambientTemp` | number | °C | Ambient temperature |
| `rectification` | `'diode'` \| `'synchronous'` | — | Output rectifier type |
| `controlMode` | `'voltage'` \| `'current'` | — | Control loop mode |

---

## DesignResult fields (returned by `compute`)

Return at minimum the fields marked **required**. Any unreturned optional fields will be omitted from the UI.

| Field | Required | Type | Unit | Description |
|-------|----------|------|------|-------------|
| `dutyCycle` | ✓ | number | — | Steady-state duty cycle |
| `inductance` | ✓ | number | H | Required inductance |
| `capacitance` | ✓ | number | F | Required output capacitance |
| `peakCurrent` | ✓ | number | A | Inductor peak current |
| `efficiency` | ✓ | number | — | Computed efficiency (0–1) |
| `operating_mode` | ✓ | `'CCM'` \| `'DCM'` | — | Conduction mode |
| `warnings` | ✓ | `string[]` | — | Array of warning messages |
| `losses` | ✗ | object | W | Loss breakdown (see below) |
| `ripple_current_rms` | ✗ | number | A | Capacitor RMS ripple current |

### `losses` object

```js
losses: {
  mosfet_conduction: 0,
  mosfet_switching:  0,
  mosfet_gate:       0,
  inductor_copper:   0,
  inductor_core:     0,
  diode_conduction:  0,
  sync_conduction:   0,
  sync_dead_time:    0,
  capacitor_esr:     0,
}
```

---

## Ćuk Converter — Skeleton Example

```js
// cuk-converter.js
// Ćuk topology plugin for Power Supply Workbench
// Reference: Erickson & Maksimovic, "Fundamentals of Power Electronics", ch. 6

module.exports = {
  id:          'cuk',
  name:        'Ćuk Converter',
  version:     '0.1.0',
  author:      'Community',
  description: 'Inverting Ćuk topology with capacitive energy transfer',

  defaultSpec: {
    vinMin: 12, vinMax: 24, vout: -5, iout: 2, fsw: 200e3, rippleRatio: 0.3,
  },

  compute(spec) {
    const { vinMin, vout, iout, fsw, rippleRatio } = spec
    const Vout = Math.abs(vout)

    // D = Vout / (Vin + Vout)  — Erickson eq. 6.5
    const dutyCycle = Vout / (vinMin + Vout)

    // L1 (input), L2 (output): sized independently, share ripple budget
    const deltaI = rippleRatio * iout
    const L1 = (vinMin * dutyCycle) / (fsw * deltaI)
    const L2 = (Vout * (1 - dutyCycle)) / (fsw * deltaI)
    const inductance = Math.min(L1, L2)

    // Output cap: standard ripple formula
    const capacitance = (iout * dutyCycle) / (fsw * (spec.voutRippleMax ?? 0.05 * Vout))

    const efficiency = 0.88  // placeholder

    return {
      dutyCycle,
      inductance,
      capacitance,
      peakCurrent: iout + deltaI / 2,
      efficiency,
      operating_mode: 'CCM',
      warnings: ['Ćuk output is inverting — Vout is negative.'],
    }
  },
}
```

Save the file as `cuk-converter.js` in the plugins folder, reload, and "Ćuk Converter" will appear in the Community Plugins group of the topology dropdown.

---

## Sandbox

Plugins run inside the Web Worker — they have access to standard JavaScript built-ins only. There is no access to the DOM, Node.js APIs, `import`, `require`, or any Electron API. If your plugin needs external data, bundle it into the `.js` file itself.
