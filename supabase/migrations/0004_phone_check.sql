-- Siết check SĐT: sau số 0 đầu phải là chữ số khác 0 (chặn dạng '009…' do nhập "+84 0912…"),
-- khớp normalizePhone (lib/phone.ts). Tên ràng buộc là tên Postgres tự đặt ở 0001.
alter table public.partners drop constraint partners_phone_check;
alter table public.partners add constraint partners_phone_check check (phone ~ '^0[1-9][0-9]{8,9}$');

alter table public.farmers drop constraint farmers_phone_check;
alter table public.farmers add constraint farmers_phone_check check (phone ~ '^0[1-9][0-9]{8,9}$');

alter table public.orders drop constraint orders_retail_phone_check;
alter table public.orders add constraint orders_retail_phone_check check (retail_phone ~ '^0[1-9][0-9]{8,9}$');
