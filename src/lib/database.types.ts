export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          npm: string | null
          email: string | null
          role: 'student' | 'admin'
          created_at: string
        }
        Insert: { id: string; full_name?: string | null; npm?: string | null; email?: string | null; role?: 'student' | 'admin' }
        Update: { full_name?: string | null; npm?: string | null; email?: string | null; role?: 'student' | 'admin' }
      }

      kelas: {
        Row: { id: string; nama: string; tingkat: string | null; created_at: string }
        Insert: { nama: string; tingkat?: string | null }
        Update: { nama?: string; tingkat?: string | null }
      }

      mata_pelajaran: {
        Row: { id: string; nama: string; kode: string | null; deskripsi: string | null; created_at: string }
        Insert: { nama: string; kode?: string | null; deskripsi?: string | null }
        Update: { nama?: string; kode?: string | null; deskripsi?: string | null }
      }

      questions: {
        Row: {
          id: string
          number: number
          question: string
          is_active: boolean
          mata_pelajaran_id: string | null
          created_at: string
        }
        Insert: { number: number; question: string; is_active?: boolean; mata_pelajaran_id?: string | null }
        Update: { number?: number; question?: string; is_active?: boolean; mata_pelajaran_id?: string | null }
      }

      jadwal_ujian: {
        Row: {
          id: string; nama: string; mata_pelajaran_id: string | null; kelas_id: string | null
          tanggal: string; waktu_mulai: string; waktu_selesai: string; durasi_menit: number
          is_active: boolean; created_at: string
        }
        Insert: {
          nama: string; mata_pelajaran_id?: string | null; kelas_id?: string | null
          tanggal: string; waktu_mulai: string; waktu_selesai: string; durasi_menit?: number; is_active?: boolean
        }
        Update: {
          nama?: string; mata_pelajaran_id?: string | null; kelas_id?: string | null
          tanggal?: string; waktu_mulai?: string; waktu_selesai?: string; durasi_menit?: number; is_active?: boolean
        }
      }

      jadwal_soal: {
        Row: { jadwal_id: string; question_id: string; urutan: number }
        Insert: { jadwal_id: string; question_id: string; urutan?: number }
        Update: { urutan?: number }
      }

      token_ujian: {
        Row: { id: string; jadwal_id: string; token: string; is_active: boolean; expired_at: string | null; created_at: string }
        Insert: { jadwal_id: string; token: string; is_active?: boolean; expired_at?: string | null }
        Update: { is_active?: boolean; expired_at?: string | null }
      }

      siswa_kelas: {
        Row: { student_id: string; kelas_id: string }
        Insert: { student_id: string; kelas_id: string }
        Update: never
      }

      exam_sessions: {
        Row: {
          id: string; student_id: string; jadwal_id: string | null; token_used: string | null
          started_at: string; submitted_at: string | null; is_submitted: boolean
        }
        Insert: { student_id: string; jadwal_id?: string | null; token_used?: string | null }
        Update: { submitted_at?: string | null; is_submitted?: boolean }
      }

      answers: {
        Row: {
          id: string; student_id: string; question_id: string; jadwal_id: string | null
          answer_text: string; score: number | null; feedback: string | null
          submitted_at: string; updated_at: string
        }
        Insert: {
          student_id: string; question_id: string; jadwal_id?: string | null
          answer_text: string; score?: number | null; feedback?: string | null
        }
        Update: { answer_text?: string; score?: number | null; feedback?: string | null }
      }
    }

    Views: {
      v_questions_full: {
        Row: {
          id: string; number: number; question: string; is_active: boolean
          mata_pelajaran_id: string | null; created_at: string
          mapel_nama: string | null; mapel_kode: string | null
        }
      }
      v_jadwal_full: {
        Row: {
          id: string; nama: string; tanggal: string; waktu_mulai: string
          waktu_selesai: string; durasi_menit: number; is_active: boolean
          mata_pelajaran_id: string | null; kelas_id: string | null
          mapel_nama: string | null; mapel_kode: string | null
          kelas_nama: string | null; kelas_tingkat: string | null
          jumlah_soal: number; jumlah_siswa: number
        }
      }
    }
  }
}