# Nguồn dữ liệu sản phẩm (giá tham khảo)

Giá trong `data/products.json` là **giá bán lẻ tham khảo thị trường**, số nguyên VNĐ, làm tròn đến nghìn. Giá thực tế thay đổi theo vùng, đại lý, thời điểm và số lượng. Mô tả, công dụng và cách dùng được viết lại bằng lời của mình dựa trên thông tin hãng/đại lý; liều dùng là mức tham khảo phổ biến, người dùng cần đọc nhãn sản phẩm.

Ngày tra cứu: 07/11/2026 (UTC).

## Nguồn chung cho phân bón bao 50kg

- **[A] dasshu.vn — "Giá phân bón ngày 12/09/2026"**: https://dasshu.vn/gia-phan-bon-hom-nay/ — bảng giá tham khảo (đồng/bao) theo vùng. Giá trong dữ liệu = trung điểm khoảng giá, làm tròn nghìn.
- **[B] Báo Hà Tĩnh — "Giá phân bón hôm nay" 22/05/2026**: https://baohatinh.vn/tv/print/41233.html — giá bao 50kg tại đại lý, dùng để đối chiếu.

## Theo từng SKU

| SKU | Giá (VNĐ) | Nguồn giá | Ghi chú |
|---|---|---|---|
| NPK-DT-20-20-15-50 | 910.000 | [A] Đông Nam Bộ – Tây Nguyên, "NPK 20-20-15 + TE Bình Điền" 890.000–930.000 | Đối chiếu [B] "NPK 20-20-15 Bình Điền" 960.000 |
| NPK-DT-16-16-8-50 | 710.000 | [A] ĐNB – Tây Nguyên, "NPK 16-16-8 Đầu Trâu" 670.000–750.000 | [B] 800.000 |
| NPK-PM-16-16-8-50 | 700.000 | [A] ĐNB – Tây Nguyên, "NPK 16-16-8 Phú Mỹ" 650.000–750.000 | [B] 715.000 |
| NPK-CM-16-16-8-50 | 705.000 | [A] ĐNB – Tây Nguyên, "NPK 16-16-8 Cà Mau" 660.000–750.000 | [B] 725.000 |
| NPK-BCC-20-20-15-50 | 885.000 | [A] Tây Nam Bộ, "NPK 20-20-15 Ba Con Cò" 870.000–900.000 | Trang hãng: https://wp.baconco.aesirx.io/en/products/fertilizer/npk-fertilizer/npk-con-co-20-20-15-usp/ |
| NPK-VN-16-16-8-50 | 630.000 | [A] Tây Nam Bộ, "NPK 16-16-8 Việt Nhật" 610.000–650.000 | |
| URE-PM-46-50 | 635.000 | [A] ĐNB – Tây Nguyên, "Urê Phú Mỹ" 610.000–660.000 | |
| URE-CM-46-50 | 630.000 | [A] ĐNB – Tây Nguyên, "Urê Cà Mau" 610.000–650.000 | [B] 675.000 |
| DAP-DV-18-46-50 | 855.000 | [A] Tây Nam Bộ, "DAP Đình Vũ" 840.000–870.000 | Hàm lượng N/P ghi theo khoảng, xem nhãn bao |
| KALI-PM-60-50 | 530.000 | [A] ĐNB – Tây Nguyên, "Kali bột Phú Mỹ" 490.000–570.000 | [B] 545.000 |
| LAN-LT-SUPE-50 | 310.000 | [A] ĐNB – Tây Nguyên, "Lân Lâm Thao" 290.000–330.000 | [B] 305.000 |
| HC-SF-TRUNQUE-25 | 235.000 | https://www.anbio.vn/products/phan-trun-que-cao-cap-sfarm-pb01-bao-25kg (235.000₫/bao 25kg) | Thành phần, cách dùng theo trang này |
| HC-SF-PHANGA-25 | 220.000 | https://sfarm.vn/bang-gia-phan-ga-gia-re-noi-mua-phan-ga-gia-re-sll24/ ("Phân gà dạng bột SFARM" 25kg: 215.000–225.000) | |
| HC-GANHAT-15 | 149.000 | https://thienthaohan.com/san-pham/phan-ga-huu-co-nhat-ban/ (149.000₫/bao 15kg) | Thành phần, liều theo trang này |
| HC-BACA-DAMCA-1L | 180.000 | https://vtnnkhuya.com/baca-dam-ca-1-lit | Trang chưa ghi liều; liều tưới gốc là mức tham khảo phổ biến cho đạm cá, có ghi chú xem nhãn |
| LA-BACA-20-20-20-50G | 25.000 | https://vtnnkhuya.com/baca-premium-20-20-20-50gr | |
| LA-BACA-12-52-6-50G | 25.000 | https://vtnnkhuya.com/baca-premium-12-52-6-50gr | |
| LA-BOLY-OMNIKELP-1L | 150.000 | https://vtnnkhuya.com/boly-omnikelp-1-lit | |
| LA-DK-HUMIC-1250 | 280.000 | https://vtnnkhuya.com/dienkhanh-humic-gel-1-25-lit | |
| BVTV-SYN-ANVIL-1L | 285.000 | https://vtnnkhuya.com/anvil-5sc-1-lit | Đối chiếu https://www.phandoiso1.com/thuoc-bao-ve-thuc-vat/thuoc-tru-benh/anvil-5sc-1-lit-thuoc-tru-benh-dac-tri-ri-sat (209.000₫ giá sỉ) |
| BVTV-BAY-NATIVO-120G | 342.000 | https://vtnnkhuya.com/nativo-750wg-120gr | |
| BVTV-SYN-CHESS-20G | 39.000 | https://vtnnkhuya.com/syngenta-chess-50wg-20gr | Liều theo trang hãng: https://www.syngenta.com.vn/product/crop-protection/thuoc-tru-sau/chess-50wg/1000 |
| BVTV-FMC-PREVATHON-100 | 185.000 | https://vtnnkhuya.com/fmc-prevathon-200sc-100ml | |
| BVTV-SYN-SOFIT-1L | 310.000 | https://vtnnkhuya.com/sofit-300ec-1l | |
| BVTV-UPL-TARANG-900 | 145.000 | https://vtnnkhuya.com/upl-tarang-280sl-x2-900ml | |
| VT-OSHIMA-BLV16 | 975.000 | https://oshimavietnam.com/products/binh-xit-dien-blv-16 | |
| VT-PK-MANGPHU-2M2 | 1.590.000 | https://vtnnkhuya.com/mang-phu-phu-khang-2-2m | Tên ghi khổ 2,2 m; trang mô tả cuộn ~400 m |
| VT-SF-DATRAU-20L | 72.000 | https://vtnnkhuya.com/dat-trong-rau-sfarm-20dm3 | |
| VT-KHAYUOM-104 | 10.000 | https://vtnnkhuya.com/khay-uom-hat-104-lo | |

Tất cả trang vtnnkhuya.com (Cửa hàng Vật tư Nông nghiệp Khuya), anbio.vn, thienthaohan.com, sfarm.vn, oshimavietnam.com được tra cứu ngày 07/11/2026.
