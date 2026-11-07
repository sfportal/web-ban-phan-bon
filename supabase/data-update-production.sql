begin;
-- Sinh tự động bởi scripts/gen-seed.ts từ data/*.json (npm run data:gen) — không sửa tay.
-- Cập nhật dữ liệu Supabase bản thật sang bộ sản phẩm thật. Chạy SAU migration 0005, trong SQL Editor.
-- Chạy lại nhiều lần an toàn. Không đụng tới đối tác, đơn hàng, cài đặt.
--  1. Nhóm cũ (theo tên cũ, rồi theo tên mới) được gắn slug, tên, ảnh, thứ tự mới — giữ id.
--  2. Thêm/cập nhật nhóm theo slug.
--  3. Bảo đảm 2 bậc đối tác; tỷ lệ theo nhóm upsert theo (bậc, nhóm).
--  4. Sản phẩm upsert theo SKU (giữ ảnh, còn hàng, hiển thị của sản phẩm đã có).
--  5. Sản phẩm có SKU ngoài bộ mới (kể cả sản phẩm thêm tay): có đơn → ẩn; không đơn → xóa
--     (kèm khuyến mãi theo sản phẩm đó).

-- 1. Nhóm cũ → slug mới
update public.categories c
set slug = v.slug, name = n.name, sort_order = n.sort_order, image_url = n.image_url
from (values
  ('Phân NPK', 'npk'),
  ('Phân hữu cơ', 'huu-co'),
  ('Phân bón lá', 'phan-bon-la'),
  ('Thuốc BVTV', 'thuoc-bvtv'),
  ('Vật tư', 'vat-tu')
) as v(match_name, slug)
join (values
  ('npk', 'Phân NPK', 1, 'https://images.pexels.com/photos/31673795/pexels-photo-31673795.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('huu-co', 'Phân hữu cơ', 3, 'https://images.unsplash.com/photo-1584747420644-5c767eebcbe6?auto=format&fit=crop&w=1600&q=80'),
  ('phan-bon-la', 'Phân bón lá & vi lượng', 4, 'https://images.unsplash.com/photo-1604595031526-1c468db04a1c?auto=format&fit=crop&w=1600&q=80'),
  ('thuoc-bvtv', 'Thuốc BVTV', 5, 'https://images.unsplash.com/photo-1711900177627-1182b446bc8f?auto=format&fit=crop&w=1600&q=80'),
  ('vat-tu', 'Vật tư nông nghiệp', 6, 'https://images.unsplash.com/photo-1645727527942-f12e14a0c841?auto=format&fit=crop&w=1600&q=80')
) as n(slug, name, sort_order, image_url) on n.slug = v.slug
where c.slug is null and c.name = v.match_name
  and not exists (select 1 from public.categories x where x.slug = v.slug);

update public.categories c
set slug = v.slug, name = n.name, sort_order = n.sort_order, image_url = n.image_url
from (values
  ('Phân NPK', 'npk'),
  ('Phân đơn (Urê, DAP, Kali)', 'phan-don'),
  ('Phân hữu cơ', 'huu-co'),
  ('Phân bón lá & vi lượng', 'phan-bon-la'),
  ('Thuốc BVTV', 'thuoc-bvtv'),
  ('Vật tư nông nghiệp', 'vat-tu')
) as v(match_name, slug)
join (values
  ('npk', 'Phân NPK', 1, 'https://images.pexels.com/photos/31673795/pexels-photo-31673795.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('phan-don', 'Phân đơn (Urê, DAP, Kali)', 2, 'https://images.pexels.com/photos/15388810/pexels-photo-15388810.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('huu-co', 'Phân hữu cơ', 3, 'https://images.unsplash.com/photo-1584747420644-5c767eebcbe6?auto=format&fit=crop&w=1600&q=80'),
  ('phan-bon-la', 'Phân bón lá & vi lượng', 4, 'https://images.unsplash.com/photo-1604595031526-1c468db04a1c?auto=format&fit=crop&w=1600&q=80'),
  ('thuoc-bvtv', 'Thuốc BVTV', 5, 'https://images.unsplash.com/photo-1711900177627-1182b446bc8f?auto=format&fit=crop&w=1600&q=80'),
  ('vat-tu', 'Vật tư nông nghiệp', 6, 'https://images.unsplash.com/photo-1645727527942-f12e14a0c841?auto=format&fit=crop&w=1600&q=80')
) as n(slug, name, sort_order, image_url) on n.slug = v.slug
where c.slug is null and c.name = v.match_name
  and not exists (select 1 from public.categories x where x.slug = v.slug);

-- 2. Nhóm theo slug
insert into public.categories (slug, name, sort_order, image_url) values
  ('npk', 'Phân NPK', 1, 'https://images.pexels.com/photos/31673795/pexels-photo-31673795.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('phan-don', 'Phân đơn (Urê, DAP, Kali)', 2, 'https://images.pexels.com/photos/15388810/pexels-photo-15388810.jpeg?auto=compress&cs=tinysrgb&w=1600'),
  ('huu-co', 'Phân hữu cơ', 3, 'https://images.unsplash.com/photo-1584747420644-5c767eebcbe6?auto=format&fit=crop&w=1600&q=80'),
  ('phan-bon-la', 'Phân bón lá & vi lượng', 4, 'https://images.unsplash.com/photo-1604595031526-1c468db04a1c?auto=format&fit=crop&w=1600&q=80'),
  ('thuoc-bvtv', 'Thuốc BVTV', 5, 'https://images.unsplash.com/photo-1711900177627-1182b446bc8f?auto=format&fit=crop&w=1600&q=80'),
  ('vat-tu', 'Vật tư nông nghiệp', 6, 'https://images.unsplash.com/photo-1645727527942-f12e14a0c841?auto=format&fit=crop&w=1600&q=80')
on conflict (slug) do update
set name = excluded.name, sort_order = excluded.sort_order, image_url = excluded.image_url;

-- 3. Bậc đối tác và tỷ lệ theo nhóm
insert into public.partner_tiers (name, kind) values
  ('CTV chuẩn', 'commission'),
  ('Đại lý cấp 1', 'wholesale')
on conflict (name) do nothing;

insert into public.tier_rates (tier_id, category_id, rate_pct)
select t.id, c.id, v.rate_pct
from (values
  ('CTV chuẩn', 'npk', 3.00),
  ('CTV chuẩn', 'phan-don', 2.00),
  ('CTV chuẩn', 'huu-co', 5.00),
  ('CTV chuẩn', 'phan-bon-la', 8.00),
  ('CTV chuẩn', 'thuoc-bvtv', 6.00),
  ('CTV chuẩn', 'vat-tu', 4.00),
  ('Đại lý cấp 1', 'npk', 5.00),
  ('Đại lý cấp 1', 'phan-don', 4.00),
  ('Đại lý cấp 1', 'huu-co', 8.00),
  ('Đại lý cấp 1', 'phan-bon-la', 12.00),
  ('Đại lý cấp 1', 'thuoc-bvtv', 10.00),
  ('Đại lý cấp 1', 'vat-tu', 6.00)
) as v(tier, category, rate_pct)
join public.partner_tiers t on t.name = v.tier
join public.categories c on c.slug = v.category
on conflict (tier_id, category_id) do update set rate_pct = excluded.rate_pct;

-- 4. Sản phẩm theo SKU
insert into public.products (sku, name, brand, unit, category_id, list_price, short_desc, composition, benefits, usage, crops, is_featured)
select v.sku, v.name, v.brand, v.unit, c.id, v.list_price, v.short_desc, v.composition, v.benefits, v.usage, v.crops, v.is_featured
from (values
  ('NPK-DT-20-20-15-50', 'Phân NPK Đầu Trâu 20-20-15+TE', 'Bình Điền (Đầu Trâu)', 'bao 50kg', 'npk', 910000, 'NPK hàm lượng cao, cân đối đạm – lân – kali, kèm vi lượng; hợp bón thúc lúa, rau màu và cây ăn trái.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 15%, bổ sung trung vi lượng (TE).', E'Tổng dinh dưỡng 55%, bón ít mà đủ chất.\nĐạm và lân cao giúp cây đẻ nhánh, ra rễ, phát lộc nhanh.\nKali hỗ trợ cứng cây, nuôi hạt và trái.\nVi lượng đi kèm giúp lá xanh bền, hạn chế vàng lá.', E'Lúa: bón thúc 100–150 kg/ha mỗi lần, giai đoạn đẻ nhánh và làm đòng.\nRau màu: 300–500 kg/ha/vụ, chia 3–4 lần.\nCà phê, sầu riêng, cây ăn trái: 0,5–1,5 kg/cây/lần, 3–4 lần/năm tùy tuổi cây.\nRải quanh tán, lấp nhẹ và tưới ẩm sau khi bón.', array['Lúa', 'Rau màu', 'Cà phê', 'Sầu riêng', 'Cây ăn trái']::text[], true),
  ('NPK-DT-16-16-8-50', 'Phân NPK Đầu Trâu 16-16-8+TE', 'Bình Điền (Đầu Trâu)', 'bao 50kg', 'npk', 710000, 'NPK đa dụng cho bón lót và bón thúc đầu vụ, có thêm trung vi lượng giúp bộ rễ khỏe.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%, bổ sung trung vi lượng (TE).', E'Tỷ lệ đạm – lân bằng nhau, hợp giai đoạn cây con và đẻ nhánh.\nThúc rễ phát triển, cây bén đất nhanh sau gieo trồng.\nDễ phối hợp với kali đơn khi vào giai đoạn nuôi trái.', E'Lúa: bón lót hoặc thúc đẻ nhánh 150–200 kg/ha.\nNgô, rau màu: 200–300 kg/ha, chia 2–3 lần.\nCây ăn trái, cà phê: 0,5–1 kg/cây/lần sau thu hoạch và đầu mùa mưa.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('NPK-PM-16-16-8-50', 'Phân NPK Phú Mỹ 16-16-8+13S', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'npk', 700000, 'NPK một hạt có thêm 13% lưu huỳnh, tan đều, dùng tốt cho lúa, ngô, rau và cây công nghiệp.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8% – Lưu huỳnh (S) 13%.', E'Mỗi hạt đủ cả N, P, K nên rải đồng đều, không bị phân lớp.\nLưu huỳnh giúp cây tổng hợp đạm tốt, lá xanh, hạt chắc.\nPhù hợp đất phèn nhẹ và đất thiếu lưu huỳnh.', E'Lúa: 150–250 kg/ha/vụ, chia bón lót và thúc đẻ nhánh.\nNgô, rau màu: 250–350 kg/ha/vụ, chia 2–3 lần.\nCà phê, hồ tiêu, cây ăn trái: 0,5–1 kg/cây/lần, 3–4 lần/năm.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Hồ tiêu']::text[], true),
  ('NPK-CM-16-16-8-50', 'Phân NPK Cà Mau 16-16-8', 'Phân bón Cà Mau (PVCFC)', 'bao 50kg', 'npk', 705000, 'NPK một hạt của Đạm Cà Mau, cân đối dinh dưỡng cho giai đoạn đầu và giữa vụ.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%.', E'Hạt đồng đều, rải máy hoặc rải tay đều dễ.\nĐạm – lân cao giúp cây phát triển rễ, thân lá mạnh.\nGiúp giảm số lần trộn phân đơn tại ruộng.', E'Lúa: 150–200 kg/ha mỗi lần bón lót hoặc thúc đẻ nhánh.\nRau màu: 200–300 kg/ha/vụ, chia nhiều lần.\nCây ăn trái: 0,5–1 kg/cây/lần, bón quanh tán rồi tưới ẩm.', array['Lúa', 'Rau màu', 'Cây ăn trái']::text[], false),
  ('NPK-BCC-20-20-15-50', 'Phân NPK Con Cò 20-20-15', 'Baconco', 'bao 50kg', 'npk', 885000, 'NPK cao cấp hãng Con Cò, dinh dưỡng đậm đặc cho cây cần thúc mạnh: lúa, rau, cây ăn trái.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 15%.', E'Hàm lượng dinh dưỡng cao, tiết kiệm công vận chuyển và bón.\nThúc cây ra rễ, đâm chồi, lá to dày.\nKali vừa đủ giúp cây cứng, ít đổ ngã.', E'Lúa: bón thúc 100–150 kg/ha mỗi lần.\nRau ăn lá, rau ăn trái: 300–400 kg/ha/vụ, chia 3–4 lần.\nSầu riêng, cà phê, cây ăn trái: 0,5–1,5 kg/cây/lần tùy tuổi cây.', array['Lúa', 'Rau màu', 'Sầu riêng', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('NPK-VN-16-16-8-50', 'Phân NPK Việt Nhật 16-16-8', 'Phân bón Việt Nhật (JVF)', 'bao 50kg', 'npk', 630000, 'NPK phổ thông giá hợp lý, dùng bón lót và thúc sớm cho lúa, ngô, rau màu.', 'Đạm (N) 16% – Lân (P₂O₅) 16% – Kali (K₂O) 8%; có dòng bổ sung lưu huỳnh (S), xem nhãn bao.', E'Giá mềm, phù hợp diện tích lớn.\nCung cấp đạm, lân cân đối cho giai đoạn cây con.\nHạt cứng, ít vón cục khi bảo quản.', E'Lúa: 150–200 kg/ha mỗi lần bón lót hoặc thúc đẻ nhánh.\nNgô: 200–300 kg/ha, chia bón lót và thúc 4–6 lá.\nRau màu: 200–300 kg/ha/vụ, chia 2–3 lần.', array['Lúa', 'Ngô', 'Rau màu']::text[], false),
  ('URE-PM-46-50', 'Phân Urê Phú Mỹ', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'phan-don', 635000, 'Đạm urê hạt trong, hàm lượng đạm cao, giúp cây xanh lá, đẻ nhánh và lớn nhanh.', 'Đạm (N) ≥ 46%, biuret thấp.', E'Nguồn đạm đậm đặc nhất trong các loại phân đơn.\nThúc cây phát triển thân lá, đẻ nhánh khỏe.\nDễ phối trộn với lân, kali để tự pha công thức.', E'Lúa: 80–120 kg/ha/vụ, chia 2–3 lần (thúc đẻ nhánh, làm đòng).\nNgô: 150–250 kg/ha/vụ, chia 2–3 lần.\nRau màu: 100–150 kg/ha/vụ, rải hoặc hòa nước tưới.\nKhông bón khi trời sắp mưa to hoặc lúc nắng gắt để giảm thất thoát.', array['Lúa', 'Ngô', 'Rau màu', 'Cây ăn trái']::text[], true),
  ('URE-CM-46-50', 'Phân Urê Cà Mau', 'Phân bón Cà Mau (PVCFC)', 'bao 50kg', 'phan-don', 630000, 'Urê hạt đục của Đạm Cà Mau, hạt to, ít bụi, tan chậm hơn urê hạt trong.', 'Đạm (N) ≥ 46%, dạng hạt đục (granular).', E'Hạt to, cứng, rải máy đều, ít hút ẩm.\nĐạm giải phóng đều hơn, cây hấp thu tốt.\nPhổ biến ở Đồng bằng sông Cửu Long cho lúa và rau màu.', E'Lúa: 80–120 kg/ha/vụ, chia 2–3 lần.\nNgô, mía: 150–250 kg/ha/vụ, chia 2–3 lần.\nRau màu: 100–150 kg/ha/vụ, bón kèm lân và kali.', array['Lúa', 'Ngô', 'Mía', 'Rau màu']::text[], false),
  ('DAP-DV-18-46-50', 'Phân DAP Đình Vũ', 'DAP Vinachem (Đình Vũ)', 'bao 50kg', 'phan-don', 855000, 'Phân DAP sản xuất trong nước, giàu lân dễ tiêu kèm đạm, chuyên bón lót và kích rễ.', 'Diamoni photphat: Lân (P₂O₅) khoảng 45–46%, Đạm (N) khoảng 16–18% tùy dòng (xem nhãn bao).', E'Lân dễ tiêu giúp cây ra rễ mạnh, bén đất nhanh.\nĐạm đi kèm hỗ trợ cây con phát triển đều.\nThích hợp bón lót và bón giai đoạn phân hóa mầm hoa.', E'Lúa: bón lót 50–100 kg/ha.\nRau màu, ngô: bón lót 100–150 kg/ha.\nCà phê, cây ăn trái: 0,2–0,5 kg/cây/lần, đầu mùa mưa hoặc trước ra hoa.', array['Lúa', 'Ngô', 'Rau màu', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('KALI-PM-60-50', 'Phân Kali bột Phú Mỹ (KCl)', 'Phú Mỹ (PVFCCo)', 'bao 50kg', 'phan-don', 530000, 'Kali clorua dạng bột đỏ, bổ sung kali cho giai đoạn làm đòng, nuôi hạt và nuôi trái.', 'Kali (K₂O) khoảng 60%, dạng kali clorua (KCl).', E'Giúp cây cứng, chống đổ ngã và chịu hạn tốt hơn.\nTăng độ chắc hạt, trọng lượng và độ ngọt của trái.\nTan nhanh, có thể rải hoặc hòa nước tưới.', E'Lúa: 50–100 kg/ha/vụ, tập trung bón thúc đòng.\nCà phê, sầu riêng, cây ăn trái: 0,3–1 kg/cây/lần giai đoạn nuôi trái.\nRau ăn củ, ăn trái: 100–150 kg/ha/vụ, chia 2–3 lần.\nHạn chế dùng cho cây kỵ clo như thuốc lá.', array['Lúa', 'Cà phê', 'Sầu riêng', 'Cây ăn trái', 'Rau màu']::text[], true),
  ('LAN-LT-SUPE-50', 'Phân Supe Lân Lâm Thao', 'Supe Phốt phát Lâm Thao', 'bao 50kg', 'phan-don', 310000, 'Supe lân đơn truyền thống, bổ sung lân, lưu huỳnh và canxi; chuyên bón lót cải tạo đất.', 'Lân hữu hiệu (P₂O₅) khoảng 16%, kèm lưu huỳnh (S) và canxi (Ca).', E'Kích thích ra rễ, giúp cây con khỏe ngay từ đầu vụ.\nCung cấp thêm lưu huỳnh và canxi cho đất.\nGiá rẻ, dễ phối trộn với phân chuồng khi ủ.', E'Lúa: bón lót 300–400 kg/ha trước khi bừa cấy.\nRau màu, đậu đỗ: bón lót 300–500 kg/ha.\nCây ăn trái, cà phê: 1–2 kg/cây/năm, trộn cùng phân hữu cơ bón quanh tán.', array['Lúa', 'Rau màu', 'Đậu đỗ', 'Cà phê', 'Cây ăn trái']::text[], false),
  ('HC-SF-TRUNQUE-25', 'Phân trùn quế cao cấp Sfarm PB01', 'Sfarm', 'bao 25kg', 'huu-co', 235000, 'Phân trùn quế nguyên chất đã qua xử lý, tơi xốp, không mùi; dùng trộn đất và bón gốc cho mọi loại cây.', '100% phân trùn quế đã xử lý, giàu mùn và vi sinh vật có lợi; pH trung tính.', E'Làm đất tơi xốp, giữ ẩm và thoáng khí cho rễ.\nCung cấp dinh dưỡng từ từ, không gây cháy rễ.\nAn toàn cho rau sạch, cây cảnh và vườn ươm.', E'Rau trồng chậu: trộn với đất theo tỷ lệ khoảng 4 phần phân – 6 phần đất; bón thêm lớp 1–2 cm mỗi 2 tuần.\nRau ngoài vườn: khoảng 1 kg/m², bón lót hoặc bón thúc.\nCây ăn trái: 2–5 kg/cây/lần, rải quanh tán rồi phủ nhẹ.', array['Rau màu', 'Cây ăn trái', 'Hoa kiểng', 'Cây ăn củ']::text[], true),
  ('HC-SF-PHANGA-25', 'Phân gà bột ủ vi sinh Sfarm', 'Sfarm', 'bao 25kg', 'huu-co', 220000, 'Phân gà đã ủ hoai bằng vi sinh, dạng bột mịn, dùng bón lót cải tạo đất cho rau và cây ăn trái.', 'Phân gà ủ hoai với chế phẩm vi sinh, giàu chất hữu cơ, đạm, lân và kali tự nhiên.', E'Đã ủ hoai nên hạn chế mầm bệnh và mùi hôi.\nBổ sung mùn, tăng vi sinh vật có ích trong đất.\nGiúp cây hấp thu phân vô cơ hiệu quả hơn.', E'Rau màu: bón lót 1–2 tấn/ha, trộn đều vào luống trước khi gieo.\nCây ăn trái, cà phê: 3–5 kg/cây/lần, 2 lần/năm.\nKhông bón sát gốc cây non; tưới ẩm sau khi bón.', array['Rau màu', 'Cây ăn trái', 'Cà phê', 'Sầu riêng']::text[], false),
  ('HC-GANHAT-15', 'Phân gà hữu cơ Nhật Bản nhập khẩu', 'Daily Egg (Nhật Bản) – Thiên Thảo Hân phân phối', 'bao 15kg', 'huu-co', 149000, 'Phân gà viên nhập khẩu từ Nhật, ủ khô, hàm lượng hữu cơ cao, dễ bón và ít mùi.', 'Phân gà ủ hoai: Đạm (N) ~3,5%, Lân (P₂O₅) ~4%, Kali (K₂O) ~2,9%; giàu chất hữu cơ.', E'Dạng viên khô, sạch, dễ vận chuyển và rải.\nCung cấp đa lượng tự nhiên và mùn cho đất.\nHợp cho vườn hữu cơ, rau sạch và cây cảnh.', E'Rau màu: bón lót 600–800 kg/ha; bón thúc 800–1.000 kg/ha trước khi ra hoa, đậu trái.\nCây ăn trái: 700–900 kg/ha/năm; cây non khoảng 250 g/cây.\nCây cảnh chậu: 10–100 g/chậu tùy kích thước, rải cách gốc 5–10 cm.\nKhông bón quá liều hoặc sát gốc.', array['Rau màu', 'Cây ăn trái', 'Hoa kiểng', 'Cây công nghiệp']::text[], false),
  ('HC-BACA-DAMCA-1L', 'Đạm cá Bà Cả (Fish Protein)', 'Nông nghiệp Bà Cả', 'chai 1 lít', 'huu-co', 180000, 'Dịch đạm cá thủy phân hữu cơ, giàu axit amin, giúp cây phục hồi, ra rễ và xanh lá tự nhiên.', 'Chất hữu cơ 20%, tỷ lệ C/N 12, pH 5; đạm cá thủy phân, axit amin, axit humic và fulvic.', E'Bổ sung đạm hữu cơ dễ hấp thu cho cây.\nKích thích rễ tơ, giúp cây hồi sức sau thu hoạch.\nCải thiện hệ vi sinh đất khi tưới gốc.', E'Tưới gốc: pha 30–50 ml cho bình 16 lít, 10–15 ngày/lần.\nSầu riêng, cây ăn trái: dùng sau thu hoạch và giai đoạn nuôi đọt.\nRau màu: pha loãng hơn, tưới 7–10 ngày/lần.\nXem thêm liều chi tiết trên nhãn chai.', array['Sầu riêng', 'Cây ăn trái', 'Rau màu', 'Hoa kiểng']::text[], false),
  ('LA-BACA-20-20-20-50G', 'Phân bón lá Baca Premium 20-20-20+TE', 'Nông nghiệp Bà Cả', 'gói 50g', 'phan-bon-la', 25000, 'Phân bón lá hòa tan NPK cân đối 20-20-20 kèm vi lượng, nhập khẩu Hà Lan, dùng được cho mọi loại cây.', 'Đạm (N) 20% – Lân (P₂O₅) 20% – Kali (K₂O) 20%; Cu 100 ppm, Mn 100 ppm, Zn 200 ppm.', E'Tan hoàn toàn, cây hấp thu nhanh qua lá.\nCân đối dinh dưỡng cho giai đoạn sinh trưởng mạnh.\nDùng được cả phun lá, tưới gốc và tưới nhỏ giọt.', E'Pha 1 gói 50 g với 30–40 lít nước.\nPhun ướt đều hai mặt lá hoặc tưới gốc, 7–10 ngày/lần.\nPhun lúc sáng sớm hoặc chiều mát.', array['Rau màu', 'Lúa', 'Cây ăn trái', 'Cây công nghiệp', 'Hoa kiểng']::text[], false),
  ('LA-BACA-12-52-6-50G', 'Phân bón lá Baca Premium 12-52-6+TE', 'Nông nghiệp Bà Cả', 'gói 50g', 'phan-bon-la', 25000, 'Phân bón lá lân cao, kích rễ và hỗ trợ phân hóa mầm hoa, nhập khẩu Hà Lan.', 'Đạm (N) 12% – Lân (P₂O₅) 52% – Kali (K₂O) 6%; Cu 100 ppm, Mn 100 ppm, Zn 200 ppm.', E'Lân rất cao giúp ra rễ mạnh cho cây con, cây mới trồng.\nHỗ trợ cây phân hóa mầm hoa, ra hoa đồng loạt.\nGiúp cây phục hồi sau ngập úng hoặc sau thu hoạch.', E'Pha 1 gói 50 g với 30–40 lít nước.\nPhun lá hoặc tưới gốc 7–10 ngày/lần, giai đoạn cây con và trước ra hoa.\nKhông phun lúc trời nắng gắt.', array['Cây ăn trái', 'Rau màu', 'Lúa', 'Hoa kiểng']::text[], false),
  ('LA-BOLY-OMNIKELP-1L', 'Phân bón lá rong biển Boly Omnikelp', 'Boly', 'chai 1 lít', 'phan-bon-la', 150000, 'Chiết xuất rong biển Úc giàu chất kích thích sinh trưởng tự nhiên, giúp cây khỏe, xanh lá, đậu trái.', 'Chiết xuất rong biển: chất hữu cơ 3%, Kali (K₂O) 1,5%; axit amin, vitamin và vi lượng tự nhiên.', E'Giúp cây ra rễ, đâm chồi và phục hồi sau thu hoạch.\nTăng khả năng chịu hạn, chịu mặn và thời tiết bất lợi.\nHỗ trợ đậu trái, trái đều và đẹp mã.', E'Phun lá: 1 lít pha với khoảng 800 lít nước/ha (tương đương 20 ml/bình 16 lít).\nRau, hoa: 8–10 ngày/lần; lúa: từ 7–10 ngày sau sạ đến giai đoạn nuôi hạt.\nCây ăn trái: 10–14 ngày/lần sau thu hoạch, ra hoa và nuôi trái.\nTưới gốc: 5–10 lít pha 5.000 lít nước/ha, 15–20 ngày/lần.', array['Lúa', 'Rau màu', 'Cây ăn trái', 'Sầu riêng', 'Hoa kiểng']::text[], true),
  ('LA-DK-HUMIC-1250', 'Phân bón lá Humic Gel Điền Khánh', 'Điền Khánh', 'chai 1,25 lít', 'phan-bon-la', 280000, 'Phân bón dạng gel kết hợp NPK, humic và vi lượng kẽm – bo; phun lá hoặc tưới gốc đều được.', 'Đạm (N) 8% – Lân (P₂O₅) 6% – Kali (K₂O) 7%; axit humic 8%; Zn 200 ppm, B 900 ppm.', E'Humic giúp kích rễ và tăng hiệu quả hấp thu phân bón.\nBo, kẽm hỗ trợ ra hoa, đậu trái, hạn chế rụng trái non.\nDạng gel đậm đặc, một chai pha được lượng nước lớn.', E'Pha 1 chai 1,25 lít với khoảng 400 lít nước.\nPhun đều tán lá hoặc tưới gốc vào các giai đoạn: sau thu hoạch, trước ra hoa và khi đậu trái.\nLặp lại 10–15 ngày/lần theo nhu cầu cây.', array['Cây ăn trái', 'Sầu riêng', 'Cà phê', 'Rau màu']::text[], false),
  ('BVTV-SYN-ANVIL-1L', 'Thuốc trừ bệnh Anvil 5SC', 'Syngenta', 'chai 1 lít', 'thuoc-bvtv', 285000, 'Thuốc trừ nấm phổ rộng gốc Hexaconazole, đặc trị khô vằn lúa, rỉ sắt và nấm hồng cà phê.', 'Hoạt chất Hexaconazole 50 g/lít, dạng huyền phù (SC).', E'Thuốc nội hấp, vừa phòng vừa trị nhiều bệnh nấm.\nHiệu quả với khô vằn, lem lép hạt trên lúa.\nTrị rỉ sắt, nấm hồng trên cà phê và ghẻ trên cây có múi.', E'Lúa (khô vằn, lem lép hạt): 40 ml/bình 16 lít, phun 2–2,5 bình cho 1.000 m².\nCà phê (rỉ sắt, nấm hồng): 500 ml/200 lít nước, phun 600–800 lít/ha khi bệnh mới xuất hiện.\nCây có múi (ghẻ): 300 ml/100 lít nước, phun lại sau 7 ngày.\nThời gian cách ly 14 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Cà phê', 'Ngô', 'Cây có múi']::text[], true),
  ('BVTV-BAY-NATIVO-120G', 'Thuốc trừ bệnh Nativo 750WG', 'Bayer', 'gói 120g', 'thuoc-bvtv', 342000, 'Thuốc trừ nấm hai hoạt chất, phòng trị đạo ôn, lem lép hạt, thán thư và rỉ sắt trên nhiều cây trồng.', 'Trifloxystrobin 250 g/kg + Tebuconazole 500 g/kg, dạng hạt phân tán (WG).', E'Kết hợp hai cơ chế tác động, giảm nguy cơ kháng thuốc.\nGiữ lá đòng xanh lâu, hạt lúa sáng, chắc.\nPhổ rộng: lúa, cà phê, hồ tiêu, đậu, khoai tây.', E'Lúa (đạo ôn, lem lép hạt, khô vằn): 6 g/bình 16 lít, phun 2 bình cho 1.000 m².\nCà phê (rỉ sắt): 40 g/100 lít nước.\nLạc, đậu tương (rỉ sắt): 200 g/ha.\nPhun khi bệnh mới xuất hiện; cách ly 7 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Cà phê', 'Hồ tiêu', 'Đậu đỗ', 'Khoai tây']::text[], false),
  ('BVTV-SYN-CHESS-20G', 'Thuốc trừ rầy Chess 50WG', 'Syngenta', 'gói 20g', 'thuoc-bvtv', 39000, 'Thuốc trừ rầy nâu, rầy lưng trắng, bọ phấn trên lúa và rầy bông, bọ trĩ trên xoài; khiến rầy ngừng chích hút.', 'Hoạt chất Pymetrozine 500 g/kg, dạng hạt phân tán (WG).', E'Rầy ngừng chích hút ngay sau khi trúng thuốc, hạn chế cháy rầy.\nLưu dẫn mạnh, hiệu lực kéo dài.\nÍt ảnh hưởng thiên địch so với nhiều thuốc trừ rầy khác.', E'Lúa (rầy nâu, rầy lưng trắng): 0,3–0,5 kg/ha; pha 7,5 g/bình 10 lít hoặc 20 g/bình 25 lít, phun khi rầy cám mới nở.\nXoài (rầy bông, bọ trĩ): 120–200 g/200 lít nước.\nThời gian cách ly 7 ngày. Đọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Xoài']::text[], false),
  ('BVTV-FMC-PREVATHON-100', 'Thuốc trừ sâu Prevathon 200SC', 'FMC', 'chai 100ml', 'thuoc-bvtv', 185000, 'Thuốc trừ sâu gốc Chlorantraniliprole, đặc trị sâu cuốn lá, sâu đục thân lúa và sâu đục trái vải.', 'Hoạt chất Chlorantraniliprole 200 g/lít, dạng huyền phù (SC).', E'Sâu ngừng ăn nhanh sau khi nhiễm thuốc.\nHiệu lực kéo dài, giảm số lần phun trong vụ.\nÍt độc với ong và thiên địch khi dùng đúng liều.', E'Lúa (sâu cuốn lá, sâu đục thân): 150 ml/ha, pha với khoảng 400 lít nước; phun khi sâu tuổi nhỏ.\nVải (sâu đục cuống trái): 200 ml/100 lít nước, phun 600 lít/ha.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa', 'Vải']::text[], false),
  ('BVTV-SYN-SOFIT-1L', 'Thuốc trừ cỏ Sofit 300EC', 'Syngenta', 'chai 1 lít', 'thuoc-bvtv', 310000, 'Thuốc trừ cỏ tiền nảy mầm cho lúa sạ và lúa cấy, có chất an toàn giúp lúa không bị ngộ độc.', 'Pretilachlor 300 g/lít + chất an toàn Fenclorim 100 g/lít, dạng nhũ dầu (EC).', E'Diệt cỏ lồng vực, đuôi phụng, cỏ chác, cỏ lác ngay từ khi nảy mầm.\nFenclorim bảo vệ cây lúa non.\nMột lần phun giữ ruộng sạch cỏ giai đoạn đầu vụ.', E'Lúa sạ: phun 0–4 ngày sau sạ; lúa cấy: 0–5 ngày sau cấy.\nLiều 1–1,4 lít/ha: khoảng 70 ml/bình 16 lít, phun 20 bình/ha (300–400 lít nước).\nGiữ ruộng đủ ẩm, không để khô nứt sau phun.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Lúa']::text[], false),
  ('BVTV-UPL-TARANG-900', 'Thuốc trừ cỏ Tarang 280SL', 'UPL', 'chai 900ml', 'thuoc-bvtv', 145000, 'Thuốc trừ cỏ không chọn lọc gốc Glufosinate, diệt nhanh cỏ lá rộng và cỏ hòa bản trong vườn cây.', 'Hoạt chất Glufosinate ammonium 280 g/lít, dạng dung dịch (SL).', E'Cỏ cháy nhanh sau vài ngày, dùng dọn vườn, bờ ruộng.\nDiệt được cỏ mần trầu, cỏ chỉ, rau dền, rau trai.\nTác động tiếp xúc, không lưu dẫn xuống rễ cây trồng.', E'Pha 60 ml/bình 16 lít hoặc 95 ml/bình 25 lít.\nPhun khi cỏ non cao 5–15 cm, trời khô ráo có nắng.\nPhun tránh tạt vào lá và thân xanh của cây trồng; không pha với nước phèn, nước đục.\nĐọc kỹ nhãn, mang đồ bảo hộ khi phun.', array['Cây ăn trái', 'Cà phê', 'Cây công nghiệp']::text[], false),
  ('VT-OSHIMA-BLV16', 'Bình xịt điện Oshima BLV 16 lít', 'Oshima', 'cái', 'vat-tu', 975000, 'Bình phun thuốc chạy pin 12V dung tích 16 lít, áp lực ổn định, phun liên tục 6–8 giờ mỗi lần sạc.', 'Bình 16 lít; ắc quy 12V – 8Ah; áp lực 0,15–0,6 MPa; lưu lượng 4,2 lít/phút; nặng khoảng 6 kg.', E'Không phải bơm tay, đỡ mỏi khi phun diện tích lớn.\nMột lần sạc phun được khoảng 20–25 bình.\nVan đồng chịu mài mòn và hóa chất; bảo hành 12 tháng.', E'Sạc đầy pin trước lần dùng đầu tiên.\nĐổ nước sạch đến 2/3 bình rồi mới cho thuốc, khuấy đều.\nRửa sạch bình, vòi và lọc sau mỗi lần phun; cất nơi khô ráo.', array['Lúa', 'Rau màu', 'Cây ăn trái', 'Cà phê']::text[], true),
  ('VT-PK-MANGPHU-2M2', 'Màng phủ nông nghiệp Phú Khang khổ 2,2 m', 'Phú Khang', 'cuộn', 'vat-tu', 1590000, 'Màng phủ luống hai mặt bạc – đen, giúp giữ ẩm, chống cỏ dại và hạn chế sâu bệnh cho rau màu, dưa, ớt.', 'Nhựa PE kèm phụ gia; mặt bạc phía trên, mặt đen phía dưới; cuộn dài khoảng 400 m (chưa đục lỗ).', E'Ngăn cỏ mọc trên luống, giảm công làm cỏ.\nGiữ ẩm mùa khô, chống xói luống mùa mưa.\nMặt bạc phản quang giúp xua côn trùng; dùng được 2–3 vụ nếu bảo quản tốt.', E'Lên luống, bón lót và tưới ẩm trước khi phủ.\nTrải mặt bạc lên trên, kéo căng và chèn đất hai mép.\nĐục lỗ theo khoảng cách trồng; hạn chế phun thuốc gốc đồng lên màng.', array['Dưa hấu', 'Ớt', 'Cà chua', 'Rau màu']::text[], false),
  ('VT-SF-DATRAU-20L', 'Đất trồng rau Sfarm', 'Sfarm', 'bao 20 lít', 'vat-tu', 72000, 'Đất sạch trộn sẵn cho rau trồng chậu, thùng xốp: tơi xốp, có phân hữu cơ và nấm Trichoderma.', 'Mùn, xơ dừa, phân trùn quế, phân bò, phân gà, bột lá neem, nấm Trichoderma và đất thịt; bao 20 dm³ (khoảng 8–9 kg).', E'Dùng ngay, không cần phối trộn thêm.\nTrichoderma giúp hạn chế nấm bệnh vùng rễ.\nGiữ ẩm tốt mà vẫn thoát nước, hợp trồng rau ban công.', E'Cho đất vào chậu, khay, cách miệng 3–5 cm.\nGieo hạt hoặc trồng cây con, tưới 1–2 lần/ngày.\nRau ngắn ngày không cần bón thêm; rau dài ngày bón bổ sung sau 25–30 ngày.', array['Rau màu', 'Hoa kiểng']::text[], false),
  ('VT-KHAYUOM-104', 'Khay ươm hạt 104 lỗ', 'Tân Tường Khang', 'cái', 'vat-tu', 10000, 'Khay nhựa 104 lỗ để ươm cây con và trồng rau mầm, dùng lại được nhiều lần.', 'Nhựa; kích thước 56 × 36 × 4 cm; ô 4 × 4 cm.', E'Cây con có bầu rễ riêng, ra ngôi không bị đứt rễ.\nTiết kiệm hạt giống và giá thể.\nRửa phơi khô là dùng lại được 4–5 lần.', E'Cho xơ dừa hoặc đất trộn phân vào từng ô, gieo 1 hạt/ô.\nTưới phun sương nhẹ, đặt nơi có nắng nhẹ, kê cao khỏi mặt đất.\nSau mỗi đợt, đổ bỏ giá thể cũ, rửa sạch và phơi khô khay.', array['Rau màu', 'Hoa kiểng']::text[], false)
) as v(sku, name, brand, unit, category, list_price, short_desc, composition, benefits, usage, crops, is_featured)
join public.categories c on c.slug = v.category
on conflict (sku) do update
set name = excluded.name, brand = excluded.brand, unit = excluded.unit, category_id = excluded.category_id,
  list_price = excluded.list_price, short_desc = excluded.short_desc, composition = excluded.composition,
  benefits = excluded.benefits, usage = excluded.usage, crops = excluded.crops, is_featured = excluded.is_featured;

-- 5. Sản phẩm ngoài bộ mới
update public.products p set is_active = false
where p.is_active
  and p.sku not in (
  'NPK-DT-20-20-15-50',
  'NPK-DT-16-16-8-50',
  'NPK-PM-16-16-8-50',
  'NPK-CM-16-16-8-50',
  'NPK-BCC-20-20-15-50',
  'NPK-VN-16-16-8-50',
  'URE-PM-46-50',
  'URE-CM-46-50',
  'DAP-DV-18-46-50',
  'KALI-PM-60-50',
  'LAN-LT-SUPE-50',
  'HC-SF-TRUNQUE-25',
  'HC-SF-PHANGA-25',
  'HC-GANHAT-15',
  'HC-BACA-DAMCA-1L',
  'LA-BACA-20-20-20-50G',
  'LA-BACA-12-52-6-50G',
  'LA-BOLY-OMNIKELP-1L',
  'LA-DK-HUMIC-1250',
  'BVTV-SYN-ANVIL-1L',
  'BVTV-BAY-NATIVO-120G',
  'BVTV-SYN-CHESS-20G',
  'BVTV-FMC-PREVATHON-100',
  'BVTV-SYN-SOFIT-1L',
  'BVTV-UPL-TARANG-900',
  'VT-OSHIMA-BLV16',
  'VT-PK-MANGPHU-2M2',
  'VT-SF-DATRAU-20L',
  'VT-KHAYUOM-104'
  )
  and exists (select 1 from public.order_lines ol where ol.product_id = p.id);

with gone as (
  delete from public.products p
  where p.sku not in (
  'NPK-DT-20-20-15-50',
  'NPK-DT-16-16-8-50',
  'NPK-PM-16-16-8-50',
  'NPK-CM-16-16-8-50',
  'NPK-BCC-20-20-15-50',
  'NPK-VN-16-16-8-50',
  'URE-PM-46-50',
  'URE-CM-46-50',
  'DAP-DV-18-46-50',
  'KALI-PM-60-50',
  'LAN-LT-SUPE-50',
  'HC-SF-TRUNQUE-25',
  'HC-SF-PHANGA-25',
  'HC-GANHAT-15',
  'HC-BACA-DAMCA-1L',
  'LA-BACA-20-20-20-50G',
  'LA-BACA-12-52-6-50G',
  'LA-BOLY-OMNIKELP-1L',
  'LA-DK-HUMIC-1250',
  'BVTV-SYN-ANVIL-1L',
  'BVTV-BAY-NATIVO-120G',
  'BVTV-SYN-CHESS-20G',
  'BVTV-FMC-PREVATHON-100',
  'BVTV-SYN-SOFIT-1L',
  'BVTV-UPL-TARANG-900',
  'VT-OSHIMA-BLV16',
  'VT-PK-MANGPHU-2M2',
  'VT-SF-DATRAU-20L',
  'VT-KHAYUOM-104'
  )
    and not exists (select 1 from public.order_lines ol where ol.product_id = p.id)
  returning p.id
)
delete from public.promotions pr using gone where pr.scope = 'product' and pr.target_id = gone.id;

commit;
