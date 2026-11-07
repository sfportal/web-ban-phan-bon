# Hướng dẫn vận hành cửa hàng

Tài liệu dành cho chủ cửa hàng và nhân viên, không cần biết lập trình. Mọi thao tác làm trên
trình duyệt (máy tính hoặc điện thoại).

## 0. Đăng nhập và các khu của website

- Vào trang `/dang-nhap` (ví dụ `https://tencuahang.vn/dang-nhap`), nhập **số điện thoại** và
  **mật khẩu** của tài khoản quản trị (người cài đặt website tạo cho bạn). Quản trị đăng nhập bằng
  số điện thoại giống đối tác, không dùng email.
- Tài khoản quản trị được tạo thế nào: người kỹ thuật chạy lệnh tạo nhân viên (README, mục *Tạo tài
  khoản quản trị*), hoặc bạn tự đăng ký ở `/dang-ky` bằng số điện thoại của mình rồi người kỹ thuật
  thêm một dòng vào bảng nhân viên (`staff`) bằng SQL trên Supabase và xóa hồ sơ đối tác chờ duyệt
  vừa tạo. Từ đó số điện thoại này đăng nhập thẳng vào khu quản trị. Muốn thêm nhân viên khác cũng
  nhờ người kỹ thuật làm cùng cách (vai trò `staff` hoặc `admin`).
- Đăng nhập xong sẽ vào **khu quản trị**. Thanh menu phía trên có các mục: Tổng quan, Đơn hàng,
  Hoa hồng, Sản phẩm, Nhóm, Bậc & tỷ lệ, Khuyến mãi, Đối tác, Nông dân, Cài đặt.
- Có hai loại tài khoản cửa hàng:
  - **Quản trị (admin):** làm được mọi việc.
  - **Nhân viên:** xử lý đơn hàng (đổi trạng thái, sửa đơn, in phiếu, xuất đơn hàng) và xem các
    trang khác; **không** sửa sản phẩm, khuyến mãi, bậc & tỷ lệ, không duyệt/khóa đối tác, không
    chuyển nông dân, không đánh dấu đã chi hoa hồng, không vào *Cài đặt*.
- Ba loại người dùng bên ngoài:
  - **Khách lẻ:** đặt hàng trên trang chủ, không cần tài khoản.
  - **CTV (cộng tác viên):** đặt hàng hộ nông dân, được **hoa hồng**.
  - **Đại lý:** tự mua với **giá chiết khấu**, không có hoa hồng.

Lần đầu sử dụng, hãy vào **Cài đặt** nhập: tên cửa hàng, link Zalo, thông tin chuyển khoản
(ngân hàng, số tài khoản, chủ tài khoản — hiện cho khách chọn chuyển khoản), email và Telegram
nhận thông báo đơn mới. Bấm **Lưu cài đặt**.

## 1. Duyệt CTV / đại lý

Đối tác tự đăng ký ở trang `/dang-ky` (số điện thoại, họ tên, khu vực, địa chỉ nhận hàng, mật
khẩu). Sau khi đăng ký họ thấy màn hình "Tài khoản đang chờ duyệt" và chưa đặt hàng được.

1. Vào **Đối tác** → bấm tab **Chờ duyệt**.
2. Bấm vào tên người cần duyệt để xem số điện thoại, khu vực, địa chỉ. Nên gọi điện xác nhận.
3. Ở ô **Chọn bậc**, chọn bậc phù hợp:
   - bậc có chữ **(CTV)** — ví dụ "CTV chuẩn (CTV)" — cho cộng tác viên hưởng hoa hồng;
   - bậc có chữ **(Đại lý)** — ví dụ "Đại lý cấp 1 (Đại lý)" — cho đại lý mua giá chiết khấu.
