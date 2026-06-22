import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import {
  listMyThread, sendUserMessage, markThreadReadByUser, countUserUnread,
  type InquiryMessage,
} from '../services/inquiriesRepo';

// 사용자(본인) 1:1 문의 스레드 + 미읽음 + Realtime.
export function useInquiries(session: Session | null) {
  const [thread, setThread] = useState<InquiryMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const uid = session?.user?.id ?? null;

  const reload = useCallback(async () => {
    if (!uid) { setThread([]); setUnread(0); return; }
    try {
      setThread(await listMyThread());
      setUnread(await countUserUnread());
    } catch (err) {
      console.warn('문의 스레드 로드 실패:', err);
    }
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: 내 스레드에 admin 답변이 insert 되면 갱신
  useEffect(() => {
    const client = supabase;
    if (!client || !uid) return;
    const ch = client
      .channel(`inq-user-${uid}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inquiries', filter: `user_id=eq.${uid}` },
        () => { reload(); })
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [uid, reload]);

  const send = useCallback(async (body: string, context?: Record<string, unknown>) => {
    await sendUserMessage(body, context);
    await reload();
  }, [reload]);

  const markRead = useCallback(async () => {
    await markThreadReadByUser();
    setUnread(0);
    setThread((prev) => prev.map((m) => (m.senderRole === 'admin' ? { ...m, readByUser: true } : m)));
  }, []);

  return { thread, unread, reload, send, markRead };
}
