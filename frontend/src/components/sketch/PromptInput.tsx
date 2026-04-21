'use client'

import { useState } from 'react'
import { Wand2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SketchState } from '@/types/sketch'

interface PromptInputProps {
  sketch: SketchState
}

export default function PromptInput({ sketch }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    // Phase 3/4: This will trigger AI refinement
    // For now, log the intent with the full sketch state
    const payload = {
      prompt: prompt.trim(),
      sketchId: sketch.id,
      layerCount: sketch.layers.length,
      layers: sketch.layers.map((l) => ({
        type: l.type,
        asset: l.asset,
        x: l.x, y: l.y,
        width: l.width, height: l.height,
        rotation: l.rotation, opacity: l.opacity,
      })),
    }

    console.log('[SUSPECTRA AI PROMPT]', JSON.stringify(payload, null, 2))
    toast('Prompt logged — AI refinement connects here in Phase 3', {
      icon: '🔮',
      style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #7c3aed' },
    })
    setPrompt('')
  }

  return (
    <div className="h-14 flex items-center gap-3 px-4 border-t border-slate-800 bg-slate-900 shrink-0">
      <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
        <Wand2 className="w-3.5 h-3.5 text-violet-500" />
        <span className="hidden sm:inline">AI Refinement</span>
        <span className="px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400 border border-violet-800 text-xs">Phase 3</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Describe a refinement… e.g. "make eyes slightly bigger and add a beard"'
          className="
            flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5
            text-sm text-slate-100 placeholder:text-slate-600
            focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500
            transition-all
          "
        />
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="p-2 rounded-lg bg-violet-600/20 border border-violet-700 text-violet-400
                     hover:bg-violet-600/40 disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors"
          title="Submit prompt (Phase 3)"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
