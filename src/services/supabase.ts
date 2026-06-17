import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 이 앱 전용 Supabase 프로젝트 연결.
// 키가 없으면 supabase=null → 앱은 로그인 없이(메모리 슬롯) 기존대로 동작한다.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
