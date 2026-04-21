'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Shield, FolderOpen, FileSearch, LogOut, Plus, User, Pencil, X, Loader2 } from 'lucide-react'
import { getUser, clearAuth } from '@/lib/auth'
import { casesApi } from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import type { User as UserType } from '@/types'

interface CaseDto {
  id: string
  title: string
  description: string
  status: string
  createdBy: { id: string; email: string; name: string; role: string }
  createdAt: string
  updatedAt: string
}

interface PageData<T> { content: T[]; totalElements: number; totalPages: number }

const STATUS_BADGE: Record<string, string> = {
  OPEN:        'badge badge-open',
  IN_PROGRESS: 'badge badge-in-progress',
  CLOSED:      'badge badge-closed',
  ARCHIVED:    'badge badge-archived',
}

export default function DashboardPage() {
  const router  = useRouter()
  const [user, setUser]     = useState<UserType | null>(null)
  const [cases, setCases]   = useState<CaseDto[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  // New Case form
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [creating, setCreating] = useState(false)
  const [titleErr, setTitleErr] = useState('')

  useEffect(() => {
    const u = getUser()
    if (!u) { router.replace('/login'); return }
    setUser(u)
    fetchCases()
  }, [router])

  const fetchCases = async () => {
    setLoading(true)
    try {
      const res  = await casesApi.getAll(0, 6)
      const page = res.data.data as PageData<CaseDto>
      setCases(page.content ?? [])
    } catch {
      toast.error('Failed to load cases — is the backend running?')
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setTitleErr('Title is required'); return }
    setTitleErr('')
    setCreating(true)
    try {
      await casesApi.create({ title: title.trim(), description: desc.trim() })
      toast.success('Case created')
      setShowModal(false)
      setTitle('')
      setDesc('')
      fetchCases()
    } catch {
      toast.error('Failed to create case')
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = () => { clearAuth(); router.push('/login') }

  const openCount  = cases.filter((c) => c.status === 'OPEN').length
  const inProgCount = cases.filter((c) => c.status === 'IN_PROGRESS').length

  const stats = [
    { label: 'Total Cases',   value: cases.length, icon: FolderOpen, color: 'text-cyan-400'  },
    { label: 'Open Cases',    value: openCount,     icon: FileSearch, color: 'text-amber-400' },
    { label: 'In Progress',   value: inProgCount,   icon: Shield,     color: 'text-blue-400'  },
  ]

  return (
    <div className="min-h-screen bg-slate-950">

      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-cyan-400" />
            <span className="font-bold text-white tracking-wide">SUSPECTRA <span className="text-cyan-400">2.0</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <User className="w-4 h-4" />
              <span>{user?.name}</span>
              <span className="px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-400 text-xs border border-cyan-800">
                {user?.role}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Investigative Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Manage cases, sketches, and recognition results</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" /> New Case
            </Button>
            <Link href="/sketch">
              <Button><Pencil className="w-4 h-4" /> New Sketch</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="card p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-800">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-sm text-slate-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cases table */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Cases</h2>
            <span className="text-xs text-slate-500">{cases.length} cases</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="mb-3">No cases yet. Create your first investigation.</p>
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4" /> New Case
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {cases.map((c) => (
                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString()} · {c.createdBy?.name ?? 'Unknown'}
                    </p>
                    {c.description && (
                      <p className="text-xs text-slate-600 mt-0.5 truncate max-w-md">{c.description}</p>
                    )}
                  </div>
                  <span className={STATUS_BADGE[c.status] ?? 'badge'}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Case Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">New Investigation Case</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <Input
                label="Case Title"
                placeholder="e.g. Robbery — MG Road 21-Apr"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleErr('') }}
                error={titleErr}
                autoFocus
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Description <span className="text-slate-600">(optional)</span></label>
                <textarea
                  rows={3}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Brief description of the incident…"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5
                             text-sm text-slate-100 placeholder:text-slate-500 resize-none
                             focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" type="submit" loading={creating}>
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Case'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
