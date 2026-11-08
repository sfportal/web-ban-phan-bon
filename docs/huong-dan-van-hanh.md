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
  Chi trả, Sản phẩm, Nhóm, Bậc & tỷ lệ, Khuyến mãi, Đối tác, Nông dân, Dữ liệu thử, Cài đặt.
- Có hai loại tài khoản cửa hàng:
  - **Quản trị (admin):** làm được mọi việc.
  - **Nhân viên:** xử lý đơn hàng (đổi trạng thái, sửa đơn, in phiếu, xuất đơn hàng) và xem các
    trang khác; **không** sửa sản phẩm, khuyến mãi, bậc & tỷ lệ, không duyệt/khóa đối tác, không
    chuyển nông dân, không duyệt/chuyển chi trả hoa hồng, không vào *Dữ liệu thử*, không vào *Cài đặt*.
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
số đơn mới hôm nay, đơn chờ thu tiền, doanh số tháng, hoa hồng chờ chi (không tính dữ liệu thử).

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

## 5. Chi trả hoa hồng cho CTV

Hoa hồng của CTV được ghi nhận khi đơn chuyển sang **Đã thu đủ tiền** (và trừ lại nếu khách trả
hàng). Mỗi CTV có một **ví hoa hồng**:

- **Đã kiếm** = tổng hoa hồng đã ghi nhận (đã trừ phần trả hàng).
- **Đang chờ chi** = các khoản đã yêu cầu rút hoặc đã duyệt nhưng chưa chuyển tiền.
- **Đã nhận** = các khoản cửa hàng đã chuyển. Hoa hồng cửa hàng đã chi **trước khi có ví** (nút
  "Đã chi" cũ) được ghi sẵn thành một khoản **"Đã chi trước khi có ví"** (mã GD `LEGACY-TRUOC-VI`),
  nên không bị rút lại.
- **Khả dụng** = Đã kiếm − Đang chờ chi − Đã nhận. Đây là số CTV được phép rút.

Nếu khách trả hàng sau khi cửa hàng đã chi hoa hồng, số khả dụng có thể **âm**; khi đó CTV thấy
dòng "Số dư âm do trả hàng sau khi đã chi" và chưa rút được cho tới khi có thêm hoa hồng bù lại.
Đại lý không có ví hoa hồng.

### 5.1. CTV rút tiền thế nào

1. CTV vào **Hoa hồng** trong tài khoản → mục **Ví hoa hồng**.
2. Lần đầu bấm **Khai ngân hàng trước khi rút tiền**: nhập ngân hàng, số tài khoản, chủ tài khoản
   → **Lưu thông tin ngân hàng** (sửa lại được bất cứ lúc nào).
3. Bấm **Rút tiền**, nhập số tiền (hoặc bấm **Rút hết**) → **Gửi yêu cầu rút**. Số tiền phải là số
   nguyên, từ **mức rút tối thiểu** (mặc định 100.000 đ) đến số khả dụng.
4. Theo dõi trong danh sách khoản chi của ví. Các trạng thái:
   - **Chờ duyệt:** đã gửi, cửa hàng chưa xem. Số tiền được giữ lại, không rút lần nữa được.
   - **Đã duyệt:** cửa hàng đồng ý, đang chuẩn bị chuyển.
   - **Đã chuyển:** tiền đã chuyển, có mã giao dịch, ngày chuyển và nút **Xem chứng từ** (nếu cửa
     hàng đính kèm).
   - **Từ chối:** kèm lý do; số tiền trở lại ví khả dụng.

### 5.2. Admin xử lý yêu cầu rút

Vào **Chi trả** (thanh menu) → tab **Yêu cầu rút**. Có thông báo Telegram/email khi có yêu cầu mới
(nếu đã cấu hình ở *Cài đặt*). Lọc theo trạng thái ở ô **Lọc trạng thái**.

