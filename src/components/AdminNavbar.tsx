'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = { adminName?: string; onProfileClick?: () => void }

const NAV = [
  {
    label: 'Siswa',
    href: '/admin',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    label: 'Bank Soal',
    href: '/admin/bank-soal',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    label: 'Akademik',
    href: '/admin/akademik',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
]

export default function AdminNavbar({ adminName, onProfileClick }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <>
      {/* Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <button onClick={() => router.push('/admin')} className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <span className="font-semibold text-slate-100 text-sm hidden sm:block">Admin UTS SMK Bintang Sembilan</span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map(n => (
                <button key={n.href} onClick={() => router.push(n.href)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(n.href) ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                  }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon}/>
                  </svg>
                  {n.label}
                </button>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-1.5">
              <button onClick={onProfileClick}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition-colors">
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-slate-950 flex-shrink-0">
                  {adminName?.[0]?.toUpperCase() || 'A'}
                </div>
                <span className="hidden sm:block text-slate-300 text-sm max-w-[90px] truncate">{adminName || 'Admin'}</span>
              </button>
              <button onClick={logout}
                className="hidden md:flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Keluar
              </button>
              {/* Hamburger */}
              <button onClick={() => setOpen(p => !p)}
                className="md:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                {open
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1">
            {NAV.map(n => (
              <button key={n.href} onClick={() => { router.push(n.href); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(n.href) ? 'bg-amber-500/15 text-amber-400' : 'text-slate-300 hover:bg-slate-800'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.icon}/>
                </svg>
                {n.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-800">
              <button onClick={() => { logout(); setOpen(false) }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Keluar
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800">
        <div className="flex">
          {NAV.map(n => (
            <button key={n.href} onClick={() => router.push(n.href)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-xs font-medium transition-colors ${
                isActive(n.href) ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive(n.href) ? 2.5 : 1.5} d={n.icon}/>
              </svg>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}