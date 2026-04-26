'use client'

import { useEffect, useState } from 'react'
import { Clock, Play, AlertTriangle, Loader2, Download, Trophy, ChevronDown, ChevronUp, Cpu, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const AI_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001'

type Status = 'idle' | 'generating' | 'done' | 'error'

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
  variants:    { age_delta: number; image_b64: string; face_found: boolean; matches: SuspectMatch[] }[]
  best_match:  SuspectMatch | null
  all_results: SuspectMatch[]
  total:       number
}

interface AgingBackendStatus {
  backend: 'sam' | 'opencv'
  sam_available: boolean
}

interface AgingPanelProps {
  humanizedImageUrl: string | null
}

function deltaLabel(delta: number): string {
  if (delta === 0)  return 'Current age'
  if (delta > 0)    return `+${delta} years older`
  return `${delta} years younger`
}

export default function AgingPanel({ humanizedImageUrl }: AgingPanelProps) {
  const [delta, setDelta]           = useState(0)
  const [status, setStatus]         = useState<Status>('idle')
  const [result, setResult]         = useState<AgingResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [threshold, setThreshold]   = useState(25)
  const [showAllResults, setShowAll] = useState(false)
  const [backendInfo, setBackendInfo] = useState<AgingBackendStatus | null>(null)

  const isLoading = status === 'generating'

  useEffect(() => {
    fetch(`${AI_URL}/api/aging/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBackendInfo(d))
      .catch(() => {})
  }, [])

  const handleApply = async () => {
    if (!humanizedImageUrl) {
      toast.error('Generate a humanized image first (Humanize tab)')
      return
    }

    setStatus('generating')
    setErrorMsg('')
    setResult(null)

    const startMs = Date.now()
    const timer = setInterval(() => setElapsedSec(Math.round((Date.now() - startMs) / 1000)), 1000)

    try {
      const b64 = humanizedImageUrl.split(',')[1]
      if (!b64) throw new Error('Invalid image URL')

      const res = await fetch(`${AI_URL}/api/aging/recognize-variants`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: b64,
          age_steps:    [delta],      // single delta only
          max_faces:    10,
          threshold,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Failed')
      }

      const data: AgingResult = await res.json()
      setResult(data)
      setStatus('done')

      if (data.best_match) {
        toast.success(`Match: ${data.best_match.name} (${data.best_match.final_score.toFixed(1)}%)`)
      } else {
        toast('No suspects matched', { icon: '🔍' })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setErrorMsg(msg)
      setStatus('error')
      toast.error(msg)
    } finally {
      clearInterval(timer)
    }
  }

  const variant = result?.variants[0] ?? null

  const downloadResult = () => {
    if (!variant) return
    const a = document.createElement('a')
    a.href     = `data:image/png;base64,${variant.image_b64}`
    a.download = `aged_${delta > 0 ? '+' : ''}${delta}yr.png`
    a.click()
  }

  // Slider fill percentage (maps -20→+20 to 0%→100%)
  const fillPct = ((delta + 20) / 40) * 100

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h2 className="font-semibold text-white text-sm">Aging Analysis</h2>
          {backendInfo && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${
              backendInfo.backend === 'sam'
                ? 'bg-violet-900/40 text-violet-400 border-violet-800'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {backendInfo.backend === 'sam'
                ? <><Sparkles className="w-2.5 h-2.5" /> SAM</>
                : <><Cpu className="w-2.5 h-2.5" /> OpenCV</>}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Adjust age, generate one image, run recognition
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Source image / placeholder */}
        {humanizedImageUrl ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-medium">Source face</p>
            <div className="rounded-lg overflow-hidden border border-slate-700 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={humanizedImageUrl} alt="Source" className="w-full object-contain max-h-28" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Humanize the sketch first, then adjust age here
          </div>
        )}

        {/* ── Age slider (the "volume bar") ─────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Younger</span>
            <span className={`font-semibold px-2 py-0.5 rounded ${
              delta === 0
                ? 'text-cyan-400 bg-cyan-900/30'
                : delta > 0
                  ? 'text-amber-400 bg-amber-900/20'
                  : 'text-blue-400 bg-blue-900/20'
            }`}>
              {deltaLabel(delta)}
            </span>
            <span className="text-slate-500">Older</span>
          </div>

          {/* Track with gradient fill */}
          <div className="relative h-6 flex items-center">
            {/* Background track */}
            <div className="absolute inset-x-0 h-2 rounded-full bg-slate-700" />
            {/* Coloured fill from centre */}
            {delta !== 0 && (
              <div
                className={`absolute h-2 rounded-full ${delta > 0 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={
                  delta > 0
                    ? { left: '50%', width: `${(delta / 20) * 50}%` }
                    : { right: '50%', width: `${(Math.abs(delta) / 20) * 50}%` }
                }
              />
            )}
            {/* Centre marker */}
            <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-3 bg-slate-500 rounded-full z-10" />
            {/* Range input */}
            <input
              type="range"
              min={-20} max={20} step={1}
              value={delta}
              onChange={e => { setDelta(Number(e.target.value)); setResult(null) }}
              className="relative w-full appearance-none bg-transparent cursor-pointer z-20
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-5
                         [&::-webkit-slider-thumb]:h-5
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-white
                         [&::-webkit-slider-thumb]:border-2
                         [&::-webkit-slider-thumb]:border-slate-400
                         [&::-webkit-slider-thumb]:shadow-lg
                         [&::-webkit-slider-thumb]:cursor-grab"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>−20</span>
            <span>0</span>
            <span>+20</span>
          </div>
        </div>

        {/* Match threshold */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Match threshold</span>
            <span className="text-cyan-400 font-mono">{threshold}%</span>
          </div>
          <input type="range" min={10} max={70} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full h-1.5 accent-cyan-500" />
        </div>

        {/* Apply button */}
        <button
          onClick={handleApply}
          disabled={isLoading || !humanizedImageUrl}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2
            transition-all duration-150
            ${isLoading || !humanizedImageUrl
              ? 'bg-cyan-900/40 text-cyan-600 cursor-not-allowed border border-cyan-900'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30'}`}
        >
          {isLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating… {elapsedSec}s</>
            : <><Play className="w-4 h-4" /> Apply &amp; Recognise</>}
        </button>

        {/* Error */}
        {status === 'error' && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs">
            <p className="font-medium mb-1">Failed</p>
            <p className="text-red-500/80">{errorMsg}</p>
          </div>
        )}

        {/* Result — single image */}
        {status === 'done' && variant && (
          <div className="space-y-3">

            {/* Generated image */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {deltaLabel(variant.age_delta)}
                </p>
                <button onClick={downloadResult}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                  <Download className="w-3 h-3" /> Save
                </button>
              </div>
              <div className={`rounded-xl overflow-hidden border bg-black ${
                variant.face_found ? 'border-cyan-700/40' : 'border-slate-700'
              }`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${variant.image_b64}`}
                  alt="Aged face" className="w-full object-contain" />
              </div>
              {!variant.face_found && (
                <p className="text-xs text-amber-500 text-center">No face detected — recognition may be limited</p>
              )}
            </div>

            {/* Best match */}
            {result?.best_match ? (
              <div className="p-3 rounded-xl border border-cyan-700/50 bg-cyan-950/30 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Best Match</span>
                </div>
                <p className="text-sm font-bold text-white">{result.best_match.name}</p>
                {(result.best_match.age || result.best_match.gender) && (
                  <p className="text-xs text-slate-400">
                    {[result.best_match.gender, result.best_match.age ? `Age ${result.best_match.age}` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
                {result.best_match.crime_type && (
                  <p className="text-xs text-amber-400">⚠ {result.best_match.crime_type}</p>
                )}
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-500">ArcFace score</span>
                    <span className="text-cyan-400 font-mono font-semibold">
                      {result.best_match.final_score.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(result.best_match.final_score, 100)}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40 text-center">
                <p className="text-xs text-slate-500">No suspects matched above {threshold}%</p>
                <p className="text-xs text-slate-600 mt-0.5">Lower the threshold or try a different age</p>
              </div>
            )}

            {/* All candidates (collapsible) */}
            {(result?.all_results.length ?? 0) > 1 && (
              <div>
                <button onClick={() => setShowAll(!showAllResults)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  {showAllResults ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showAllResults ? 'Hide' : 'Show'} all {result!.all_results.length} candidates
                </button>
                {showAllResults && (
                  <div className="mt-2 space-y-1.5">
                    {result!.all_results.map((m, i) => (
                      <div key={m.suspect_id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
                        <span className="text-xs text-slate-600 font-mono w-4 shrink-0">{i + 1}</span>
                        <p className="text-xs text-slate-300 flex-1 truncate">{m.name}</p>
                        <span className="text-xs text-cyan-400 font-mono shrink-0">{m.final_score.toFixed(1)}%</span>
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
