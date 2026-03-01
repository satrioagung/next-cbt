'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────
type Kelas    = { id: string; nama: string; tingkat: string; jumlah_siswa?: number; jumlah_mapel?: number }
type Mapel    = { id: string; nama: string; kode: string; deskripsi: string; jumlah_soal?: number; jumlah_kelas?: number; jumlah_bank?: number }
type Question = { id: string; number: number; question: string; is_active: boolean; mata_pelajaran_id?: string | null; bank_soal_id?: string | null }
type BankSoal = { id: string; nama: string; deskripsi: string; is_active: boolean; jumlah_soal?: number }
type Jadwal   = {
  id: string; nama: string; tanggal: string; waktu_mulai: string; waktu_selesai: string
  durasi_menit: number; is_active: boolean; mata_pelajaran_id: string | null; kelas_id: string | null
  mapel_nama?: string | null; mapel_kode?: string | null; kelas_nama?: string | null
  jumlah_soal?: number; jumlah_siswa?: number
}
type Token   = { id: string; token: string; is_active: boolean; expired_at: string | null; created_at: string; jadwal?: { nama: string; mapel_nama?: string } }
type Student = { id: string; full_name: string; npm: string }

type ActiveTab = 'kelas' | 'mapel' | 'jadwal' | 'token'

