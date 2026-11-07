-- Dữ liệu mẫu: nhóm, sản phẩm, 2 bậc đối tác kèm tỷ lệ theo nhóm (và 1 mức
-- riêng theo sản phẩm), tên cửa hàng.
-- Không tạo user (auth.users giữ nguyên qua db:reset).

insert into public.categories (name, sort_order) values
  ('Phân NPK', 1),
  ('Phân hữu cơ', 2),
  ('Phân bón lá', 3),
  ('Thuốc BVTV', 4),
  ('Vật tư', 5);

insert into public.products (sku, name, unit, category_id, list_price, description)
select v.sku, v.name, v.unit, c.id, v.list_price, v.description
from (values
  ('NPK-161616', 'Phân NPK 16-16-8 Đầu Trâu', 'bao 50kg', 'Phân NPK', 850000, 'Phân NPK cân đối cho lúa, cà phê, sầu riêng giai đoạn nuôi trái.'),
  ('NPK-201020', 'Phân NPK 20-10-20 Bình Điền', 'bao 50kg', 'Phân NPK', 920000, 'Giàu đạm và kali, dùng cho giai đoạn phát triển trái.'),
  ('NPK-301010', 'Phân NPK 30-10-10 Phú Mỹ', 'bao 25kg', 'Phân NPK', 480000, 'Đạm cao, kích thích ra lá, đâm chồi.'),
  ('HC-VISINH', 'Phân hữu cơ vi sinh Sông Gianh', 'bao 50kg', 'Phân hữu cơ', 350000, 'Cải tạo đất, tăng vi sinh vật có ích.'),
  ('HC-PHANBO', 'Phân bò ủ hoai', 'bao 25kg', 'Phân hữu cơ', 120000, 'Phân chuồng đã ủ hoai, không mùi.'),
  ('LA-ROONG', 'Phân bón lá Ra rễ cực mạnh', 'chai 500ml', 'Phân bón lá', 95000, 'Kích rễ, phục hồi cây sau thu hoạch.'),
  ('LA-DUONGTRAI', 'Phân bón lá Dưỡng trái to', 'gói 1kg', 'Phân bón lá', 145000, 'Bổ sung canxi-bo, chống rụng trái non.'),
  ('BVTV-NAM', 'Thuốc trừ nấm Anvil 5SC', 'chai 1 lít', 'Thuốc BVTV', 210000, 'Phòng trừ nấm hồng, thán thư, rỉ sắt.'),
  ('BVTV-SAU', 'Thuốc trừ sâu Regent 800WG', 'gói 100g', 'Thuốc BVTV', 65000, 'Trừ sâu đục thân, rầy, bọ trĩ.'),
  ('VT-BINHXIT', 'Bình xịt điện 20 lít', 'cái', 'Vật tư', 780000, 'Bình phun thuốc chạy pin, 2 chế độ phun.')
) as v(sku, name, unit, category, list_price, description)
join public.categories c on c.name = v.category;

insert into public.partner_tiers (name, kind) values
  ('CTV chuẩn', 'commission'),
  ('Đại lý cấp 1', 'wholesale');

insert into public.tier_rates (tier_id, category_id, rate_pct)
select t.id, c.id, v.rate_pct
from (values
  ('CTV chuẩn', 'Phân NPK', 3.00),
  ('CTV chuẩn', 'Phân hữu cơ', 5.00),
  ('CTV chuẩn', 'Phân bón lá', 8.00),
  ('CTV chuẩn', 'Thuốc BVTV', 6.00),
  ('CTV chuẩn', 'Vật tư', 4.00),
  ('Đại lý cấp 1', 'Phân NPK', 5.00),
  ('Đại lý cấp 1', 'Phân hữu cơ', 8.00),
  ('Đại lý cấp 1', 'Phân bón lá', 12.00),
  ('Đại lý cấp 1', 'Thuốc BVTV', 10.00),
  ('Đại lý cấp 1', 'Vật tư', 6.00)
) as v(tier, category, rate_pct)
join public.partner_tiers t on t.name = v.tier
join public.categories c on c.name = v.category;

-- Một mức riêng theo sản phẩm (ghi đè mức theo nhóm) làm mẫu.
insert into public.tier_product_rates (tier_id, product_id, rate_pct)
select t.id, p.id, 10.00
from public.partner_tiers t, public.products p
where t.name = 'CTV chuẩn' and p.sku = 'LA-DUONGTRAI';

insert into public.settings (key, value) values
  ('store_name', to_jsonb('Cửa hàng vật tư'::text));
