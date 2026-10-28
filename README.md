# UDU Chat — Bài thực hành 5

Chat 1-1 realtime với Firebase, phát triển tiếp Bài 4 bằng React Native CLI. React Native 0.87.0, React 19.2.3, React Navigation 7. Firebase dùng JavaScript SDK (`firebase/auth`, `firebase/database`); vị trí dùng `@react-native-community/geolocation` 3.4.0.

## Chức năng

- Đăng ký: họ tên, email, mật khẩu ít nhất 6 ký tự, xác nhận mật khẩu. Đăng nhập Firebase, báo lỗi và đăng xuất tại Cài đặt.
- Danh bạ từ Realtime Database, loại tài khoản hiện tại, tìm kiếm tên không phân biệt hoa/thường và dấu tiếng Việt.
- Online/offline theo từng kết nối: đăng ký `onDisconnect` trước khi ghi online; xử lý chuyển ứng dụng nền, mất kết nối, đăng xuất và nhiều thiết bị cùng tài khoản.
- Chat 1-1: cập nhật trực tiếp, tin gửi bên phải, tin nhận bên trái, giờ gửi, chia ngày, chặn tin trống, tự cuộn xuống tin mới.
- Nút 📍 xin quyền vị trí, thông báo khi từ chối/lỗi GPS, gửi tọa độ; nhấn thẻ vị trí để mở Google Maps.
- Home: avatar, tên, tin cuối, thời gian, cuộc trò chuyện mới nhất lên đầu; số chưa đọc cập nhật từ tin nhận và mốc đọc của từng tài khoản.
- Thông báo giữ dữ liệu và hành vi Bài 4: đọc từng mục, Đọc tất cả, huy hiệu chưa đọc.

Không còn dùng người dùng, cuộc trò chuyện hay tin nhắn mẫu trong luồng Bài 5. Tài khoản chỉ tồn tại trong phiên ứng dụng; mở lại ứng dụng cần đăng nhập. Dữ liệu chat được lưu trên Firebase.

## Cấu trúc

```text
src/
  services/
    firebaseConfig.ts     # Firebase Web config của project
    firebase.ts           # Khởi tạo Auth/Database, ánh xạ lỗi
    authService.ts        # Đăng ký, đăng nhập, hồ sơ, đăng xuất
    userService.ts        # Danh bạ và trạng thái trực tuyến
    chatService.ts        # Tạo phòng, lắng nghe, gửi tin, ghi mốc đọc
    chatModel.ts          # Kiểu dữ liệu, thứ tự tin, số chưa đọc, URL Maps
    presenceService.ts    # Kết nối và onDisconnect
    locationService.ts    # Quyền vị trí, GPS, Google Maps
  baiTapChat/
    navigation/           # Stack đăng nhập/đăng ký và 4 tab
    state/ChatContext.tsx # Ghép trạng thái Firebase và vòng đời listener
    screens/              # DangNhap, DangKy, Home, DanhBa, NoiDungChat, ThongBao, CaiDat
    components/           # Thành phần giao diện dùng lại từ Bài 4
    utils/                # Kiểm tra form, tìm kiếm, thời gian
firebase/database.rules.json
scripts/
  android-offline.ps1     # Build Windows bằng môi trường có sẵn
  start.cjs               # Metro, file tạm trên ổ D
  verify-firebase.cjs     # Kiểm tra backend thực bằng tài khoản thử
```

`ChatContext` hủy listener xác thực, danh bạ, presence và cuộc trò chuyện trong cleanup của `useEffect`. Listener mỗi phòng chỉ đăng ký một lần và thay danh sách theo snapshot, tránh cộng dồn tin nhắn trùng. Mốc đọc cập nhật khi màn hình chat đang được xem và ứng dụng ở foreground.

Mã màn hình cũ trước Bài 4 vẫn được giữ qua nút “Mở dự án ban đầu”; đây là phần lưu lại từ repository gốc.

## Firebase

Project hiện được cấu hình trong `src/services/firebaseConfig.ts`. Đây là cấu hình Web của Firebase JS SDK; không cần `google-services.json` hay plugin Firebase Native. Không đặt khóa service account trong ứng dụng.

