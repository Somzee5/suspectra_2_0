'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
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

const newSketch = (): SketchState => ({
  id: uuid(),
  createdAt: new Date().toISOString(),
  layers: [],
})

export default function SketchPage() {
  const [sketch, setSketch]         = useState<SketchState>(newSketch)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const canvasRef = useRef<SketchCanvasHandle>(null)

  // ── Add feature from sidebar ───────────────────────────────
  const handleAddFeature = useCallback((cat: CategoryDef, feature: FeatureDef) => {
    const maxZ = sketch.layers.reduce((m, l) => Math.max(m, l.zIndex), 0)
    const newLayer: SketchLayer = {
      id: uuid(),
      type: cat.id,
      asset: feature.asset,
      label: `${cat.label} — ${feature.name}`,
      ...cat.defaultProps,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
    }
    setSketch((prev) => ({ ...prev, layers: [...prev.layers, newLayer] }))
    setSelectedId(newLayer.id)
  }, [sketch.layers])

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
        const tmp = sorted[idx].zIndex
        sorted[idx].zIndex = sorted[idx + 1].zIndex
        sorted[idx + 1].zIndex = tmp
      } else if (direction === 'down' && idx > 0) {
        const tmp = sorted[idx].zIndex
        sorted[idx].zIndex = sorted[idx - 1].zIndex
        sorted[idx - 1].zIndex = tmp
      }
      return { ...prev, layers: sorted }
    })
  }, [])

  // ── Clear all layers ───────────────────────────────────────
  const handleClear = useCallback(() => {
    if (sketch.layers.length === 0) return
    setSketch((prev) => ({ ...prev, layers: [] }))
    setSelectedId(null)
    toast('Canvas cleared', { icon: '🗑️' })
  }, [sketch.layers.length])

  // ── Reset to fresh sketch ──────────────────────────────────
  const handleReset = useCallback(() => {
    setSketch(newSketch())
    setSelectedId(null)
    toast('Canvas reset', { icon: '↺' })
  }, [])

  const selectedLayer = sketch.layers.find((l) => l.id === selectedId) ?? null

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Toolbar */}
      <Toolbar
        sketch={sketch}
        layerCount={sketch.layers.length}
        onReset={handleReset}
        onClear={handleClear}
        onExportPNG={() => canvasRef.current?.exportPNG()}
      />

      {/* Main area */}
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

        {/* Right — property editor */}
        <LayerEditor
          layer={selectedLayer}
          allLayers={sketch.layers}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      </div>

      {/* Bottom — prompt input (Phase 3 foundation) */}
      <PromptInput sketch={sketch} />
    </div>
  )
}
