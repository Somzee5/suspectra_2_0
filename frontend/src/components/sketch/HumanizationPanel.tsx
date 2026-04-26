'use client'

import { useState, useRef } from 'react'
import { Wand2, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle, Cloud, Cpu } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import type { SketchState } from '@/types/sketch'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

type GenerationStatus = 'idle' | 'checking' | 'generating' | 'done' | 'error'

interface StatusData {
  model_ready: boolean
  backend: string
  device: string
}

interface HumanizationPanelProps {
  sketch: SketchState
  getSketchPNG: () => Promise<Blob | null>
  /** Called with the result data-URL after a successful generation */
  onHumanized?: (dataUrl: string) => void
}

export default function HumanizationPanel({ sketch, getSketchPNG, onHumanized }: HumanizationPanelProps) {
  const [status, setStatus]         = useState<GenerationStatus>('idle')
  const [resultUrl, setResultUrl]   = useState<string | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string>('')
  const [prompt, setPrompt]         = useState('')
  const [steps, setSteps]           = useState(20)
  const [guidance, setGuidance]     = useState(7.5)
  const [ctrlScale, setCtrlScale]   = useState(0.85)
  const [serviceInfo, setServiceInfo] = useState<StatusData | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const isLoading = status === 'checking' || status === 'generating'

  // ── Check service status ──────────────────────────────────
  const checkStatus = async (): Promise<StatusData | null> => {
    try {
      const res = await fetch(`${AI_URL}/api/humanization/status`)
      if (res.ok) {
        const data = await res.json()
        setServiceInfo(data)
        return data
      }
    } catch { /* service not running */ }
    return null
  }

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (sketch.layers.length === 0) {
      toast.error('Build a sketch first before humanizing')
      return
    }

    setStatus('checking')
    setErrorMsg('')
    setElapsedSec(0)

    const startMs = Date.now()
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - startMs) / 1000))
    }, 1000)

    try {
      const svcData = await checkStatus()
      if (!svcData) throw new Error('AI service is not running — start it with: uvicorn main:app --port 8001')

      setStatus('generating')

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

      const data   = await res.json()
      const imgUrl = `data:${data.mime};base64,${data.image_b64}`
      setResultUrl(imgUrl)
      onHumanized?.(imgUrl)
      setStatus('done')
      toast.success('Sketch humanized')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setErrorMsg(msg)
      setStatus('error')
      toast.error(`Humanization failed: ${msg}`)
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `suspectra_humanized_${sketch.id.slice(-6)}_${Date.now()}.png`
    a.click()
  }

  const backend = serviceInfo?.backend ?? null   // 'replicate' | 'cuda' | 'local' | null

  const badgeInfo = () => {
    if (!serviceInfo) return { label: 'AI', color: 'bg-slate-800 text-slate-500 border-slate-700', icon: null }
    if (backend === 'replicate') return { label: 'Cloud AI', color: 'bg-violet-900/40 text-violet-400 border-violet-800', icon: <Cloud className="w-2.5 h-2.5" /> }
    if (backend === 'cuda')      return { label: 'GPU · SD+ControlNet', color: 'bg-green-900/40 text-green-400 border-green-800', icon: <CheckCircle className="w-2.5 h-2.5" /> }
    return { label: 'Local AI', color: 'bg-slate-800 text-slate-400 border-slate-700', icon: <Cpu className="w-2.5 h-2.5" /> }
  }

  const subtitleMap: Record<string, string> = {
    replicate: 'Converts sketch to photorealistic face via cloud SD+ControlNet',
    cuda:      'Converts sketch to photorealistic face via local GPU (SD+ControlNet)',
    local:     'Converts sketch to a colorized face portrait (instant, CPU)',
  }
  const badge = badgeInfo()
  const showAdvanced = backend === 'replicate' || backend === 'cuda'

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-violet-400" />
          <h2 className="font-semibold text-white text-sm">AI Humanization</h2>
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${badge.color}`}>
            {badge.icon}{badge.label}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {backend ? subtitleMap[backend] : 'Converts composite sketch into a realistic face'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Service status */}
        {serviceInfo && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
            serviceInfo.model_ready
              ? 'bg-green-900/20 border-green-800 text-green-400'
              : 'bg-amber-900/20 border-amber-800 text-amber-400'
          }`}>
            {serviceInfo.model_ready
              ? <><CheckCircle className="w-3.5 h-3.5 shrink-0" /> Ready — {serviceInfo.device}</>
              : <><AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {backend === 'cuda'
                    ? 'GPU ready — downloads ~5 GB on first run'
                    : 'Ready — instant local colorization'}
                </>
            }
          </div>
        )}

        {/* Prompt */}
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Describe the subject (optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={'e.g. "middle aged male, brown skin, scar on left cheek"'}
            rows={2}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100
                       placeholder:text-slate-600 resize-none
                       focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
          />
          <p className="text-xs text-slate-600 mt-1">Skin tone keywords: fair, olive, brown, dark</p>
        </div>

        {/* Advanced settings — only meaningful for cloud/GPU backends */}
        {showAdvanced && (
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
        )}

        {/* Info hint for local mode */}
        {backend === 'local' && (
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-0.5">Want photorealistic output?</p>
            <p>Run on a machine with an NVIDIA GPU — the service auto-detects CUDA and switches to full SD+ControlNet automatically.</p>
          </div>
        )}

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
                {status === 'checking' ? 'Connecting…' : `Generating… ${elapsedSec}s`}
              </>
            : <><Wand2 className="w-4 h-4" /> Humanize Sketch</>
          }
        </button>

        {/* Error */}
        {status === 'error' && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
            <p className="font-medium mb-1">Generation failed</p>
            <p className="text-red-500/80">{errorMsg}</p>
            {errorMsg.includes('AI service') && (
              <p className="mt-2 text-slate-500">
                Start it with: <code className="text-slate-400">cd ai-service && uvicorn main:app --port 8001</code>
              </p>
            )}
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

            <div className="relative rounded-xl overflow-hidden border border-violet-500/30 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Humanized face" className="w-full object-contain" />
              <div className="absolute top-2 right-2">
                <span className="px-2 py-0.5 rounded bg-violet-900/80 text-violet-300 text-xs border border-violet-700">
                  {backend === 'cuda' ? 'GPU · SD+ControlNet' : backend === 'replicate' ? 'Cloud · SD+ControlNet' : 'Local AI'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center">
              512 × 640 px ·{' '}
              {showAdvanced ? `${steps} steps · guidance ${guidance}` : 'local colorization'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