4. Bấm **Duyệt**. Thấy chữ "Đã lưu" và trạng thái chuyển thành "Hoạt động" là xong.
5. Báo cho đối tác đăng nhập lại ở `/dang-nhap`. Gợi ý họ mở website bằng điện thoại và chọn
   **"Thêm vào màn hình chính"** để dùng như một ứng dụng.

Các việc khác trên trang chi tiết đối tác:

- **Đổi bậc:** chọn bậc mới → bấm **Đổi bậc**. Áp dụng cho đơn đặt từ lúc đổi; đơn cũ giữ nguyên.
- **Khóa tài khoản:** đối tác không đăng nhập được nữa. Bấm **Mở khóa** để cho dùng lại.
- **Đặt lại mật khẩu** (khi đối tác quên mật khẩu): bấm nút, xác nhận. Website hiện **mật khẩu tạm
  một lần duy nhất** — chép lại, gửi cho đối tác (qua Zalo/điện thoại), rồi bấm **Đã ghi lại**.

Muốn sửa phần trăm hoa hồng/chiết khấu: vào **Bậc & tỷ lệ**. Bảng lưới có mỗi hàng là một bậc,
mỗi cột là một nhóm sản phẩm; sửa số % trực tiếp. Có thể đặt mức riêng cho từng sản phẩm (ghi đè
mức của nhóm).

## 2. Nhập sản phẩm từ Excel

Dùng khi có nhiều sản phẩm cần thêm hoặc đổi giá cùng lúc (các mục 2, 3 cần tài khoản quản trị). (Thêm/sửa từng sản phẩm thì bấm
**Thêm sản phẩm** hoặc bấm vào tên sản phẩm trong danh sách.)

1. Vào **Nhóm** và tạo đủ các nhóm sản phẩm trước (ví dụ: Phân NPK, Phân hữu cơ, Thuốc BVTV…).
2. Vào **Sản phẩm** → bấm **Tải file mẫu** (file trống, đúng cột) hoặc **Xuất Excel** (file có sẵn
   toàn bộ sản phẩm hiện tại — tiện để sửa giá).
3. Mở file bằng Excel. Hàng 1 là tiêu đề, **không được sửa**. File mẫu có **15 cột**:
   `SKU | Tên | Quy cách | Nhóm | Giá niêm yết | Còn hàng | Hiển thị | Mô tả | Thương hiệu |
   Mô tả ngắn | Thành phần | Công dụng | Cách dùng | Cây trồng | Nổi bật`
   - **SKU:** mã sản phẩm, mỗi sản phẩm một mã khác nhau (ví dụ `NPK-161616`). SKU đã có trên
     website → dòng đó **cập nhật** sản phẩm; SKU mới → **tạo** sản phẩm mới.
   - **Nhóm:** gõ đúng tên nhóm đã tạo ở bước 1.
   - **Giá niêm yết:** số tiền bán lẻ, chỉ gõ số (ví dụ `850000`).
   - **Còn hàng**, **Hiển thị**, **Nổi bật:** gõ `có` hoặc `không` (bỏ trống *Nổi bật* = không).
   - **Công dụng**, **Cách dùng:** mỗi ý một dòng trong ô (trong Excel bấm `Alt + Enter` để xuống
     dòng).
   - **Cây trồng:** cách nhau bằng dấu phẩy, ví dụ `Lúa, Cà phê, Sầu riêng`.
   - Các cột mô tả (từ *Thương hiệu* đến *Nổi bật*) bỏ trống được.
   - **File mẫu cũ 8 cột** (chỉ đến cột *Mô tả*) vẫn nhập được: khi đó website chỉ cập nhật 8 cột
     đó và **giữ nguyên** thương hiệu, mô tả ngắn, công dụng… đã có của sản phẩm.
4. Lưu file (định dạng `.xlsx`).
5. Quay lại trang **Sản phẩm** → bấm **Nhập Excel** → chọn file.
6. Nếu file có lỗi, website liệt kê lỗi theo số dòng (ví dụ "dòng 7: Nhóm không tồn tại") và
   **không ghi dòng nào**. Sửa các dòng đó trong Excel rồi nhập lại. Không có lỗi thì sản phẩm
   được cập nhật ngay.

