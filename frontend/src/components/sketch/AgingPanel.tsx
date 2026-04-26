'use client'

import { useState } from 'react'
import { Clock, Play, AlertTriangle, Loader2, Download, Trophy, ChevronDown, ChevronUp, Cpu, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

const DEFAULT_STEPS = [-20, -10, 0, 10, 20]

const stepLabel = (delta: number): string => {
  const map: Partial<Record<number, string>> = {
    [-20]: '−20 yrs', [-10]: '−10 yrs', [0]: 'Current', [10]: '+10 yrs', [20]: '+20 yrs',
  }
  return map[delta] ?? `${delta > 0 ? '+' : ''}${delta} yrs`
}

type Status = 'idle' | 'generating' | 'recognizing' | 'done' | 'error'

interface Variant {
  age_delta:  number
  image_b64:  string
  face_found: boolean
  matches:    SuspectMatch[]
}

interface SuspectMatch {
  suspect_id:      string
  name:            string
  age?:            number
  gender?:         string
  crime_type?:     string
  description?:    string
  embedding_score: number
  final_score:     number
  confidence:      number
  source_variant:  string
}

interface AgingResult {
  variants:       Variant[]
  best_match:     SuspectMatch | null
  source_variant: string | null
  all_results:    SuspectMatch[]
  total:          number
}

interface AgingBackendStatus {
  backend: 'sam' | 'opencv'
  sam_ready: boolean
  sam_available: boolean
}

interface AgingPanelProps {
  /** Base64 data-URL of the humanized face from HumanizationPanel */
  humanizedImageUrl: string | null
}

export default function AgingPanel({ humanizedImageUrl }: AgingPanelProps) {
  const [status, setStatus]         = useState<Status>('idle')
  const [result, setResult]         = useState<AgingResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [threshold, setThreshold]   = useState(25)
  const [showAllResults, setShowAllResults] = useState(false)
  const [backendInfo, setBackendInfo] = useState<AgingBackendStatus | null>(null)

  const isLoading = status === 'generating' || status === 'recognizing'

  // Fetch backend status on mount
  useState(() => {
    fetch(`${AI_URL}/api/aging/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBackendInfo(d))
      .catch(() => {})
  })

  const handleRun = async () => {
    if (!humanizedImageUrl) {
      toast.error('Generate a humanized image first (Humanize tab)')
      return
    }

    setStatus('generating')
    setErrorMsg('')
    setResult(null)

    const startMs = Date.now()
    const timer   = setInterval(() => setElapsedSec(Math.round((Date.now() - startMs) / 1000)), 1000)

    try {
      // Strip the data-URL prefix to get raw base64
      const b64 = humanizedImageUrl.split(',')[1]
      if (!b64) throw new Error('Invalid image URL format')

      setStatus('recognizing')

      const res = await fetch(`${AI_URL}/api/aging/recognize-variants`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: b64,
          age_steps:    DEFAULT_STEPS,
          max_faces:    10,
          threshold,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Recognition failed')
      }

      const data: AgingResult = await res.json()
      setResult(data)
      setStatus('done')

      if (data.best_match) {
        toast.success(`Best match: ${data.best_match.name} via ${data.best_match.source_variant} variant`)
      } else {
        toast('No matches found above threshold', { icon: '🔍' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setErrorMsg(msg)
      setStatus('error')
      toast.error(`Aging failed: ${msg}`)
    } finally {
      clearInterval(timer)
    }
  }

  const downloadVariant = (v: Variant) => {
    const a = document.createElement('a')
    a.href     = `data:image/png;base64,${v.image_b64}`
    a.download = `suspectra_aged_${v.age_delta > 0 ? '+' : ''}${v.age_delta}yr_${Date.now()}.png`
    a.click()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h2 className="font-semibold text-white text-sm">Aging Analysis</h2>
          {backendInfo ? (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${
              backendInfo.backend === 'sam'
                ? 'bg-violet-900/40 text-violet-400 border-violet-800'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {backendInfo.backend === 'sam'
                ? <><Sparkles className="w-2.5 h-2.5" /> SAM</>
                : <><Cpu className="w-2.5 h-2.5" /> OpenCV</>
              }
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-xs bg-cyan-900/40 text-cyan-400 border border-cyan-800">
              Age-Invariant
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {backendInfo?.backend === 'sam'
            ? 'SAM (SIGGRAPH 2021) — photorealistic identity-preserving aging'
            : 'Generates 5 age variants and runs recognition across all of them'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Source image */}
        {humanizedImageUrl ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">Source (humanized face)</p>
            <div className="rounded-lg overflow-hidden border border-slate-700 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={humanizedImageUrl} alt="Humanized face" className="w-full object-contain max-h-32" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Humanize the sketch first, then come here to run aging analysis
          </div>
        )}

        {/* Threshold control */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Match threshold</span>
            <span className="text-cyan-400 font-mono">{threshold}%</span>
          </div>
          <input type="range" min={10} max={70} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-500" />
          <p className="text-xs text-slate-600 mt-0.5">Lower = more results, may include weak matches</p>
        </div>

        {/* SAM setup hint when on OpenCV */}
        {backendInfo?.backend === 'opencv' && (
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-0.5">Want photorealistic aging?</p>
            <p>Run <code className="text-violet-400">python scripts/setup_sam.py</code> in <code className="text-slate-400">ai-service/</code> on the GPU laptop to enable SAM (SIGGRAPH 2021).</p>
          </div>
        )}

        {/* Age steps info */}
        <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-500">
          <p className="font-medium text-slate-400 mb-1">Variants generated</p>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_STEPS.map((s) => (
              <span key={s} className={`px-2 py-0.5 rounded text-xs border ${
                s === 0
                  ? 'bg-cyan-900/30 text-cyan-400 border-cyan-800'
                  : 'bg-slate-700 text-slate-400 border-slate-600'
              }`}>
                {stepLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={isLoading || !humanizedImageUrl}
          className={`
            w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2
            transition-all duration-150
            ${isLoading || !humanizedImageUrl
              ? 'bg-cyan-900/40 text-cyan-600 cursor-not-allowed border border-cyan-900'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30'}
          `}
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" />
                {status === 'generating' ? `Generating variants… ${elapsedSec}s` : `Running recognition… ${elapsedSec}s`}
              </>
            : <><Play className="w-4 h-4" /> Run Age-Aware Recognition</>
          }
        </button>

        {/* Error */}
        {status === 'error' && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
            <p className="font-medium mb-1">Failed</p>
            <p className="text-red-500/80">{errorMsg}</p>
            {errorMsg.includes('AI service') || errorMsg.includes('fetch') ? (
              <p className="mt-2 text-slate-500">
                Start AI service: <code className="text-slate-400">uvicorn main:app --port 8001</code>
              </p>
            ) : null}
          </div>
        )}

        {/* Results */}
        {result && status === 'done' && (
          <div className="space-y-4">

            {/* Variant grid */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Age Variants
              </p>
              <div className="grid grid-cols-2 gap-2">
                {result.variants.map((v) => (
                  <div key={v.age_delta}
                    className={`relative rounded-lg overflow-hidden border bg-black group ${
                      result.best_match?.source_variant === `${v.age_delta > 0 ? '+' : ''}${v.age_delta}`
                        ? 'border-cyan-500/70 ring-1 ring-cyan-500/40'
                        : 'border-slate-700'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/png;base64,${v.image_b64}`}
                      alt={`Age ${v.age_delta > 0 ? '+' : ''}${v.age_delta}`}
                      className="w-full object-contain"
                    />
                    {/* Label overlay */}
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 text-center">
                      <span className={`text-xs font-medium ${
                        v.age_delta === 0 ? 'text-cyan-400' : 'text-slate-300'
                      }`}>
                        {stepLabel(v.age_delta)}
                      </span>
                    </div>
                    {/* Best variant badge */}
                    {result.best_match?.source_variant === `${v.age_delta > 0 ? '+' : ''}${v.age_delta}` && (
                      <div className="absolute top-1 right-1">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-600 text-white text-xs font-bold">
                          Best
                        </span>
                      </div>
                    )}
                    {/* Face not detected warning */}
                    {!v.face_found && (
                      <div className="absolute top-1 left-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 text-xs">
                          No face
                        </span>
                      </div>
                    )}
                    {/* Download on hover */}
                    <button
                      onClick={() => downloadVariant(v)}
                      className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity
                                 p-1 rounded bg-black/60 text-slate-300 hover:text-white"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Best match card */}
            {result.best_match ? (
              <div className="p-3 rounded-xl border border-cyan-700/50 bg-cyan-950/30 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Best Match</p>
                  <span className="ml-auto text-xs text-slate-500">
                    via {result.best_match.source_variant} variant
                  </span>
                </div>

                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-white">{result.best_match.name}</p>
                  {result.best_match.age && (
                    <p className="text-xs text-slate-400">
                      Age: {result.best_match.age}
                      {result.best_match.gender ? ` · ${result.best_match.gender}` : ''}
                    </p>
                  )}
                  {result.best_match.crime_type && (
                    <p className="text-xs text-slate-400">Crime: {result.best_match.crime_type}</p>
                  )}
                </div>

                {/* Score bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">ArcFace score</span>
                    <span className="text-cyan-400 font-mono font-semibold">
                      {result.best_match.final_score.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(result.best_match.final_score, 100)}%` }}
                    />
                  </div>
                </div>

                {result.best_match.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">{result.best_match.description}</p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40 text-center">
                <p className="text-xs text-slate-500">No suspects matched above {threshold}% threshold.</p>
                <p className="text-xs text-slate-600 mt-0.5">Try lowering the threshold.</p>
              </div>
            )}

            {/* All results (collapsible) */}
            {result.all_results.length > 1 && (
              <div>
                <button
                  onClick={() => setShowAllResults(!showAllResults)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showAllResults ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAllResults ? 'Hide' : 'Show'} all {result.all_results.length} candidates
                </button>

                {showAllResults && (
                  <div className="mt-2 space-y-1.5">
                    {result.all_results.map((m, i) => (
                      <div key={m.suspect_id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700"
                      >
                        <span className="text-xs text-slate-600 font-mono w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{m.name}</p>
                          <p className="text-xs text-slate-600">via {m.source_variant} · {m.final_score.toFixed(1)}%</p>
                        </div>
                        <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden shrink-0">
                          <div
                            className="h-full bg-cyan-600 rounded-full"
                            style={{ width: `${Math.min(m.final_score, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
