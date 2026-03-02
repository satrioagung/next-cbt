'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type JadwalCard = {
  id: string
  nama: string
  tanggal: string
  waktu_mulai: string
  waktu_selesai: string
  durasi_menit: number
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_nama: string | null
  jumlah_soal: number
  // Status siswa
  status: 'selesai' | 'sedang' | 'belum' | 'mendatang'
  submitted_at: string | null
  token_tersedia: boolean
}

const Ic = ({ d, cls = 'w-5 h-5' }: { d: string; cls?: string }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

export default function HomeSiswa() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [profile, setProfile]   = useState<any>(null)
  const [jadwalList, setJadwal] = useState<JadwalCard[]>([])
  const [today, setToday]       = useState('')

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    if (!prof) { router.push('/auth/login'); return }
    if (prof.role === 'admin') { router.push('/admin'); return }
    setProfile(prof)

    const todayStr = new Date().toISOString().split('T')[0]
    setToday(todayStr)
    await loadJadwal(session.user.id, prof, todayStr)
    setLoading(false)
  }

  const loadJadwal = async (userId: string, prof: any, todayStr: string) => {
    // Cari kelas siswa
    const { data: sk } = await supabase
      .from('siswa_kelas').select('kelas_id').eq('student_id', userId)
    const kelasIds = sk?.map((r: any) => r.kelas_id) || []

    // Ambil jadwal: hari ini dan 7 hari ke depan, yang kelasnya cocok
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]

    let query = supabase
      .from('jadwal_ujian')
      .select(`
        id, nama, tanggal, waktu_mulai, waktu_selesai, durasi_menit, is_active, kelas_id,
        mata_pelajaran:mata_pelajaran_id(nama, kode)
      `)
      .eq('is_active', true)
      .gte('tanggal', todayStr)
      .lte('tanggal', nextWeekStr)
      .order('tanggal').order('waktu_mulai')

    if (kelasIds.length > 0) {
      query = query.in('kelas_id', kelasIds)
    }

    const { data: jadwals } = await query

    if (!jadwals || jadwals.length === 0) { setJadwal([]); return }

    // Ambil sesi ujian siswa
    const jadwalIds = jadwals.map((j: any) => j.id)
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('jadwal_id, is_submitted, submitted_at')
      .eq('student_id', userId)
      .in('jadwal_id', jadwalIds)

    // Ambil jumlah soal per jadwal
    const { data: jadwalSoal } = await supabase
      .from('jadwal_soal')
      .select('jadwal_id, question_id')
      .in('jadwal_id', jadwalIds)

    // Cek token aktif per jadwal
    const { data: tokens } = await supabase
      .from('token_ujian')
      .select('jadwal_id, is_active, expired_at')
      .in('jadwal_id', jadwalIds)
      .eq('is_active', true)

    const now = new Date()
    const cards: JadwalCard[] = jadwals.map((j: any) => {
      const sess = sessions?.find((s: any) => s.jadwal_id === j.id)
      const jumlahSoal = jadwalSoal?.filter((js: any) => js.jadwal_id === j.id).length || 0
      const hasToken = tokens?.some((t: any) => {
        if (t.jadwal_id !== j.id) return false
        if (t.expired_at && new Date(t.expired_at) < now) return false
        return t.is_active
      }) || false

      const jadwalDate = new Date(j.tanggal)
      const isToday = j.tanggal === todayStr

      let status: JadwalCard['status']
      if (sess?.is_submitted) status = 'selesai'
      else if (sess && !sess.is_submitted) status = 'sedang'
      else if (!isToday) status = 'mendatang'
      else status = 'belum'

      return {
        id: j.id,
        nama: j.nama,
        tanggal: j.tanggal,
        waktu_mulai: j.waktu_mulai,
        waktu_selesai: j.waktu_selesai,
        durasi_menit: j.durasi_menit,
        mapel_nama: j.mata_pelajaran?.nama || null,
        mapel_kode: j.mata_pelajaran?.kode || null,
        kelas_nama: null,
        jumlah_soal: jumlahSoal,
        status,
        submitted_at: sess?.submitted_at || null,
        token_tersedia: hasToken,
      }
    })

    setJadwal(cards)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const goToExam = () => router.push('/exam')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const todayCards   = jadwalList.filter((j: any) => j.tanggal === today)
  const upcomingCards = jadwalList.filter((j: any) => j.tanggal > today)

  const StatusBadge = ({ status }: { status: JadwalCard['status'] }) => {
    const map = {
      selesai:   { cls: 'bg-green-500/15 text-green-400 border-green-500/25',  label: '✓ Selesai' },
      sedang:    { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25',  label: '◉ Sedang dikerjakan' },
      belum:     { cls: 'bg-slate-700 text-slate-300 border-slate-600',         label: 'Belum dikerjakan' },
      mendatang: { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25',     label: 'Mendatang' },
    }
    const s = map[status]
    return <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${s.cls}`}>{s.label}</span>
  }

  const JadwalCard = ({ j }: { j: JadwalCard; key?: string | number }) => {
    const isToday = j.tanggal === today
    const canStart = isToday && (j.status === 'belum' || j.status === 'sedang') && j.jumlah_soal > 0
    const showTokenHint = canStart && !j.token_tersedia

    return (
      <div className={`card p-5 transition-all ${j.status === 'selesai' ? 'opacity-75' : ''} ${canStart && j.token_tersedia ? 'border-amber-500/30 hover:border-amber-500/50' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {j.mapel_kode && (
                <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-medium">{j.mapel_kode}</span>
              )}
              <StatusBadge status={j.status} />
            </div>
            <h3 className="font-semibold text-slate-100 leading-tight">{j.nama}</h3>
            {j.mapel_nama && <p className="text-sm text-slate-400 mt-0.5">{j.mapel_nama}</p>}
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1">
            <Ic d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" cls="w-3.5 h-3.5" />
            {isToday ? 'Hari ini' : new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className="flex items-center gap-1">
            <Ic d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" cls="w-3.5 h-3.5" />
            {j.waktu_mulai} – {j.waktu_selesai}
          </span>
          <span className="flex items-center gap-1">
            <Ic d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" cls="w-3.5 h-3.5" />
            {j.durasi_menit} menit
          </span>
          <span className="flex items-center gap-1">
            <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" cls="w-3.5 h-3.5" />
            {j.jumlah_soal} soal
          </span>
        </div>

        {/* Footer */}
        {j.status === 'selesai' && j.submitted_at && (
          <p className="text-xs text-green-400/70">
            Dikumpulkan {new Date(j.submitted_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {canStart && (
          <div className="space-y-2">
            {showTokenHint ? (
              <div className="bg-slate-800/80 rounded-lg px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2">
                <Ic d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" cls="w-4 h-4 flex-shrink-0 text-slate-500" />
                Belum ada token aktif. Tunggu pengawas memberikan token untuk memulai.
              </div>
            ) : (
              <button onClick={goToExam}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {j.status === 'sedang' ? (
                  <><Ic d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" cls="w-4 h-4" />Lanjutkan Ujian</>
                ) : (
                  <><Ic d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" cls="w-4 h-4" />Masukkan Token & Mulai</>
                )}
              </button>
            )}
          </div>
        )}

        {j.status === 'mendatang' && (
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2 text-xs text-blue-400/80">
            Ujian dijadwalkan pada {new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-slate-100 text-sm">Aplikasi UTS SMK Bintang Sembilan</h1>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200">{profile?.full_name}</p>
              <p className="text-xs text-slate-500">{profile?.username || profile?.npm}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-sm font-bold text-slate-950 flex-shrink-0">
              {(profile?.full_name || 'S')[0].toUpperCase()}
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-red-400 text-xs px-2 py-1.5 transition-colors">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
        {/* Sapaan */}
        <div className="mb-6 mt-2">
          <h2 className="text-xl font-semibold text-slate-100">
            Halo, {profile?.full_name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {jadwalList.length === 0
              ? 'Tidak ada ujian dalam waktu dekat.'
              : `${todayCards.length > 0 ? `${todayCards.length} ujian hari ini` : 'Tidak ada ujian hari ini'}${upcomingCards.length > 0 ? `, ${upcomingCards.length} ujian mendatang` : ''}.`}
          </p>
        </div>

        {jadwalList.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" cls="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">Tidak ada jadwal ujian</p>
            <p className="text-slate-600 text-sm mt-1">Hubungi admin jika kamu seharusnya memiliki ujian.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ujian Hari Ini */}
            {todayCards.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Ujian Hari Ini</h3>
                </div>
                <div className="space-y-3">
                  {todayCards.map((j: any) => <JadwalCard key={j.id} j={j} />)}
                </div>
              </section>
            )}

            {/* Ujian Mendatang */}
            {upcomingCards.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Ujian Mendatang</h3>
                </div>
                <div className="space-y-3">
                  {upcomingCards.map((j: any) => <JadwalCard key={j.id} j={j} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}