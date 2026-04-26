'use client'

import { X, Trophy, Download, ChevronDown, ChevronUp, AlertTriangle, User, Cpu, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { PipelineResult, PipelineVariant } from '@/types'

const stepLabel = (delta: number): string => {
  const m: Partial<Record<number, string>> = {
    [-20]: '−20 yrs', [-10]: '−10 yrs', [0]: 'Current', [10]: '+10 yrs', [20]: '+20 yrs',
  }
  return m[delta] ?? `${delta > 0 ? '+' : ''}${delta} yrs`
}

interface PipelineResultsPanelProps {
  humanizedUrl:  string | null
  result:        PipelineResult
  onClose:       () => void
}

export default function PipelineResultsPanel({ humanizedUrl, result, onClose }: PipelineResultsPanelProps) {
  const [showAll, setShowAll] = useState(false)

  const downloadVariant = (v: PipelineVariant) => {
    const a = document.createElement('a')
    a.href     = `data:image/png;base64,${v.imageb64}`
    a.download = `aged_${v.ageDelta > 0 ? '+' : ''}${v.ageDelta}yr.png`
    a.click()
  }

  const downloadHumanized = () => {
    if (!humanizedUrl) return
    const a = document.createElement('a')
    a.href     = humanizedUrl
    a.download = `humanized_${Date.now()}.png`
    a.click()
  }

  const best = result.bestMatch

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm">

      {/* Panel — right side */}
      <div className="ml-auto w-full max-w-2xl h-full flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
          <div>
            <h2 className="font-bold text-white text-lg">Pipeline Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {result.backend === 'sam'
                ? <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-400" /> SAM aging</span>
                : <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-slate-400" /> OpenCV aging</span>
              }
              {' · '}{result.variants.length} variants · {result.totalMatches} candidate{result.totalMatches !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">

          {/* Error state */}
          {result.error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{result.error}</span>
            </div>
          )}

          {/* Step 1 — Humanized face */}
          {humanizedUrl && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Step 1 — Humanized Face
                </h3>
                <button onClick={downloadHumanized}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-black inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={humanizedUrl} alt="Humanized" className="max-h-52 object-contain" />
              </div>
            </section>
          )}

          {/* Step 2 — Age variants grid */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Step 2 — Age Variants
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {result.variants.map((v) => {
                const isBest = result.sourceVariant === `${v.ageDelta > 0 ? '+' : ''}${v.ageDelta}` ||
                               result.sourceVariant === String(v.ageDelta)
                return (
                  <div key={v.ageDelta}
                    className={`relative rounded-lg overflow-hidden border group cursor-pointer bg-black ${
                      isBest ? 'border-cyan-500/80 ring-1 ring-cyan-500/40' : 'border-slate-700'
                    }`}
                    onClick={() => downloadVariant(v)}
                    title="Click to download"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:image/png;base64,${v.imageb64}`}
                      alt={stepLabel(v.ageDelta)} className="w-full object-contain" />
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-center">
                      <span className={`text-xs font-medium ${isBest ? 'text-cyan-400' : 'text-slate-300'}`}>
                        {stepLabel(v.ageDelta)}
                      </span>
                    </div>
                    {isBest && (
                      <div className="absolute top-1 right-1">
                        <span className="px-1 py-0.5 rounded bg-cyan-600 text-white text-xs font-bold">Best</span>
                      </div>
                    )}
                    {!v.faceFound && (
                      <div className="absolute top-1 left-1">
                        <span className="px-1 py-0.5 rounded bg-slate-800/80 text-slate-400 text-xs">No face</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">Click any variant to download</p>
          </section>

          {/* Step 3 — Best match */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Step 3 — Recognition Result
            </h3>

            {best ? (
              <div className="p-4 rounded-xl border border-cyan-700/50 bg-cyan-950/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Best Match</span>
                  <span className="ml-auto text-xs text-slate-500">via {best.sourceVariant} variant</span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                    <User className="w-7 h-7 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base">{best.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[best.gender, best.age ? `Age ${best.age}` : null].filter(Boolean).join(' · ')}
                    </p>
                    {best.crimeType && (
                      <p className="text-xs text-amber-400 mt-1">⚠ {best.crimeType}</p>
                    )}
                    {best.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{best.description}</p>
                    )}
                  </div>
                </div>

                {/* Score bars */}
                <div className="space-y-2 pt-1">
                  {[
                    { label: 'Final Score',   value: best.finalScore,     color: 'bg-cyan-500' },
                    { label: 'ArcFace Score', value: best.embeddingScore, color: 'bg-violet-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-slate-300 font-mono font-semibold">{value.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min(value, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-slate-700 bg-slate-800/40 text-center space-y-1">
                <p className="text-slate-400 text-sm">No suspects matched above threshold</p>
                <p className="text-slate-600 text-xs">Try lowering the threshold or use a more detailed sketch</p>
              </div>
            )}
          </section>

          {/* All candidates (collapsible) */}
          {result.totalMatches > 1 && (
            <section>
              <button onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAll ? 'Hide' : 'Show'} all {result.totalMatches} candidates
              </button>

              {showAll && (
                <div className="mt-3 space-y-2">
                  {result.variants.flatMap(v => v.matches).reduce((acc, m) => {
                    // De-dup by suspectId keeping highest score
                    const existing = acc.find(x => x.suspectId === m.suspectId)
                    if (!existing || m.finalScore > existing.finalScore) {
                      return [...acc.filter(x => x.suspectId !== m.suspectId), m]
                    }
                    return acc
                  }, [] as typeof result.variants[0]['matches'])
                    .sort((a, b) => b.finalScore - a.finalScore)
                    .map((m, i) => (
                      <div key={m.suspectId}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
                        <span className="text-xs text-slate-600 font-mono w-4 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{m.name}</p>
                          <p className="text-xs text-slate-600">via {m.sourceVariant} · {m.finalScore.toFixed(1)}%</p>
                        </div>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-cyan-600 rounded-full"
                            style={{ width: `${Math.min(m.finalScore, 100)}%` }} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
