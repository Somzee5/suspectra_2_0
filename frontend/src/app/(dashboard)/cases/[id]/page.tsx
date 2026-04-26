'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Shield, ChevronLeft, FolderOpen, Pencil, Clock, Search,
  Trophy, Loader2, AlertTriangle, User, Play
} from 'lucide-react'
import { casesApi, recognitionApi, agingApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import type { AgingRunSummary, RecognitionRunSummary } from '@/types'

interface CaseDetail {
  id: string; title: string; description: string; status: string
  createdBy: { name: string; email: string }; createdAt: string; updatedAt: string
}

const STATUS_COLOR: Record<string, string> = {
  OPEN:        'bg-green-900/30 text-green-400 border-green-800',
  IN_PROGRESS: 'bg-blue-900/30 text-blue-400 border-blue-800',
  CLOSED:      'bg-slate-800 text-slate-400 border-slate-700',
  ARCHIVED:    'bg-slate-900 text-slate-600 border-slate-800',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 60)   return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h   < 24)   return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id as string

  const [caseData, setCaseData]       = useState<CaseDetail | null>(null)
  const [recRuns, setRecRuns]         = useState<RecognitionRunSummary[]>([])
  const [agingRuns, setAgingRuns]     = useState<AgingRunSummary[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!getUser()) { router.replace('/login'); return }
    if (!caseId) return

    Promise.all([
      casesApi.getById(caseId),
      recognitionApi.getByCase(caseId),
      agingApi.getByCase(caseId),
    ])
      .then(([caseRes, recRes, agingRes]) => {
        setCaseData(caseRes.data.data)
        setRecRuns(recRes.data.data ?? [])
        setAgingRuns(agingRes.data.data ?? [])
      })
      .catch(() => toast.error('Failed to load case — is the backend running?'))
      .finally(() => setLoading(false))
  }, [caseId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-500">
        <AlertTriangle className="w-12 h-12 opacity-30" />
        <p>Case not found</p>
        <Link href="/dashboard" className="text-cyan-400 hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    )
  }

  const totalRuns = recRuns.length + agingRuns.length

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span className="font-bold text-white tracking-wide">SUSPECTRA <span className="text-cyan-400">2.0</span></span>
            </div>
          </div>
          <Link href={`/sketch?caseId=${caseId}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors">
            <Pencil className="w-4 h-4" /> Open Sketch
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Case header */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-slate-800 shrink-0">
                <FolderOpen className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{caseData.title}</h1>
                {caseData.description && (
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">{caseData.description}</p>
                )}
                <p className="text-xs text-slate-600 mt-2">
                  Created by {caseData.createdBy?.name} · {new Date(caseData.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-lg text-xs font-medium border shrink-0 ${STATUS_COLOR[caseData.status] ?? ''}`}>
              {caseData.status}
            </span>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800">
            {[
              { label: 'Recognition Runs', value: recRuns.length,   icon: Search },
              { label: 'Aging Runs',        value: agingRuns.length, icon: Clock  },
              { label: 'Total Runs',         value: totalRuns,        icon: Play   },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Aging runs (pipeline results) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" /> Age-Invariant Recognition
              </h2>
              <span className="text-xs text-slate-500">{agingRuns.length} run{agingRuns.length !== 1 ? 's' : ''}</span>
            </div>

            {agingRuns.length === 0 ? (
              <div className="card p-8 flex flex-col items-center text-slate-600 text-center gap-2">
                <Clock className="w-10 h-10 opacity-20" />
                <p className="text-sm">No pipeline runs yet</p>
                <Link href={`/sketch?caseId=${caseId}`}
                  className="text-xs text-cyan-400 hover:underline">Run Full Pipeline →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {agingRuns.map((run) => (
                  <div key={run.id} className="card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{timeAgo(run.createdAt)}</span>
                      <span className="text-xs text-slate-600">
                        {run.totalMatches} candidate{run.totalMatches !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {run.bestMatch ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-950/30 border border-cyan-900/50">
                        <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{run.bestMatch.name}</p>
                          <p className="text-xs text-slate-500">
                            via {run.bestMatch.sourceVariant} · {run.bestMatch.finalScore.toFixed(1)}%
                          </p>
                        </div>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${Math.min(run.bestMatch.finalScore, 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">No match above threshold</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Standard recognition runs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400" /> Recognition Runs
              </h2>
              <span className="text-xs text-slate-500">{recRuns.length} run{recRuns.length !== 1 ? 's' : ''}</span>
            </div>

            {recRuns.length === 0 ? (
              <div className="card p-8 flex flex-col items-center text-slate-600 text-center gap-2">
                <Search className="w-10 h-10 opacity-20" />
                <p className="text-sm">No recognition runs yet</p>
                <Link href="/recognition" className="text-xs text-cyan-400 hover:underline">
                  Go to Recognition →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recRuns.map((run) => (
                  <div key={run.id} className="card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{timeAgo(run.createdAt)}</span>
                      <span className="text-xs text-slate-600">
                        {run.total} match{run.total !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    {run.matches?.slice(0, 2).map((m) => (
                      <div key={m.suspectId} className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-300 flex-1 truncate">{m.name}</span>
                        <span className="text-xs text-amber-400 font-mono">{m.finalScore.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  )
}
