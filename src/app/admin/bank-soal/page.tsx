'use client'
import React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminNavbar from '@/components/AdminNavbar'

// ─── Types ────────────────────────────────────────────────────
type BankSoal = {
  id: string; nama: string; deskripsi: string; is_active: boolean
  mapel_list: { id: string; nama: string; kode: string }[]
  kelas_list: { id: string; nama: string }[]
  jumlah_soal: number
}
type Mapel    = { id: string; nama: string; kode: string }
type Kelas    = { id: string; nama: string; tingkat: string }
type Question = { id: string; number: number; question: string; is_active: boolean }
type Jadwal   = {
  id: string; nama: string; tanggal: string
  mapel_nama: string | null; kelas_nama: string | null; mapel_id: string | null
}
type Answer = {
  id: string; answer_text: string; score: number | null; feedback: string | null
  question: { number: number; question: string }
}
type GradingSession = {
  student_id: string; full_name: string; npm: string; username: string; kelas: string
  submitted_at: string | null; is_submitted: boolean
  answers: Answer[]; total_score: number | null; graded_count: number
}
type View = 'bank-list' | 'bank-detail' | 'soal-form' | 'jadwal-list' | 'penilaian' | 'penilaian-detail'

const Ic = ({ d, cls = 'w-4 h-4' }: { d: string; cls?: string }) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

