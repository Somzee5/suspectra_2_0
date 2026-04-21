'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, Mail } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }

    setLoading(true)
    try {
      await authApi.sendOtp(email)
      toast.success('OTP sent to your email')
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            SUSPECTRA
            <span className="text-cyan-400"> 2.0</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Forensic Sketch Recognition Platform</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Investigator Login</h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter your registered email to receive a one-time passcode.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Input
                label="Email Address"
                type="email"
                placeholder="investigator@agency.gov"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                error={error}
                autoComplete="email"
                autoFocus
              />
              <Mail className="absolute right-3 top-9 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Send OTP
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          AUTHORIZED PERSONNEL ONLY — All activity is logged and monitored.
        </p>
      </div>
    </main>
  )
}
