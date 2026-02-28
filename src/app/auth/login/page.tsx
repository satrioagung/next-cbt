'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email atau password salah. Silakan coba lagi.')
      setLoading(false)
      return
    }

    if (data.session) {
      // Check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single()

      if (profile?.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/exam')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{backgroundImage: 'radial-gradient(circle at 1px 1px, #f59e0b 1px, transparent 0)', backgroundSize: '40px 40px'}} />
      
      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4 rotate-3">
            <svg className="w-8 h-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-100 mb-1">UTS Essay</h1>
          <p className="text-slate-400 text-sm">Sistem Ujian Tengah Semester</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display text-xl font-semibold text-slate-100 mb-6">Masuk ke Akun</h2>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="mahasiswa@email.com"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Masuk...</span>
                </>
              ) : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Belum punya akun?{' '}
              <Link href="/auth/register" className="text-amber-400 hover:text-amber-300 font-medium">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2024 UTS Essay System
        </p>
      </div>
    </div>
  )
}
