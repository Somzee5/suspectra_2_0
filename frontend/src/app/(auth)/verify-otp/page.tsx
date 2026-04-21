'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Shield, ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import { authApi } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import type { AuthResponse } from '@/types'

function VerifyOtpContent() {
  const router      = useRouter()
  const params      = useSearchParams()
  const email       = params.get('email') || ''
  const inputsRef   = useRef<(HTMLInputElement | null)[]>([])
  const [otp, setOtp]       = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)

  useEffect(() => {
    if (!email) router.replace('/login')
    inputsRef.current[0]?.focus()
  }, [email, router])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleChange = (idx: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[idx] = value
    setOtp(next)
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus()
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...otp]
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    inputsRef.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < 6) { toast.error('Enter all 6 digits'); return }

    setLoading(true)
    try {
      const res = await authApi.verifyOtp(email, code)
      const { token, user } = res.data.data as AuthResponse
      setAuth(token, user)
      toast.success(`Welcome, ${user.name}!`)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg || 'Invalid or expired OTP')
      setOtp(Array(6).fill(''))
      inputsRef.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await authApi.sendOtp(email)
      toast.success('New OTP sent')
      setCountdown(60)
      setOtp(Array(6).fill(''))
      inputsRef.current[0]?.focus()
    } catch {
      toast.error('Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-4">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            SUSPECTRA<span className="text-cyan-400"> 2.0</span>
          </h1>
        </div>

        <div className="card p-8">
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to login
          </button>

          <h2 className="text-lg font-semibold text-white">Verify Identity</h2>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Enter the 6-digit OTP sent to{' '}
            <span className="text-cyan-400 font-mono">{maskedEmail}</span>
          </p>

          {/* OTP inputs */}
          <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputsRef.current[idx] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="
                  w-12 h-14 text-center text-xl font-bold font-mono
                  rounded-xl border border-slate-700 bg-slate-800/60
                  text-cyan-400 caret-cyan-400
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
                  transition-all duration-150
                "
              />
            ))}
          </div>

          <Button size="lg" loading={loading} onClick={handleVerify} className="w-full mb-4">
            Verify & Login
          </Button>

          <div className="text-center text-sm text-slate-500">
            {countdown > 0 ? (
              <span>Resend OTP in <span className="text-cyan-400 font-mono">{countdown}s</span></span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend OTP'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpContent />
    </Suspense>
  )
}
