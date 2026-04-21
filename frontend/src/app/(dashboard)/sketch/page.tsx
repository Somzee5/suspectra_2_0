'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Wand2, PenTool } from 'lucide-react'
import FeatureSidebar from '@/components/sketch/FeatureSidebar'
import LayerEditor from '@/components/sketch/LayerEditor'
import Toolbar from '@/components/sketch/Toolbar'
import PromptInput from '@/components/sketch/PromptInput'
import HumanizationPanel from '@/components/sketch/HumanizationPanel'
import type { SketchLayer, SketchState } from '@/types/sketch'
import type { CategoryDef, FeatureDef } from '@/lib/sketchFeatures'
import type { SketchCanvasHandle } from '@/components/sketch/SketchCanvas'

const SketchCanvas = dynamic(() => import('@/components/sketch/SketchCanvas'), { ssr: false })

const EMPTY_SKETCH: SketchState = { id: '', createdAt: '', layers: [] }

type PanelMode = 'build' | 'humanize'

export default function SketchPage() {
  const [sketch, setSketch]         = useState<SketchState>(EMPTY_SKETCH)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mounted, setMounted]       = useState(false)
  const [panelMode, setPanelMode]   = useState<PanelMode>('build')
  const canvasRef = useRef<SketchCanvasHandle>(null)

  useEffect(() => {
    setSketch({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), layers: [] })
    setMounted(true)
  }, [])

  // ── Add feature ────────────────────────────────────────────
  const handleAddFeature = useCallback((cat: CategoryDef, feature: FeatureDef) => {
    setSketch((prev) => {
      const layers = [...prev.layers]
      const maxZ   = layers.reduce((m, l) => Math.max(m, l.zIndex), 0)

      if (cat.singleInstance) {
        const existing = layers.find((l) => l.type === cat.id)
        if (existing) {
          toast(`Replaced ${cat.label}`, { icon: '↺' })
          return {
            ...prev,
            layers: layers.map((l) =>
              l.id === existing.id
                ? { ...l, asset: feature.asset, label: `${cat.label} — ${feature.name}` }
                : l
            ),
          }
        }
      }

      const newLayer: SketchLayer = {
        id: crypto.randomUUID(),
        type: cat.id,
        asset: feature.asset,
        label: `${cat.label} — ${feature.name}`,
        ...cat.defaultProps,
        rotation: 0,
        opacity: 1,
        zIndex: maxZ + 1,
      }
      toast.success(`Added ${cat.label}`)
      return { ...prev, layers: [...layers, newLayer] }
    })
  }, [])

  // ── Update layer ───────────────────────────────────────────
  const handleUpdate = useCallback((id: string, props: Partial<SketchLayer>) => {
    setSketch((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...props } : l)),
    }))
  }, [])

  // ── Prompt → layer changes ─────────────────────────────────
  const handleLayerChanges = useCallback(
    (changes: Array<{ type: string; changes: Partial<SketchLayer> }>) => {
      setSketch((prev) => {
        const layers = prev.layers.map((l) => {
          const change = changes.find((c) => c.type === l.type)
          return change ? { ...l, ...change.changes } : l
        })
        return { ...prev, layers }
      })
    },
    []
  )

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    setSketch((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }))
    setSelectedId(null)
    toast.success('Layer removed')
  }, [])

  // ── Reorder ────────────────────────────────────────────────
  const handleReorder = useCallback((id: string, direction: 'up' | 'down') => {
    setSketch((prev) => {
      const sorted = [...prev.layers].sort((a, b) => a.zIndex - b.zIndex)
      const idx    = sorted.findIndex((l) => l.id === id)
      if (direction === 'up' && idx < sorted.length - 1)
        ;[sorted[idx].zIndex, sorted[idx + 1].zIndex] = [sorted[idx + 1].zIndex, sorted[idx].zIndex]
      else if (direction === 'down' && idx > 0)
        ;[sorted[idx].zIndex, sorted[idx - 1].zIndex] = [sorted[idx - 1].zIndex, sorted[idx].zIndex]
      return { ...prev, layers: sorted }
    })
  }, [])

  const handleClear = useCallback(() => {
    setSketch((prev) => ({ ...prev, layers: [] }))
    setSelectedId(null)
    toast('Canvas cleared', { icon: '🗑️' })
  }, [])

  const handleReset = useCallback(() => {
    setSketch({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), layers: [] })
    setSelectedId(null)
    toast('Canvas reset', { icon: '↺' })
  }, [])

  // ── Export canvas as blob (for AI service) ─────────────────
  const getSketchPNG = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!canvasRef.current) { resolve(null); return }
      canvasRef.current.exportPNGBlob(resolve)
    })
  }, [])

  const selectedLayer = sketch.layers.find((l) => l.id === selectedId) ?? null

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      <Toolbar
        sketch={sketch}
        layerCount={sketch.layers.length}
        onReset={handleReset}
        onClear={handleClear}
        onExportPNG={() => canvasRef.current?.exportPNG()}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left — feature library */}
        <FeatureSidebar onAddFeature={handleAddFeature} />

        {/* Center — canvas */}
        <main className="flex-1 flex items-center justify-center bg-slate-950 p-6 overflow-auto">
          <SketchCanvas
            ref={canvasRef}
            layers={sketch.layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={handleUpdate}
          />
        </main>

        {/* Right — tabbed panel: Build properties OR Humanize */}
        <div className="w-72 flex flex-col border-l border-slate-800 bg-slate-900">

          {/* Panel tabs */}
          <div className="flex border-b border-slate-800 shrink-0">
            <button
              onClick={() => setPanelMode('build')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors
                ${panelMode === 'build'
                  ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-800/40'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              <PenTool className="w-3.5 h-3.5" /> Properties
            </button>
            <button
              onClick={() => setPanelMode('humanize')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors
                ${panelMode === 'humanize'
                  ? 'text-violet-400 border-b-2 border-violet-500 bg-slate-800/40'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Wand2 className="w-3.5 h-3.5" /> Humanize
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {panelMode === 'build' ? (
              <LayerEditor
                layer={selectedLayer}
                allLayers={sketch.layers}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            ) : (
              <HumanizationPanel
                sketch={sketch}
                getSketchPNG={getSketchPNG}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom — structural prompt input */}
      <PromptInput
        sketch={sketch}
        onLayerChanges={handleLayerChanges}
      />
    </div>
  )
}