1. Bấm **Duyệt** nếu đồng ý, hoặc **Từ chối** → gõ **Lý do từ chối** (bắt buộc) → **Xác nhận từ
   chối**. Từ chối được cả khoản "Chờ duyệt" lẫn "Đã duyệt"; tiền trở lại ví CTV.
2. Chuyển khoản cho CTV theo thông tin ngân hàng hiện trên khoản chi (đây là thông tin tại lúc tạo
   khoản chi, CTV đổi sau cũng không ảnh hưởng).
3. Bấm **Đánh dấu đã chuyển** và nhập: **Mã giao dịch** (bắt buộc), **Ngày chuyển** (bắt buộc, không
   được sau hôm nay), **Chứng từ** (ảnh chụp màn hình chuyển khoản hoặc PDF — không bắt buộc, nhưng
   nên có). Chứng từ nhận **JPG, PNG, WebP hoặc PDF, tối đa 5MB**. Bấm **Xác nhận đã chuyển**.
4. Bấm hai lần liên tiếp cũng không sao: khoản đã chuyển không bị chuyển lại. Khoản đã chuyển không
   sửa hay hủy được.

Chứng từ lưu ở nơi **riêng tư**: chỉ quản trị và đúng CTV nhận tiền xem được, qua link tạm thời
(hết hạn sau 5 phút, mở lại bằng nút **Xem chứng từ**).

### 5.3. Đợt chi (chi cho nhiều CTV cùng lúc)

Dùng khi chi định kỳ thay vì chờ từng yêu cầu. Vào **Chi trả** → tab **Đợt chi** → **Tạo đợt chi**:

1. Chọn **Loại đợt**: *theo tuần*, *theo tháng* hoặc *tùy chọn* (chỉ để phân loại và ghi nhớ).
2. Chọn **Ngày chốt** (không được sau hôm nay, giờ Việt Nam). Hoa hồng được tính **từ đầu đến hết
   ngày chốt**; hoa hồng phát sinh sau ngày đó để dành cho đợt sau.
3. Gõ **Ghi chú** nếu muốn (ví dụ "Chi tuần 2 tháng 11") → **Tạo đợt chi**.

Với mỗi CTV đang hoạt động, website lấy hoa hồng tính đến ngày chốt, trừ phần đã yêu cầu rút/đã
chi, và tạo một khoản chi ở trạng thái **Đã duyệt** thuộc đợt này. Sau khi tạo, website báo
*"Đã tạo … khoản chi. Bỏ qua … CTV thiếu ngân hàng, … CTV dưới mức tối thiểu."* Nghĩa là:

- **Bỏ qua thiếu ngân hàng:** CTV chưa khai ngân hàng nên không có chỗ để chuyển. Nhắc họ khai rồi
  tạo đợt sau (hoặc họ tự gửi yêu cầu rút).
- **Bỏ qua dưới mức:** số tiền của CTV chưa đạt **mức rút tối thiểu**. Số đó **không mất**, vẫn nằm
  trong ví và cộng dồn cho đợt sau.

Bấm vào một đợt để xem danh sách khoản chi. Chuyển tiền xong thì đánh dấu từng khoản **Đánh dấu đã
chuyển** (mã giao dịch, ngày chuyển, chứng từ như mục 5.2), hoặc bấm **Đánh dấu tất cả đã chuyển**
để đánh dấu cả đợt cùng lúc (dùng chung một mã giao dịch và một ngày chuyển cho các khoản chưa
chuyển trong đợt; cách này không đính kèm chứng từ).

### 5.4. Số dư và xuất Excel

- Tab **Số dư** liệt kê từng CTV: đã kiếm, đang chờ chi, đã nhận, khả dụng và có khai ngân hàng
  chưa. Dùng để biết cửa hàng đang nợ hoa hồng bao nhiêu.
- Mỗi tab (**Yêu cầu rút**, **Đợt chi**, **Số dư**) có nút **Xuất Excel** để lưu và gửi kế toán.
- Trang **Tổng quan** có thẻ **Hoa hồng chờ chi**: tổng hoa hồng CTV đã kiếm được trừ đi các khoản
  đã chuyển (không tính dữ liệu thử). Số này gồm cả các khoản đang chờ chuyển; CTV nào đang âm (trả
  hàng sau khi đã chi) thì phần âm được trừ vào tổng.

