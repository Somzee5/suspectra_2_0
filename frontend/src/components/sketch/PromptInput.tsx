'use client'

import { useState } from 'react'
import { Wand2, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SketchLayer, SketchState } from '@/types/sketch'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

interface PromptInputProps {
  sketch: SketchState
  onLayerChanges?: (changes: Array<{ type: string; changes: Partial<SketchLayer> }>) => void
}

export default function PromptInput({ sketch, onLayerChanges }: PromptInputProps) {
  const [prompt, setPrompt]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`${AI_URL}/api/humanization/parse-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), layers: sketch.layers }),
      })

      if (!res.ok) throw new Error('Parser unavailable')

      const data = await res.json()

      if (data.layer_changes?.length > 0 && onLayerChanges) {
        onLayerChanges(data.layer_changes)
        toast.success(data.actions.join(' · '))
      } else {
        toast('No structural changes found — use the Humanize panel for visual enhancements', {
          icon: '💡',
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
        })
      }

      console.log('[SUSPECTRA PROMPT PARSE]', data)
    } catch {
      console.log('[SUSPECTRA PROMPT (offline)]', {
        prompt: prompt.trim(),
        sketchId: sketch.id,
        layers: sketch.layers,
      })
      toast('AI service offline — prompt logged locally', {
        icon: '📝',
        style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
      })
    } finally {
      setLoading(false)
      setPrompt('')
    }
  }

  return (
    <div className="h-14 flex items-center gap-3 px-4 border-t border-slate-800 bg-slate-900 shrink-0">
      <div className="flex items-center gap-2 text-xs shrink-0">
        <Wand2 className="w-3.5 h-3.5 text-violet-500" />
        <span className="hidden sm:inline text-slate-500">Structural edit</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "make eyes bigger" · "wider nose" · "tilt eyebrows left"'
          disabled={loading}
          className="
            flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5
            text-sm text-slate-100 placeholder:text-slate-600
            focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500
            disabled:opacity-50 transition-all
          "
        />
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="p-2 rounded-lg bg-violet-600/20 border border-violet-700 text-violet-400
                     hover:bg-violet-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
        </button>
      </form>

      <span className="text-xs text-slate-700 hidden md:block shrink-0">
        Visual enhancement → Humanize panel →
      </span>
    </div>
  )
}
