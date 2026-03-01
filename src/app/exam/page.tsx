'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Question  = { id: string; number: number; question: string }
type Answers   = Record<string, string>
type ExamState = 'token' | 'exam' | 'submitted'

export default function ExamPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [examState, setExamState] = useState<ExamState>('token')
  const [jadwal, setJadwal]       = useState<any>(null)

  // Token
  const [tokenInput, setTokenInput]     = useState('')
  const [tokenError, setTokenError]     = useState('')
  const [tokenLoading, setTokenLoading] = useState(false)

  // Exam
  const [questions, setQuestions]         = useState<Question[]>([])
  const [answers, setAnswers]             = useState<Answers>({})
  const [savedAnswers, setSavedAnswers]   = useState<Set<string>>(new Set())
  const [currentQ, setCurrentQ]           = useState(0)
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState<string | null>(null)
  const [submitting, setSubmitting]       = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [startTime, setStartTime]         = useState<Date | null>(null)
  const [timeLeft, setTimeLeft]           = useState<number | null>(null)

  useEffect(() => { initPage() }, [])

  // Timer
  useEffect(() => {
    if (!startTime || examState !== 'exam' || !jadwal?.durasi_menit) return
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
      const left = jadwal.durasi_menit * 60 - elapsed
      setTimeLeft(left)
      if (left <= 0) handleSubmit(true)
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, examState, jadwal])

  // Auto-save
  const autoSave = useCallback(async (
    questionId: string, text: string, userId: string, jadwalId: string
  ) => {
    if (!text.trim()) return
    setSaving(questionId)
    await supabase.from('answers').upsert(
      { student_id: userId, question_id: questionId, answer_text: text, jadwal_id: jadwalId },
      { onConflict: 'student_id,question_id,jadwal_id' }
    )
    setSavedAnswers(p => new Set(p).add(questionId))
    setSaving(null)
  }, [])

  useEffect(() => {
    if (!user || !questions.length || examState !== 'exam' || !jadwal) return
    const q = questions[currentQ]
    if (!q || !answers[q.id]) return
    const t = setTimeout(() => autoSave(q.id, answers[q.id], user.id, jadwal.id), 1500)
    return () => clearTimeout(t)
  }, [answers, currentQ, questions, user, examState, jadwal, autoSave])

  const initPage = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setUser(session.user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(prof)
    if (prof?.role === 'admin') { router.push('/admin'); return }
    setLoading(false)
  }

  // Token validation
  const validateToken = async () => {
    const token = tokenInput.trim().toUpperCase()
    if (!token) { setTokenError('Masukkan token ujian.'); return }
    if (!user)  { setTokenError('Sesi tidak valid, coba refresh halaman.'); return }
    setTokenLoading(true); setTokenError('')

    // 1. Cari token
    const { data: tok, error: tokErr } = await supabase
      .from('token_ujian')
      .select(`id, token, is_active, expired_at, jadwal_id,
        jadwal:jadwal_id(id, nama, is_active, durasi_menit, kelas_id,
          mata_pelajaran:mata_pelajaran_id(nama, kode),
          kelas:kelas_id(id, nama))`)
      .eq('token', token).eq('is_active', true).maybeSingle()

    if (tokErr || !tok) {
      setTokenError('Token tidak valid atau tidak aktif.')
      setTokenLoading(false); return
    }

    // 2. Cek expiry
    if (tok.expired_at && new Date(tok.expired_at) < new Date()) {
      setTokenError('Token sudah kedaluwarsa.')
      setTokenLoading(false); return
    }

    // 3. Jadwal aktif
    if (!tok.jadwal?.is_active) {
      setTokenError('Jadwal ujian tidak aktif.')
      setTokenLoading(false); return
    }

    // 4. Cek kelas siswa — hanya jika jadwal punya kelas_id
    const kelasId = tok.jadwal?.kelas_id
    if (kelasId) {
      const { data: sk } = await supabase
        .from('siswa_kelas')
        .select('student_id')
        .eq('kelas_id', kelasId).eq('student_id', user.id).maybeSingle()
      if (!sk) {
        // Cek apakah siswa punya kelas sama sekali
        const { data: allSk } = await supabase
          .from('siswa_kelas').select('kelas_id').eq('student_id', user.id)
        if (!allSk?.length) {
          setTokenError('Kamu belum terdaftar di kelas manapun. Hubungi admin untuk ditambahkan ke kelas.')
        } else {
          setTokenError(`Kamu tidak terdaftar di kelas untuk ujian ini (${tok.jadwal?.kelas?.nama || '—'}). Hubungi admin.`)
        }
        setTokenLoading(false); return
      }
    }

    // 5. Sudah submit?
    const { data: done } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('student_id', user.id).eq('jadwal_id', tok.jadwal_id).eq('is_submitted', true).maybeSingle()
    if (done) {
      setTokenError('Kamu sudah mengumpulkan ujian ini.')
      setTokenLoading(false); return
    }

    // 6. Cek soal
    const { data: jadwalSoal } = await supabase
      .from('jadwal_soal')
      .select('question_id, urutan')
      .eq('jadwal_id', tok.jadwal_id).order('urutan')
    if (!jadwalSoal?.length) {
      setTokenError('Jadwal ini belum memiliki soal. Hubungi admin.')
      setTokenLoading(false); return
    }

    setJadwal(tok.jadwal)
    await startExam(tok.jadwal, token, jadwalSoal)
    setTokenLoading(false)
  }

  const startExam = async (
    jadwalData: any, tokenUsed: string,
    jadwalSoal: { question_id: string; urutan: number }[]
  ) => {
    // Cari atau buat sesi
    const { data: existSess } = await supabase
      .from('exam_sessions').select('*')
      .eq('student_id', user.id).eq('jadwal_id', jadwalData.id).maybeSingle()

    let sess = existSess
    if (!sess) {
      const { data: newSess, error: e } = await supabase
        .from('exam_sessions')
        .insert({ student_id: user.id, jadwal_id: jadwalData.id, token_used: tokenUsed })
        .select().single()
      if (e) { setTokenError('Gagal membuat sesi: ' + e.message); return }
      sess = newSess
    }
    setStartTime(new Date(sess?.started_at || Date.now()))

    // Load soal
    const { data: qs } = await supabase
      .from('questions').select('id, number, question').in('id', jadwalSoal.map(j => j.question_id))

    const sorted = jadwalSoal
      .map(j => qs?.find(q => q.id === j.question_id))
      .filter(Boolean) as Question[]
    setQuestions(sorted)

    // Load jawaban lama
    const { data: existing } = await supabase
      .from('answers').select('question_id, answer_text')
      .eq('student_id', user.id).eq('jadwal_id', jadwalData.id)
    const ansMap: Answers = {}
    const savedSet = new Set<string>()
    existing?.forEach(a => {
      ansMap[a.question_id] = a.answer_text || ''
      if (a.answer_text?.trim()) savedSet.add(a.question_id)
    })
    setAnswers(ansMap); setSavedAnswers(savedSet)
    setExamState('exam')
  }

  const handleSubmit = async (auto = false) => {
    if (examState !== 'exam' || !user || !jadwal) return
    setSubmitting(true)
    for (const q of questions) {
      await supabase.from('answers').upsert(
        { student_id: user.id, question_id: q.id, answer_text: answers[q.id] || '', jadwal_id: jadwal.id },
        { onConflict: 'student_id,question_id,jadwal_id' }
      )
    }
    await supabase.from('exam_sessions')
      .update({ is_submitted: true, submitted_at: new Date().toISOString() })
      .eq('student_id', user.id).eq('jadwal_id', jadwal.id)
    setExamState('submitted'); setSubmitting(false); setConfirmSubmit(false)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/auth/login') }

  const fmt = (s: number) => {
    if (s < 0) s = 0
    const m = Math.floor(s / 60), ss = s % 60
    return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  }

  const answered = questions.filter(q => answers[q.id]?.trim()).length
  const warn = timeLeft !== null && timeLeft < 300
  const crit = timeLeft !== null && timeLeft < 60

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // TOKEN SCREEN
  if (examState === 'token') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px,#f59e0b 1px,transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4 rotate-3">
            <svg className="w-8 h-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-100 mb-1">Masukkan Token</h1>
          <p className="text-slate-400 text-sm">Halo, <span className="text-slate-200 font-medium">{profile?.full_name}</span></p>
          <p className="text-slate-500 text-sm">Minta token dari pengawas untuk memulai ujian.</p>
        </div>
        <div className="card p-8">
          <label className="block text-sm font-medium text-slate-300 mb-3 text-center">Kode Token (6 karakter)</label>
          <input
            type="text" value={tokenInput} maxLength={6} autoFocus autoComplete="off"
            onChange={e => { setTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')); setTokenError('') }}
            onKeyDown={e => e.key === 'Enter' && validateToken()}
            placeholder="AB3X7K"
            className="input-field text-center text-3xl font-mono font-bold tracking-[0.5em] uppercase py-5 mb-4 w-full"
          />
          {tokenError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-400 text-sm text-center">{tokenError}</p>
            </div>
          )}
          <button onClick={validateToken} disabled={tokenLoading || tokenInput.length < 6}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {tokenLoading
              ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Memvalidasi...</>
              : 'Mulai Ujian →'}
          </button>
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">{profile?.username || profile?.npm}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/home')} className="text-xs text-slate-500 hover:text-slate-300">← Home</button>
              <button onClick={logout} className="text-xs text-slate-500 hover:text-red-400">Keluar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // SUBMITTED SCREEN
  if (examState === 'submitted') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-full mb-6">
          <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Ujian Selesai!</h1>
        <p className="text-slate-400 mb-6">Jawaban kamu berhasil dikumpulkan.</p>
        <div className="card p-5 mb-6 text-left space-y-2.5">
          {[
            ['Nama',    profile?.full_name],
            ['Username', profile?.username || profile?.npm],
            ['Mapel',  jadwal?.mata_pelajaran?.nama],
            ['Kelas',  jadwal?.kelas?.nama],
            ['Ujian',  jadwal?.nama],
            ['Dijawab', `${answered} / ${questions.length} soal`],
          ].map(([l,v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-slate-500 text-sm">{l}</span>
              <span className="text-slate-200 text-sm font-medium">{v || '—'}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/home')} className="btn-primary w-full">
          Kembali ke Halaman Utama
        </button>
      </div>
    </div>
  )

  // EXAM SCREEN
  const cq = questions[currentQ]
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100 truncate">{jadwal?.mata_pelajaran?.nama || 'Ujian'}</p>
            <p className="text-xs text-slate-500">{profile?.full_name} · {answered}/{questions.length} dijawab</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {timeLeft !== null && (
              <span className={`font-mono text-sm font-bold px-3 py-1.5 rounded-lg border ${
                crit ? 'text-red-400 bg-red-500/10 border-red-500/30 animate-pulse' :
                warn ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                       'text-slate-300 bg-slate-800 border-slate-700'}`}>
                {fmt(timeLeft)}
              </span>
            )}
            <button onClick={() => setConfirmSubmit(true)} className="btn-primary text-sm py-2">Kumpulkan</button>
          </div>
        </div>
        <div className="h-0.5 bg-slate-800">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${questions.length ? (answered/questions.length)*100 : 0}%` }}/>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex gap-4">
        {/* Sidebar navigator */}
        <div className="hidden md:flex flex-col gap-1.5 w-12 flex-shrink-0 pt-1">
          {questions.map((q, i) => (
            <button key={q.id} onClick={() => setCurrentQ(i)}
              title={`Soal ${i+1}`}
              className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                i === currentQ           ? 'bg-amber-500 text-slate-950' :
                answers[q.id]?.trim()   ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                          'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
              {i+1}
            </button>
          ))}
        </div>

        {/* Question + Answer */}
        {cq && (
          <div className="flex-1 min-w-0 space-y-4">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-sm font-bold px-3 py-1 rounded-xl">
                  Soal {currentQ+1} / {questions.length}
                </span>
                <span className="ml-auto text-xs">
                  {saving === cq.id
                    ? <span className="text-amber-400 flex items-center gap-1"><div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin"/>Menyimpan...</span>
                    : savedAnswers.has(cq.id)
                    ? <span className="text-green-400">✓ Tersimpan</span>
                    : null}
                </span>
              </div>
              <p className="text-slate-200 leading-relaxed">{cq.question}</p>
            </div>

            <div className="card p-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Jawaban</label>
              <textarea
                value={answers[cq.id] || ''}
                onChange={e => setAnswers(p => ({ ...p, [cq.id]: e.target.value }))}
                placeholder="Tulis jawaban di sini..."
                rows={12} className="input-field w-full resize-none"
              />
              <p className="text-xs text-slate-600 mt-2">{(answers[cq.id]||'').length} karakter · Auto-save aktif</p>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setCurrentQ(p => Math.max(0,p-1))} disabled={currentQ===0}
                className="btn-secondary py-2 flex items-center gap-1 disabled:opacity-30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                Sebelumnya
              </button>
              {/* Mobile nav */}
              <div className="flex md:hidden gap-1 overflow-x-auto">
                {questions.map((q,i) => (
                  <button key={q.id} onClick={() => setCurrentQ(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold flex-shrink-0 ${
                      i===currentQ ? 'bg-amber-500 text-slate-950' :
                      answers[q.id]?.trim() ? 'bg-green-500/20 text-green-400' :
                      'bg-slate-800 text-slate-500'}`}>{i+1}</button>
                ))}
              </div>
              {currentQ < questions.length-1
                ? <button onClick={() => setCurrentQ(p=>p+1)} className="btn-secondary py-2 flex items-center gap-1">
                    Berikutnya <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                : <button onClick={() => setConfirmSubmit(true)} className="btn-primary py-2">Kumpulkan ✓</button>}
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 bg-amber-500/10 border-2 border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Kumpulkan Ujian?</h2>
            <p className="text-slate-400 text-sm mb-2">
              Dijawab: <span className="text-amber-400 font-bold">{answered}</span> / {questions.length} soal
            </p>
            {answered < questions.length && (
              <p className="text-amber-400 text-sm mb-3">⚠️ {questions.length-answered} soal belum dijawab.</p>
            )}
            <p className="text-slate-600 text-xs mb-5">Tidak bisa diubah setelah dikumpulkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1">Kembali</button>
              <button onClick={() => handleSubmit()} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {submitting ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Mengumpulkan...</> : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}