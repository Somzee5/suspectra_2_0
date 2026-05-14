'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Trash2, RotateCcw, Shield, Code, Undo2, Redo2, Zap } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { SketchState } from '@/types/sketch'

interface ToolbarProps {
  sketch: SketchState
  layerCount: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  onClear: () => void
  onExportPNG: () => void
  onLoadDemoSketch: () => void
}

export default function Toolbar({
  sketch, layerCount, canUndo, canRedo, onUndo, onRedo, onReset, onClear, onExportPNG, onLoadDemoSketch,
}: ToolbarProps) {
  const handleExportJSON = () => {
    const json = JSON.stringify(sketch, null, 2)
    console.log('[SUSPECTRA] Sketch JSON export:\n', json)
    const blob = new Blob([json], { type: 'application/json' })
    const a    = document.createElement('a')
    a.download = `suspectra_sketch_${sketch.id}.json`
    a.href     = URL.createObjectURL(blob)
    a.click()
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900 shrink-0">

      {/* Left — brand + back */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white text-sm">Sketch Builder</span>
          <span className="text-xs text-slate-500 font-mono">#{sketch.id.slice(-6)}</span>
        </div>
        <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-900/40 text-cyan-400 border border-cyan-800">
          {layerCount} layer{layerCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5">

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <Button variant="ghost" size="sm" onClick={onReset} title="Reset canvas">
          <RotateCcw className="w-4 h-4" />
          <span className="hidden md:inline">Reset</span>
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} title="Clear all layers">
          <Trash2 className="w-4 h-4" />
          <span className="hidden md:inline">Clear</span>
        </Button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <Button variant="secondary" size="sm" onClick={handleExportJSON} title="Export JSON">
          <Code className="w-4 h-4" />
          <span className="hidden md:inline">JSON</span>
        </Button>

        {/* Demo preset — loads pre-built faculty sketch instantly */}
        <button
          onClick={onLoadDemoSketch}
          title="Load faculty demo sketch"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-lg shadow-amber-900/30"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Demo Sketch</span>
        </button>

        <Button variant="primary" size="sm" onClick={onExportPNG}>
          <Download className="w-4 h-4" />
          Export PNG
        </Button>
      </div>
    </header>
  )
}
