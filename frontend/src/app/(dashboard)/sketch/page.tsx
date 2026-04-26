'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Wand2, PenTool, Clock, Play, ChevronLeft, FolderOpen, Loader2 } from 'lucide-react'
import FeatureSidebar from '@/components/sketch/FeatureSidebar'
import LayerEditor from '@/components/sketch/LayerEditor'
import Toolbar from '@/components/sketch/Toolbar'
import PromptInput from '@/components/sketch/PromptInput'
import HumanizationPanel from '@/components/sketch/HumanizationPanel'
import AgingPanel from '@/components/sketch/AgingPanel'
import PipelineResultsPanel from '@/components/sketch/PipelineResultsPanel'
import { casesApi, pipelineApi } from '@/lib/api'
import type { SketchLayer, SketchState } from '@/types/sketch'
import type { CategoryDef, FeatureDef } from '@/lib/sketchFeatures'
import type { SketchCanvasHandle } from '@/components/sketch/SketchCanvas'
import type { PipelineResult } from '@/types'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

const SketchCanvas = dynamic(() => import('@/components/sketch/SketchCanvas'), { ssr: false })

const EMPTY_SKETCH: SketchState = { id: '', createdAt: '', layers: [] }
const MAX_HISTORY = 50
type PanelMode = 'build' | 'humanize' | 'aging'
type PipelineStatus = 'idle' | 'humanizing' | 'running' | 'done' | 'error'

interface CaseOption { id: string; title: string }