Khi chuyển sang project khác:

1. Tạo project trong Firebase Console, thêm Web app và điền Web config (gồm `databaseURL`) vào file cấu hình.
2. Authentication → Sign-in method → bật Email/Password.
3. Tạo Realtime Database, chọn khu vực phù hợp.
4. Database → Rules → dán nội dung `firebase/database.rules.json` → Publish.
5. Đăng ký hai tài khoản khác nhau trong ứng dụng để thử chat.

Luật trong repository được viết cho cấu trúc dữ liệu bên dưới. Nếu giảng viên đưa bộ luật riêng, cần đối chiếu đường dẫn và quyền trước khi thay thế.

```text
users/{uid}/name
presence/{uid}/connections/{connectionId}: true
presence/{uid}/lastOnline: timestamp
userChats/{uid}/{chatId}: peerUid
chats/{chatId}/participantA
chats/{chatId}/participantB
chats/{chatId}/members/{uid}: true
chats/{chatId}/messages/{messageId}
  senderId, text, type, createdAt
  latitude, longitude          # Chỉ tin vị trí
chats/{chatId}/reads/{uid}: messageId
```

Phòng dùng ID cố định theo hai UID đã sắp xếp. Thời gian gửi do server cấp. Chỉ thành viên đọc phòng; chỉ được gửi dưới UID của mình và ghi mốc đọc của mình. Mật khẩu do Firebase Authentication quản lý, không lưu trong Realtime Database.

## Chạy trên Windows

Giữ Gradle **9.4.1**, OpenJDK **17**, compile SDK **37**, Build Tools **37.0.0**, NDK **27.1.12297006**, Kotlin **2.2.0**. Target SDK theo repository gốc là 36. Máy ảo hiện có: **Pixel_7** (x86_64).

Máy này đã có `node_modules`. Khi clone về máy khác hoặc thiếu thư viện:

```powershell
npm ci
```

Cache npm, Metro, file tạm và cache Gradle mới nằm trong `.cache/` của dự án; thư mục này được bỏ qua trong Git. Script build tái sử dụng bản Gradle 9.4.1 và bộ nhớ đệm thư viện có sẵn. Do đường dẫn có dấu, script tạo ổ ánh xạ tạm trong lúc build rồi gỡ trong `finally`; không sao chép dự án sang ổ khác.

Mở Pixel_7 hiện có trong Android Studio. Mở hai terminal tại thư mục dự án:

```powershell
# Terminal 1
npm start
```

```powershell
# Terminal 2: build offline, cài và mở trên máy ảo đang chạy
npm run android
```

Lệnh `npm run android:offline` chỉ build APK. Nếu một thư viện Native mới chưa có trong cache, `npm run android:build` cho phép tải phần còn thiếu vào cache trên D. APK ở `android/app/build/outputs/apk/debug/app-debug.apk`.

Để build cho điện thoại ARM64:

```powershell
npm run android:offline -- -Architecture arm64-v8a
```

Chạy iOS cần macOS/Xcode và `pod install`. Quyền vị trí khi sử dụng đã khai báo trong Info.plist. Bản iOS chưa được build trên máy Windows này.

## Kiểm tra

```powershell
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm test -- --runInBand
```

Kiểm thử bao gồm form, ID phòng, thứ tự tin, số chưa đọc, quyền vị trí, URL Maps, cleanup listener, điều hướng đăng nhập/đăng ký, danh bạ, chat và đăng xuất. Mock test không thay thế việc kiểm tra hai thiết bị kết nối Firebase.

Kiểm tra backend thật (tạo hoặc sử dụng lại tài khoản thử, gửi tin kiểm thử vào project đang cấu hình):

```powershell
node scripts/verify-firebase.cjs --live
```

Script kiểm tra gửi/nhận qua hai Firebase client, chưa đọc/mốc đọc, tin vị trí với tọa độ thử, presence, đăng nhập/đăng xuất và các trường hợp bị Rules từ chối. Tài khoản thử và kết quả chỉ lưu trong `.cache/verification/`, không đưa vào Git. Script không đọc GPS thiết bị.

Phần chuẩn bị ảnh và video nộp bài do người học thực hiện.