Hết hàng tạm thời: bỏ tích **Còn hàng** (khách vẫn thấy nhưng không đặt được). Ngừng bán: bỏ tích
**Hiển thị** (ẩn hẳn khỏi website).

### Thông tin hiển thị trên trang sản phẩm

Mở một sản phẩm trong **Sản phẩm** để sửa từng ô (cùng nội dung với các cột Excel ở trên):

- **Thương hiệu** (hiện phía trên tên sản phẩm) và **Mô tả ngắn** (một hai câu ngay dưới tên, cũng
  dùng trên thẻ sản phẩm).
- **Thành phần**, **Công dụng**, **Cách dùng**, **Cây trồng**, **Mô tả thêm**: mỗi ô có nội dung
  thành một tab trên trang chi tiết (*Công dụng*, *Thành phần*, *Cách dùng*, *Cây phù hợp*, *Mô
  tả*); ô trống thì tab đó không hiện. *Công dụng* và *Cách dùng* gõ **mỗi ý một dòng**; *Cây trồng*
  cách nhau bằng dấu phẩy.
- **Nổi bật:** tích để đưa sản phẩm lên mục **Sản phẩm nổi bật** ở trang chủ (hiện tối đa 8 sản
  phẩm nổi bật đang còn hàng).

**Giá là giá tham khảo.** Giá có sẵn khi cài website là giá tham khảo thị trường, không phải giá của
cửa hàng — hãy rà và sửa **Giá niêm yết** từng sản phẩm (hoặc xuất Excel, sửa cột giá, nhập lại)
trước khi nhận đơn thật. Chân trang website cũng ghi rõ "Giá là giá tham khảo".

### Ảnh sản phẩm và ảnh nhóm

- Sản phẩm chưa có ảnh hiện **hình minh họa bao bì tự vẽ** (màu theo nhóm, có tên và quy cách) —
  đây chỉ là hình tạm. Nên **chụp ảnh thật** sản phẩm cửa hàng đang bán và tải lên thay: mở sản phẩm →
  tải ảnh (JPG/PNG/WebP, tối đa 2MB; nên chụp vuông, nền sáng, rõ tem nhãn) hoặc dán link ảnh. Xóa
  trống ô link để quay về hình minh họa.
- Ảnh nhóm (ô nhóm ở trang chủ) và ảnh đồng ruộng trên trang chủ, trang đăng nhập lấy từ Unsplash và
  Pexels — giấy phép cho dùng miễn phí; tác giả và link gốc từng ảnh ghi trong `docs/nguon-anh.md`.
  Muốn đổi ảnh nhóm: **Nhóm** → dán link ảnh vào ô *Link ảnh nhóm* của nhóm đó → lưu.
- **Không** dùng ảnh bao bì, logo tải từ website của hãng hay trang khác (có thể vi phạm bản quyền);
  chỉ dùng ảnh cửa hàng tự chụp hoặc ảnh Unsplash/Pexels (khi đó ghi thêm nguồn vào `docs/nguon-anh.md`).

## 3. Tạo khuyến mãi

1. Vào **Khuyến mãi** → **Thêm khuyến mãi**.
2. Nhập **tên khuyến mãi** (ví dụ "Giảm giá phân NPK mùa mưa").
3. Chọn phạm vi: **Theo nhóm** (cả nhóm sản phẩm) hoặc **Theo sản phẩm**, rồi chọn nhóm/sản phẩm
   áp dụng.
4. Chọn loại và nhập giá trị:
   - **Giảm %**: ví dụ `10` là giảm 10%;
   - **Giá cố định** (chỉ khi chọn theo sản phẩm): giá bán mới, ví dụ `790000`.