export default function SketchPage() {
  const searchParams = useSearchParams()

  const [sketch, setSketch]               = useState<SketchState>(EMPTY_SKETCH)
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [mounted, setMounted]             = useState(false)
  const [panelMode, setPanelMode]         = useState<PanelMode>('build')
  const [humanizedImageUrl, setHumanizedImageUrl] = useState<string | null>(null)

  // Case context
  const [cases, setCases]             = useState<CaseOption[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string>(searchParams.get('caseId') ?? '')

  // Pipeline
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle')
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [showResults, setShowResults]       = useState(false)

  // ── History for undo / redo ────────────────────────────────
  const [past,   setPast]   = useState<SketchState[]>([])
  const [future, setFuture] = useState<SketchState[]>([])
  const sketchRef = useRef<SketchState>(sketch)
  useEffect(() => { sketchRef.current = sketch }, [sketch])

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  /** Call BEFORE any mutation to snapshot current state into history. */
  const snapshot = useCallback(() => {
    setPast(p => [...p.slice(-(MAX_HISTORY - 1)), sketchRef.current])
    setFuture([])
  }, [])

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture(f => [sketchRef.current, ...f.slice(0, MAX_HISTORY - 1)])
      setSketch(prev)
      localStorage.setItem('suspectra_sketch_draft', JSON.stringify(prev))
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f
      const next = f[0]
      setPast(p => [...p.slice(-(MAX_HISTORY - 1)), sketchRef.current])
      setSketch(next)
      localStorage.setItem('suspectra_sketch_draft', JSON.stringify(next))
      return f.slice(1)
    })
  }, [])

  const canvasRef = useRef<SketchCanvasHandle>(null)
  // Reliable handle — populated via onCanvasReady prop (bypasses dynamic() ref issue)
  const canvasHandleRef = useRef<SketchCanvasHandle | null>(null)
  const handleCanvasReady = useCallback((handle: SketchCanvasHandle) => {
    canvasHandleRef.current = handle
  }, [])

  // ── Mount: restore draft or start fresh ───────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('suspectra_sketch_draft')
      if (saved) {
        const parsed = JSON.parse(saved) as SketchState
        if (parsed?.layers?.length > 0) {
          setSketch(parsed)
          setMounted(true)
          return
        }
      }
    } catch { /* ignore */ }
    setSketch({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), layers: [] })
    setMounted(true)
  }, [])

  // ── Auto-save ──────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('suspectra_sketch_draft', JSON.stringify(sketch))
  }, [sketch, mounted])

  // ── Fetch cases for selector ──────────────────────────────
  useEffect(() => {
    casesApi.getAll(0, 100)
      .then(res => {
        const content = res.data.data?.content ?? []
        setCases(content.map((c: CaseOption) => ({ id: c.id, title: c.title })))
      })
      .catch(() => {/* backend may not be running */})
  }, [])

  // ── Run Full Pipeline ─────────────────────────────────────
  const handleRunPipeline = useCallback(async () => {
    if (sketch.layers.length === 0) {
      toast.error('Build a sketch first')
      return
    }
    if (!selectedCaseId) {
      toast.error('Select a case before running the pipeline')
      return
    }

    setPipelineStatus('humanizing')
    setPipelineResult(null)

    try {
      // Step 1 — Humanize (call AI service directly from frontend)
      const blob = await new Promise<Blob | null>(resolve => {
        const handle = canvasHandleRef.current ?? canvasRef.current
        if (!handle) { resolve(null); return }
        handle.exportPNGBlob(resolve)
      })
      if (!blob) throw new Error('Failed to export sketch canvas')

      toast('Step 1/2: Humanizing sketch…', { icon: '🎨', duration: 3000 })

      const form = new FormData()
      form.append('sketch', blob, 'sketch.png')
      form.append('prompt', '')
      form.append('steps', '20')
      form.append('guidance', '7.5')
      form.append('controlnet_scale', '0.85')
      form.append('seed', '-1')

      const humanRes = await fetch(`${AI_URL}/api/humanization/generate-b64`, {
        method: 'POST',
        body: form,
      })
      if (!humanRes.ok) throw new Error('Humanization failed — is the AI service running?')

      const humanData = await humanRes.json()
      const humanizedUrl = `data:${humanData.mime};base64,${humanData.image_b64}`
      setHumanizedImageUrl(humanizedUrl)

      // Step 2 — Age-invariant recognition via Spring Boot pipeline
      setPipelineStatus('running')
      toast('Step 2/2: Running age-invariant recognition…', { icon: '🔍', duration: 5000 })

      const pipeRes = await pipelineApi.run(selectedCaseId, humanData.image_b64)
      const result  = pipeRes.data.data as PipelineResult

      setPipelineResult(result)
      setPipelineStatus('done')
      setShowResults(true)

      if (result.bestMatch) {
        toast.success(`Best match: ${result.bestMatch.name} (${result.bestMatch.finalScore.toFixed(1)}%)`)
      } else {
        toast('Pipeline complete — no suspects matched above threshold', { icon: 'ℹ️' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pipeline failed'
      setPipelineStatus('error')
      toast.error(msg)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketch.layers.length, selectedCaseId])

  // ── Keyboard shortcuts ────────────────────────────────────
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      // Delete selected layer: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault()
        handleDelete(selectedIdRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo]) // handleDelete via ref below

  // stable ref so keyboard handler doesn't need it as dep
  const handleDeleteRef = useRef<(id: string) => void>(() => {})

  // ── Add feature ────────────────────────────────────────────
  const handleAddFeature = useCallback((cat: CategoryDef, feature: FeatureDef) => {
    snapshot()
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
      setPanelMode('build')
      return { ...prev, layers: [...layers, newLayer] }
    })
  }, [snapshot])

  // ── Update layer (drag / resize / panel sliders) ──────────
  const handleUpdate = useCallback((id: string, props: Partial<SketchLayer>) => {
    // Snapshot only for position/size/rotation changes (from canvas interactions)
    if ('x' in props || 'y' in props || 'rotation' in props) snapshot()
    setSketch((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...props } : l)),
    }))
  }, [snapshot])

  // ── Prompt → layer changes ─────────────────────────────────
  const handleLayerChanges = useCallback(
    (changes: Array<{ type: string; props: Partial<SketchLayer> }>) => {
      snapshot()
      setSketch((prev) => ({
        ...prev,
        layers: prev.layers.map((l) => {
          const change = changes.find((c) => c.type === l.type)
          return change ? { ...l, ...change.props } : l
        }),
      }))
    },
    [snapshot]
  )

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    snapshot()
    setSketch((prev) => ({ ...prev, layers: prev.layers.filter((l) => l.id !== id) }))
    setSelectedId(null)
    toast.success('Layer removed')
  }, [snapshot])

  useEffect(() => { handleDeleteRef.current = handleDelete }, [handleDelete])

  // ── Reorder ────────────────────────────────────────────────
  const handleReorder = useCallback((id: string, direction: 'up' | 'down') => {
    snapshot()
    setSketch((prev) => {
      const sorted = [...prev.layers].sort((a, b) => a.zIndex - b.zIndex)
      const idx    = sorted.findIndex((l) => l.id === id)
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
  }, [snapshot])

  // ── Clear / Reset ──────────────────────────────────────────
  const handleClear = useCallback(() => {
    snapshot()
    setSketch((prev) => ({ ...prev, layers: [] }))
    setSelectedId(null)
    localStorage.removeItem('suspectra_sketch_draft')
    toast('Canvas cleared', { icon: '🗑️' })
  }, [snapshot])

  const handleReset = useCallback(() => {
    snapshot()
    const fresh = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), layers: [] }
    setSketch(fresh)
    setSelectedId(null)
    setPast([])
    setFuture([])
    localStorage.removeItem('suspectra_sketch_draft')
    toast('Canvas reset', { icon: '↺' })
  }, [snapshot])

  // ── Export canvas blob for AI ──────────────────────────────
  const getSketchPNG = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // Prefer the handle set via onCanvasReady (reliable across dynamic() wrapping)
      // Fall back to the forwarded ref in case forwardRef works in this environment
      const handle = canvasHandleRef.current ?? canvasRef.current
      if (!handle) { resolve(null); return }
      handle.exportPNGBlob(resolve)
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

  const pipelineRunning = pipelineStatus === 'humanizing' || pipelineStatus === 'running'

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      <Toolbar
        sketch={sketch}
        layerCount={sketch.layers.length}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onReset={handleReset}
        onClear={handleClear}
        onExportPNG={() => canvasRef.current?.exportPNG()}
      />

      {/* Case bar — case selector + pipeline button */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
        <Link href="/dashboard"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors shrink-0">
          <ChevronLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <div className="w-px h-4 bg-slate-700 shrink-0" />

        <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {cases.length > 0 ? (
          <select
            value={selectedCaseId}
            onChange={e => setSelectedCaseId(e.target.value)}
            className="flex-1 max-w-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1
                       text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">— select a case —</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        ) : (
          <span className="text-xs text-slate-600 italic">
            No cases — <Link href="/dashboard" className="text-cyan-500 hover:underline">create one</Link>
          </span>
        )}

        <div className="ml-auto">
          <button
            onClick={handleRunPipeline}
            disabled={pipelineRunning || sketch.layers.length === 0}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${pipelineRunning || sketch.layers.length === 0
                ? 'bg-green-900/30 text-green-600 border border-green-900 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/30'}`}
          >
            {pipelineRunning
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {pipelineStatus === 'humanizing' ? 'Humanizing…' : 'Recognizing…'}
                </>
              : <><Play className="w-3.5 h-3.5" /> Run Full Pipeline</>}
          </button>
        </div>

        {pipelineStatus === 'done' && pipelineResult && (
          <button
            onClick={() => setShowResults(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline shrink-0"
          >
            View Results
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <FeatureSidebar onAddFeature={handleAddFeature} />

        <main className="flex-1 flex items-center justify-center bg-slate-950 p-6 overflow-auto">
          <SketchCanvas
            ref={canvasRef}
            layers={sketch.layers}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); if (id) setPanelMode('build') }}
            onUpdate={handleUpdate}
            onCanvasReady={handleCanvasReady}
          />
        </main>

        <div className="w-72 flex flex-col border-l border-slate-800 bg-slate-900">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 shrink-0">
            <button
              onClick={() => setPanelMode('build')}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors
                ${panelMode === 'build'
                  ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-800/40'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              <PenTool className="w-3 h-3" /> Properties
            </button>
            <button
              onClick={() => setPanelMode('humanize')}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors
                ${panelMode === 'humanize'
                  ? 'text-violet-400 border-b-2 border-violet-500 bg-slate-800/40'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Wand2 className="w-3 h-3" /> Humanize
            </button>
            <button
              onClick={() => setPanelMode('aging')}
              className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors
                ${panelMode === 'aging'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/40'
                  : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Clock className="w-3 h-3" /> Aging
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {panelMode === 'build' && (
              <LayerEditor
                layer={selectedLayer}
                allLayers={sketch.layers}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            )}
            {panelMode === 'humanize' && (
              <HumanizationPanel
                sketch={sketch}
                getSketchPNG={getSketchPNG}
                onHumanized={(url) => setHumanizedImageUrl(url)}
              />
            )}
            {panelMode === 'aging' && (
              <AgingPanel humanizedImageUrl={humanizedImageUrl} />
            )}
          </div>
        </div>
      </div>

      <PromptInput sketch={sketch} onLayerChanges={handleLayerChanges} />

      {/* Pipeline results overlay */}
      {showResults && pipelineResult && (
        <PipelineResultsPanel
          humanizedUrl={humanizedImageUrl}
          result={pipelineResult}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  )
}
