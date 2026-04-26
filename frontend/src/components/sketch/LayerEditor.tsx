'use client'

import { Trash2, ChevronUp, ChevronDown, Layers } from 'lucide-react'
import type { SketchLayer } from '@/types/sketch'
import Button from '@/components/ui/Button'

interface LayerEditorProps {
  layer: SketchLayer | null
  allLayers: SketchLayer[]
  onUpdate: (id: string, props: Partial<SketchLayer>) => void
  onDelete: (id: string) => void
  onReorder: (id: string, direction: 'up' | 'down') => void
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-cyan-400 font-mono">{Math.round(value)}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded accent-cyan-500"
      />
    </div>
  )
}

interface NumberInputProps {
  label: string
  value: number
  onChange: (v: number) => void
}

function NumberInput({ label, value, onChange }: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="number"
        value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="
          w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5
          text-sm text-white font-mono text-center
          focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500
        "
      />
    </div>
  )
}

export default function LayerEditor({ layer, allLayers, onUpdate, onDelete, onReorder }: LayerEditorProps) {
  if (!layer) {
    return (
      <aside className="w-full h-full flex flex-col bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Properties</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Layers className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm text-slate-500">Select a feature on the canvas to edit its properties</p>
        </div>

        {/* Layers list */}
        {allLayers.length > 0 && (
          <div className="border-t border-slate-800 p-3">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">All Layers</p>
            <div className="space-y-1">
              {[...allLayers].reverse().map((l) => (
                <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-400">
                  <span className="w-4 text-center opacity-50">{l.zIndex}</span>
                  <span className="flex-1 truncate">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    )
  }

  return (
    <aside className="w-full h-full flex flex-col bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Properties</p>
        <p className="text-sm font-medium text-cyan-400 truncate">{layer.label}</p>
        <p className="text-xs text-slate-600 capitalize">{layer.type} · layer {layer.zIndex}</p>
      </div>

      {/* Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Position */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Position</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={layer.x} onChange={(v) => onUpdate(layer.id, { x: v })} />
            <NumberInput label="Y" value={layer.y} onChange={(v) => onUpdate(layer.id, { y: v })} />
          </div>
        </section>

        {/* Dimensions */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dimensions</p>
          <div className="space-y-3">
            <SliderRow
              label="Width" value={layer.width} min={10} max={500}
              onChange={(v) => onUpdate(layer.id, { width: v })}
            />
            <SliderRow
              label="Height" value={layer.height} min={10} max={600}
              onChange={(v) => onUpdate(layer.id, { height: v })}
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <NumberInput label="W" value={layer.width} onChange={(v) => onUpdate(layer.id, { width: Math.max(10, v) })} />
              <NumberInput label="H" value={layer.height} onChange={(v) => onUpdate(layer.id, { height: Math.max(10, v) })} />
            </div>
          </div>
        </section>

        {/* Rotation */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Rotation</p>
          <SliderRow
            label="Angle" value={layer.rotation} min={-180} max={180} unit="°"
            onChange={(v) => onUpdate(layer.id, { rotation: v })}
          />
        </section>

        {/* Opacity */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Appearance</p>
          <SliderRow
            label="Opacity" value={layer.opacity * 100} min={10} max={100} unit="%"
            onChange={(v) => onUpdate(layer.id, { opacity: v / 100 })}
          />
        </section>

        {/* Z-index ordering */}
        <section>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Layer Order</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onReorder(layer.id, 'up')}>
              <ChevronUp className="w-3.5 h-3.5" /> Forward
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => onReorder(layer.id, 'down')}>
              <ChevronDown className="w-3.5 h-3.5" /> Back
            </Button>
          </div>
        </section>
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-slate-800">
        <Button
          variant="danger" size="sm" className="w-full"
          onClick={() => onDelete(layer.id)}
        >
          <Trash2 className="w-4 h-4" /> Remove Layer
        </Button>
      </div>
    </aside>
  )
}
