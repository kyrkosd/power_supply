import type { ProjectFile } from '../../types/project'

export interface ReferenceDesign extends ProjectFile {
  title: string
  description: string
  application: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  design_notes: string
  source: string
}

import d01 from './01-usb-charger-5v.json'
import d02 from './02-led-driver-boost.json'
import d03 from './03-3v3-logic-rail.json'
import d04 from './04-battery-boost.json'
import d05 from './05-server-pol-buck.json'
import d06 from './06-telecom-forward.json'
import d07 from './07-solar-sepic.json'
import d08 from './08-automotive-buck.json'
import d09 from './09-usbc-pd-flyback.json'
import d10 from './10-atx-multi-output.json'
import d11 from './11-poe-flyback.json'
import d12 from './12-hi-eff-forward.json'

export const REFERENCE_DESIGNS: ReferenceDesign[] = [
  d01, d02, d03, d04, d05, d06, d07, d08, d09, d10, d11, d12,
] as unknown as ReferenceDesign[]
