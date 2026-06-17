-- ============================================================
-- 매물시세 앱 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- ============================================================

-- 저장 슬롯 (사용자별 고정 20칸, 0~19)
create table if not exists public.naver_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  slot_index  int  not null check (slot_index >= 0 and slot_index < 20),
  data        jsonb not null,                 -- SavedSlot 전체(meta/config/count/properties)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slot_index)
);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_naver_slots_touch on public.naver_slots;
create trigger trg_naver_slots_touch
  before update on public.naver_slots
  for each row execute function public.touch_updated_at();

-- ── Row Level Security: 본인 행만 접근 ──
alter table public.naver_slots enable row level security;

drop policy if exists "naver_slots_select_own" on public.naver_slots;
create policy "naver_slots_select_own" on public.naver_slots
  for select using (auth.uid() = user_id);

drop policy if exists "naver_slots_insert_own" on public.naver_slots;
create policy "naver_slots_insert_own" on public.naver_slots
  for insert with check (auth.uid() = user_id);

drop policy if exists "naver_slots_update_own" on public.naver_slots;
create policy "naver_slots_update_own" on public.naver_slots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "naver_slots_delete_own" on public.naver_slots;
create policy "naver_slots_delete_own" on public.naver_slots
  for delete using (auth.uid() = user_id);
