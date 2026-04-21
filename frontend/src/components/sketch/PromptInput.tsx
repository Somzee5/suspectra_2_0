'use client'

import { useState } from 'react'
import { Wand2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { parsePrompt } from '@/lib/promptParser'
import type { SketchLayer, SketchState } from '@/types/sketch'

interface PromptInputProps {
  sketch: SketchState
  onLayerChanges: (changes: Array<{ type: string; props: Partial<SketchLayer> }>) => void
}

const EXAMPLES = [
  'wider nose',
  'bigger eyes',
  'smaller lips',
  'taller eyebrows',
  'slightly narrower face',
]

export default function PromptInput({ sketch, onLayerChanges }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = prompt.trim()
    if (!text) return

    const result = parsePrompt(text, sketch.layers)

    if (result.changes.length === 0) {
      toast(`No structural match found. Try: "${EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]}"`, {
        icon: '💡',
        style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
      })
      return
    }

    onLayerChanges(result.changes)
    toast.success(result.actions.join(' · '))

    if (result.unhandled) {
      toast(`"${result.unhandled}" → use Humanize panel for visual changes`, {
        icon: '🎨',
        style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
      })
    }

    setPrompt('')
  }

  return (
    <div className="h-14 flex items-center gap-3 px-4 border-t border-slate-800 bg-slate-900 shrink-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <Wand2 className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-xs text-slate-500 hidden sm:inline">Edit</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Try: "${EXAMPLES[0]}" · "${EXAMPLES[1]}" · "${EXAMPLES[2]}"`}
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
                     hover:bg-violet-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <span className="text-xs text-slate-700 hidden lg:block shrink-0">
        Visual → Humanize tab
      </span>
    </div>
  )
}
