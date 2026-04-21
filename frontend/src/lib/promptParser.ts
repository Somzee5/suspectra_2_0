import type { SketchLayer } from '@/types/sketch'

const FEATURE_MAP: Record<string, string> = {
  nose: 'nose', nostril: 'nose',
  eye: 'eyes', eyes: 'eyes',
  eyebrow: 'eyebrows', eyebrows: 'eyebrows', brow: 'eyebrows', brows: 'eyebrows',
  lip: 'lips', lips: 'lips', mouth: 'lips',
  hair: 'hair',
  beard: 'mustache', mustache: 'mustache',
  face: 'face', head: 'face', jaw: 'face',
}

interface ScaleRule { w?: number; h?: number }

const SCALE_MAP: Record<string, ScaleRule> = {
  'much bigger':      { w: 1.5,  h: 1.5  },
  'much larger':      { w: 1.5,  h: 1.5  },
  'slightly bigger':  { w: 1.1,  h: 1.1  },
  'slightly larger':  { w: 1.1,  h: 1.1  },
  'slightly wider':   { w: 1.1              },
  'slightly taller':  {           h: 1.1  },
  'slightly smaller': { w: 0.9,  h: 0.9  },
  'slightly narrower':{ w: 0.9              },
  bigger:             { w: 1.25, h: 1.25 },
  larger:             { w: 1.25, h: 1.25 },
  wider:              { w: 1.2             },
  taller:             {           h: 1.2  },
  smaller:            { w: 0.8,  h: 0.8  },
  shorter:            {           h: 0.8  },
  narrower:           { w: 0.8             },
  huge:               { w: 1.6,  h: 1.6  },
  tiny:               { w: 0.6,  h: 0.6  },
}

export interface ParseResult {
  changes: Array<{ type: string; props: Partial<SketchLayer> }>
  actions: string[]
  unhandled: string   // remainder that needs AI
}

export function parsePrompt(prompt: string, layers: SketchLayer[]): ParseResult {
  const text    = prompt.toLowerCase()
  const layerMap = Object.fromEntries(layers.map((l) => [l.type, l]))
  const changes: ParseResult['changes'] = []
  const actions: string[] = []

  // Try multi-word scale phrases first, then single words
  const scaleEntries = Object.entries(SCALE_MAP).sort((a, b) => b[0].length - a[0].length)

  for (const [scaleTerm, rule] of scaleEntries) {
    if (!text.includes(scaleTerm)) continue
    for (const [featTerm, featType] of Object.entries(FEATURE_MAP)) {
      if (!text.includes(featTerm)) continue
      const layer = layerMap[featType]
      if (!layer) continue

      const props: Partial<SketchLayer> = {}
      if (rule.w !== undefined) props.width  = Math.max(20, Math.round(layer.width  * rule.w))
      if (rule.h !== undefined) props.height = Math.max(20, Math.round(layer.height * rule.h))

      if (Object.keys(props).length > 0) {
        changes.push({ type: featType, props })
        actions.push(`${featType}: ${scaleTerm} (${JSON.stringify(props)})`)
      }
    }
  }

  // Opacity keywords
  const opacityMap: Record<string, number> = { faint: 0.4, light: 0.6, subtle: 0.7, bold: 1.0 }
  for (const [opTerm, opacity] of Object.entries(opacityMap)) {
    if (!text.includes(opTerm)) continue
    for (const [featTerm, featType] of Object.entries(FEATURE_MAP)) {
      if (!text.includes(featTerm) || !layerMap[featType]) continue
      changes.push({ type: featType, props: { opacity } })
      actions.push(`${featType}: opacity → ${Math.round(opacity * 100)}%`)
    }
  }

  // Strip what we handled — remainder goes to AI humanization
  let unhandled = text
  for (const term of [...Object.keys(SCALE_MAP), ...Object.keys(FEATURE_MAP), ...Object.keys(opacityMap)]) {
    unhandled = unhandled.replace(new RegExp(term, 'gi'), '')
  }
  unhandled = unhandled.replace(/\s+/g, ' ').trim().replace(/^[,\s]+|[,\s]+$/g, '')

  return { changes, actions, unhandled }
}