// ── Icon ──────────────────────────────────────────────────────
const Icon = ({ d, className = 'w-4 h-4' }: { d: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)
const IC = {
  plus:     'M12 4v16m8-8H4',
  back:     'M15 19l-7-7 7-7',
  key:      'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  users:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  book:     'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  doc:      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  link:     'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  x:        'M6 18L18 6M6 6l12 12',
  grid:     'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
}

// ── Main ──────────────────────────────────────────────────────
export default function AkademikPage() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('kelas')
  const [msg, setMsg]             = useState('')
  const [saving, setSaving]       = useState(false)

  // Data
  const [kelasList, setKelasList]   = useState<Kelas[]>([])
  const [mapelList, setMapelList]   = useState<Mapel[]>([])
  const [soalList, setSoalList]     = useState<Question[]>([])
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([])
  const [tokenList, setTokenList]   = useState<Token[]>([])
  const [students, setStudents]     = useState<Student[]>([])

  // Panel
  const [panel, setPanel] = useState<
    | { type: 'none' }
    | { type: 'kelas-form';   id: string | null }
    | { type: 'kelas-siswa';  kelasId: string; kelasNama: string }
    | { type: 'kelas-mapel';  kelasId: string; kelasNama: string }
    | { type: 'mapel-form';   id: string | null }
    | { type: 'mapel-bank';   mapelId: string; mapelNama: string }   // bank soal list untuk mapel
    | { type: 'mapel-soal';   mapelId: string; mapelNama: string; bankId: string; bankNama: string }   // soal dalam 1 bank soal
    | { type: 'mapel-kelas';  mapelId: string; mapelNama: string }   // relasi mapel → kelas
    | { type: 'soal-form';    id: string | null; mapelId: string; bankId: string }
    | { type: 'jadwal-form';  id: string | null }
    | { type: 'jadwal-soal';  jadwalId: string; jadwalNama: string }
    | { type: 'token-gen' }
  >({ type: 'none' })

  // Forms
  const [kelasForm, setKF]  = useState({ nama: '', tingkat: '' })
  const [mapelForm, setMF]  = useState({ nama: '', kode: '', deskripsi: '' })
  const [soalForm,  setSF]  = useState({ number: '', question: '', is_active: true })
  const [jadwalForm, setJF] = useState({ nama: '', mata_pelajaran_id: '', kelas_id: '', tanggal: '', waktu_mulai: '', waktu_selesai: '', durasi_menit: '90' })
  const [tokenForm, setTF]  = useState({ jadwal_id: '', expired_at: '' })

  // Relasi states
  const [kelasStudents,  setKelasStudents]  = useState<string[]>([])
  const [kelasMapelIds,  setKelasMapelIds]  = useState<string[]>([])
  const [mapelKelasIds,  setMapelKelasIds]  = useState<string[]>([])
  const [jadwalSoalIds,  setJadwalSoalIds]  = useState<string[]>([])

  // Bank soal state
  const [bankSoalList,   setBankSoalList]   = useState<BankSoal[]>([])
  const [bankSoalForMapel, setBSFM]         = useState<BankSoal[]>([]) // bank soal milik mapel yang dipilih

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') { router.push('/exam'); return }
    await loadAll()
    setLoading(false)
  }

  const loadAll = async () => {
    const [k, m, q, j, t, s, sk, mk, bs, bsm] = await Promise.all([
      supabase.from('kelas').select('*').order('tingkat').order('nama'),
      supabase.from('mata_pelajaran').select('*').order('nama'),
      supabase.from('questions').select('id,number,question,is_active,mata_pelajaran_id,bank_soal_id').order('number'),
      supabase.from('v_jadwal_full').select('*').order('tanggal', { ascending: false }),
      supabase.from('token_ujian')
        .select('*, jadwal:jadwal_id(nama, mata_pelajaran:mata_pelajaran_id(nama))')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,npm').eq('role', 'student').order('full_name'),
      supabase.from('siswa_kelas').select('kelas_id,student_id'),
      supabase.from('mapel_kelas').select('mata_pelajaran_id,kelas_id'),
      supabase.from('bank_soal').select('*').order('nama'),
      supabase.from('bank_soal_mapel').select('bank_soal_id,mata_pelajaran_id'),
    ])

    const kelasFull = (k.data || []).map(kl => ({
      ...kl,
      jumlah_siswa: sk.data?.filter(r => r.kelas_id === kl.id).length || 0,
      jumlah_mapel: mk.data?.filter(r => r.kelas_id === kl.id).length || 0,
    }))
    const mapelFull = (m.data || []).map(mp => ({
      ...mp,
      jumlah_soal:  q.data?.filter(r => r.mata_pelajaran_id === mp.id || bsm.data?.some(b => b.mata_pelajaran_id === mp.id && q.data?.some(qq => qq.bank_soal_id === b.bank_soal_id))).length || 0,
      jumlah_kelas: mk.data?.filter(r => r.mata_pelajaran_id === mp.id).length || 0,
      jumlah_bank:  bsm.data?.filter(r => r.mata_pelajaran_id === mp.id).length || 0,
    }))
    const bankFull = (bs.data || []).map((b: any) => ({
      ...b,
      jumlah_soal: q.data?.filter(r => r.bank_soal_id === b.id).length || 0,
    }))

    setKelasList(kelasFull)
    setMapelList(mapelFull)
    setSoalList(q.data || [])
    setBankSoalList(bankFull)
    setJadwalList(j.data || [])
    setTokenList((t.data || []).map((tk: any) => ({
      ...tk,
      jadwal: tk.jadwal ? { nama: tk.jadwal.nama, mapel_nama: tk.jadwal.mata_pelajaran?.nama } : undefined
    })))
    setStudents(s.data || [])
  }

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const closePanel = () => setPanel({ type: 'none' })

  // ── KELAS ─────────────────────────────────────────────────────
  const saveKelas = async () => {
    if (panel.type !== 'kelas-form') return
    setSaving(true)
    panel.id
      ? await supabase.from('kelas').update(kelasForm).eq('id', panel.id)
      : await supabase.from('kelas').insert(kelasForm)
    await loadAll(); setSaving(false); closePanel(); flash('✅ Kelas disimpan!')
  }

  const deleteKelas = async (id: string) => {
    if (!confirm('Hapus kelas ini?')) return
    await supabase.from('kelas').delete().eq('id', id)
    await loadAll(); flash('🗑 Kelas dihapus.')
    if ((panel as any).kelasId === id) closePanel()
  }

  const openKelasForm = (k?: Kelas) => {
    setKF(k ? { nama: k.nama, tingkat: k.tingkat || '' } : { nama: '', tingkat: '' })
    setPanel({ type: 'kelas-form', id: k?.id || null })
  }

  const openSiswaKelas = async (k: Kelas) => {
    const { data } = await supabase.from('siswa_kelas').select('student_id').eq('kelas_id', k.id)
    setKelasStudents(data?.map(d => d.student_id) || [])
    setPanel({ type: 'kelas-siswa', kelasId: k.id, kelasNama: k.nama })
  }

  const toggleSiswaKelas = async (studentId: string) => {
    if (panel.type !== 'kelas-siswa') return
    if (kelasStudents.includes(studentId)) {
      await supabase.from('siswa_kelas').delete().eq('kelas_id', panel.kelasId).eq('student_id', studentId)
      setKelasStudents(p => p.filter(id => id !== studentId))
    } else {
      await supabase.from('siswa_kelas').insert({ kelas_id: panel.kelasId, student_id: studentId })
      setKelasStudents(p => [...p, studentId])
    }
    await loadAll()
  }

  const openKelasMapel = async (k: Kelas) => {
    const { data } = await supabase.from('mapel_kelas').select('mata_pelajaran_id').eq('kelas_id', k.id)
    setKelasMapelIds(data?.map(d => d.mata_pelajaran_id) || [])
    setPanel({ type: 'kelas-mapel', kelasId: k.id, kelasNama: k.nama })
  }

  const toggleKelasMapel = async (mapelId: string) => {
    if (panel.type !== 'kelas-mapel') return
    if (kelasMapelIds.includes(mapelId)) {
      await supabase.from('mapel_kelas').delete().eq('kelas_id', panel.kelasId).eq('mata_pelajaran_id', mapelId)
      setKelasMapelIds(p => p.filter(id => id !== mapelId))
    } else {
      await supabase.from('mapel_kelas').insert({ kelas_id: panel.kelasId, mata_pelajaran_id: mapelId })
      setKelasMapelIds(p => [...p, mapelId])
    }
    await loadAll()
  }

  // ── MAPEL ─────────────────────────────────────────────────────
  const saveMapel = async () => {
    if (panel.type !== 'mapel-form') return
    setSaving(true)
    panel.id
      ? await supabase.from('mata_pelajaran').update(mapelForm).eq('id', panel.id)
      : await supabase.from('mata_pelajaran').insert(mapelForm)
    await loadAll(); setSaving(false); closePanel(); flash('✅ Mata pelajaran disimpan!')
  }

  const deleteMapel = async (id: string) => {
    if (!confirm('Hapus mata pelajaran ini? Soal-soal di dalamnya tidak akan ikut terhapus.')) return
    await supabase.from('mata_pelajaran').delete().eq('id', id)
    await loadAll(); flash('🗑 Mata pelajaran dihapus.')
    if ((panel as any).mapelId === id) closePanel()
  }

  const openMapelForm = (m?: Mapel) => {
    setMF(m ? { nama: m.nama, kode: m.kode || '', deskripsi: m.deskripsi || '' } : { nama: '', kode: '', deskripsi: '' })
    setPanel({ type: 'mapel-form', id: m?.id || null })
  }

  // Bank Soal: tampilkan daftar bank soal milik mapel ini
  const openBankSoal = async (m: Mapel) => {
    // Load bank soal yang terhubung ke mapel ini
    const { data: bsm } = await supabase
      .from('bank_soal_mapel').select('bank_soal_id').eq('mata_pelajaran_id', m.id)
    const bankIds = bsm?.map(r => r.bank_soal_id) || []
    const banks = bankSoalList
      .filter(b => bankIds.includes(b.id))
      .map(b => ({ ...b, jumlah_soal: soalList.filter(q => q.bank_soal_id === b.id).length }))
    setBSFM(banks)
    setPanel({ type: 'mapel-bank', mapelId: m.id, mapelNama: m.nama })
  }

  // Buat bank soal baru langsung dari panel mapel
  const createBankForMapel = async (mapelId: string, mapelNama: string) => {
    const nama = prompt(`Nama bank soal baru untuk ${mapelNama}:`)
    if (!nama?.trim()) return
    const { data: newBank } = await supabase
      .from('bank_soal').insert({ nama: nama.trim() }).select().single()
    if (newBank) {
      await supabase.from('bank_soal_mapel').insert({ bank_soal_id: newBank.id, mata_pelajaran_id: mapelId })
    }
    await loadAll()
    // Reopen panel with fresh data
    const { data: bsm } = await supabase
      .from('bank_soal_mapel').select('bank_soal_id').eq('mata_pelajaran_id', mapelId)
    const bankIds = bsm?.map(r => r.bank_soal_id) || []
    const { data: freshBanks } = await supabase.from('bank_soal').select('*').in('id', bankIds)
    const banks = (freshBanks || []).map(b => ({ ...b, jumlah_soal: soalList.filter(q => q.bank_soal_id === b.id).length }))
    setBSFM(banks)
    flash('✅ Bank soal dibuat!')
  }

  // Buka soal dalam bank soal tertentu
  const openBankSoalDetail = (mapelId: string, mapelNama: string, bank: BankSoal) => {
    setSF({ number: '', question: '', is_active: true })
    setPanel({ type: 'mapel-soal', mapelId, mapelNama, bankId: bank.id, bankNama: bank.nama })
  }

  // Relasi mapel → kelas
  const openMapelKelas = async (m: Mapel) => {
    const { data } = await supabase.from('mapel_kelas').select('kelas_id').eq('mata_pelajaran_id', m.id)
    setMapelKelasIds(data?.map(d => d.kelas_id) || [])
    setPanel({ type: 'mapel-kelas', mapelId: m.id, mapelNama: m.nama })
  }

  const toggleMapelKelas = async (kelasId: string) => {
    if (panel.type !== 'mapel-kelas') return
    if (mapelKelasIds.includes(kelasId)) {
      await supabase.from('mapel_kelas').delete().eq('mata_pelajaran_id', panel.mapelId).eq('kelas_id', kelasId)
      setMapelKelasIds(p => p.filter(id => id !== kelasId))
    } else {
      await supabase.from('mapel_kelas').insert({ mata_pelajaran_id: panel.mapelId, kelas_id: kelasId })
      setMapelKelasIds(p => [...p, kelasId])
    }
    await loadAll()
  }

  // ── SOAL (selalu dalam konteks bank soal + mapel) ──────────────
  const openSoalForm = (mapelId: string, bankId: string, q?: Question) => {
    setSF(q ? { number: q.number.toString(), question: q.question, is_active: q.is_active }
             : { number: '', question: '', is_active: true })
    setPanel({ type: 'soal-form', id: q?.id || null, mapelId, bankId })
  }

  const saveSoal = async () => {
    if (panel.type !== 'soal-form') return
    setSaving(true)
    const payload = {
      number: parseInt(soalForm.number),
      question: soalForm.question,
      mata_pelajaran_id: panel.mapelId,
      bank_soal_id: panel.bankId,
      is_active: soalForm.is_active,
    }
    panel.id
      ? await supabase.from('questions').update(payload).eq('id', panel.id)
      : await supabase.from('questions').insert(payload)
    await loadAll(); setSaving(false)
    // Kembali ke soal list bank ini
    const bank = bankSoalList.find(b => b.id === panel.bankId) || { id: panel.bankId, nama: '—', deskripsi: '', is_active: true }
    const mapel = mapelList.find(m => m.id === panel.mapelId)
    setPanel({ type: 'mapel-soal', mapelId: panel.mapelId, mapelNama: mapel?.nama || '—', bankId: panel.bankId, bankNama: bank.nama })
    flash('✅ Soal disimpan!')
  }

  const deleteSoal = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return
    await supabase.from('questions').delete().eq('id', id)
    await loadAll(); flash('🗑 Soal dihapus.')
  }

  const toggleSoalActive = async (id: string, cur: boolean) => {
    await supabase.from('questions').update({ is_active: !cur }).eq('id', id)
    await loadAll()
  }

  // ── JADWAL ────────────────────────────────────────────────────
  const saveJadwal = async () => {
    if (panel.type !== 'jadwal-form') return
    setSaving(true)
    const payload = {
      nama: jadwalForm.nama,
      mata_pelajaran_id: jadwalForm.mata_pelajaran_id || null,
      kelas_id: jadwalForm.kelas_id || null,
      tanggal: jadwalForm.tanggal,
      waktu_mulai: jadwalForm.waktu_mulai,
      waktu_selesai: jadwalForm.waktu_selesai,
      durasi_menit: parseInt(jadwalForm.durasi_menit),
    }
    panel.id
      ? await supabase.from('jadwal_ujian').update(payload).eq('id', panel.id)
      : await supabase.from('jadwal_ujian').insert(payload)
    await loadAll(); setSaving(false); closePanel(); flash('✅ Jadwal disimpan!')
  }

  const deleteJadwal = async (id: string) => {
    if (!confirm('Hapus jadwal ini? Token terkait juga akan terhapus.')) return
    await supabase.from('jadwal_ujian').delete().eq('id', id)
    await loadAll(); flash('🗑 Jadwal dihapus.')
    if ((panel as any).jadwalId === id) closePanel()
  }

  const toggleJadwalActive = async (id: string, cur: boolean) => {
    await supabase.from('jadwal_ujian').update({ is_active: !cur }).eq('id', id)
    await loadAll()
  }

  const openJadwalForm = (j?: Jadwal) => {
    setJF(j ? {
      nama: j.nama, mata_pelajaran_id: j.mata_pelajaran_id || '',
      kelas_id: j.kelas_id || '', tanggal: j.tanggal,
      waktu_mulai: j.waktu_mulai, waktu_selesai: j.waktu_selesai,
      durasi_menit: j.durasi_menit.toString(),
    } : { nama: '', mata_pelajaran_id: '', kelas_id: '', tanggal: '', waktu_mulai: '', waktu_selesai: '', durasi_menit: '90' })
    setPanel({ type: 'jadwal-form', id: j?.id || null })
  }

  const openJadwalSoal = async (j: Jadwal) => {
    const { data } = await supabase.from('jadwal_soal').select('question_id').eq('jadwal_id', j.id)
    setJadwalSoalIds(data?.map(d => d.question_id) || [])
    setPanel({ type: 'jadwal-soal', jadwalId: j.id, jadwalNama: j.nama })
  }

  const toggleJadwalSoal = async (questionId: string) => {
    if (panel.type !== 'jadwal-soal') return
    if (jadwalSoalIds.includes(questionId)) {
      await supabase.from('jadwal_soal').delete().eq('jadwal_id', panel.jadwalId).eq('question_id', questionId)
      setJadwalSoalIds(p => p.filter(id => id !== questionId))
    } else {
      await supabase.from('jadwal_soal').insert({ jadwal_id: panel.jadwalId, question_id: questionId, urutan: jadwalSoalIds.length + 1 })
      setJadwalSoalIds(p => [...p, questionId])
    }
    await loadAll()
  }

  const selectAllSoalMapel = async (mapelId: string) => {
    if (panel.type !== 'jadwal-soal') return
    const filtered = soalList.filter(q => q.mata_pelajaran_id === mapelId && q.is_active && !jadwalSoalIds.includes(q.id))
    for (let i = 0; i < filtered.length; i++) {
      await supabase.from('jadwal_soal').insert({ jadwal_id: panel.jadwalId, question_id: filtered[i].id, urutan: jadwalSoalIds.length + i + 1 })
    }
    const { data } = await supabase.from('jadwal_soal').select('question_id').eq('jadwal_id', panel.jadwalId)
    setJadwalSoalIds(data?.map(d => d.question_id) || [])
    await loadAll()
  }

  // ── TOKEN ─────────────────────────────────────────────────────
  const generateToken = async () => {
    if (!tokenForm.jadwal_id) { flash('⚠️ Pilih jadwal terlebih dahulu.'); return }
    setSaving(true)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let token = ''
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)]
    const payload: any = { jadwal_id: tokenForm.jadwal_id, token, is_active: true }
    if (tokenForm.expired_at) payload.expired_at = new Date(tokenForm.expired_at).toISOString()
    const { error } = await supabase.from('token_ujian').insert(payload)
    error ? flash('❌ ' + error.message) : flash(`✅ Token ${token} berhasil dibuat!`)
    await loadAll(); setSaving(false)
    setTF(p => ({ ...p, expired_at: '' }))
  }

  const toggleToken = async (id: string, cur: boolean) => {
    await supabase.from('token_ujian').update({ is_active: !cur }).eq('id', id)
    await loadAll()
  }

  const deleteToken = async (id: string) => {
    if (!confirm('Hapus token ini?')) return
    await supabase.from('token_ujian').delete().eq('id', id)
    await loadAll(); flash('🗑 Token dihapus.')
  }

  const copyToken = (token: string) => { navigator.clipboard.writeText(token); flash(`📋 Token ${token} disalin!`) }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const TABS: { key: ActiveTab; label: string; icon: keyof typeof IC; count?: number }[] = [
    { key: 'kelas',  label: 'Kelas',         icon: 'users',    count: kelasList.length },
    { key: 'mapel',  label: 'Mata Pelajaran', icon: 'book',     count: mapelList.length },
    { key: 'jadwal', label: 'Jadwal Ujian',   icon: 'calendar', count: jadwalList.length },
    { key: 'token',  label: 'Token',          icon: 'key',      count: tokenList.filter(t => t.is_active).length },
  ]

  const panelOpen = panel.type !== 'none'

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/admin')} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <Icon d={IC.back} />
          </button>
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon d={IC.grid} className="w-4 h-4 text-slate-950" />
          </div>
          <h1 className="font-semibold text-slate-100">Manajemen Akademik</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        {/* Flash */}
        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm border animate-fade-in ${
            msg.startsWith('✅') || msg.startsWith('📋') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
            msg.startsWith('⚠️') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            msg.startsWith('🗑') ? 'bg-slate-800 text-slate-400 border-slate-700' :
            'bg-red-500/10 text-red-400 border-red-500/20'}`}>{msg}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); closePanel() }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${activeTab === t.key ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}>
              <Icon d={IC[t.icon]} className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Split layout */}
        <div className={`grid gap-4 transition-all ${panelOpen ? 'md:grid-cols-[1fr_380px]' : ''}`}>

          {/* ── LEFT ─────────────────────────────────────────── */}
          <div className="min-w-0">

            {/* ─ KELAS ─ */}
            {activeTab === 'kelas' && (
              <div>
                <ListHeader title="Daftar Kelas" onAdd={() => openKelasForm()} />
                <Empty show={kelasList.length === 0} />
                <div className="space-y-2">
                  {kelasList.map(k => (
                    <div key={k.id} className="card p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-400 font-bold text-sm">{k.tingkat || '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100">{k.nama}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {k.jumlah_siswa} siswa · {k.jumlah_mapel} mata pelajaran
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Btn label="Mapel" onClick={() => openKelasMapel(k)} />
                        <Btn label="Siswa" onClick={() => openSiswaKelas(k)} />
                        <Btn label="Edit"  onClick={() => openKelasForm(k)} />
                        <Btn label="Hapus" danger onClick={() => deleteKelas(k.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─ MAPEL (kartu besar, klik → buka bank soal) ─ */}
            {activeTab === 'mapel' && (
              <div>
                <ListHeader title="Mata Pelajaran" onAdd={() => openMapelForm()} addLabel="Tambah Mapel" />
                <Empty show={mapelList.length === 0} />
                <div className="grid sm:grid-cols-2 gap-3">
                  {mapelList.map(m => (
                    <div key={m.id} className="card p-5 hover:border-slate-700 transition-colors group">
                      {/* Card header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-400 font-bold text-xs">{m.kode || '—'}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-100 truncate">{m.nama}</p>
                            {m.deskripsi && <p className="text-xs text-slate-500 truncate">{m.deskripsi}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          <Btn label="Edit"  onClick={() => openMapelForm(m)} />
                          <Btn label="Hapus" danger onClick={() => deleteMapel(m.id)} />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                          📚 {m.jumlah_bank || 0} bank soal
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                          🏫 {m.jumlah_kelas} kelas
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button onClick={() => openBankSoal(m)}
                          className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                          <Icon d={IC.doc} className="w-3.5 h-3.5" />
                          Bank Soal
                        </button>
                        <button onClick={() => openMapelKelas(m)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                          <Icon d={IC.link} className="w-3.5 h-3.5" />
                          Kelas
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─ JADWAL ─ */}
            {activeTab === 'jadwal' && (
              <div>
                <ListHeader title="Jadwal Ujian" onAdd={() => openJadwalForm()} addLabel="Buat Jadwal" />
                <Empty show={jadwalList.length === 0} />
                <div className="space-y-2">
                  {jadwalList.map(j => (
                    <div key={j.id} className={`card p-4 ${!j.is_active ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {j.mapel_kode && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">{j.mapel_kode}</span>}
                            {j.kelas_nama && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{j.kelas_nama}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded ${j.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                              {j.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-100">{j.nama}</p>
                          <div className="flex flex-wrap gap-3 mt-1">
                            <span className="text-xs text-slate-400">📅 {new Date(j.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="text-xs text-slate-400">🕐 {j.waktu_mulai}–{j.waktu_selesai}</span>
                            <span className="text-xs text-slate-400">⏱ {j.durasi_menit} mnt</span>
                            <span className="text-xs text-slate-500">📝 {j.jumlah_soal || 0} soal · 👥 {j.jumlah_siswa || 0} siswa</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Btn label="Soal" onClick={() => openJadwalSoal(j)} />
                          <Btn label={j.is_active ? 'Nonaktif' : 'Aktif'} onClick={() => toggleJadwalActive(j.id, j.is_active)} />
                          <Btn label="Edit"  onClick={() => openJadwalForm(j)} />
                          <Btn label="Hapus" danger onClick={() => deleteJadwal(j.id)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─ TOKEN ─ */}
            {activeTab === 'token' && (
              <div>
                <ListHeader title="Token Ujian" onAdd={() => setPanel({ type: 'token-gen' })} addLabel="Generate Token" />
                <Empty show={tokenList.length === 0} />
                <div className="space-y-2">
                  {tokenList.map(t => {
                    const isExpired = t.expired_at ? new Date(t.expired_at) < new Date() : false
                    const isActive  = t.is_active && !isExpired
                    return (
                      <div key={t.id} className={`card p-4 flex items-center gap-4 ${!isActive ? 'opacity-50' : ''}`}>
                        <div className={`font-mono font-bold text-xl tracking-widest px-3 py-2 rounded-xl border-2 flex-shrink-0 ${isActive ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' : 'text-slate-600 border-slate-700'}`}>
                          {t.token}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{t.jadwal?.mapel_nama || '—'}</p>
                          <p className="text-xs text-slate-500 truncate">{t.jadwal?.nama}</p>
                          <div className="flex gap-2 mt-1">
                            {isExpired && <span className="text-xs text-red-400">Kedaluwarsa</span>}
                            {!t.is_active && !isExpired && <span className="text-xs text-slate-500">Nonaktif</span>}
                            {isActive && <span className="text-xs text-green-400">● Aktif</span>}
                            {t.expired_at && <span className="text-xs text-slate-600">Exp: {new Date(t.expired_at).toLocaleString('id-ID')}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isActive && <Btn label="Salin" onClick={() => copyToken(t.token)} />}
                          <Btn label={t.is_active ? 'Nonaktif' : 'Aktif'} onClick={() => toggleToken(t.id, t.is_active)} />
                          <Btn label="Hapus" danger onClick={() => deleteToken(t.id)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ───────────────────────────────────── */}
          {panelOpen && (
            <div className="animate-slide-in">

              {/* Kelas Form */}
              {panel.type === 'kelas-form' && (
                <Panel title={panel.id ? 'Edit Kelas' : 'Tambah Kelas'} onClose={closePanel}>
                  <F label="Nama Kelas"><input type="text" value={kelasForm.nama} onChange={e => setKF(p => ({ ...p, nama: e.target.value }))} placeholder="cth: X IPA 1" className="input-field" /></F>
                  <F label="Tingkat">
                    <select value={kelasForm.tingkat} onChange={e => setKF(p => ({ ...p, tingkat: e.target.value }))} className="input-field">
                      <option value="">Pilih tingkat</option>
                      {['X','XI','XII','1','2','3','4','5','6','7','8'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </F>
                  <PA onSave={saveKelas} onCancel={closePanel} saving={saving} disabled={!kelasForm.nama} />
                </Panel>
              )}

              {/* Siswa di Kelas */}
              {panel.type === 'kelas-siswa' && (
                <Panel title={`Siswa — ${panel.kelasNama}`} onClose={closePanel}>
                  <p className="text-xs text-slate-500 mb-2">{kelasStudents.length}/{students.length} dipilih</p>
                  <CheckList items={students} selected={kelasStudents} onToggle={s => toggleSiswaKelas(s.id)}
                    getLabel={s => s.full_name} getSub={s => s.npm} emptyText="Belum ada siswa." />
                </Panel>
              )}

              {/* Mapel di Kelas */}
              {panel.type === 'kelas-mapel' && (
                <Panel title={`Mapel — ${panel.kelasNama}`} onClose={closePanel}>
                  <p className="text-xs text-slate-500 mb-2">{kelasMapelIds.length} mapel dipilih</p>
                  <CheckList items={mapelList} selected={kelasMapelIds} onToggle={m => toggleKelasMapel(m.id)}
                    getLabel={m => m.nama} getSub={m => `${m.kode || '—'} · ${m.jumlah_soal} soal`} emptyText="Belum ada mata pelajaran." />
                </Panel>
              )}

              {/* Mapel Form */}
              {panel.type === 'mapel-form' && (
                <Panel title={panel.id ? 'Edit Mapel' : 'Tambah Mapel'} onClose={closePanel}>
                  <F label="Nama"><input type="text" value={mapelForm.nama} onChange={e => setMF(p => ({ ...p, nama: e.target.value }))} placeholder="cth: Rekayasa Perangkat Lunak" className="input-field" /></F>
                  <F label="Kode"><input type="text" value={mapelForm.kode} onChange={e => setMF(p => ({ ...p, kode: e.target.value.toUpperCase() }))} placeholder="cth: RPL" className="input-field" /></F>
                  <F label="Deskripsi"><textarea value={mapelForm.deskripsi} onChange={e => setMF(p => ({ ...p, deskripsi: e.target.value }))} rows={3} className="input-field" /></F>
                  <PA onSave={saveMapel} onCancel={closePanel} saving={saving} disabled={!mapelForm.nama} />
                </Panel>
              )}

              {/* Bank Soal per Mapel */}
              {/* Bank Soal List for a Mapel */}
              {panel.type === 'mapel-bank' && (
                <Panel title={`Bank Soal — ${panel.mapelNama}`} onClose={closePanel}>
                  <button onClick={() => createBankForMapel(panel.mapelId, panel.mapelNama)}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 mb-3">
                    <Icon d={IC.plus} className="w-3.5 h-3.5" /> Buat Bank Soal Baru
                  </button>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {bankSoalForMapel.length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-8">Belum ada bank soal untuk mata pelajaran ini.</p>
                    )}
                    {bankSoalForMapel.map(b => (
                      <div key={b.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{b.nama}</p>
                            {b.deskripsi && <p className="text-xs text-slate-500 truncate">{b.deskripsi}</p>}
                          </div>
                          <span className="text-xs bg-slate-900 text-amber-400 px-2 py-0.5 rounded flex-shrink-0">{b.jumlah_soal} soal</span>
                        </div>
                        <button
                          onClick={() => openBankSoalDetail(panel.mapelId, panel.mapelNama, b)}
                          className="w-full mt-2 text-xs bg-slate-900 hover:bg-slate-700 text-slate-300 py-1.5 rounded-lg transition-colors">
                          Buka → Kelola Soal
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <p className="text-xs text-slate-600">Soal yang ditambahkan ke bank soal di sini akan muncul saat assign soal ke jadwal ujian.</p>
                  </div>
                </Panel>
              )}

              {/* Soal list dalam bank soal */}
              {panel.type === 'mapel-soal' && (
                <Panel title={panel.bankNama}
                  sub={`Bank Soal · ${panel.mapelNama}`}
                  onClose={() => setPanel({ type: 'mapel-bank', mapelId: panel.mapelId, mapelNama: panel.mapelNama })}>
                  <button onClick={() => openSoalForm(panel.mapelId, panel.bankId)}
                    className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 mb-3">
                    <Icon d={IC.plus} className="w-3.5 h-3.5" /> Tambah Soal Baru
                  </button>
                  <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                    {soalList.filter(q => q.bank_soal_id === panel.bankId).length === 0 && (
                      <p className="text-xs text-slate-600 text-center py-8">Belum ada soal. Klik tombol di atas untuk menambah.</p>
                    )}
                    {soalList.filter(q => q.bank_soal_id === panel.bankId).map(q => (
                      <div key={q.id} className={`bg-slate-800/50 rounded-xl p-3 border border-slate-800 ${!q.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs text-amber-500 font-semibold">#{q.number}</span>
                          <div className="flex items-center gap-1">
                            <Btn label={q.is_active ? 'Nonaktif' : 'Aktif'} onClick={() => toggleSoalActive(q.id, q.is_active)} />
                            <Btn label="Edit" onClick={() => openSoalForm(panel.mapelId, panel.bankId, q)} />
                            <Btn label="Hapus" danger onClick={() => deleteSoal(q.id)} />
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{q.question}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Soal Form */}
              {panel.type === 'soal-form' && (
                <Panel title={panel.id ? 'Edit Soal' : 'Tambah Soal'} onClose={() => {
                  const bank = bankSoalList.find(b => b.id === panel.bankId) || { id: panel.bankId, nama: '—', deskripsi: '', is_active: true }
                  const mapel = mapelList.find(m => m.id === panel.mapelId)
                  setPanel({ type: 'mapel-soal', mapelId: panel.mapelId, mapelNama: mapel?.nama || '—', bankId: panel.bankId, bankNama: bank.nama })
                }}>
                  <F label="Nomor Soal"><input type="number" value={soalForm.number} onChange={e => setSF(p => ({ ...p, number: e.target.value }))} min="1" className="input-field" /></F>
                  <F label="Pertanyaan"><textarea value={soalForm.question} onChange={e => setSF(p => ({ ...p, question: e.target.value }))} placeholder="Tulis pertanyaan essay..." rows={6} className="input-field" /></F>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={soalForm.is_active} onChange={e => setSF(p => ({ ...p, is_active: e.target.checked }))} className="accent-amber-500" />
                    Soal aktif
                  </label>
                  <PA onSave={saveSoal} onCancel={() => {
                    const bank = bankSoalList.find(b => b.id === panel.bankId) || { id: panel.bankId, nama: '—', deskripsi: '', is_active: true }
                    const mapel = mapelList.find(m => m.id === panel.mapelId)
                    setPanel({ type: 'mapel-soal', mapelId: panel.mapelId, mapelNama: mapel?.nama || '—', bankId: panel.bankId, bankNama: bank.nama })
                  }} saving={saving} disabled={!soalForm.question || !soalForm.number} />
                </Panel>
              )}

              {/* Kelas di Mapel */}
              {panel.type === 'mapel-kelas' && (
                <Panel title={`Kelas — ${panel.mapelNama}`} onClose={closePanel}>
                  <p className="text-xs text-slate-500 mb-2">{mapelKelasIds.length} kelas dipilih</p>
                  <CheckList items={kelasList} selected={mapelKelasIds} onToggle={k => toggleMapelKelas(k.id)}
                    getLabel={k => k.nama} getSub={k => `${k.jumlah_siswa} siswa`} emptyText="Belum ada kelas." />
                </Panel>
              )}

              {/* Jadwal Form */}
              {panel.type === 'jadwal-form' && (
                <Panel title={panel.id ? 'Edit Jadwal' : 'Buat Jadwal Ujian'} onClose={closePanel}>
                  <F label="Nama Ujian"><input type="text" value={jadwalForm.nama} onChange={e => setJF(p => ({ ...p, nama: e.target.value }))} placeholder="cth: UTS Semester Genap 2025" className="input-field" /></F>
                  <F label="Mata Pelajaran">
                    <select value={jadwalForm.mata_pelajaran_id} onChange={e => setJF(p => ({ ...p, mata_pelajaran_id: e.target.value }))} className="input-field">
                      <option value="">Pilih mata pelajaran</option>
                      {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                    </select>
                  </F>
                  <F label="Kelas">
                    <select value={jadwalForm.kelas_id} onChange={e => setJF(p => ({ ...p, kelas_id: e.target.value }))} className="input-field">
                      <option value="">Pilih kelas</option>
                      {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                    </select>
                  </F>
                  <F label="Tanggal"><input type="date" value={jadwalForm.tanggal} onChange={e => setJF(p => ({ ...p, tanggal: e.target.value }))} className="input-field" /></F>
                  <div className="grid grid-cols-2 gap-2">
                    <F label="Mulai"><input type="time" value={jadwalForm.waktu_mulai} onChange={e => setJF(p => ({ ...p, waktu_mulai: e.target.value }))} className="input-field" /></F>
                    <F label="Selesai"><input type="time" value={jadwalForm.waktu_selesai} onChange={e => setJF(p => ({ ...p, waktu_selesai: e.target.value }))} className="input-field" /></F>
                  </div>
                  <F label="Durasi (menit)"><input type="number" value={jadwalForm.durasi_menit} onChange={e => setJF(p => ({ ...p, durasi_menit: e.target.value }))} min="10" max="300" className="input-field" /></F>
                  <PA onSave={saveJadwal} onCancel={closePanel} saving={saving} disabled={!jadwalForm.nama || !jadwalForm.tanggal} />
                </Panel>
              )}

              {/* Assign Soal ke Jadwal */}
              {panel.type === 'jadwal-soal' && (
                <Panel title={`Soal — ${panel.jadwalNama}`} onClose={closePanel}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-500">{jadwalSoalIds.length} soal dipilih</p>
                  </div>
                  {/* Group by bank soal / mapel */}
                  {mapelList.map(m => {
                    // Tampilkan soal dari bank soal yang linked ke mapel ini ATAU soal legacy dengan mata_pelajaran_id
                    const soalMapel = soalList.filter(q =>
                      q.mata_pelajaran_id === m.id ||
                      (q.bank_soal_id && bankSoalList.some(b =>
                        b.id === q.bank_soal_id &&
                        // bank soal ini linked ke mapel ini (kita punya data dari loadAll)
                        soalList.filter(qq => qq.bank_soal_id === b.id).length >= 0 // always true, soal cukup cek bank_soal_id
                      ) && q.mata_pelajaran_id === m.id)
                    )
                    // Ambil juga soal yang bank_soal_id linked ke mapel ini via bank_soal_mapel
                    // Kita filter: soal yang mata_pelajaran_id = mapel ini
                    const soalFinal = soalList.filter(q => q.mata_pelajaran_id === m.id && q.is_active)
                    if (soalFinal.length === 0) return null
                    return (
                      <div key={m.id} className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-blue-400">{m.kode} — {m.nama}</span>
                          <button onClick={() => selectAllSoalMapel(m.id)}
                            className="text-xs text-slate-500 hover:text-amber-400 transition-colors">
                            Pilih semua
                          </button>
                        </div>
                        {soalFinal.map(q => (
                          <label key={q.id} className={`flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800 cursor-pointer ${!q.is_active ? 'opacity-40' : ''}`}>
                            <input type="checkbox" checked={jadwalSoalIds.includes(q.id)}
                              onChange={() => toggleJadwalSoal(q.id)} className="accent-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-xs text-amber-500 font-semibold mr-1">#{q.number}</span>
                              <span className="text-xs text-slate-300 leading-relaxed line-clamp-2">{q.question}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )
                  })}
                  {soalList.filter(q => q.is_active).length === 0 && <p className="text-xs text-slate-600 text-center py-6">Belum ada soal aktif. Tambahkan di Bank Soal.</p>}
                </Panel>
              )}

              {/* Token Generate */}
              {panel.type === 'token-gen' && (
                <Panel title="Generate Token Ujian" onClose={closePanel}>
                  <F label="Jadwal Ujian">
                    <select value={tokenForm.jadwal_id} onChange={e => setTF(p => ({ ...p, jadwal_id: e.target.value }))} className="input-field">
                      <option value="">Pilih jadwal</option>
                      {jadwalList.filter(j => j.is_active).map(j => (
                        <option key={j.id} value={j.id}>{j.mapel_kode} — {j.kelas_nama} — {j.nama}</option>
                      ))}
                    </select>
                  </F>
                  <F label="Kedaluwarsa (opsional)">
                    <input type="datetime-local" value={tokenForm.expired_at} onChange={e => setTF(p => ({ ...p, expired_at: e.target.value }))} className="input-field" />
                    <p className="text-xs text-slate-600 mt-1">Kosongkan = tidak ada batas waktu.</p>
                  </F>
                  <button onClick={generateToken} disabled={saving || !tokenForm.jadwal_id}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-1">
                    {saving ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> Membuat...</> : <><Icon d={IC.key} className="w-4 h-4" /> Generate Token</>}
                  </button>
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Cara kerja:</p>
                    {['Generate token untuk jadwal ujian', 'Bagikan kode 6-digit ke siswa saat ujian', 'Siswa input token → sistem validasi kelas', 'Soal yang muncul sesuai yang diassign ke jadwal', 'Nonaktifkan token setelah ujian selesai'].map((t, i) => (
                      <p key={i} className="text-xs text-slate-600">{i+1}. {t}</p>
                    ))}
                  </div>
                </Panel>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Reusable Components ───────────────────────────────────────
const Icon2 = ({ d, className = 'w-4 h-4' }: { d: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)

function ListHeader({ title, onAdd, addLabel = 'Tambah' }: { title: string; onAdd: () => void; addLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-slate-100">{title}</h2>
      <button onClick={onAdd} className="btn-primary text-sm py-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {addLabel}
      </button>
    </div>
  )
}

function Empty({ show }: { show: boolean }) {
  if (!show) return null
  return <div className="card p-10 text-center text-slate-500 text-sm">Belum ada data.</div>
}

function Btn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2 py-1 rounded transition-colors hover:bg-slate-800 ${danger ? 'text-red-500 hover:text-red-400' : 'text-slate-400 hover:text-slate-200'}`}>
      {label}
    </button>
  )
}

function Panel({ title, sub, children, onClose }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="card p-5 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-100 text-sm truncate">{title}</h3>
          {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  )
}

function PA({ onSave, onCancel, saving, disabled }: { onSave: () => void; onCancel: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button onClick={onSave} disabled={saving || disabled} className="btn-primary flex-1 text-sm py-2">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
      <button onClick={onCancel} className="btn-secondary text-sm py-2">Batal</button>
    </div>
  )
}

function CheckList<T extends { id: string }>({
  items, selected, onToggle, getLabel, getSub, emptyText
}: {
  items: T[]; selected: string[]; onToggle: (item: T) => void
  getLabel: (item: T) => string; getSub: (item: T) => string; emptyText: string
}) {
  return (
    <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
      {items.length === 0 && <p className="text-xs text-slate-600 text-center py-6">{emptyText}</p>}
      {items.map(item => (
        <label key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800 cursor-pointer">
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item)} className="accent-amber-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-200 truncate">{getLabel(item)}</p>
            <p className="text-xs text-slate-500">{getSub(item)}</p>
          </div>
        </label>
      ))}
    </div>
  )
}