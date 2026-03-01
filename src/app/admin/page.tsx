'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string; full_name: string; npm: string; username: string; email: string
  is_submitted: boolean; submitted_at: string | null; answer_count: number
  kelas_nama?: string
}
type AdminProfile = { id: string; full_name: string; npm: string; email: string }
type ImportRow = { full_name: string; npm: string; username: string; password: string; kelas_nama: string }
type View = 'dashboard' | 'edit-student' | 'edit-admin' | 'import'

export default function AdminPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<View>('dashboard')

  // Admin
  const [admin, setAdmin]   = useState<AdminProfile | null>(null)
  const [adminForm, setAF]  = useState({ full_name: '', npm: '', email: '' })
  const [adminSaving, setAS] = useState(false)
  const [adminMsg, setAM]   = useState('')

  // Students
  const [students, setStudents]         = useState<Student[]>([])
  const [search, setSearch]             = useState('')
  const [filterKelas, setFilterKelas]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Edit student
  const [selStudent, setSelStudent] = useState<Student | null>(null)
  const [stuForm, setSF]  = useState({ full_name: '', npm: '', username: '' })
  const [stuSaving, setSS] = useState(false)
  const [stuMsg, setSM]   = useState('')

  // Import
  const [importData, setImportData] = useState<ImportRow[]>([])
  const [importing, setImporting]   = useState(false)
  const [importResult, setIR]       = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [kelasList, setKelasList]   = useState<{ id: string; nama: string }[]>([])

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (profile?.role !== 'admin') { router.push('/home'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const ap = { id: profile.id, full_name: profile.full_name || '', npm: profile.npm || '', email: user?.email || '' }
    setAdmin(ap); setAF(ap)
    await loadData()
    setLoading(false)
  }

  const loadData = async () => {
    const [profiles, sessions, answers, sk, kelas] = await Promise.all([
      supabase.from('profiles').select('id,full_name,npm,username,email,role').eq('role', 'student'),
      supabase.from('exam_sessions').select('student_id,is_submitted,submitted_at'),
      supabase.from('answers').select('student_id,id'),
      supabase.from('siswa_kelas').select('student_id,kelas:kelas_id(nama)'),
      supabase.from('kelas').select('id,nama').order('nama'),
    ])
    const list: Student[] = (profiles.data || []).map(p => {
      const sess  = sessions.data?.find(s => s.student_id === p.id)
      const skRow = (sk.data as any[])?.find(r => r.student_id === p.id)
      return {
        id: p.id,
        full_name:    p.full_name   || '-',
        npm:          p.npm         || '-',
        username:     p.username    || '-',
        email:        p.email       || '-',
        is_submitted: sess?.is_submitted   || false,
        submitted_at: sess?.submitted_at   || null,
        answer_count: answers.data?.filter(a => a.student_id === p.id).length || 0,
        kelas_nama:   skRow?.kelas?.nama   || '',
      }
    }).sort((a, b) => a.full_name.localeCompare(b.full_name))
    setStudents(list)
    setKelasList(kelas.data || [])
  }

  // ── Admin profile ─────────────────────────────────────────────
  const saveAdmin = async () => {
    setAS(true); setAM('')
    const { error } = await supabase.from('profiles').update({ full_name: adminForm.full_name, npm: adminForm.npm }).eq('id', admin!.id)
    if (error) { setAM('❌ ' + error.message); setAS(false); return }
    if (adminForm.email !== admin?.email) {
      const { error: e2 } = await supabase.auth.updateUser({ email: adminForm.email })
      if (e2) { setAM('❌ ' + e2.message); setAS(false); return }
    }
    setAdmin(p => p ? { ...p, ...adminForm } : p)
    setAM('✅ Profil berhasil disimpan!'); setAS(false)
  }

  // ── Edit student ──────────────────────────────────────────────
  const openEdit = (s: Student) => {
    setSelStudent(s)
    setSF({ full_name: s.full_name, npm: s.npm, username: s.username === '-' ? '' : s.username })
    setSM(''); setView('edit-student')
  }

  const saveStu = async () => {
    if (!selStudent) return
    setSS(true); setSM('')
    const { error } = await supabase.from('profiles')
      .update({ full_name: stuForm.full_name, npm: stuForm.npm, username: stuForm.username || null })
      .eq('id', selStudent.id)
    if (error) { setSM('❌ ' + error.message); setSS(false); return }
    setSM('✅ Profil diperbarui!'); await loadData(); setSS(false)
  }

  const deleteStu = async (id: string) => {
    if (!confirm('Hapus siswa ini? Semua data akan terhapus.')) return
    await supabase.from('answers').delete().eq('student_id', id)
    await supabase.from('exam_sessions').delete().eq('student_id', id)
    await supabase.from('siswa_kelas').delete().eq('student_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    await loadData(); setView('dashboard')
  }

  // ── Import ─────────────────────────────────────────────────────
  // Format CSV: full_name, npm, username, password, kelas
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const lines = (evt.target?.result as string).trim().split('\n')
      const rows: ImportRow[] = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        return {
          full_name:  cols[0] || '',
          npm:        cols[1] || '',
          username:   cols[2] || '',
          password:   cols[3] || 'password123',
          kelas_nama: cols[4] || '',
        }
      }).filter(r => r.full_name && r.username)
      setImportData(rows); setIR(null)
    }
    reader.readAsText(file)
  }

  const runImport = async () => {
    setImporting(true)
    let success = 0, failed = 0
    const errors: string[] = []

    for (const row of importData) {
      // Buat email internal dari username (tidak diekspos ke siswa)
      const fakeEmail = `${row.username.toLowerCase().replace(/\s+/g, '')}@uts-internal.local`

      const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: row.password,
        options: { data: { full_name: row.full_name, npm: row.npm } }
      })

      if (error) {
        failed++
        errors.push(`${row.full_name} (${row.username}): ${error.message}`)
      } else if (data.user) {
        success++
        // Update profile dengan username dan npm
        await supabase.from('profiles').update({
          npm:      row.npm,
          username: row.username,
        }).eq('id', data.user.id)

        // Assign ke kelas jika ada
        if (row.kelas_nama) {
          const k = kelasList.find(k => k.nama.toLowerCase() === row.kelas_nama.toLowerCase())
          if (k) await supabase.from('siswa_kelas').upsert({ student_id: data.user.id, kelas_id: k.id })
        }
      }
      await new Promise(r => setTimeout(r, 300))
    }

    setIR({ success, failed, errors }); setImporting(false); await loadData()
  }

  const downloadTemplate = () => {
    const kelasEx = kelasList[0]?.nama || 'X IPA 1'
    const csv = [
      'full_name,npm,username,password,kelas',
      `Budi Santoso,12345678,budi.santoso,password123,${kelasEx}`,
      `Siti Rahayu,87654321,siti.rahayu,password123,${kelasEx}`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'template-import-siswa.csv'; a.click()
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/auth/login') }

  // ── Filtered students ─────────────────────────────────────────
  const filtered = students.filter(s => {
    if (search && !s.full_name.toLowerCase().includes(search.toLowerCase())
      && !s.npm.includes(search) && !s.username.toLowerCase().includes(search.toLowerCase())) return false
    if (filterKelas && s.kelas_nama !== filterKelas) return false
    if (filterStatus === 'submitted' && !s.is_submitted) return false
    if (filterStatus === 'pending'   && s.is_submitted)  return false
    return true
  })

  const stats = {
    total:     students.length,
    submitted: students.filter(s => s.is_submitted).length,
    pending:   students.filter(s => !s.is_submitted).length,
    kelas:     kelasList.length,
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Shared back header ────────────────────────────────────────
  const BackHeader = ({ title, sub }: { title: string; sub?: string }) => (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={() => setView('dashboard')} className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </header>
  )

  // ── View: Edit Student ────────────────────────────────────────
  if (view === 'edit-student' && selStudent) return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title="Edit Profil Siswa" sub={selStudent.full_name} />
      <div className="max-w-2xl mx-auto p-4 space-y-4 animate-fade-in">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-100 mb-5">Data Siswa</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Nama Lengkap</label>
              <input type="text" value={stuForm.full_name} onChange={e => setSF(p => ({ ...p, full_name: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">NPM / NIM</label>
              <input type="text" value={stuForm.npm} onChange={e => setSF(p => ({ ...p, npm: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Username</label>
              <input type="text" value={stuForm.username} onChange={e => setSF(p => ({ ...p, username: e.target.value }))}
                placeholder="username untuk login" className="input-field font-mono" />
              <p className="text-xs text-slate-600 mt-1">Username digunakan siswa untuk login. Hanya huruf, angka, titik, dan underscore.</p>
            </div>
            {selStudent.kelas_nama && (
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Kelas</label>
                <p className="input-field text-slate-300">{selStudent.kelas_nama}</p>
                <p className="text-xs text-slate-600 mt-1">Ubah kelas di menu Akademik → Kelas.</p>
              </div>
            )}
          </div>
          {stuMsg && (
            <div className={`mt-4 px-4 py-3 rounded-lg text-sm border ${stuMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{stuMsg}</div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={saveStu} disabled={stuSaving} className="btn-primary flex items-center gap-2">
              {stuSaving ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Menyimpan...</> : 'Simpan'}
            </button>
            <button onClick={() => setView('dashboard')} className="btn-secondary">Batal</button>
          </div>
        </div>
        <div className="card p-6 border border-red-500/10">
          <h3 className="font-semibold text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm text-slate-500 mb-4">Hapus siswa beserta semua data ujiannya. Tidak bisa dibatalkan.</p>
          <button onClick={() => deleteStu(selStudent.id)} className="btn-danger text-sm py-2">Hapus Siswa Ini</button>
        </div>
      </div>
    </div>
  )

  // ── View: Edit Admin ──────────────────────────────────────────
  if (view === 'edit-admin') return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title="Profil Admin" />
      <div className="max-w-2xl mx-auto p-4 animate-fade-in">
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl font-bold text-slate-950 flex-shrink-0">
              {adminForm.full_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <p className="font-semibold text-slate-100">{admin?.full_name || 'Admin'}</p>
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full mt-1 inline-block">Administrator</span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Nama Lengkap</label>
              <input type="text" value={adminForm.full_name} onChange={e => setAF(p => ({ ...p, full_name: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">NIP / ID Admin</label>
              <input type="text" value={adminForm.npm} onChange={e => setAF(p => ({ ...p, npm: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Email</label>
              <input type="email" value={adminForm.email} onChange={e => setAF(p => ({ ...p, email: e.target.value }))} className="input-field" />
              {adminForm.email !== admin?.email && <p className="text-xs text-amber-400 mt-1">⚠️ Kamu akan menerima email konfirmasi ke alamat baru.</p>}
            </div>
          </div>
          {adminMsg && (
            <div className={`mt-4 px-4 py-3 rounded-lg text-sm border ${adminMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{adminMsg}</div>
          )}
          <div className="flex gap-3 mt-6">
            <button onClick={saveAdmin} disabled={adminSaving} className="btn-primary flex items-center gap-2">
              {adminSaving ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Menyimpan...</> : 'Simpan'}
            </button>
            <button onClick={() => setView('dashboard')} className="btn-secondary">Batal</button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── View: Import ──────────────────────────────────────────────
  if (view === 'import') return (
    <div className="min-h-screen bg-slate-950">
      <BackHeader title="Import Data Siswa" />
      <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">

        {/* Step 1 — Template */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-7 h-7 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
            <h2 className="font-semibold text-slate-100">Download Template CSV</h2>
          </div>
          <p className="text-sm text-slate-400 mb-1">Format kolom:</p>
          <code className="text-xs text-amber-400 bg-slate-900 px-3 py-2 rounded-lg block mb-3 leading-relaxed">
            full_name, npm, username, password, kelas
          </code>
          <div className="space-y-1 mb-4 text-xs text-slate-500">
            <p><span className="text-amber-400 font-medium">username</span> — digunakan siswa untuk login (unik, tanpa spasi)</p>
            <p><span className="text-amber-400 font-medium">kelas</span> — harus sama persis dengan nama kelas di sistem (opsional)</p>
          </div>
          {kelasList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-xs text-slate-500">Kelas tersedia:</span>
              {kelasList.map(k => <span key={k.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{k.nama}</span>)}
            </div>
          )}
          <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download Template
          </button>
        </div>

        {/* Step 2 — Upload */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-7 h-7 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
            <h2 className="font-semibold text-slate-100">Upload File CSV</h2>
          </div>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-10 text-center cursor-pointer transition-colors group">
            <svg className="w-10 h-10 text-slate-600 group-hover:text-amber-500/50 mx-auto mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            {importData.length > 0
              ? <p className="text-amber-400 font-medium text-sm">{importData.length} siswa siap diimport</p>
              : <p className="text-slate-400 text-sm">Klik untuk pilih file CSV</p>}
            <p className="text-slate-600 text-xs mt-1">Format: .csv</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {/* Step 3 — Preview */}
        {importData.length > 0 && !importResult && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
              <h2 className="font-semibold text-slate-100">Preview ({importData.length} siswa)</h2>
            </div>
            <div className="overflow-x-auto mb-4 rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                    {['Nama', 'NPM', 'Username', 'Password', 'Kelas'].map(h =>
                      <th key={h} className="text-left text-xs text-slate-500 font-medium p-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 8).map((row, i) => {
                    const km = row.kelas_nama
                      ? kelasList.find(k => k.nama.toLowerCase() === row.kelas_nama.toLowerCase())
                      : null
                    const usernameOk = row.username && /^[a-zA-Z0-9._-]+$/.test(row.username)
                    return (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="p-3 text-slate-200 text-xs">{row.full_name}</td>
                        <td className="p-3 text-slate-400 font-mono text-xs">{row.npm || '—'}</td>
                        <td className="p-3 font-mono text-xs">
                          {usernameOk
                            ? <span className="text-green-400">{row.username}</span>
                            : <span className="text-red-400">{row.username || '(kosong)'} ⚠️</span>}
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-xs">{'•'.repeat(Math.min(row.password.length, 8))}</td>
                        <td className="p-3 text-xs">
                          {row.kelas_nama
                            ? km ? <span className="text-green-400">{row.kelas_nama}</span> : <span className="text-red-400">{row.kelas_nama} ⚠️</span>
                            : <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {importData.length > 8 && <p className="text-xs text-slate-600 p-3">...dan {importData.length - 8} lainnya</p>}
            </div>
            {importData.some(r => !r.username) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-3 text-red-400 text-sm">⚠️ Ada baris tanpa username. Kolom username wajib diisi.</div>
            )}
            {importData.some(r => r.kelas_nama && !kelasList.find(k => k.nama.toLowerCase() === r.kelas_nama.toLowerCase())) && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-3 text-amber-400 text-sm">⚠️ Beberapa nama kelas tidak ditemukan (ditandai merah). Siswa tetap dibuat tapi tidak dimasukkan ke kelas.</div>
            )}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-4 text-blue-400 text-sm">
              ℹ️ Nonaktifkan konfirmasi email di Supabase Auth Settings agar siswa bisa langsung login dengan username.
            </div>
            <button onClick={runImport} disabled={importing || importData.some(r => !r.username)}
              className="btn-primary flex items-center gap-2">
              {importing
                ? <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"/>Mengimport...</>
                : `Import ${importData.length} Siswa`}
            </button>
          </div>
        )}

        {/* Result */}
        {importResult && (
          <div className="card p-6 animate-fade-in">
            <h2 className="font-semibold text-slate-100 mb-4">Hasil Import</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5 text-center">
                <p className="text-4xl font-bold text-green-400">{importResult.success}</p>
                <p className="text-xs text-slate-400 mt-1">Berhasil</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 text-center">
                <p className="text-4xl font-bold text-red-400">{importResult.failed}</p>
                <p className="text-xs text-slate-400 mt-1">Gagal</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4 mb-4 max-h-40 overflow-y-auto">
                {importResult.errors.map((e, i) => <p key={i} className="text-xs text-red-400">• {e}</p>)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setImportData([]); setIR(null) }} className="btn-secondary text-sm">Import Lagi</button>
              <button onClick={() => { setView('dashboard'); setImportData([]); setIR(null) }} className="btn-primary text-sm">Kembali</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── DASHBOARD ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <h1 className="font-semibold text-slate-100">Panel Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/admin/bank-soal')}
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Bank Soal
            </button>
            <button onClick={() => router.push('/admin/akademik')}
              className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              Akademik
            </button>
            <button onClick={() => setView('edit-admin')}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-slate-950 flex-shrink-0">
                {admin?.full_name?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate">{admin?.full_name || 'Admin'}</span>
            </button>
            <button onClick={logout} className="text-slate-500 hover:text-red-400 text-sm px-2 py-1.5 transition-colors">Keluar</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Siswa',   value: stats.total,     color: 'text-slate-100' },
            { label: 'Sudah Kumpul',  value: stats.submitted, color: 'text-green-400' },
            { label: 'Belum Kumpul',  value: stats.pending,   color: 'text-amber-400' },
            { label: 'Kelas',         value: stats.kelas,     color: 'text-blue-400'  },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Mobile nav */}
        <div className="flex sm:hidden gap-2 mb-4">
          <button onClick={() => router.push('/admin/bank-soal')} className="flex-1 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Bank Soal
          </button>
          <button onClick={() => router.push('/admin/akademik')} className="flex-1 bg-slate-800 text-slate-300 text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            Akademik
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap flex-1">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, NPM, atau username..." className="input-field text-sm py-2 flex-1 min-w-[200px] max-w-xs" />
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)} className="input-field text-sm py-2 w-auto">
              <option value="">Semua Kelas</option>
              {kelasList.map(k => <option key={k.id} value={k.nama}>{k.nama}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field text-sm py-2 w-auto">
              <option value="">Semua Status</option>
              <option value="submitted">Sudah Kumpul</option>
              <option value="pending">Belum Kumpul</option>
            </select>
          </div>
          <button onClick={() => setView('import')}
            className="btn-secondary text-sm py-2 flex items-center gap-1.5 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Import CSV
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 font-medium p-4">Nama</th>
                  <th className="text-left text-xs text-slate-500 font-medium p-4">Username</th>
                  <th className="text-left text-xs text-slate-500 font-medium p-4 hidden sm:table-cell">Kelas</th>
                  <th className="text-center text-xs text-slate-500 font-medium p-4">Status</th>
                  <th className="text-center text-xs text-slate-500 font-medium p-4 hidden md:table-cell">Dikumpulkan</th>
                  <th className="text-center text-xs text-slate-500 font-medium p-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-500 p-10">
                    {students.length === 0
                      ? <div><p className="mb-3">Belum ada siswa terdaftar.</p>
                          <button onClick={() => setView('import')} className="btn-primary text-sm py-2">Import Siswa CSV</button></div>
                      : 'Tidak ada siswa yang cocok.'}
                  </td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-slate-200">{s.full_name}</p>
                      <p className="text-xs text-slate-500">{s.npm}</p>
                    </td>
                    <td className="p-4 text-slate-300 font-mono text-sm">{s.username}</td>
                    <td className="p-4 text-slate-400 text-sm hidden sm:table-cell">{s.kelas_nama || <span className="text-slate-600">—</span>}</td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.is_submitted ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {s.is_submitted ? 'Dikumpulkan' : 'Belum'}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-500 text-xs hidden md:table-cell">
                      {s.submitted_at ? new Date(s.submitted_at).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-slate-200 font-medium px-2 py-1 rounded hover:bg-slate-800">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600">
              {filtered.length} dari {students.length} siswa
            </div>
          )}
        </div>
      </div>
    </div>
  )
}