'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Shield, Search, ImageIcon, Loader2, AlertCircle,
  ChevronLeft, Info
} from 'lucide-react'
import { casesApi, recognitionApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import Button from '@/components/ui/Button'
import SuspectCard, { type SuspectMatch } from '@/components/recognition/SuspectCard'

interface CaseOption { id: string; title: string }

export default function RecognitionPage() {
  const router       = useRouter()
  const params       = useSearchParams()
  const fileRef      = useRef<HTMLInputElement>(null)

  const [cases, setCases]           = useState<CaseOption[]>([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [caseId, setCaseId]         = useState(params.get('caseId') ?? '')
  const [imageB64, setImageB64]     = useState('')
  const [preview, setPreview]       = useState('')
  const [running, setRunning]       = useState(false)
  const [matches, setMatches]       = useState<SuspectMatch[] | null>(null)
  const [runError, setRunError]     = useState('')
  const [runId, setRunId]           = useState('')

  useEffect(() => {
    if (!getUser()) { router.replace('/login'); return }
    casesApi.getAll(0, 100)
      .then((res) => {
        const content = res.data.data?.content ?? []
        setCases(content.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })))
      })
      .catch(() => toast.error('Could not load cases — is the backend running?'))
      .finally(() => setCasesLoading(false))
  }, [router])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      const b64 = dataUrl.split(',')[1]
      setImageB64(b64)
      setMatches(null)
      setRunError('')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) handleFile(file)
  }

  const handleRun = async () => {
    if (!caseId)    { toast.error('Select a case first'); return }
    if (!imageB64)  { toast.error('Upload a face image first'); return }

    setRunning(true)
    setMatches(null)
    setRunError('')

    try {
      const res    = await recognitionApi.run(caseId, imageB64)
      const result = res.data.data as {
        id: string; matches: SuspectMatch[]; total: number; error?: string
      }

      setRunId(result.id ?? '')
      if (result.error) {
        setRunError(result.error)
      } else {
        setMatches(result.matches ?? [])
        if (result.total === 0) {
          toast('No suspects matched above the threshold.', { icon: 'ℹ️' })
        } else {
          toast.success(`Found ${result.total} potential match${result.total > 1 ? 'es' : ''}`)
        }
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Recognition failed'
      setRunError(msg)
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <span className="font-bold text-white tracking-wide">
                SUSPECTRA <span className="text-cyan-400">2.0</span>
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Suspect Recognition</h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload the AI-humanized face image to search the suspect database via AWS Rekognition
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left panel: controls ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Case selector */}
            <div className="card p-4 space-y-2">
              <label className="text-sm font-medium text-slate-300">Link to Case</label>

              {casesLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span className="text-sm text-slate-500">Loading cases…</span>
                </div>
              ) : cases.length === 0 ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-500">
                    No cases found
                  </div>
                  <Link
                    href="/dashboard"
                    className="block text-center text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    + Create a case from the Dashboard first
                  </Link>
                </div>
              ) : (
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2
                             text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">— select a case ({cases.length} available) —</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Image upload */}
            <div className="card p-4 space-y-3">
              <label className="text-sm font-medium text-slate-300">Humanized Face Image</label>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col
                           items-center justify-center gap-3 cursor-pointer
                           hover:border-cyan-500/50 hover:bg-slate-800/40 transition-all"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="preview" className="max-h-52 rounded-lg object-contain" />
                ) : (
                  <>
                    <ImageIcon className="w-10 h-10 text-slate-600" />
                    <p className="text-sm text-slate-500 text-center">
                      Drop image here or <span className="text-cyan-400">browse</span>
                    </p>
                    <p className="text-xs text-slate-600">Use the humanized output from the Sketch page</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {preview && (
                <button
                  onClick={() => { setPreview(''); setImageB64(''); setMatches(null) }}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear image
                </button>
              )}
            </div>

            {/* Info banner */}
            <div className="flex gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300 leading-relaxed">
                For best results, use the <strong>AI-humanized</strong> image (from the Sketch page
                Humanize tab), not the raw sketch. AWS Rekognition is trained on real face photos.
              </p>
            </div>

            <Button className="w-full" onClick={handleRun} loading={running} disabled={!imageB64 || !caseId}>
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching database…</>
                : <><Search className="w-4 h-4" /> Run Recognition</>}
            </Button>
          </div>

          {/* ── Right panel: results ─────────────────────────────────── */}
          <div className="lg:col-span-3">
            {runError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{runError}</span>
              </div>
            )}

            {matches === null && !running && (
              <div className="h-full flex flex-col items-center justify-center py-24 text-slate-600">
                <Search className="w-14 h-14 mb-4 opacity-30" />
                <p className="text-sm">Upload an image and click Run Recognition</p>
              </div>
            )}

            {running && (
              <div className="h-full flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
                <p className="text-sm">Searching AWS Rekognition collection…</p>
              </div>
            )}

            {matches !== null && !running && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">
                    {matches.length > 0
                      ? `Top ${matches.length} Match${matches.length > 1 ? 'es' : ''}`
                      : 'No Matches Found'}
                  </h2>
                  {runId && (
                    <span className="text-xs text-slate-600">Run ID: {runId.slice(0, 8)}…</span>
                  )}
                </div>

                {matches.length === 0 ? (
                  <div className="card p-8 flex flex-col items-center text-slate-500 text-center">
                    <Search className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No suspects matched above the 40% similarity threshold.</p>
                    <p className="text-xs mt-1">Try a clearer humanized image or lower the threshold.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {matches.map((m, i) => (
                      <SuspectCard key={m.suspectId} match={m} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
