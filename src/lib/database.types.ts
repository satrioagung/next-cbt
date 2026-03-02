// Auto-generated minimal Supabase database types
// These keep the codebase type-safe without requiring supabase gen types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          npm: string | null
          username: string | null
          email: string | null
          role: string | null
          created_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      kelas: {
        Row: { id: string; nama: string; tingkat: string | null; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['kelas']['Row']>
        Update: Partial<Database['public']['Tables']['kelas']['Row']>
      }
      mata_pelajaran: {
        Row: { id: string; nama: string; kode: string; deskripsi: string | null; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['mata_pelajaran']['Row']>
        Update: Partial<Database['public']['Tables']['mata_pelajaran']['Row']>
      }
      questions: {
        Row: { id: string; number: number; question: string; is_active: boolean; mata_pelajaran_id: string | null; bank_soal_id: string | null; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['questions']['Row']>
        Update: Partial<Database['public']['Tables']['questions']['Row']>
      }
      bank_soal: {
        Row: { id: string; nama: string; deskripsi: string | null; is_active: boolean; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['bank_soal']['Row']>
        Update: Partial<Database['public']['Tables']['bank_soal']['Row']>
      }
      bank_soal_mapel: {
        Row: { id: string; bank_soal_id: string; mata_pelajaran_id: string; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['bank_soal_mapel']['Row']>
        Update: Partial<Database['public']['Tables']['bank_soal_mapel']['Row']>
      }
      bank_soal_kelas: {
        Row: { id: string; bank_soal_id: string; kelas_id: string; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['bank_soal_kelas']['Row']>
        Update: Partial<Database['public']['Tables']['bank_soal_kelas']['Row']>
      }
      jadwal_ujian: {
        Row: {
          id: string; nama: string; tanggal: string; waktu_mulai: string; waktu_selesai: string
          durasi_menit: number; is_active: boolean; mata_pelajaran_id: string | null
          kelas_id: string | null; bank_soal_id: string | null; created_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['jadwal_ujian']['Row']>
        Update: Partial<Database['public']['Tables']['jadwal_ujian']['Row']>
      }
      jadwal_soal: {
        Row: { id: string; jadwal_id: string; question_id: string; urutan: number | null }
        Insert: Partial<Database['public']['Tables']['jadwal_soal']['Row']>
        Update: Partial<Database['public']['Tables']['jadwal_soal']['Row']>
      }
      token_ujian: {
        Row: { id: string; token: string; jadwal_id: string; is_active: boolean; expired_at: string | null; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['token_ujian']['Row']>
        Update: Partial<Database['public']['Tables']['token_ujian']['Row']>
      }
      exam_sessions: {
        Row: { id: string; student_id: string; jadwal_id: string; is_submitted: boolean; submitted_at: string | null; started_at: string | null }
        Insert: Partial<Database['public']['Tables']['exam_sessions']['Row']>
        Update: Partial<Database['public']['Tables']['exam_sessions']['Row']>
      }
      answers: {
        Row: { id: string; student_id: string; question_id: string; answer_text: string | null; jadwal_id: string | null; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['answers']['Row']>
        Update: Partial<Database['public']['Tables']['answers']['Row']>
      }
      siswa_kelas: {
        Row: { id: string; student_id: string; kelas_id: string; created_at: string | null }
        Insert: Partial<Database['public']['Tables']['siswa_kelas']['Row']>
        Update: Partial<Database['public']['Tables']['siswa_kelas']['Row']>
      }
    }
    Views: {
      v_jadwal_full: {
        Row: {
          id: string; nama: string; tanggal: string; waktu_mulai: string; waktu_selesai: string
          durasi_menit: number; is_active: boolean; mata_pelajaran_id: string | null
          kelas_id: string | null; bank_soal_id: string | null
          mapel_nama: string | null; mapel_kode: string | null; kelas_nama: string | null
          bank_soal_nama: string | null; jumlah_soal: number | null; jumlah_siswa: number | null
        }
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}