### 5.5. Cài đặt mức rút tối thiểu và phân quyền

- Vào **Cài đặt** → ô **Mức rút tối thiểu** (đồng) → **Lưu cài đặt**. Mặc định **100.000**.
  Mức này áp dụng cho cả yêu cầu rút của CTV và đợt chi.
- **Chỉ tài khoản quản trị** được duyệt, từ chối, đánh dấu đã chuyển, tạo đợt chi, đổi mức tối
  thiểu và xuất Excel chi trả. **Nhân viên** vào xem được các tab nhưng không thao tác được.

## 5A. Dữ liệu thử (để tập dùng)

Dành cho quản trị muốn tập xử lý đơn và chi trả mà không ảnh hưởng số liệu thật. Vào **Dữ liệu
thử** (chỉ quản trị).

- **Tạo dữ liệu thử:** nhập một **mật khẩu chung** (ít nhất 8 ký tự) cho các tài khoản thử → bấm
  **Tạo dữ liệu thử**. Mật khẩu chỉ dùng để tạo tài khoản, website **không lưu lại** — hãy tự ghi
  nhớ. Website tạo 3 CTV và 1 đại lý đang hoạt động, 1 CTV chờ duyệt (số điện thoại
  **0900000101 đến 0900000105**), vài nông dân, khoảng 15 đơn ở đủ các trạng thái, vài đơn khách
  lẻ, 1 yêu cầu rút, 1 khoản đã chuyển (mã "DEMO-0001") và 1 đợt chi. Đăng nhập `/dang-nhap` bằng
  các số này và mật khẩu vừa nhập để thử góc nhìn của đối tác.
- **Nhận biết:** mục thử có nhãn **Thử** trong danh sách đơn hàng, đối tác, nông dân và chi trả.
  Đơn do đối tác thử đặt cũng là đơn thử.
- **Không lẫn vào số liệu thật:** trang **Tổng quan** (số đơn, doanh số, hoa hồng chờ chi) **không
  tính** dữ liệu thử.
- Không tạo lại được khi đang có dữ liệu thử, hoặc khi các số điện thoại trên đã bị dùng.
- Đơn thử dùng chung dãy **mã đơn** với đơn thật (`DHyymm-nnnn`), nên sau khi xóa dữ liệu thử, dãy
  mã đơn thật sẽ có chỗ bị nhảy số. Đây là bình thường, không phải mất đơn.
- Thông báo Telegram/email do hoạt động thử gây ra (đơn của đối tác thử, yêu cầu rút của CTV thử)
  có chữ **[THỬ]** ở đầu.
- **Xóa toàn bộ dữ liệu thử:** bấm nút → **Xác nhận xóa**. Việc xóa là **được ăn cả, ngã về
  không**: hoặc xóa hết, hoặc không xóa gì. Nếu đã có dữ liệu **thật** gắn với tài khoản thử (ví
  dụ ai đó đã dùng số 0900000101 để đặt đơn thật), website **từ chối xóa và hiện thông báo**; khi
  đó phần thử vẫn giữ nguyên, hãy kiểm tra lại rồi xử lý bằng tay. Nên xóa dữ liệu thử trước khi
  nhận khách thật.

## 6. Xuất dữ liệu cho kế toán

- **Đơn hàng theo khoảng ngày:** vào **Tổng quan** → mục **Xuất dữ liệu** → chọn **Từ ngày**,
  **Đến ngày** (tối đa 366 ngày) → bấm **Xuất đơn hàng (Excel)**. File có mỗi dòng hàng một hàng
  (mã đơn, ngày, khách/CTV, sản phẩm, số lượng, giá, thành tiền…).
- **Chi trả hoa hồng:** **Chi trả** → chọn tab → **Xuất Excel** (xem mục 5.4).
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
