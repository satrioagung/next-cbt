'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Question = { id: string; number: number; question: string }
type Answers  = Record<string, string>
type ExamState = 'token' | 'exam' | 'submitted'

export default function ExamPage() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [examState, setExamState] = useState<ExamState>('token')

  // Token
  const [tokenInput, setTokenInput]   = useState('')
  const [tokenError, setTokenError]   = useState('')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [jadwal, setJadwal]           = useState<any>(null)

  // Exam
  const [questions, setQuestions]           = useState<Question[]>([])
  const [answers, setAnswers]               = useState<Answers>({})
  const [savedAnswers, setSavedAnswers]     = useState<Set<string>>(new Set())
  const [currentQ, setCurrentQ]             = useState(0)
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState<string | null>(null)
  const [submitting, setSubmitting]         = useState(false)
  const [confirmSubmit, setConfirmSubmit]   = useState(false)
  const [startTime, setStartTime]           = useState<Date | null>(null)
  const [elapsed, setElapsed]               = useState(0)
  const [timeLeft, setTimeLeft]             = useState<number | null>(null)

  useEffect(() => { initPage() }, [])

  // ── Timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || examState !== 'exam') return
    const interval = setInterval(() => {
      const el = Math.floor((Date.now() - startTime.getTime()) / 1000)
      setElapsed(el)
      if (jadwal?.durasi_menit) {
        const left = jadwal.durasi_menit * 60 - el
        setTimeLeft(left)
        if (left <= 0) handleSubmit(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime, examState, jadwal])

  // ── Auto-save ───────────────────────────────────────────────
  const autoSave = useCallback(async (questionId: string, text: string, userId: string, jadwalId?: string) => {
    if (!text.trim()) return
    setSaving(questionId)
    await supabase.from('answers').upsert({
      student_id: userId, question_id: questionId, answer_text: text,
      ...(jadwalId ? { jadwal_id: jadwalId } : {})
    }, { onConflict: 'student_id,question_id' })
    setSavedAnswers(prev => new Set(prev).add(questionId))
    setSaving(null)
  }, [])

  useEffect(() => {
    if (!user || !questions.length || examState !== 'exam') return
    const q = questions[currentQ]
    if (!q || !answers[q.id]) return
    const timeout = setTimeout(() => autoSave(q.id, answers[q.id], user.id, jadwal?.id), 1500)
    return () => clearTimeout(timeout)
  }, [answers, currentQ, questions, user, examState, jadwal, autoSave])

  // ── Init ────────────────────────────────────────────────────
  const initPage = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setUser(session.user)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(prof)
    if (prof?.role === 'admin') { router.push('/admin'); return }
    setLoading(false)
  }

  // ── Token validation ────────────────────────────────────────
  const validateToken = async () => {
    if (!tokenInput.trim()) { setTokenError('Masukkan token ujian.'); return }
    setTokenLoading(true)
    setTokenError('')
    const token = tokenInput.trim().toUpperCase()

    // 1. Cari token
    const { data: tokenData } = await supabase
      .from('token_ujian')
      .select('*, jadwal:jadwal_id(*, mata_pelajaran:mata_pelajaran_id(nama,kode), kelas:kelas_id(id,nama))')
      .eq('token', token).eq('is_active', true).maybeSingle()

    if (!tokenData) { setTokenError('Token tidak valid atau tidak aktif.'); setTokenLoading(false); return }

    // 2. Cek expiry
    if (tokenData.expired_at && new Date(tokenData.expired_at) < new Date()) {
      setTokenError('Token sudah kedaluwarsa.'); setTokenLoading(false); return
    }

    // 3. Cek jadwal aktif
    if (!tokenData.jadwal?.is_active) {
      setTokenError('Jadwal ujian ini tidak aktif.'); setTokenLoading(false); return
    }

    // 4. Cek apakah siswa terdaftar di kelas jadwal ini
    const kelasId = tokenData.jadwal?.kelas?.id
    if (kelasId) {
      const { data: sk } = await supabase
        .from('siswa_kelas')
        .select('student_id')
        .eq('kelas_id', kelasId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (!sk) {
        setTokenError(`Kamu tidak terdaftar di kelas ${tokenData.jadwal?.kelas?.nama}. Hubungi admin.`)
        setTokenLoading(false); return
      }
    }

    // 5. Cek apakah sudah submit untuk jadwal ini
    const { data: existingSession } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('student_id', user.id)
      .eq('jadwal_id', tokenData.jadwal_id)
      .eq('is_submitted', true)
      .maybeSingle()

    if (existingSession) {
      setTokenError('Kamu sudah mengumpulkan ujian ini.'); setTokenLoading(false); return
    }

    // 6. Cek apakah jadwal punya soal
    const { data: jadwalSoal } = await supabase
      .from('jadwal_soal')
      .select('question_id, urutan')
      .eq('jadwal_id', tokenData.jadwal_id)
      .order('urutan')

    if (!jadwalSoal || jadwalSoal.length === 0) {
      setTokenError('Jadwal ini belum memiliki soal. Hubungi admin.'); setTokenLoading(false); return
    }

    setJadwal(tokenData.jadwal)
    await startExam(tokenData.jadwal, token, jadwalSoal)
    setTokenLoading(false)
  }

  const startExam = async (jadwalData: any, tokenUsed: string, jadwalSoal: { question_id: string; urutan: number }[]) => {
    // Get or create exam session
    let { data: sess } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('student_id', user.id)
      .eq('jadwal_id', jadwalData.id)
      .maybeSingle()

    if (!sess) {
      const { data: newSess } = await supabase
        .from('exam_sessions')
        .insert({ student_id: user.id, jadwal_id: jadwalData.id, token_used: tokenUsed })
        .select().single()
      sess = newSess
      setStartTime(new Date())
    } else {
      setStartTime(new Date(sess.started_at))
    }

    // Load questions dari jadwal_soal (urutan tetap, joined ke questions)
    const questionIds = jadwalSoal.map(js => js.question_id)
    const { data: qs } = await supabase
      .from('questions')
      .select('id, number, question')
      .in('id', questionIds)

    // Sort sesuai urutan jadwal_soal
    const sorted = jadwalSoal
      .map(js => qs?.find(q => q.id === js.question_id))
      .filter(Boolean) as Question[]

    setQuestions(sorted)

    // Load existing answers untuk jadwal ini
    const { data: existingAnswers } = await supabase
      .from('answers')
      .select('*')
      .eq('student_id', user.id)
      .eq('jadwal_id', jadwalData.id)

    const answerMap: Answers = {}
    const savedSet = new Set<string>()
    existingAnswers?.forEach(a => {
      answerMap[a.question_id] = a.answer_text
      savedSet.add(a.question_id)
    })
    setAnswers(answerMap)
    setSavedAnswers(savedSet)
    setExamState('exam')
  }

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (auto = false) => {
    if (examState !== 'exam') return
    setSubmitting(true)
    for (const q of questions) {
      await supabase.from('answers').upsert({
        student_id: user.id, question_id: q.id, answer_text: answers[q.id] || '',
        jadwal_id: jadwal?.id || null,
      }, { onConflict: 'student_id,question_id' })
    }
    await supabase.from('exam_sessions')
      .update({ is_submitted: true, submitted_at: new Date().toISOString() })
      .eq('student_id', user.id).eq('jadwal_id', jadwal?.id)
    setExamState('submitted')
    setSubmitting(false)
    setConfirmSubmit(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const formatTime = (sec: number) => {
    if (sec < 0) sec = 0
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
  }

  const answeredCount    = questions.filter(q => answers[q.id]?.trim()).length
  const isTimeWarning    = timeLeft !== null && timeLeft >= 0 && timeLeft < 300
  const isTimeCritical   = timeLeft !== null && timeLeft >= 0 && timeLeft < 60

  // ── Loading ─────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── TOKEN INPUT ─────────────────────────────────────────────
  if (examState === 'token') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #f59e0b 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4 rotate-3">
            <svg className="w-8 h-8 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-100 mb-1">Masukkan Token</h1>
          <p className="text-slate-400 text-sm">Halo, <span className="text-slate-200 font-medium">{profile?.full_name}</span>!</p>
          <p className="text-slate-500 text-sm">Minta token ujian dari pengawas untuk memulai.</p>
        </div>
        <div className="card p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3 text-center">Kode Token (6 karakter)</label>
            <input
              type="text" value={tokenInput}
              onChange={e => { setTokenInput(e.target.value.toUpperCase()); setTokenError('') }}
              onKeyDown={e => e.key === 'Enter' && validateToken()}
              placeholder="AB3X7K" maxLength={6}
              className="input-field text-center text-3xl font-mono font-bold tracking-[0.5em] uppercase py-5"
            />
            {tokenError && <p className="text-red-400 text-sm text-center mt-3">{tokenError}</p>}
          </div>
          <button onClick={validateToken} disabled={tokenLoading || tokenInput.length < 3}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {tokenLoading
              ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> Memvalidasi...</>
              : 'Mulai Ujian →'}
          </button>
          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between">
            <p className="text-slate-600 text-xs">NPM: {profile?.npm}</p>
            <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs">Keluar</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── SUBMITTED ───────────────────────────────────────────────
  if (examState === 'submitted') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border-2 border-green-500/30 rounded-full mb-6">
          <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-100 mb-2">Ujian Selesai!</h1>
        <p className="text-slate-400 mb-8">Jawaban kamu telah berhasil dikumpulkan.</p>
        <div className="card p-6 mb-6 text-left space-y-3">
          <InfoRow label="Nama"    value={profile?.full_name} />
          <InfoRow label="NPM"     value={profile?.npm} />
          {jadwal && <>
            <InfoRow label="Mapel"   value={jadwal.mata_pelajaran?.nama} />
            <InfoRow label="Kelas"   value={jadwal.kelas?.nama} />
            <InfoRow label="Ujian"   value={jadwal.nama} />
          </>}
          <InfoRow label="Dijawab" value={`${answeredCount} / ${questions.length} soal`} />
        </div>
        <button onClick={handleLogout} className="btn-secondary">Keluar</button>
      </div>
    </div>
  )

  // ── EXAM ────────────────────────────────────────────────────
  const currentQuestion = questions[currentQ]

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-100 truncate">
                {jadwal?.mata_pelajaran?.nama || 'UTS Essay'}
                {jadwal?.kelas?.nama && <span className="text-slate-500 font-normal"> — {jadwal.kelas.nama}</span>}
              </h1>
              <p className="text-xs text-slate-500 truncate">{profile?.full_name} · {profile?.npm}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Timer */}
            <div className={`px-3 py-1.5 rounded-lg font-mono text-sm font-semibold transition-all ${
              isTimeCritical ? 'bg-red-500/30 text-red-300 animate-pulse' :
              isTimeWarning  ? 'bg-amber-500/20 text-amber-300' :
              'bg-slate-800 text-amber-400'
            }`}>
              {timeLeft !== null
                ? (timeLeft > 0 ? `⏳ ${formatTime(timeLeft)}` : '⏰ Waktu Habis!')
                : `⏱ ${formatTime(elapsed)}`}
            </div>
            <span className="hidden sm:block text-sm text-slate-400">
              <span className="text-amber-400 font-semibold">{answeredCount}</span>/{questions.length}
            </span>
            <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs hidden sm:block">Keluar</button>
          </div>
        </div>
        {/* Info bar */}
        {jadwal && (
          <div className="border-t border-slate-800 px-4 py-1">
            <div className="max-w-7xl mx-auto flex items-center gap-4 text-xs text-slate-600 overflow-x-auto whitespace-nowrap">
              <span>{jadwal.nama}</span>
              <span>·</span>
              <span>📅 {new Date(jadwal.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span>·</span>
              <span>🕐 {jadwal.waktu_mulai} – {jadwal.waktu_selesai}</span>
              <span>·</span>
              <span>⏱ {jadwal.durasi_menit} menit</span>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto p-4 flex gap-4 mt-2">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="card p-4 sticky top-24">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Navigasi Soal</h3>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id]?.trim()
                const isCurrent  = idx === currentQ
                return (
                  <button key={q.id} onClick={() => setCurrentQ(idx)}
                    className={`aspect-square rounded-lg text-xs font-semibold transition-all ${
                      isCurrent  ? 'bg-amber-500 text-slate-950 scale-105' :
                      isAnswered ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {q.number}
                  </button>
                )
              })}
            </div>
            {/* Legend */}
            <div className="space-y-1 text-xs text-slate-600 mb-3">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-500 rounded" /><span>Aktif</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-green-500/20 border border-green-500/30 rounded" /><span>Dijawab</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-800 rounded" /><span>Kosong</span></div>
            </div>
            {/* Progress */}
            <div className="bg-slate-800 rounded-full h-1.5 mb-1">
              <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-slate-600 text-center mb-4">{answeredCount}/{questions.length} terjawab</p>
            <button onClick={() => setConfirmSubmit(true)} className="btn-primary w-full text-sm py-2">Kumpulkan</button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {currentQuestion && (
            <div className="card p-6 animate-fade-in" key={currentQuestion.id}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <span className="text-xs text-amber-500 font-semibold uppercase tracking-wider">Soal {currentQuestion.number}</span>
                  <div className="h-4 flex items-center mt-0.5">
                    {savedAnswers.has(currentQuestion.id) && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Tersimpan
                      </span>
                    )}
                    {saving === currentQuestion.id && (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                        Menyimpan...
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-500">{answers[currentQuestion.id]?.length || 0} karakter</span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-5 mb-5 border border-slate-700/50">
                <p className="text-slate-100 leading-relaxed">{currentQuestion.question}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Jawaban Anda</label>
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                  placeholder="Tuliskan jawaban Anda secara detail dan sistematis..."
                  rows={9}
                  className="input-field w-full"
                />
              </div>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-800">
                <button onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
                  disabled={currentQ === 0}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-30 text-sm py-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Sebelumnya
                </button>
                <span className="text-sm text-slate-500">{currentQ + 1} / {questions.length}</span>
                {currentQ < questions.length - 1
                  ? <button onClick={() => setCurrentQ(p => p + 1)} className="btn-secondary flex items-center gap-2 text-sm py-2">
                      Selanjutnya
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  : <button onClick={() => setConfirmSubmit(true)} className="btn-primary text-sm py-2">Kumpulkan →</button>
                }
              </div>
            </div>
          )}

          {/* Mobile nav */}
          <div className="md:hidden mt-4 card p-3">
            <div className="grid grid-cols-10 gap-1 mb-3">
              {questions.map((q, idx) => (
                <button key={q.id} onClick={() => setCurrentQ(idx)}
                  className={`aspect-square rounded text-xs font-semibold ${
                    currentQ === idx ? 'bg-amber-500 text-slate-950' :
                    answers[q.id]?.trim() ? 'bg-green-500/20 text-green-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                  {q.number}
                </button>
              ))}
            </div>
            <button onClick={() => setConfirmSubmit(true)} className="btn-primary w-full text-sm py-2">
              Kumpulkan ({answeredCount}/{questions.length})
            </button>
          </div>
        </main>
      </div>

      {/* Confirm submit modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-8 max-w-md w-full animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-bold text-slate-100 mb-2">Kumpulkan Ujian?</h3>
              <p className="text-slate-400 text-sm">
                Kamu menjawab <span className="text-amber-400 font-semibold">{answeredCount}</span>/<span className="text-slate-300 font-semibold">{questions.length}</span> soal. Jawaban tidak bisa diubah setelah dikumpulkan.
              </p>
            </div>
            {answeredCount < questions.length && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-5 text-amber-400 text-sm text-center">
                ⚠️ {questions.length - answeredCount} soal masih kosong!
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1">Kembali</button>
              <button onClick={() => handleSubmit()} disabled={submitting} className="btn-danger flex-1 flex items-center justify-center gap-2">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Mengumpulkan...</>
                  : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-200 font-medium text-sm">{value || '—'}</span>
    </div>
  )
}