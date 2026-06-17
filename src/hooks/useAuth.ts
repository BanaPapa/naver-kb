import { useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export interface AuthState {
  configured: boolean;      // Supabase 키 설정 여부
  loading: boolean;         // 초기 세션 복원 중
  session: Session | null;
  user: User | null;
}

// 이메일/비밀번호 인증 상태 + 동작. Supabase 미설정 시 모든 동작은 안전하게 no-op.
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    configured: isSupabaseConfigured,
    loading: isSupabaseConfigured, // 설정된 경우에만 세션 복원 대기
    session: null,
    user: null,
  });

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({
        ...s,
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
      }));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, loading: false, session, user: session?.user ?? null }));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // 이메일 확인이 켜져 있으면 session=null (확인 메일 발송됨)
    return { needsEmailConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut };
}
