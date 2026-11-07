-- Quyền mặc định trên schema public giống Supabase. Dùng khi bootstrap và db:reset
-- (default privileges gắn với schema nên phải tạo lại sau khi drop schema).
create schema if not exists public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