5. Chọn **Từ ngày** và **Đến hết ngày**. Để tích **Đang bật**. Bấm **Lưu**.

Lưu ý:

- Nếu một sản phẩm có nhiều khuyến mãi cùng lúc, website tự chọn mức **có lợi nhất cho khách**
  (không cộng dồn).
- Hoa hồng CTV và giá đại lý tính trên **giá đã khuyến mãi**.
- Muốn dừng sớm: bấm **Sửa**, bỏ tích **Đang bật**, **Lưu** (hoặc **Xóa**).
- Khuyến mãi đang chạy hiện trên trang chủ khu đối tác để CTV giới thiệu cho nông dân.

## 4. Xử lý đơn hàng

Có đơn mới, website gửi email/Telegram (nếu đã cấu hình ở *Cài đặt*). Trang **Tổng quan** cho biết
số đơn mới hôm nay, đơn chờ thu tiền, doanh số tháng, hoa hồng chờ chi.

Các trạng thái của một đơn:

```
Mới → Đã xác nhận → Đang giao → Đã giao → Đã thu đủ tiền
 (Mới / Đã xác nhận / Đang giao có thể → Đã hủy)
 (Đã giao / Đã thu đủ tiền có thể → Trả hàng)
```

Quy trình mỗi đơn:

1. Vào **Đơn hàng**. Lọc theo trạng thái (ví dụ "Mới"), nguồn (Đối tác / Đơn lẻ), CTV, khoảng ngày
   → bấm **Lọc**.
2. Bấm mã đơn (dạng `DH…`) để xem chi tiết: người đặt, số điện thoại, địa chỉ, các dòng hàng (đơn
   của CTV chia theo từng nông dân), tổng tiền, hoa hồng hoặc giá đại lý.
3. **Gọi điện xác nhận** với khách / CTV, rồi bấm **Đã xác nhận**.
   - Cần sửa số lượng / bỏ bớt sản phẩm (chỉ khi đơn còn "Mới" hoặc "Đã xác nhận"): dùng khung
     **Sửa đơn** → **Lưu**. Nếu giá đã đổi, website báo và yêu cầu bấm **Lưu với giá mới**.
   - Khách không lấy nữa: bấm **Đã hủy** (website hỏi lại cho chắc).
4. Soạn hàng: bấm **In phiếu giao hàng** để in phiếu khổ A5 dán kèm hàng.
5. Giao cho xe/shipper → bấm **Đang giao**.
6. Khách nhận hàng → bấm **Đã giao**.
7. Đã nhận đủ tiền → bấm **Đã thu đủ tiền**. **Chỉ lúc này hoa hồng của CTV mới được ghi nhận.**
8. Khách trả lại hàng sau khi đã giao/đã thu tiền → bấm **Trả hàng**. Nếu đơn đã có hoa hồng,
   website tự tạo một dòng hoa hồng âm (trừ lại) vào tháng trả hàng.

Mỗi lần đổi trạng thái có thể gõ thêm ghi chú (ví dụ "Giao qua xe Phương Trang"); lịch sử hiện ở
cuối trang chi tiết đơn. CTV/đại lý tự xem trạng thái đơn trong tài khoản của họ.

**Đổi trạng thái nhiều đơn cùng lúc:** trong danh sách **Đơn hàng**, tích ô vuông đầu các đơn (hoặc
ô "Chọn tất cả") → chọn trạng thái ở ô **Chuyển sang…** → bấm **Áp dụng** → xác nhận. Đơn nào không
chuyển được (ví dụ đang ở trạng thái khác) sẽ được liệt kê kèm lý do; các đơn còn lại vẫn được đổi.

**Đơn lẻ của khách là nông dân của một CTV** (trùng số điện thoại): đơn tự gắn với CTV đó và CTV
vẫn được hoa hồng. Muốn chuyển nông dân sang CTV khác: **Nông dân** → bấm tên → chọn CTV nhận ở
**Chuyển chủ**.

