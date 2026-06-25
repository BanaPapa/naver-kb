-- ============================================================
-- KB 시계열 데이터 — Supabase Storage 설정
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- (버킷 자체는 ingest 스크립트가 자동 생성하거나, 대시보드 Storage에서
--  'kb-data' private 버킷을 직접 만들어도 됩니다.)
-- ============================================================

-- 로그인(authenticated)한 사용자에게 kb-data 버킷 읽기 허용.
-- 앱이 이미 승인제 로그인 게이트 뒤에 있으므로 authenticated 단위로 둔다.
-- 더 엄격히 하려면 아래 using 절에 profiles.status='approved' 체크를 추가하면 된다.
drop policy if exists "kb-data read for authenticated" on storage.objects;
create policy "kb-data read for authenticated"
on storage.objects for select
to authenticated
using ( bucket_id = 'kb-data' );

-- (선택) 승인된 회원만 읽도록 강화하려면 위 정책 대신 아래 사용:
-- drop policy if exists "kb-data read for approved" on storage.objects;
-- create policy "kb-data read for approved"
-- on storage.objects for select
-- to authenticated
-- using (
--   bucket_id = 'kb-data'
--   and exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.status = 'approved'
--   )
-- );

-- 업로드(ingest)는 service_role 키로 수행하므로 별도 insert/update 정책이 필요 없다
-- (service_role 은 RLS를 우회).
