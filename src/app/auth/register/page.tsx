'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', npm: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (form.password !== form.confirmPassword) {
      setError('Password tidak cocok.')
      return
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, npm: form.npm }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/exam')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5"
        style={{backgroundImage: 'radial-gradient(circle at 1px 1px, #f59e0b 1px, transparent 0)', backgroundSize: '40px 40px'}} />
      
      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4 rotate-3">
            <svg className="w-8 h-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-100 mb-1">UTS Essay</h1>
          <p className="text-slate-400 text-sm">Daftar Akun Mahasiswa</p>
        </div>

        <div className="card p-8">
          <h2 className="font-display text-xl font-semibold text-slate-100 mb-6">Buat Akun Baru</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-6 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nama Lengkap</label>
              <input name="fullName" type="text" value={form.fullName} onChange={handleChange}
                placeholder="Nama lengkap Anda" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">NPM / NIM</label>
              <input name="npm" type="text" value={form.npm} onChange={handleChange}
                placeholder="12345678" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="email@mahasiswa.ac.id" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="Minimal 6 karakter" required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Konfirmasi Password</label>
              <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange}
                placeholder="Ulangi password" required className="input-field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Mendaftar...</span>
                </>
              ) : 'Daftar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Sudah punya akun?{' '}
              <Link href="/auth/login" className="text-amber-400 hover:text-amber-300 font-medium">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