## 5. Chốt và chi hoa hồng cuối tháng

Hoa hồng tính theo **tháng mà đơn chuyển sang "Đã thu đủ tiền"** (giờ Việt Nam). Ví dụ đơn đặt
ngày 28/10 nhưng thu đủ tiền ngày 02/11 thì tính vào kỳ tháng 11.

1. Đầu tháng mới, rà lại các đơn tháng trước: đơn nào đã thu tiền mà chưa bấm **Đã thu đủ tiền**
   thì bấm cho đủ (lọc **Đơn hàng** theo trạng thái "Đã giao").
2. Vào **Hoa hồng** → ở ô **Kỳ (tháng)** chọn tháng cần chốt → bấm **Xem**.
3. Bảng tổng theo từng CTV gồm: **Ghi nhận** (hoa hồng các đơn đã thu tiền), **Hoàn** (trừ do trả
   hàng), **Thực nhận**, **Chờ chi**, **Đã chi**. Phần **Chi tiết** bên dưới liệt kê từng đơn.
4. Bấm **Xuất Excel** để lưu bảng hoa hồng tháng (đối chiếu, gửi kế toán).
5. Chuyển tiền cho từng CTV (chuyển khoản / tiền mặt) theo cột **Chờ chi**.
6. Chuyển xong cho CTV nào thì bấm nút **Đã chi** trên hàng của CTV đó (xác nhận). Hoặc trong danh
   sách chi tiết, tích từng dòng / **Chọn tất cả chờ chi** → **Đánh dấu đã chi**.
7. CTV mở mục **Hoa hồng** trong tài khoản sẽ thấy các dòng chuyển từ "Chờ chi" sang "Đã chi".

Chỉ tài khoản **quản trị** mới đánh dấu đã chi và xuất Excel hoa hồng được.

## 6. Xuất dữ liệu cho kế toán

- **Đơn hàng theo khoảng ngày:** vào **Tổng quan** → mục **Xuất dữ liệu** → chọn **Từ ngày**,
  **Đến ngày** (tối đa 366 ngày) → bấm **Xuất đơn hàng (Excel)**. File có mỗi dòng hàng một hàng
  (mã đơn, ngày, khách/CTV, sản phẩm, số lượng, giá, thành tiền…).
- **Hoa hồng theo tháng:** **Hoa hồng** → chọn kỳ → **Xuất Excel** (xem mục 5).
- **Danh sách sản phẩm và giá:** **Sản phẩm** → **Xuất Excel**.
- **Sao lưu toàn bộ:** **Tổng quan** → **Xuất toàn bộ dữ liệu (sao lưu)** (chỉ quản trị). Nên làm
  mỗi tháng một lần và cất file ở nơi an toàn (Google Drive, máy tính riêng).

## 7. Câu hỏi thường gặp

- **CTV báo không đăng nhập được:** kiểm tra trong **Đối tác** xem tài khoản có bị khóa hoặc còn
  "Chờ duyệt" không; quên mật khẩu thì dùng **Đặt lại mật khẩu** (mục 1).
- **Nông dân "đã thuộc CTV khác":** mỗi số điện thoại nông dân chỉ thuộc một CTV. Muốn chuyển thì
  dùng **Nông dân** → **Chuyển chủ**.
- **Đổi giá khi CTV đang soạn đơn:** lúc CTV gửi đơn, website báo dòng nào đổi giá để CTV xác nhận
  lại — cửa hàng không bao giờ bán theo giá cũ ngoài ý muốn.
- **Website chậm/không vào được sau một thời gian dài không dùng:** nếu đang dùng gói Supabase miễn
  phí, dự án tự tạm dừng sau 7 ngày không hoạt động — báo người kỹ thuật bật lại, và nên nâng lên
  gói trả phí khi kinh doanh thật (xem README).