export default function BankSoalPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<View>('bank-list')
  const [msg, setMsg]           = useState('')
  const [adminName, setAdminName] = useState('')

  // Master
  const [bankList, setBankList] = useState<BankSoal[]>([])
  const [mapelAll, setMapelAll] = useState<Mapel[]>([])
  const [kelasAll, setKelasAll] = useState<Kelas[]>([])

  // Selected context
  const [selBank, setSelBank]     = useState<BankSoal | null>(null)
  const [selJadwal, setSelJadwal] = useState<Jadwal | null>(null)
  const [selSession, setSelSess]  = useState<GradingSession | null>(null)

  const [bankMapelIds, setBMIds] = useState<string[]>([])
  const [bankKelasIds, setBKIds] = useState<string[]>([])
  const [soalList, setSoalList]  = useState<Question[]>([])

  // Penilaian
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])
  const [sessions, setSessions]     = useState<GradingSession[]>([])
  const [scores, setScores]         = useState<Record<string, { score: string; feedback: string }>>({})
  const [savingId, setSavingId]     = useState<string | null>(null)
  const [gradSearch, setGS]         = useState('')

  // Bank form
  const [bankForm, setBF]    = useState({ nama: '', deskripsi: '', is_active: true })
  const [editBankId, setEBI] = useState<string | null>(null)

  // Soal form
  const [soalFormId, setSFId]         = useState('')
  const [soalFormNum, setSFNum]       = useState('')
  const [soalFormQ, setSFQ]           = useState('')
  const [soalFormActive, setSFActive] = useState(true)
  const [soalSaving, setSoalSaving]   = useState(false)

  const [importing, setImp] = useState(false)

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    const { data: p } = await supabase.from('profiles').select('role,full_name').eq('id', session.user.id).single()
    if ((p as any)?.role !== 'admin') { router.push('/home'); return }
    setAdminName((p as any)?.full_name || '')
    await Promise.all([loadBanks(), loadMapel(), loadKelas()])
    setLoading(false)
  }

  const loadBanks = async () => {
    const [{ data: banks }, { data: soal }, { data: bsm }, { data: bsk }] = await Promise.all([
      supabase.from('bank_soal').select('*').order('nama'),
      supabase.from('questions').select('bank_soal_id').not('bank_soal_id', 'is', null),
      supabase.from('bank_soal_mapel').select('bank_soal_id, mata_pelajaran_id, mp:mata_pelajaran_id(id,nama,kode)'),
      supabase.from('bank_soal_kelas').select('bank_soal_id, kelas_id, kl:kelas_id(id,nama)'),
    ])
    setBankList((banks || []).map((b: any) => ({
      ...b,
      jumlah_soal: soal?.filter((q: any) => q.bank_soal_id === b.id).length || 0,
      mapel_list:  (bsm as any[])?.filter((r: any) => r.bank_soal_id === b.id).map((r: any) => r.mp).filter(Boolean) || [],
      kelas_list:  (bsk as any[])?.filter((r: any) => r.bank_soal_id === b.id).map((r: any) => r.kl).filter(Boolean) || [],
    })))
  }

  const loadMapel = async () => {
    const { data } = await supabase.from('mata_pelajaran').select('id,nama,kode').order('nama')
    setMapelAll(data || [])
  }

  const loadKelas = async () => {
    const { data } = await supabase.from('kelas').select('id,nama,tingkat').order('tingkat').order('nama')
    setKelasAll(data || [])
  }

  const openBank = async (b: BankSoal) => {
    setSelBank(b)
    const [{ data: soal }, { data: bsm }, { data: bsk }] = await Promise.all([
      supabase.from('questions').select('*').eq('bank_soal_id', b.id).order('number'),
      supabase.from('bank_soal_mapel').select('mata_pelajaran_id').eq('bank_soal_id', b.id),
      supabase.from('bank_soal_kelas').select('kelas_id').eq('bank_soal_id', b.id),
    ])
    setSoalList(soal || [])
    setBMIds(bsm?.map((r: any) => r.mata_pelajaran_id) || [])
    setBKIds(bsk?.map((r: any) => r.kelas_id) || [])
    setView('bank-detail')
  }

  // ── Bank CRUD ─────────────────────────────────────────────────
  const saveBank = async () => {
    if (!bankForm.nama.trim()) return
    if (editBankId) {
      await supabase.from('bank_soal').update(bankForm).eq('id', editBankId)
      setEBI(null)
    } else {
      await supabase.from('bank_soal').insert(bankForm)
    }
    setBF({ nama: '', deskripsi: '', is_active: true })
    await loadBanks(); flash('✅ Bank soal disimpan!')
  }

  const deleteBank = async (id: string) => {
    if (!confirm('Hapus bank soal ini?')) return
    await supabase.from('bank_soal').delete().eq('id', id)
    await loadBanks(); flash('🗑 Bank soal dihapus.')
    if (selBank?.id === id) { setSelBank(null); setView('bank-list') }
  }

  // ── Relasi toggle ─────────────────────────────────────────────
  const toggleMapel = async (mapelId: string) => {
    if (!selBank) return
    if (bankMapelIds.includes(mapelId)) {
      await supabase.from('bank_soal_mapel').delete().eq('bank_soal_id', selBank.id).eq('mata_pelajaran_id', mapelId)
      setBMIds(p => p.filter((x: any) => x !== mapelId))
    } else {
      await supabase.from('bank_soal_mapel').insert({ bank_soal_id: selBank.id, mata_pelajaran_id: mapelId })
      setBMIds(p => [...p, mapelId])
    }
    await loadBanks()
  }

  const toggleKelas = async (kelasId: string) => {
    if (!selBank) return
    if (bankKelasIds.includes(kelasId)) {
      await supabase.from('bank_soal_kelas').delete().eq('bank_soal_id', selBank.id).eq('kelas_id', kelasId)
      setBKIds(p => p.filter((x: any) => x !== kelasId))
    } else {
      await supabase.from('bank_soal_kelas').insert({ bank_soal_id: selBank.id, kelas_id: kelasId })
      setBKIds(p => [...p, kelasId])
    }
    await loadBanks()
  }

  // ── Soal CRUD ─────────────────────────────────────────────────
  const openSoalForm = (q?: Question) => {
    if (q) { setSFId(q.id); setSFNum(q.number.toString()); setSFQ(q.question); setSFActive(q.is_active) }
    else   { setSFId(''); setSFNum(''); setSFQ(''); setSFActive(true) }
    setView('soal-form')
  }

  const saveSoal = async () => {
    if (!selBank) { flash('❌ Pilih bank soal dulu.'); return }
    if (!soalFormQ.trim()) { flash('❌ Pertanyaan tidak boleh kosong.'); return }
    setSoalSaving(true)
    let number = parseInt(soalFormNum) || 0
    if (!soalFormId || !number) {
      const maxNum = soalList.reduce((m: any, q: any) => Math.max(m, q.number), 0)
      number = maxNum + 1
    }
    const payload = { number, question: soalFormQ.trim(), is_active: soalFormActive, bank_soal_id: selBank.id, mata_pelajaran_id: bankMapelIds[0] || null }
    if (soalFormId) await supabase.from('questions').update(payload).eq('id', soalFormId)
    else            await supabase.from('questions').insert(payload)
    const { data: fresh } = await supabase.from('questions').select('*').eq('bank_soal_id', selBank.id).order('number')
    setSoalList(fresh || [])
    await loadBanks(); setSoalSaving(false); flash('✅ Soal disimpan!'); setView('bank-detail')
  }

  const deleteSoal = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return
    await supabase.from('questions').delete().eq('id', id)
    if (selBank) {
      const { data: fresh } = await supabase.from('questions').select('*').eq('bank_soal_id', selBank.id).order('number')
      setSoalList(fresh || [])
    }
    await loadBanks(); flash('🗑 Soal dihapus.')
  }

  const toggleSoalActive = async (id: string, cur: boolean) => {
    await supabase.from('questions').update({ is_active: !cur }).eq('id', id)
    if (selBank) {
      const { data: fresh } = await supabase.from('questions').select('*').eq('bank_soal_id', selBank.id).order('number')
      setSoalList(fresh || [])
    }
  }

  // ── Import CSV ────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selBank) return
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async evt => {
      setImp(true)
      const lines = (evt.target?.result as string).trim().split('\n')
      const rows = lines.slice(1).map((line: any) => {
        const cols = line.split(';').map((c: any) => c.trim().replace(/^"|"$/g, ''))
        return { number: parseInt(cols[0])||0, question: cols[1]||'', is_active: (cols[2]||'1')!=='0' }
      }).filter((r: any) => r.question && r.number > 0)
      for (const row of rows) {
        await supabase.from('questions').insert({ ...row, bank_soal_id: selBank!.id, mata_pelajaran_id: bankMapelIds[0]||null })
      }
      const { data: fresh } = await supabase.from('questions').select('*').eq('bank_soal_id', selBank!.id).order('number')
      setSoalList(fresh || [])
      await loadBanks(); setImp(false); flash(`✅ ${rows.length} soal diimport!`); e.target.value = ''
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const csv = `nomor;pertanyaan;aktif\n1;Jelaskan pengertian dan tujuan dari ${selBank?.nama || 'mata kuliah ini'};1\n2;Apa perbedaan antara konsep A dan B? Berikan contoh masing-masing.;1`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `template-soal-${selBank?.nama.replace(/\s+/g,'-')||'bank'}.csv`; a.click()
  }

  // ── Penilaian ─────────────────────────────────────────────────
  const openJadwalList = async () => {
    if (!selBank || bankMapelIds.length === 0) { flash('⚠️ Bank soal belum punya mata pelajaran. Assign mapel dulu.'); return }
    const { data } = await supabase.from('jadwal_ujian')
      .select('id,nama,tanggal,mata_pelajaran_id,mata_pelajaran:mata_pelajaran_id(nama),kelas:kelas_id(nama)')
      .in('mata_pelajaran_id', bankMapelIds).order('tanggal', { ascending: false })
    setJadwalList((data||[]).map((j:any) => ({
      id: j.id, nama: j.nama, tanggal: j.tanggal, mapel_id: j.mata_pelajaran_id,
      mapel_nama: j.mata_pelajaran?.nama||null, kelas_nama: j.kelas?.nama||null,
    })))
    setView('jadwal-list')
  }

  const openPenilaian = async (j: Jadwal) => {
    setSelJadwal(j)
    const { data: js } = await supabase.from('jadwal_soal').select('question_id,urutan').eq('jadwal_id', j.id).order('urutan')
    const qIds = js?.map((r: any) => r.question_id) || []
    const { data: qs } = qIds.length ? await supabase.from('questions').select('id,number,question').in('id', qIds) : { data: [] }
    const { data: jd } = await supabase.from('jadwal_ujian').select('kelas_id').eq('id', j.id).single()
    let stuIds: string[] = []
    if (jd?.kelas_id) {
      const { data: sk } = await supabase.from('siswa_kelas').select('student_id').eq('kelas_id', jd.kelas_id)
      stuIds = sk?.map((r: any) => r.student_id) || []
    }
    if (!stuIds.length) {
      const { data: ex } = await supabase.from('exam_sessions').select('student_id').eq('jadwal_id', j.id)
      stuIds = ex?.map((r: any) => r.student_id) || []
    }
    if (!stuIds.length) { setSessions([]); setView('penilaian'); return }
    const [{ data: profs }, { data: exSess }, { data: skRows }, { data: ans }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,npm,username').in('id', stuIds),
      supabase.from('exam_sessions').select('student_id,submitted_at,is_submitted').eq('jadwal_id', j.id),
      supabase.from('siswa_kelas').select('student_id,kelas:kelas_id(nama)').in('student_id', stuIds),
      supabase.from('answers').select('id,answer_text,score,feedback,question_id,student_id').eq('jadwal_id', j.id),
    ])
    const result: GradingSession[] = stuIds.map((sid: any) => {
      const prof  = profs?.find((p: any) => p.id === sid)
      const sess  = exSess?.find((s: any) => s.student_id === sid)
      const skRow = (skRows as any[])?.find((r: any) => r.student_id === sid)
      const stuAns = (ans||[]).filter((a: any) => a.student_id === sid).map((a: any) => ({
        ...a, question: (qs as any[])?.find((q: any) => q.id === a.question_id) || { number: 0, question: '' }
      })).sort((a,b) => a.question.number - b.question.number)
      const graded = stuAns.filter((a: any) => a.score !== null)
      return {
        student_id: sid, full_name: prof?.full_name||'-', npm: prof?.npm||'-',
        username: prof?.username||'-', kelas: skRow?.kelas?.nama||'',
        submitted_at: sess?.submitted_at||null, is_submitted: sess?.is_submitted||false,
        answers: stuAns, graded_count: graded.length,
        total_score: graded.length ? Math.round(graded.reduce((s: any, a: any) => s+(a.score||0),0)/graded.length) : null,
      }
    })
    setSessions(result); setSelSess(null); setView('penilaian')
  }

  const openSession = (s: GradingSession) => {
    setSelSess(s)
    const sm: Record<string,{score:string;feedback:string}> = {}
    s.answers.forEach((a: any) => { sm[a.id] = { score: a.score?.toString()||'', feedback: a.feedback||'' } })
    setScores(sm); setView('penilaian-detail')
  }

  const saveScore = async (answerId: string) => {
    setSavingId(answerId)
    await supabase.from('answers').update({
      score: scores[answerId]?.score!=='' ? parseInt(scores[answerId].score) : null,
      feedback: scores[answerId]?.feedback||null,
    }).eq('id', answerId)
    setSavingId(null)
  }

  const saveAllScores = async () => {
    setSavingId('all')
    for (const id of Object.keys(scores)) await saveScore(id)
    if (selJadwal) await openPenilaian(selJadwal)
    setSavingId(null); flash('✅ Semua nilai disimpan!'); setView('penilaian')
  }

  // ── Downloads ─────────────────────────────────────────────────
  const dlSiswa = (s: GradingSession) => {
    let t = `JAWABAN UJIAN\n${'='.repeat(60)}\nNama: ${s.full_name}\nNPM: ${s.npm}\nUsername: ${s.username}\nKelas: ${s.kelas||'-'}\nUjian: ${selJadwal?.nama}\nMapel: ${selJadwal?.mapel_nama||'-'}\nDikumpul: ${s.submitted_at ? new Date(s.submitted_at).toLocaleString('id-ID') : 'Belum'}\n${'='.repeat(60)}\n\n`
    s.answers.forEach((a: any) => {
      t += `SOAL ${a.question.number}\n${'-'.repeat(40)}\n${a.question.question}\n\nJAWABAN:\n${a.answer_text||'(kosong)'}\n`
      if (a.score!==null) t += `\nNilai: ${a.score}/100\nFeedback: ${a.feedback||'-'}\n`
      t += '\n'
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' }))
    a.download = `jawaban-${s.npm}-${selJadwal?.nama.replace(/\s+/g,'-')}.txt`; a.click()
  }

  const dlRekapJawaban = () => {
    const allNomor: number[] = []
    sessions.forEach(s => s.answers.forEach((a: any) => { if (!allNomor.includes(a.question.number)) allNomor.push(a.question.number) }))
    allNomor.sort((x, y) => x - y)
    const header = ['Username','NPM','Nama Lengkap','Kelas','Status','Tgl Kumpul',
      ...allNomor.flatMap(n => [`Soal_${n}`, `Jawaban_${n}`, `Nilai_${n}`, `Feedback_${n}`]), 'Rata_Nilai']
    const rows = sessions.map(s => {
      const base = [s.username, s.npm, s.full_name, s.kelas||'-', s.is_submitted?'Dikumpulkan':'Belum', s.submitted_at?new Date(s.submitted_at).toLocaleString('id-ID'):'-']
      const ansCols = allNomor.flatMap(n => {
        const ans = s.answers.find((a: any) => a.question.number === n)
        return [ans?.question?.question?.replace(/\n/g,' ')||'-', ans?.answer_text?.replace(/\n/g,' ')||'(kosong)', ans?.score!=null?String(ans.score):'-', ans?.feedback?.replace(/\n/g,' ')||'-']
      })
      return [...base, ...ansCols, s.total_score!=null?String(s.total_score):'-']
    })
    const esc = (v: string) => `"${String(v).replace(/"/g,'""')}"`
    const csv = [header,...rows].map(r => r.map(esc).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `rekap-jawaban-${selJadwal?.nama.replace(/\s+/g,'-')}.csv`; a.click()
  }

  const dlSemua = () => {
    let t = `REKAP JAWABAN — ${selJadwal?.nama}\n${'='.repeat(60)}\n\n`
    sessions.forEach((s,i) => {
      t += `[${i+1}] ${s.full_name} (${s.npm}) — ${s.is_submitted?'Dikumpulkan':'Belum'}\nRata-rata: ${s.total_score??'Belum dinilai'}\n\n`
      s.answers.forEach((a: any) => {
        t += `  Soal ${a.question.number}: ${a.question.question}\n  Jawaban: ${a.answer_text||'(kosong)'}\n`
        if (a.score!==null) t += `  Nilai: ${a.score} | Feedback: ${a.feedback||'-'}\n`
        t += '\n'
      })
      t += `${'─'.repeat(60)}\n\n`
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain;charset=utf-8' }))
    a.download = `semua-jawaban-${selJadwal?.nama.replace(/\s+/g,'-')}.txt`; a.click()
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  // ── Sub-header: breadcrumb + back button (ditempel di bawah AdminNavbar) ──
  const SubHeader = ({ title, sub, back }: { title: string; sub?: string; back: () => void }) => (
    <div className="bg-slate-900/80 border-b border-slate-800/60 backdrop-blur-sm sticky top-14 z-40">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2.5">
        <button onClick={back} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 flex-shrink-0 transition-colors">
          <Ic d="M15 19l-7-7 7-7" cls="w-4 h-4"/>
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{title}</p>
          {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  )

  const Flash = () => msg ? (
    <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-green-500/10 text-green-400 border-green-500/20">{msg}</div>
  ) : null

  // ════════════════════════════════════════════════════════════
  // VIEW: SOAL FORM
  // ════════════════════════════════════════════════════════════
  if (view === 'soal-form') {
    const nextNum = soalFormId
      ? parseInt(soalFormNum) || soalList.reduce((m: any, q: any) => Math.max(m, q.number), 0)
      : soalList.reduce((m: any, q: any) => Math.max(m, q.number), 0) + 1
    return (
      <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
        <AdminNavbar adminName={adminName} />
        <SubHeader title={soalFormId ? 'Edit Soal' : 'Tambah Soal'} sub={selBank?.nama} back={() => setView('bank-detail')} />
        <div className="max-w-2xl mx-auto p-4">
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 px-3 py-2 rounded-lg">
              <Ic d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" cls="w-3.5 h-3.5 flex-shrink-0" />
              Nomor soal otomatis: <span className="text-amber-400 font-bold">#{nextNum}</span>
              {soalFormId && ' (nomor saat ini)'}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Pertanyaan *</label>
              <textarea value={soalFormQ} rows={10} placeholder="Tulis pertanyaan essay..."
                onChange={e => setSFQ(e.target.value)} autoFocus className="input-field w-full" />
              <p className="text-xs text-slate-600 mt-1">{soalFormQ.length} karakter</p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={soalFormActive} onChange={e => setSFActive(e.target.checked)} className="accent-amber-500 w-4 h-4" />
              <span className="text-sm text-slate-300">Soal aktif (muncul di ujian)</span>
            </label>
            {msg && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">{msg}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={saveSoal} disabled={soalSaving || !soalFormQ.trim()} className="btn-primary flex items-center gap-2">
                {soalSaving ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Menyimpan...</> : <><Ic d="M5 13l4 4L19 7"/>Simpan Soal</>}
              </button>
              <button onClick={() => setView('bank-detail')} className="btn-secondary">Batal</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // VIEW: PENILAIAN DETAIL
  // ════════════════════════════════════════════════════════════
  if (view === 'penilaian-detail' && selSession) {
    type ScoreEntry = { score: string; feedback: string }
    const scoreValues = Object.values(scores) as ScoreEntry[]
    const gradedNow = scoreValues.filter(s => s.score !== '').length
    const avgNow    = gradedNow > 0
      ? Math.round(scoreValues.filter(s => s.score !== '').reduce((sum, s) => sum + parseInt(s.score), 0) / gradedNow)
      : null
    return (
      <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
        <AdminNavbar adminName={adminName} />
        <SubHeader title={selSession.full_name} sub={`${selSession.npm} · ${selSession.username} · ${selJadwal?.nama}`} back={() => setView('penilaian')} />
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          <Flash/>
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200 flex-shrink-0">
                {selSession.full_name[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-100">{selSession.full_name}</p>
                <p className="text-xs text-slate-500">{selSession.username} · {selSession.npm} · {selSession.kelas||'—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center"><p className="text-xs text-slate-500">Dijawab</p><p className="font-bold text-slate-200">{selSession.answers.filter((a: any) => a.answer_text?.trim()).length}/{selSession.answers.length}</p></div>
              <div className="text-center"><p className="text-xs text-slate-500">Dinilai</p><p className="font-bold text-amber-400">{gradedNow}/{selSession.answers.length}</p></div>
              <div className="text-center"><p className="text-xs text-slate-500">Rata-rata</p>
                <p className={`font-bold text-lg ${avgNow!==null?(avgNow>=70?'text-green-400':'text-red-400'):'text-slate-600'}`}>{avgNow??'—'}</p>
              </div>
              <button onClick={() => dlSiswa(selSession)} className="btn-secondary text-xs py-1.5 flex items-center gap-1"><Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>DL</button>
            </div>
          </div>

          {selSession.answers.map((a: any) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg">Soal {a.question.number}</span>
                {scores[a.id]?.score!=='' && <span className={`text-xs font-bold px-2 py-0.5 rounded ${parseInt(scores[a.id]?.score||'0')>=70?'text-green-400 bg-green-500/10':'text-red-400 bg-red-500/10'}`}>{scores[a.id]?.score}/100</span>}
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4 mb-3 border border-slate-700/50">
                <p className="text-slate-300 text-sm leading-relaxed">{a.question.question}</p>
              </div>
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Jawaban Siswa</p>
              <p className={`text-sm leading-relaxed p-3 rounded-lg mb-4 ${a.answer_text?.trim()?'text-slate-200 bg-slate-800/30':'text-slate-600 italic'}`}>
                {a.answer_text?.trim()||'(tidak dijawab)'}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Nilai (0–100)</label>
                  <input type="number" min="0" max="100" value={scores[a.id]?.score||''}
                    onChange={e => setScores(p => ({ ...p, [a.id]: { ...p[a.id], score: e.target.value } }))}
                    onBlur={() => saveScore(a.id)} placeholder="—" className="input-field w-24 text-center font-mono"/>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Feedback</label>
                  <input type="text" value={scores[a.id]?.feedback||''}
                    onChange={e => setScores(p => ({ ...p, [a.id]: { ...p[a.id], feedback: e.target.value } }))}
                    onBlur={() => saveScore(a.id)} placeholder="Catatan..." className="input-field text-sm"/>
                </div>
              </div>
              {savingId===a.id && <p className="text-xs text-amber-400 mt-2 flex items-center gap-1"><div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin"/>Menyimpan...</p>}
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={saveAllScores} disabled={savingId==='all'} className="btn-primary flex items-center gap-2">
              {savingId==='all'?<><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Menyimpan...</>:'💾 Simpan Semua Nilai'}
            </button>
            <button onClick={() => setView('penilaian')} className="btn-secondary">Kembali</button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // VIEW: PENILAIAN LIST
  // ════════════════════════════════════════════════════════════
  if (view === 'penilaian') return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
      <AdminNavbar adminName={adminName} />
      <SubHeader title={`Penilaian — ${selJadwal?.nama}`} sub={`${selJadwal?.mapel_nama} · ${selJadwal?.kelas_nama||'Semua Kelas'}`} back={() => setView('jadwal-list')} />
      <div className="max-w-5xl mx-auto p-4">
        <Flash/>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['Total Siswa', sessions.length, 'text-slate-100'],['Sudah Kumpul', sessions.filter((s: any) => s.is_submitted).length, 'text-green-400'],['Selesai Dinilai', sessions.filter((s: any) => s.graded_count===s.answers.length&&s.answers.length>0).length, 'text-amber-400']].map(([l,v,c]) => (
            <div key={l as string} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${c}`}>{v}</p>
              <p className="text-xs text-slate-500 mt-0.5">{l}</p>
            </div>
          ))}
        </div>
        <div className="card p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
          <input type="text" value={gradSearch} onChange={e => setGS(e.target.value)} placeholder="Cari nama / NPM / username..." className="input-field text-sm py-2 flex-1 min-w-[200px] max-w-xs"/>
          <div className="flex flex-wrap gap-2">
            <button onClick={dlSemua} disabled={!sessions.length} className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>Semua Jawaban (.txt)
            </button>
            <button onClick={dlRekapJawaban} disabled={!sessions.length} className="btn-secondary text-xs py-2 flex items-center gap-1.5">
              <Ic d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>Rekap Jawaban (.csv)
            </button>
          </div>
        </div>
        {sessions.length===0
          ? <div className="card p-10 text-center text-slate-500">Belum ada siswa untuk jadwal ini.</div>
          : <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800 bg-slate-800/30">
                  {['Siswa','Username','Kelas','Status','Dijawab','Dinilai','Nilai','Aksi'].map(h =>
                    <th key={h} className="text-left text-xs text-slate-500 font-medium p-3 first:pl-4">{h}</th>)}
                </tr></thead>
                <tbody>
                  {sessions.filter((s: any) => !gradSearch || s.full_name.toLowerCase().includes(gradSearch.toLowerCase()) || s.npm.includes(gradSearch) || s.username.toLowerCase().includes(gradSearch.toLowerCase()))
                    .map((s: any) => (
                    <tr key={s.student_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="p-3 pl-4"><p className="font-medium text-slate-200 text-sm">{s.full_name}</p><p className="text-xs text-slate-500">{s.npm}</p></td>
                      <td className="p-3 text-slate-400 font-mono text-sm">{s.username}</td>
                      <td className="p-3 text-slate-400 text-sm">{s.kelas||'—'}</td>
                      <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.is_submitted?'bg-green-500/10 text-green-400':'bg-slate-700 text-slate-500'}`}>{s.is_submitted?'Dikumpulkan':'Belum'}</span></td>
                      <td className="p-3 text-center text-sm text-slate-300">{s.answers.filter((a: any) => a.answer_text?.trim()).length}/{s.answers.length}</td>
                      <td className="p-3 text-center"><span className={`text-sm font-medium ${s.graded_count===s.answers.length&&s.answers.length>0?'text-green-400':'text-amber-400'}`}>{s.graded_count}/{s.answers.length}</span></td>
                      <td className="p-3 text-center"><span className={`text-sm font-bold ${s.total_score!==null?(s.total_score>=70?'text-green-400':'text-red-400'):'text-slate-600'}`}>{s.total_score??'—'}</span></td>
                      <td className="p-3"><div className="flex gap-1">
                        <button onClick={() => openSession(s)} className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 rounded hover:bg-slate-800">Nilai</button>
                        <button onClick={() => dlSiswa(s)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800"><Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // VIEW: JADWAL LIST
  // ════════════════════════════════════════════════════════════
  if (view === 'jadwal-list') return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
      <AdminNavbar adminName={adminName} />
      <SubHeader title={`Penilaian — ${selBank?.nama}`} sub="Pilih jadwal ujian" back={() => setView('bank-detail')} />
      <div className="max-w-4xl mx-auto p-4">
        {jadwalList.length===0
          ? <div className="card p-10 text-center text-slate-500">Belum ada jadwal untuk mapel di bank soal ini.</div>
          : <div className="space-y-2">
              {jadwalList.map((j: any) => (
                <button key={j.id} onClick={() => openPenilaian(j)} className="card p-5 w-full text-left hover:border-amber-500/30 transition-all group">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">{j.nama}</p>
                      <div className="flex gap-3 mt-0.5">
                        {j.mapel_nama && <span className="text-xs text-slate-500">{j.mapel_nama}</span>}
                        {j.kelas_nama && <span className="text-xs text-slate-500">· {j.kelas_nama}</span>}
                        <span className="text-xs text-slate-600">{new Date(j.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span>
                      </div>
                    </div>
                    <Ic d="M9 5l7 7-7 7" cls="w-5 h-5 text-slate-600 group-hover:text-amber-400 flex-shrink-0"/>
                  </div>
                </button>
              ))}
            </div>}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // VIEW: BANK DETAIL
  // ════════════════════════════════════════════════════════════
  if (view === 'bank-detail' && selBank) return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
      <AdminNavbar adminName={adminName} />
      <SubHeader title={selBank.nama} sub={`${soalList.length} soal · ${bankMapelIds.length} mapel · ${bankKelasIds.length} kelas`} back={() => { setSelBank(null); setView('bank-list') }} />
      <div className="max-w-5xl mx-auto p-4">
        <Flash/>
        <div className="grid md:grid-cols-[1fr_280px] gap-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => openSoalForm()} className="btn-primary text-sm py-2 flex items-center gap-1.5"><Ic d="M12 4v16m8-8H4"/>Tambah Soal</button>
              <button onClick={openJadwalList} className="btn-secondary text-sm py-2 flex items-center gap-1.5"><Ic d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>Penilaian</button>
              <button onClick={downloadTemplate} className="btn-secondary text-sm py-2 flex items-center gap-1.5"><Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>Template CSV</button>
              <label className={`btn-secondary text-sm py-2 flex items-center gap-1.5 cursor-pointer ${importing?'opacity-50 pointer-events-none':''}`}>
                <Ic d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                {importing?'Mengimport...':'Import CSV'}
                <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden"/>
              </label>
            </div>
            <p className="text-xs text-slate-500 mb-3">{soalList.filter((q: any) => q.is_active).length} aktif · {soalList.filter((q: any) => !q.is_active).length} nonaktif</p>
            {soalList.length===0
              ? <div className="card p-10 text-center text-slate-500">
                  <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" cls="w-10 h-10 mx-auto text-slate-700 mb-3"/>
                  <p>Belum ada soal. Klik Tambah Soal atau Import CSV.</p>
                </div>
              : <div className="space-y-2">
                  {soalList.map((q: any) => (
                    <div key={q.id} className={`card p-4 flex items-start gap-3 ${!q.is_active?'opacity-50':''}`}>
                      <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-400 font-bold text-sm">{q.number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 leading-relaxed">{q.question}</p>
                        <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${q.is_active?'text-green-400 bg-green-500/10':'text-slate-500 bg-slate-800'}`}>{q.is_active?'Aktif':'Nonaktif'}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => toggleSoalActive(q.id,q.is_active)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">{q.is_active?'Nonaktif':'Aktif'}</button>
                        <button onClick={() => openSoalForm(q)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800">Edit</button>
                        <button onClick={() => deleteSoal(q.id)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800">Hapus</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-slate-100 mb-1">Mata Pelajaran</h4>
              <p className="text-xs text-slate-500 mb-3">Soal bank ini dapat dipakai untuk mapel yang dicentang.</p>
              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                {mapelAll.map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={bankMapelIds.includes(m.id)} onChange={() => toggleMapel(m.id)} className="accent-amber-500 flex-shrink-0"/>
                    <div className="min-w-0"><p className="text-sm text-slate-200 truncate">{m.nama}</p><p className="text-xs text-slate-500">{m.kode}</p></div>
                  </label>
                ))}
                {mapelAll.length===0 && <p className="text-xs text-slate-600 text-center py-4">Belum ada mapel.</p>}
              </div>
            </div>
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-slate-100 mb-1">Kelas</h4>
              <p className="text-xs text-slate-500 mb-3">Siswa dari kelas yang dicentang bisa menggunakan bank soal ini.</p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {kelasAll.map((k: any) => (
                  <label key={k.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <input type="checkbox" checked={bankKelasIds.includes(k.id)} onChange={() => toggleKelas(k.id)} className="accent-amber-500 flex-shrink-0"/>
                    <p className="text-sm text-slate-200">{k.nama}</p>
                  </label>
                ))}
                {kelasAll.length===0 && <p className="text-xs text-slate-600 text-center py-4">Belum ada kelas.</p>}
              </div>
            </div>
            <div className="card p-4 bg-slate-800/30">
              <p className="text-xs font-medium text-slate-400 mb-2">Format Import CSV</p>
              <code className="text-xs text-amber-400 block bg-slate-900 px-3 py-2 rounded-lg leading-relaxed">
                nomor;pertanyaan;aktif<br/>1;Jelaskan...;1<br/>2;Apa itu...;0
              </code>
              <p className="text-xs text-slate-600 mt-2">Pisah dengan titik koma (;). Aktif: 1=aktif, 0=nonaktif.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // VIEW: BANK LIST — AdminNavbar tanpa SubHeader (ini halaman utama)
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 pb-20 md:pb-4">
      <AdminNavbar adminName={adminName} />
      <div className="max-w-5xl mx-auto p-4">
        <Flash/>
        <div className="card p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">{editBankId ? 'Edit Bank Soal' : 'Buat Bank Soal Baru'}</h2>
          <div className="flex flex-wrap gap-3">
            <input type="text" value={bankForm.nama} onChange={e => setBF(p => ({ ...p, nama: e.target.value }))}
              placeholder="Nama bank soal (cth: UTS Ganjil 2025 — Kelas A)" className="input-field flex-1 min-w-[220px] text-sm py-2"/>
            <input type="text" value={bankForm.deskripsi} onChange={e => setBF(p => ({ ...p, deskripsi: e.target.value }))}
              placeholder="Deskripsi (opsional)" className="input-field flex-1 min-w-[160px] text-sm py-2"/>
            <div className="flex gap-2">
              <button onClick={saveBank} disabled={!bankForm.nama.trim()} className="btn-primary text-sm py-2 whitespace-nowrap">
                {editBankId ? 'Simpan Perubahan' : '+ Buat Bank Soal'}
              </button>
              {editBankId && <button onClick={() => { setBF({ nama:'',deskripsi:'',is_active:true }); setEBI(null) }} className="btn-secondary text-sm py-2">Batal</button>}
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2">💡 Tips: beri nama yang spesifik, misalnya "UTS RPL Kelas A" agar mudah dibedakan.</p>
        </div>

        {bankList.length===0
          ? <div className="card p-12 text-center text-slate-500">
              <Ic d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" cls="w-10 h-10 mx-auto text-slate-700 mb-3"/>
              <p>Belum ada bank soal. Buat yang pertama di atas.</p>
            </div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankList.map((b: any) => (
                <div key={b.id} className={`card p-5 hover:border-amber-500/30 transition-all group ${!b.is_active?'opacity-60':''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-100 group-hover:text-amber-400 transition-colors leading-tight">{b.nama}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                      <button onClick={() => { setBF({nama:b.nama,deskripsi:b.deskripsi||'',is_active:b.is_active}); setEBI(b.id) }}
                        className="text-xs text-slate-400 hover:text-slate-200 px-1.5 py-1 rounded hover:bg-slate-800">Edit</button>
                      <button onClick={() => deleteBank(b.id)} className="text-xs text-red-500 hover:text-red-400 px-1.5 py-1 rounded hover:bg-slate-800">Hapus</button>
                    </div>
                  </div>
                  {b.deskripsi && <p className="text-xs text-slate-500 mb-3 line-clamp-1">{b.deskripsi}</p>}
                  {b.mapel_list.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {b.mapel_list.map((m: any) => <span key={m.id} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">{m.kode||m.nama}</span>)}
                    </div>
                  )}
                  {b.kelas_list.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {b.kelas_list.map((k: any) => <span key={k.id} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{k.nama}</span>)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">📝 {b.jumlah_soal} soal</span>
                  </div>
                  <button onClick={() => openBank(b)} className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-1.5">
                    Buka Bank Soal <Ic d="M9 5l7 7-7 7"/>
                  </button>
                </div>
              ))}
            </div>}
      </div>
    </div>
  )
}