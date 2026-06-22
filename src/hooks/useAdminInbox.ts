import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { countAdminUnread, listUnreadUserIds } from '../services/inquiriesRepo';

// 관리자: 전체 미읽음 문의 수 + 미읽음 사용자 id 집합 + Realtime.
export function useAdminInbox(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadUserIds, setUnreadUserIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!enabled) { setUnreadCount(0); setUnreadUserIds(new Set()); return; }
    try {
      setUnreadCount(await countAdminUnread());
      setUnreadUserIds(new Set(await listUnreadUserIds()));
    } catch (err) {
      console.warn('관리자 문의함 로드 실패:', err);
    }
  }, [enabled]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!supabase || !enabled) return;
    const client = supabase;
    const ch = client
      .channel('inq-admin-inbox')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => { reload(); })
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [enabled, reload]);

  return { unreadCount, unreadUserIds, reload };
}
