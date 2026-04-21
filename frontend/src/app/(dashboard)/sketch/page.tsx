'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import FeatureSidebar from '@/components/sketch/FeatureSidebar'
import LayerEditor from '@/components/sketch/LayerEditor'
import Toolbar from '@/components/sketch/Toolbar'
import PromptInput from '@/components/sketch/PromptInput'
import type { SketchLayer, SketchState } from '@/types/sketch'
import type { CategoryDef, FeatureDef } from '@/lib/sketchFeatures'
import type { SketchCanvasHandle } from '@/components/sketch/SketchCanvas'

// SSR-safe: react-konva uses browser canvas API
const SketchCanvas = dynamic(() => import('@/components/sketch/SketchCanvas'), { ssr: false })

// ── Stable empty sketch (no uuid at module level — avoids hydration mismatch)
const EMPTY_SKETCH: SketchState = { id: '', createdAt: '', layers: [] }

export default function SketchPage() {
  // Initialise with empty, then populate on client only (fixes hydration error)
  const [sketch, setSketch]         = useState<SketchState>(EMPTY_SKETCH)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mounted, setMounted]       = useState(false)
  const canvasRef = useRef<SketchCanvasHandle>(null)

  useEffect(() => {
    // Generate uuid only in browser to prevent server/client mismatch
    setSketch({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      layers: [],
    })
    setMounted(true)
  }, [])

  // ── Add feature (replace existing if singleInstance) ──────
  const handleAddFeature = useCallback((cat: CategoryDef, feature: FeatureDef) => {
    setSketch((prev) => {
      let layers = [...prev.layers]
      const maxZ = layers.reduce((m, l) => Math.max(m, l.zIndex), 0)

      // Enforce one-per-category for singleInstance categories
      if (cat.singleInstance) {
        const existing = layers.find((l) => l.type === cat.id)
        if (existing) {
          // Replace asset in-place, keep position/size the user already set
          layers = layers.map((l) =>
            l.id === existing.id
              ? { ...l, asset: feature.asset, label: `${cat.label} — ${feature.name}` }
              : l
          )
          toast(`Replaced ${cat.label}`, { icon: '↺' })
          return { ...prev, layers }
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

  // ── Update layer properties ────────────────────────────────
  const handleUpdate = useCallback((id: string, props: Partial<SketchLayer>) => {
    setSketch((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...props } : l)),
    }))
  }, [])

  // ── Delete layer ───────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    setSketch((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }))
    setSelectedId(null)
    toast.success('Layer removed')
  }, [])

  // ── Z-index reordering ─────────────────────────────────────
  const handleReorder = useCallback((id: string, direction: 'up' | 'down') => {
    setSketch((prev) => {
      const sorted = [...prev.layers].sort((a, b) => a.zIndex - b.zIndex)
      const idx = sorted.findIndex((l) => l.id === id)
      if (direction === 'up' && idx < sorted.length - 1) {
        ;[sorted[idx].zIndex, sorted[idx + 1].zIndex] = [sorted[idx + 1].zIndex, sorted[idx].zIndex]
      } else if (direction === 'down' && idx > 0) {
        ;[sorted[idx].zIndex, sorted[idx - 1].zIndex] = [sorted[idx - 1].zIndex, sorted[idx].zIndex]
      }
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
        <FeatureSidebar onAddFeature={handleAddFeature} />

        <main className="flex-1 flex items-center justify-center bg-slate-950 p-6 overflow-auto">
          <SketchCanvas
            ref={canvasRef}
            layers={sketch.layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={handleUpdate}
          />
        </main>

        <LayerEditor
          layer={selectedLayer}
          allLayers={sketch.layers}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>

      <PromptInput sketch={sketch} />
    </div>
  )
}
