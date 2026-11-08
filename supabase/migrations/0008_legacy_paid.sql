-- Hoa hồng đã chi theo cách cũ (commission_entries.status = 'paid', trước khi có ví) được ghi
-- thành MỘT khoản chi `paid` mỗi đối tác (source 'legacy', mã GD 'LEGACY-TRUOC-VI') để ví không
-- tính lại số tiền đó là khả dụng. Chạy lại không thêm gì: bỏ qua đối tác đã có khoản legacy.
-- Sau khi chạy, đừng dùng nút "Đã chi" cũ nữa (bản mới đã bỏ nút này).

alter table public.payouts drop constraint if exists payouts_source_check;
alter table public.payouts add constraint payouts_source_check
  check (source in ('request', 'batch', 'legacy'));

insert into public.payouts (
  partner_id, amount, source, status, transfer_ref, transferred_on,
  requested_at, decided_at, paid_at, is_demo
)
select ce.partner_id, sum(ce.amount), 'legacy', 'paid', 'LEGACY-TRUOC-VI',
  (coalesce(max(ce.paid_at), now()) at time zone 'Asia/Ho_Chi_Minh')::date,
  coalesce(max(ce.paid_at), now()), coalesce(max(ce.paid_at), now()), coalesce(max(ce.paid_at), now()),
  bool_or(pt.is_demo)
from public.commission_entries ce
join public.partners pt on pt.id = ce.partner_id
where ce.status = 'paid'
  and not exists (
    select 1 from public.payouts p where p.partner_id = ce.partner_id and p.source = 'legacy'
  )
group by ce.partner_id
having sum(ce.amount) > 0;
