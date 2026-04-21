'use client'

import { useState, useRef } from 'react'
import { Wand2, Download, RefreshCw, ZoomIn, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import type { SketchState } from '@/types/sketch'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

type GenerationStatus = 'idle' | 'loading-model' | 'generating' | 'done' | 'error'

interface HumanizationPanelProps {
  sketch: SketchState
  getSketchPNG: () => Promise<Blob | null>
}

export default function HumanizationPanel({ sketch, getSketchPNG }: HumanizationPanelProps) {
  const [status, setStatus]         = useState<GenerationStatus>('idle')
  const [resultUrl, setResultUrl]   = useState<string | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string>('')
  const [prompt, setPrompt]         = useState('')
  const [steps, setSteps]           = useState(25)
  const [guidance, setGuidance]     = useState(7.5)
  const [ctrlScale, setCtrlScale]   = useState(0.85)
  const [modelReady, setModelReady] = useState<boolean | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Check model status ────────────────────────────────────
  const checkModelStatus = async () => {
    try {
      const res = await fetch(`${AI_URL}/api/humanization/status`)
      if (res.ok) {
        const data = await res.json()
        setModelReady(data.model_ready)
        return data
      }
    } catch {
      setModelReady(false)
    }
    return null
  }

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (sketch.layers.length === 0) {
      toast.error('Build a sketch first before humanizing')
      return
    }

    setStatus('loading-model')
    setErrorMsg('')
    setElapsedSec(0)

    // Start elapsed timer
    const startMs = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - startMs) / 1000))
    }, 1000)

    try {
      // Check if model is already loaded
      const statusData = await checkModelStatus()
      if (statusData && !statusData.model_ready) {
        toast('First run downloads ~5GB models. This takes a few minutes…', {
          icon: '📦', duration: 8000,
          style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' },
        })
      }

      setStatus('generating')

      // Export current canvas as PNG blob
      const blob = await getSketchPNG()
      if (!blob) throw new Error('Failed to export sketch canvas')

      const form = new FormData()
      form.append('sketch', blob, 'sketch.png')
      form.append('prompt', prompt)
      form.append('steps', String(steps))
      form.append('guidance', String(guidance))
      form.append('controlnet_scale', String(ctrlScale))
      form.append('seed', '-1')

      const res = await fetch(`${AI_URL}/api/humanization/generate-b64`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Generation failed')
      }

      const data = await res.json()
      const imgUrl = `data:${data.mime};base64,${data.image_b64}`
      setResultUrl(imgUrl)
      setStatus('done')
      setModelReady(true)
      toast.success('Face humanized successfully')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setErrorMsg(msg)
      setStatus('error')
      toast.error(`Humanization failed: ${msg}`)
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  // ── Export generated image ────────────────────────────────
  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `suspectra_humanized_${sketch.id.slice(-6)}_${Date.now()}.png`
    a.click()
  }

  const isLoading = status === 'loading-model' || status === 'generating'

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-violet-400" />
          <h2 className="font-semibold text-white text-sm">AI Humanization</h2>
          <span className="px-1.5 py-0.5 rounded text-xs bg-violet-900/40 text-violet-400 border border-violet-800">
            SD + ControlNet
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Converts your composite sketch into a photorealistic face
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Model status badge */}
        {modelReady !== null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
            modelReady
              ? 'bg-green-900/20 border-green-800 text-green-400'
              : 'bg-amber-900/20 border-amber-800 text-amber-400'
          }`}>
            {modelReady
              ? <><CheckCircle className="w-3.5 h-3.5" /> Model loaded &amp; ready</>
              : <><AlertTriangle className="w-3.5 h-3.5" /> Model not loaded — first run downloads ~5 GB</>
            }
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Additional prompt (optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'e.g. "middle aged male, brown skin, scar on left cheek"'}
            rows={2}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                       placeholder:text-slate-600 resize-none
                       focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        {/* Advanced settings */}
        <details className="group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
            Advanced settings
          </summary>
          <div className="mt-3 space-y-3 pl-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Steps</span>
                <span className="text-violet-400 font-mono">{steps}</span>
              </div>
              <input type="range" min={10} max={50} value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="w-full h-1.5 accent-violet-500" />
              <p className="text-xs text-slate-600 mt-0.5">More steps = better quality, slower</p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Guidance Scale</span>
                <span className="text-violet-400 font-mono">{guidance}</span>
              </div>
              <input type="range" min={1} max={15} step={0.5} value={guidance}
                onChange={(e) => setGuidance(Number(e.target.value))}
                className="w-full h-1.5 accent-violet-500" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">ControlNet Strength</span>
                <span className="text-violet-400 font-mono">{ctrlScale}</span>
              </div>
              <input type="range" min={0.3} max={1.5} step={0.05} value={ctrlScale}
                onChange={(e) => setCtrlScale(Number(e.target.value))}
                className="w-full h-1.5 accent-violet-500" />
              <p className="text-xs text-slate-600 mt-0.5">Higher = more faithful to sketch structure</p>
            </div>
          </div>
        </details>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className={`
            w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2
            transition-all duration-150
            ${isLoading
              ? 'bg-violet-900/40 text-violet-400 cursor-not-allowed border border-violet-800'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'}
          `}
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />
                {status === 'loading-model' ? 'Loading model…' : `Generating… ${elapsedSec}s`}
              </>
            : <><Wand2 className="w-4 h-4" /> Humanize Sketch</>
          }
        </button>

        {/* Error */}
        {status === 'error' && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
            <p className="font-medium mb-1">Generation failed</p>
            <p className="text-red-500/80">{errorMsg}</p>
            <p className="mt-2 text-slate-500">
              Make sure the AI service is running: <code className="text-slate-400">uvicorn main:app --port 8001</code>
            </p>
          </div>
        )}

        {/* Result */}
        {resultUrl && status === 'done' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Generated Face</p>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => setResultUrl(null)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Generated image */}
            <div className="relative rounded-xl overflow-hidden border border-violet-500/30 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Humanized face" className="w-full object-contain" />
              <div className="absolute top-2 right-2">
                <span className="px-2 py-0.5 rounded bg-violet-900/80 text-violet-300 text-xs border border-violet-700">
                  SD + ControlNet
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center">
              512 × 640px · {steps} steps · guidance {guidance}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
