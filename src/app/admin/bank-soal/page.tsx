'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────
type Mapel    = { id: string; nama: string; kode: string; jumlah_soal: number }
type Question = { id: string; number: number; question: string; is_active: boolean; mata_pelajaran_id: string | null }
type Jadwal   = { id: string; nama: string; tanggal: string; mapel_nama: string | null; kelas_nama: string | null; mapel_id: string | null }
type Answer   = {
  id: string; answer_text: string; score: number | null; feedback: string | null
  question: { id: string; number: number; question: string }
  student: { id: string; full_name: string; npm: string }
  jadwal_id: string | null
}
type GradingSession = {
  student_id: string; full_name: string; npm: string; kelas: string
  submitted_at: string | null; is_submitted: boolean
  answers: Answer[]; total_score: number | null; graded_count: number
}

type View = 'mapel-list' | 'soal-list' | 'jadwal-list' | 'penilaian' | 'soal-form'

// ── Icon ──────────────────────────────────────────────────────
const Ic = ({ d, cls = 'w-4 h-4' }: { d: string; cls?: string }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)

export default function BankSoalPage() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<View>('mapel-list')
  const [msg, setMsg]               = useState('')

  // Data
  const [mapelList, setMapelList]   = useState<Mapel[]>([])
  const [soalList, setSoalList]     = useState<Question[]>([])
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])

  // Selection state
  const [selMapel, setSelMapel]     = useState<Mapel | null>(null)
  const [selJadwal, setSelJadwal]   = useState<Jadwal | null>(null)

  // Soal form
  const [soalForm, setSF]           = useState({ id: '', number: '', question: '', is_active: true })
  const [soalSaving, setSoalSaving] = useState(false)

  // Penilaian
  const [sessions, setSessions]     = useState<GradingSession[]>([])
  const [selSession, setSelSession] = useState<GradingSession | null>(null)
  const [scores, setScores]         = useState<Record<string, { score: string; feedback: string }>>({})
  const [savingId, setSavingId]     = useState<string | null>(null)
  const [gradingFilter, setGF]      = useState('')
  const [downloading, setDL]        = useState(false)

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') { router.push('/exam'); return }
    await loadMapel()
    setLoading(false)
  }

  const loadMapel = async () => {
    const { data: mapel } = await supabase.from('mata_pelajaran').select('*').order('nama')
    const { data: soal }  = await supabase.from('questions').select('mata_pelajaran_id')
    const list = (mapel || []).map(m => ({
      ...m,
      jumlah_soal: soal?.filter(q => q.mata_pelajaran_id === m.id).length || 0,
    }))
    setMapelList(list)
  }

  const loadSoal = async (mapelId: string) => {
    const { data } = await supabase.from('questions')
      .select('*').eq('mata_pelajaran_id', mapelId).order('number')
    setSoalList(data || [])
  }

  const loadJadwal = async (mapelId: string) => {
    const { data } = await supabase
      .from('jadwal_ujian')
      .select('id, nama, tanggal, mata_pelajaran:mata_pelajaran_id(nama), kelas:kelas_id(nama)')
      .eq('mata_pelajaran_id', mapelId)
      .order('tanggal', { ascending: false })
    setJadwalList((data || []).map((j: any) => ({
      id: j.id, nama: j.nama, tanggal: j.tanggal,
      mapel_nama: j.mata_pelajaran?.nama || null,
      kelas_nama: j.kelas?.nama || null,
      mapel_id: mapelId,
    })))
  }

  const loadPenilaian = async (jadwal: Jadwal) => {
    // Get soal in jadwal
    const { data: js } = await supabase.from('jadwal_soal')
      .select('question_id, urutan').eq('jadwal_id', jadwal.id).order('urutan')
    const qIds = js?.map(r => r.question_id) || []

    if (qIds.length === 0) {
      setSessions([]); return
    }

    // Get all questions for this jadwal
    const { data: qs } = await supabase.from('questions').select('id,number,question').in('id', qIds)

    // Get siswa in kelas
    const { data: jadwalData } = await supabase
      .from('jadwal_ujian').select('kelas_id').eq('id', jadwal.id).single()

    let studentIds: string[] = []
    if (jadwalData?.kelas_id) {
      const { data: sk } = await supabase.from('siswa_kelas').select('student_id').eq('kelas_id', jadwalData.kelas_id)
      studentIds = sk?.map(r => r.student_id) || []
    } else {
      // fallback: all students who submitted
      const { data: exs } = await supabase.from('exam_sessions').select('student_id').eq('jadwal_id', jadwal.id).eq('is_submitted', true)
      studentIds = exs?.map(r => r.student_id) || []
    }

    if (studentIds.length === 0) { setSessions([]); return }

    // Get profiles + sessions
    const { data: profiles } = await supabase.from('profiles').select('id,full_name,npm').in('id', studentIds)
    const { data: examSessions } = await supabase.from('exam_sessions')
      .select('student_id,submitted_at,is_submitted').eq('jadwal_id', jadwal.id)
    const { data: skRows } = await supabase.from('siswa_kelas')
      .select('student_id, kelas:kelas_id(nama)').in('student_id', studentIds)

    // Get all answers for this jadwal
    const { data: answers } = await supabase
      .from('answers')
      .select('id,answer_text,score,feedback,question_id,student_id,jadwal_id')
      .eq('jadwal_id', jadwal.id)
      .in('student_id', studentIds)

    // Build grading sessions
    const result: GradingSession[] = studentIds.map(sid => {
      const prof = profiles?.find(p => p.id === sid)
      const exSess = examSessions?.find(s => s.student_id === sid)
      const skRow = (skRows as any[])?.find(r => r.student_id === sid)
      const stuAnswers = (answers || [])
        .filter(a => a.student_id === sid)
        .map(a => ({
          ...a,
          question: qs?.find(q => q.id === a.question_id) || { id: a.question_id, number: 0, question: '' },
          student: { id: sid, full_name: prof?.full_name || '-', npm: prof?.npm || '-' },
        }))
        .sort((a, b) => (a.question.number || 0) - (b.question.number || 0))

      const gradedAnswers = stuAnswers.filter(a => a.score !== null)
      const total = gradedAnswers.length > 0 ? Math.round(gradedAnswers.reduce((s, a) => s + (a.score || 0), 0) / gradedAnswers.length) : null

      return {
        student_id: sid,
        full_name: prof?.full_name || '-',
        npm: prof?.npm || '-',
        kelas: skRow?.kelas?.nama || '',
        submitted_at: exSess?.submitted_at || null,
        is_submitted: exSess?.is_submitted || false,
        answers: stuAnswers,
        total_score: total,
        graded_count: gradedAnswers.length,
      }
    })

    setSessions(result)
    setSelSession(null)
  }

  // ── Navigation helpers ────────────────────────────────────────
  const openMapel = async (m: Mapel) => {
    setSelMapel(m)
    await Promise.all([loadSoal(m.id), loadJadwal(m.id)])
    setView('soal-list')
  }

  const openJadwalList = () => setView('jadwal-list')

  const openPenilaian = async (j: Jadwal) => {
    setSelJadwal(j)
    await loadPenilaian(j)
    setGF('')
    setView('penilaian')
  }

  const openSoalForm = (q?: Question) => {
    setSF(q ? { id: q.id, number: q.number.toString(), question: q.question, is_active: q.is_active } : { id: '', number: '', question: '', is_active: true })
    setView('soal-form')
  }

  const openSession = (s: GradingSession) => {
    setSelSession(s)
    const sm: Record<string, { score: string; feedback: string }> = {}
    s.answers.forEach(a => { sm[a.id] = { score: a.score?.toString() || '', feedback: a.feedback || '' } })
    setScores(sm)
  }

  const backToSoalList = () => setView('soal-list')
  const backToJadwal   = () => { setSelJadwal(null); setSelSession(null); setView('jadwal-list') }
  const backToSession  = () => setSelSession(null)

  // ── SOAL CRUD ─────────────────────────────────────────────────
  const saveSoal = async () => {
    if (!selMapel || !soalForm.question || !soalForm.number) return
    setSoalSaving(true)
    const payload = {
      number: parseInt(soalForm.number), question: soalForm.question,
      is_active: soalForm.is_active, mata_pelajaran_id: selMapel.id,
    }
    if (soalForm.id) await supabase.from('questions').update(payload).eq('id', soalForm.id)
    else await supabase.from('questions').insert(payload)
    await loadSoal(selMapel.id); await loadMapel()
    setSoalSaving(false); setView('soal-list'); flash('✅ Soal disimpan!')
  }

  const deleteSoal = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return
    await supabase.from('questions').delete().eq('id', id)
    if (selMapel) await loadSoal(selMapel.id); await loadMapel()
    flash('🗑 Soal dihapus.')
  }

  const toggleSoalActive = async (id: string, cur: boolean) => {
    await supabase.from('questions').update({ is_active: !cur }).eq('id', id)
    if (selMapel) await loadSoal(selMapel.id)
  }

  // ── Penilaian ─────────────────────────────────────────────────
  const saveScore = async (answerId: string) => {
    setSavingId(answerId)
    const { score, feedback } = scores[answerId]
    await supabase.from('answers').update({
      score: score !== '' ? parseInt(score) : null,
      feedback: feedback || null,
    }).eq('id', answerId)
    setSavingId(null)
    // Recalculate total for current session
    if (selSession && selJadwal) {
      await loadPenilaian(selJadwal)
      // Re-open same session
    }
  }

  const saveAllScores = async () => {
    if (!selSession) return
    setSavingId('all')
    for (const answerId of Object.keys(scores)) {
      const { score, feedback } = scores[answerId]
      await supabase.from('answers').update({
        score: score !== '' ? parseInt(score) : null,
        feedback: feedback || null,
      }).eq('id', answerId)
    }
    setSavingId(null)
    if (selJadwal) {
      await loadPenilaian(selJadwal)
      flash('✅ Semua nilai disimpan!')
    }
  }

  // ── Download jawaban ──────────────────────────────────────────
  const downloadJawabanSiswa = (s: GradingSession) => {
    if (!selJadwal) return
    let txt = `JAWABAN UJIAN\n`
    txt += `${'='.repeat(60)}\n`
    txt += `Nama     : ${s.full_name}\n`
    txt += `NPM      : ${s.npm}\n`
    txt += `Kelas    : ${s.kelas || '-'}\n`
    txt += `Mata Pel : ${selJadwal.mapel_nama || '-'}\n`
    txt += `Jadwal   : ${selJadwal.nama}\n`
    txt += `Tanggal  : ${new Date(selJadwal.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n`
    txt += `Dikumpul : ${s.submitted_at ? new Date(s.submitted_at).toLocaleString('id-ID') : 'Belum dikumpulkan'}\n`
    txt += `${'='.repeat(60)}\n\n`
    s.answers.forEach((a, i) => {
      txt += `SOAL ${a.question.number}\n`
      txt += `${'-'.repeat(40)}\n`
      txt += `${a.question.question}\n\n`
      txt += `JAWABAN:\n${a.answer_text || '(tidak dijawab)'}\n\n`
      if (a.score !== null) txt += `Nilai: ${a.score}/100\n`
      if (a.feedback) txt += `Feedback: ${a.feedback}\n`
      txt += `\n`
    })
    const blob = new Blob([txt], { type: 'text/plain; charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jawaban-${s.npm}-${selJadwal.nama.replace(/\s+/g, '-')}.txt`
    a.click()
  }

  const downloadAllJawaban = async () => {
    if (!selJadwal || sessions.length === 0) return
    setDL(true)
    // Build CSV with all scores
    const rows = [['NPM', 'Nama', 'Kelas', 'Dikumpulkan', 'Jumlah Soal', 'Dinilai', 'Rata-rata Nilai']]
    sessions.forEach(s => {
      rows.push([
        s.npm, s.full_name, s.kelas || '-',
        s.submitted_at ? new Date(s.submitted_at).toLocaleString('id-ID') : '-',
        s.answers.length.toString(),
        s.graded_count.toString(),
        s.total_score !== null ? s.total_score.toString() : '-',
      ])
    })
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `rekap-nilai-${selJadwal.nama.replace(/\s+/g, '-')}.csv`
    a.click()
    setDL(false)
  }

  const downloadSemuaJawabanTxt = () => {
    if (!selJadwal) return
    setDL(true)
    let txt = `REKAP JAWABAN UJIAN\n`
    txt += `Jadwal : ${selJadwal.nama}\n`
    txt += `Mapel  : ${selJadwal.mapel_nama || '-'} | Kelas: ${selJadwal.kelas_nama || '-'}\n`
    txt += `${'='.repeat(60)}\n\n`
    sessions.forEach((s, i) => {
      txt += `[${i + 1}] ${s.full_name} (${s.npm})\n`
      txt += `Status: ${s.is_submitted ? `Dikumpulkan ${new Date(s.submitted_at!).toLocaleString('id-ID')}` : 'Belum dikumpulkan'}\n`
      txt += `Rata-rata Nilai: ${s.total_score !== null ? s.total_score : 'Belum dinilai'}\n\n`
      s.answers.forEach(a => {
        txt += `  Soal ${a.question.number}: ${a.question.question}\n`
        txt += `  Jawaban: ${a.answer_text || '(kosong)'}\n`
        if (a.score !== null) txt += `  Nilai: ${a.score}/100 | Feedback: ${a.feedback || '-'}\n`
        txt += '\n'
      })
      txt += `${'─'.repeat(60)}\n\n`
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }))
    a.download = `semua-jawaban-${selJadwal.nama.replace(/\s+/g, '-')}.txt`
    a.click()
    setDL(false)
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Shared back header ────────────────────────────────────────
  const BackHeader = ({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) => (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
          <Ic d="M15 19l-7-7 7-7" cls="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{title}</p>
          {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
        </div>
      </div>
    </header>
  )

  // ── VIEW: SOAL FORM ───────────────────────────────────────────
  if (view === 'soal-form') return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title={soalForm.id ? 'Edit Soal' : 'Tambah Soal'} sub={selMapel?.nama} onBack={backToSoalList} />
      <div className="max-w-2xl mx-auto p-4 animate-fade-in">
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nomor Soal</label>
            <input type="number" value={soalForm.number} onChange={e => setSF(p => ({ ...p, number: e.target.value }))}
              min="1" placeholder="1" className="input-field w-32" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Pertanyaan</label>
            <textarea value={soalForm.question} onChange={e => setSF(p => ({ ...p, question: e.target.value }))}
              placeholder="Tulis pertanyaan essay di sini..." rows={8} className="input-field w-full" />
            <p className="text-xs text-slate-600 mt-1">{soalForm.question.length} karakter</p>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={soalForm.is_active} onChange={e => setSF(p => ({ ...p, is_active: e.target.checked }))} className="accent-amber-500 w-4 h-4" />
            <span className="text-sm text-slate-300">Soal aktif (muncul saat ujian)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={saveSoal} disabled={soalSaving || !soalForm.question || !soalForm.number} className="btn-primary flex items-center gap-2">
              {soalSaving ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />Menyimpan...</> : 'Simpan Soal'}
            </button>
            <button onClick={backToSoalList} className="btn-secondary">Batal</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── VIEW: PENILAIAN — detail satu siswa ───────────────────────
  if (view === 'penilaian' && selSession) {
    const answeredCount  = selSession.answers.filter(a => a.answer_text?.trim()).length
    const gradedCount    = Object.values(scores).filter(s => s.score !== '').length
    const totalScore     = gradedCount > 0 ? Math.round(Object.values(scores).filter(s => s.score !== '').reduce((sum, s) => sum + parseInt(s.score), 0) / gradedCount) : null

    return (
      <div className="min-h-screen bg-slate-950">
        <BackHeader
          title={`Penilaian — ${selSession.full_name}`}
          sub={`${selSession.npm} · ${selJadwal?.mapel_nama} · ${selJadwal?.nama}`}
          onBack={backToSession}
        />
        <div className="max-w-3xl mx-auto p-4 animate-fade-in">
          {/* Student info bar */}
          <div className="card p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 flex-shrink-0">
                {selSession.full_name[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-100">{selSession.full_name}</p>
                <p className="text-xs text-slate-500">{selSession.npm} · {selSession.kelas || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center">
                <p className="text-xs text-slate-500">Dijawab</p>
                <p className="font-bold text-slate-200">{answeredCount}/{selSession.answers.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Dinilai</p>
                <p className="font-bold text-amber-400">{gradedCount}/{selSession.answers.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Rata-rata</p>
                <p className={`font-bold text-lg ${totalScore !== null ? (totalScore >= 70 ? 'text-green-400' : 'text-red-400') : 'text-slate-600'}`}>
                  {totalScore !== null ? totalScore : '—'}
                </p>
              </div>
              <button onClick={() => downloadJawabanSiswa(selSession)} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                <Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" cls="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          {/* Answers + scoring */}
          <div className="space-y-4">
            {selSession.answers.map((a, idx) => (
              <div key={a.id} className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg">Soal {a.question.number}</span>
                  {a.score !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${a.score >= 70 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>{a.score}/100</span>
                  )}
                </div>
                {/* Question */}
                <div className="bg-slate-800/60 rounded-xl p-4 mb-3 border border-slate-700/50">
                  <p className="text-slate-300 text-sm leading-relaxed">{a.question.question}</p>
                </div>
                {/* Answer */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Jawaban Siswa</p>
                  <p className={`text-sm leading-relaxed p-3 rounded-lg ${a.answer_text?.trim() ? 'text-slate-200 bg-slate-800/30' : 'text-slate-600 italic'}`}>
                    {a.answer_text?.trim() || '(tidak dijawab)'}
                  </p>
                </div>
                {/* Scoring */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Nilai (0–100)</label>
                    <input type="number" min="0" max="100"
                      value={scores[a.id]?.score || ''}
                      onChange={e => setScores(p => ({ ...p, [a.id]: { ...p[a.id], score: e.target.value } }))}
                      onBlur={() => saveScore(a.id)}
                      placeholder="—" className="input-field w-24 text-center font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">Feedback</label>
                    <input type="text"
                      value={scores[a.id]?.feedback || ''}
                      onChange={e => setScores(p => ({ ...p, [a.id]: { ...p[a.id], feedback: e.target.value } }))}
                      onBlur={() => saveScore(a.id)}
                      placeholder="Catatan untuk siswa..." className="input-field text-sm" />
                  </div>
                </div>
                {savingId === a.id && <p className="text-xs text-amber-400 mt-2 flex items-center gap-1"><div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />Menyimpan...</p>}
              </div>
            ))}
          </div>

          {/* Save all */}
          <div className="flex gap-3 mt-4">
            <button onClick={saveAllScores} disabled={savingId === 'all'} className="btn-primary flex items-center gap-2">
              {savingId === 'all' ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />Menyimpan...</> : '💾 Simpan Semua Nilai'}
            </button>
            <button onClick={backToSession} className="btn-secondary">Kembali</button>
          </div>
        </div>
      </div>
    )
  }

  // ── VIEW: PENILAIAN — daftar siswa ────────────────────────────
  if (view === 'penilaian') {
    const filteredSessions = sessions.filter(s => {
      if (!gradingFilter) return true
      return s.full_name.toLowerCase().includes(gradingFilter.toLowerCase()) || s.npm.includes(gradingFilter)
    })
    const submittedCount = sessions.filter(s => s.is_submitted).length
    const gradedAll      = sessions.filter(s => s.graded_count === s.answers.length && s.answers.length > 0)

    return (
      <div className="min-h-screen bg-slate-950">
        <BackHeader
          title={`Penilaian — ${selJadwal?.nama}`}
          sub={`${selJadwal?.mapel_nama} · ${selJadwal?.kelas_nama || 'Semua Kelas'}`}
          onBack={backToJadwal}
        />
        <div className="max-w-5xl mx-auto p-4 animate-fade-in">
          {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">{msg}</div>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-100">{sessions.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total Siswa</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{submittedCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Sudah Kumpul</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{gradedAll.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Selesai Dinilai</p>
            </div>
          </div>

          {/* Download bar */}
          <div className="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300 font-medium">Download Jawaban</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadSemuaJawabanTxt} disabled={downloading || sessions.length === 0}
                className="btn-secondary text-xs py-2 flex items-center gap-1.5">
                <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" cls="w-3.5 h-3.5" />
                Semua Jawaban (.txt)
              </button>
              <button onClick={downloadAllJawaban} disabled={downloading || sessions.length === 0}
                className="btn-secondary text-xs py-2 flex items-center gap-1.5">
                <Ic d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" cls="w-3.5 h-3.5" />
                Rekap Nilai (.csv)
              </button>
            </div>
          </div>

          {/* Search */}
          <input type="text" value={gradingFilter} onChange={e => setGF(e.target.value)}
            placeholder="Cari nama atau NPM..." className="input-field text-sm py-2 mb-4 w-full max-w-sm" />

          {/* Student list */}
          {sessions.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              <p>Belum ada siswa yang terdaftar di kelas ini atau belum ada jawaban.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30">
                    <th className="text-left text-xs text-slate-500 font-medium p-4">Siswa</th>
                    <th className="text-left text-xs text-slate-500 font-medium p-4 hidden sm:table-cell">Kelas</th>
                    <th className="text-center text-xs text-slate-500 font-medium p-4">Status</th>
                    <th className="text-center text-xs text-slate-500 font-medium p-4">Dijawab</th>
                    <th className="text-center text-xs text-slate-500 font-medium p-4">Dinilai</th>
                    <th className="text-center text-xs text-slate-500 font-medium p-4">Nilai</th>
                    <th className="text-center text-xs text-slate-500 font-medium p-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(s => (
                    <tr key={s.student_id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-slate-200 text-sm">{s.full_name}</p>
                        <p className="text-xs text-slate-500">{s.npm}</p>
                      </td>
                      <td className="p-4 text-slate-400 text-sm hidden sm:table-cell">{s.kelas || '—'}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.is_submitted ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                          {s.is_submitted ? 'Dikumpulkan' : 'Belum'}
                        </span>
                      </td>
                      <td className="p-4 text-center text-sm text-slate-300">
                        {s.answers.filter(a => a.answer_text?.trim()).length}/{s.answers.length}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-medium ${s.graded_count === s.answers.length && s.answers.length > 0 ? 'text-green-400' : 'text-amber-400'}`}>
                          {s.graded_count}/{s.answers.length}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-sm font-bold ${s.total_score !== null ? (s.total_score >= 70 ? 'text-green-400' : 'text-red-400') : 'text-slate-600'}`}>
                          {s.total_score !== null ? s.total_score : '—'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openSession(s)}
                            className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2.5 py-1 rounded hover:bg-slate-800 transition-colors">
                            Nilai
                          </button>
                          <button onClick={() => downloadJawabanSiswa(s)}
                            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors" title="Download jawaban">
                            <Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" cls="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── VIEW: JADWAL per mapel ────────────────────────────────────
  if (view === 'jadwal-list') return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title={`Penilaian — ${selMapel?.nama}`} sub="Pilih jadwal ujian" onBack={backToSoalList} />
      <div className="max-w-4xl mx-auto p-4 animate-fade-in">
        {jadwalList.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            <p>Belum ada jadwal ujian untuk mata pelajaran ini.</p>
            <p className="text-xs mt-2">Buat jadwal dulu di menu Akademik.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jadwalList.map(j => (
              <button key={j.id} onClick={() => openPenilaian(j)}
                className="card p-5 w-full text-left hover:border-amber-500/30 transition-all group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">{j.nama}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {j.kelas_nama && <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{j.kelas_nama}</span>}
                      <span className="text-xs text-slate-500">📅 {new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <Ic d="M9 5l7 7-7 7" cls="w-5 h-5 text-slate-600 group-hover:text-amber-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── VIEW: SOAL LIST per mapel ─────────────────────────────────
  if (view === 'soal-list' && selMapel) return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title={selMapel.nama} sub={`${selMapel.kode} · ${soalList.length} soal`} onBack={() => { setSelMapel(null); setView('mapel-list') }} />
      <div className="max-w-4xl mx-auto p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex gap-2">
            <button onClick={() => openSoalForm()} className="btn-primary text-sm py-2 flex items-center gap-1.5">
              <Ic d="M12 4v16m8-8H4" cls="w-4 h-4" /> Tambah Soal
            </button>
            <button onClick={openJadwalList} className="btn-secondary text-sm py-2 flex items-center gap-1.5">
              <Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" cls="w-4 h-4" />
              Penilaian
            </button>
          </div>
        </div>

        {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20 animate-fade-in">{msg}</div>}

        {soalList.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            <p className="mb-3">Belum ada soal untuk mata pelajaran ini.</p>
            <button onClick={() => openSoalForm()} className="btn-primary text-sm py-2">Tambah Soal Pertama</button>
          </div>
        ) : (
          <div className="space-y-3">
            {soalList.map((q, idx) => (
              <div key={q.id} className={`card p-5 ${!q.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 font-bold text-sm">{q.number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 leading-relaxed text-sm">{q.question}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${q.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                        {q.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleSoalActive(q.id, q.is_active)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">
                      {q.is_active ? 'Nonaktif' : 'Aktif'}
                    </button>
                    <button onClick={() => openSoalForm(q)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">Edit</button>
                    <button onClick={() => deleteSoal(q.id)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800">Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── VIEW: MAPEL LIST (home) ───────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
            <Ic d="M15 19l-7-7 7-7" cls="w-5 h-5" />
          </button>
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" cls="w-4 h-4 text-slate-950" />
          </div>
          <h1 className="font-semibold text-slate-100">Bank Soal</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <p className="text-slate-500 text-sm mb-5">Pilih mata pelajaran untuk mengelola soal dan penilaian.</p>

        {mapelList.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <p className="mb-2">Belum ada mata pelajaran.</p>
            <button onClick={() => router.push('/admin/akademik')} className="btn-primary text-sm py-2 mt-2">
              Tambah Mata Pelajaran di Akademik
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mapelList.map(m => (
              <button key={m.id} onClick={() => openMapel(m)}
                className="card p-6 text-left hover:border-amber-500/30 transition-all group hover:bg-slate-800/30">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 bg-amber-500/10 group-hover:bg-amber-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <span className="text-amber-400 font-bold text-sm">{m.kode || '—'}</span>
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors leading-tight">{m.nama}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-lg">
                    📝 {m.jumlah_soal} soal
                  </span>
                  <span className="text-xs text-slate-600 group-hover:text-amber-500 transition-colors flex items-center gap-1">
                    Buka <Ic d="M9 5l7 7-7 7" cls="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}