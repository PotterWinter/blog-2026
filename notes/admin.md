# Admin: login และ session (ขั้น 5)

---

## ตัดสินใจ (30 ก.ย. 69)

- TOTP อย่างเดียว ไม่มี user / password (ตกลงไว้ตั้งแต่ขั้น 0)
- rate limit = กฎ Vercel Firewall: POST `/api/login` ≤ 5 ครั้ง / 10 นาที ต่อ IP
- รายการ session = `sessions.json` ใน content repo · login / sign out = 1 commit
- มี homelab database เมื่อไหร่ ค่อยย้ายทั้งสองไปที่นั่น

## ทำงานยังไง

- `src/lib/totp.ts` — ตรวจรหัส TOTP (RFC 6238) เขียนเอง ไม่ใช้ library
  - รับรหัสช่วงก่อน/หลัง 1 ช่วง (±30 วิ) เผื่อนาฬิกามือถือคลาด
  - ผ่านชุดทดสอบมาตรฐานของ RFC ครบ
- `src/lib/cookie.ts` — cookie `session` = `<id>.<หมดอายุ>.<ลายเซ็น>` เซ็นด้วย `SESSION_SECRET` (HMAC-SHA256) · อายุ 30 วัน · httpOnly
- `src/lib/session.ts`
  - `sessions.json` = `{ sessions: [{ id, device, city, createdAt }], lastStep }`
  - `lastStep` = ช่วงเวลาของรหัสล่าสุดที่ใช้ → รหัสเดิมใช้ซ้ำไม่ได้
  - `device` จาก User-Agent ("iPhone · Safari") · `city` จาก header `x-vercel-ip-city` (dev = ว่าง)
  - `currentSession()` = cookie ถูก **และ** id ยังอยู่ในรายการ (ถูก sign out จากเครื่องอื่น = หลุด)
  - รายการ id cache ไว้ (tag `sessions`) ล้างทันที (`revalidateTag(…, { expire: 0 })`) เมื่อ login / sign out
- `src/proxy.ts` (Next 16 เปลี่ยนชื่อ middleware เป็น proxy) — `/admin/…` ไม่มี cookie ถูก → `/login?next=…`
  - เช็กแค่ลายเซ็นกับวันหมดอายุ ไม่อ่าน repo · หน้า admin เช็กรายการอีกชั้น
- `/api/login` POST `{ code }` → 200 / 401 (ผิด หรือใช้ซ้ำ) / 503 (ยังไม่ตั้ง `TOTP_SECRET`)
- `/api/logout` POST → ลบเครื่องนี้ออกจากรายการ + ลบ cookie
- `content.ts`: `readFresh` (ไม่ผ่าน cache + sha) · `writeContent` (PUT contents API = 1 commit; sha ไม่ตรง = 409 ไม่เขียนทับ) — ขั้น 5 ต่อไปใช้เขียนบทความด้วย

## หน้า 05 Login (`/login`) — ตาม v4

- ช่องเดียวทับเส้นใต้ 6 เส้น (64 ห่าง 76 · มือถือ < 600: 44 ห่าง 52) · ตัวเลขโชว์ 1 วิ แล้วเป็น •
- ตรวจเมื่อกด Continue / Enter เท่านั้น · ถูก = กล่องเขียวขึ้นพร้อมกันทั้ง 6 ช่องแล้วเข้า admin (v4 ไล่ทีละช่อง — เจ้าของอยากให้พร้อมกันเหมือนตอนผิด) · ผิด = กล่องแดงสั่น
- กรอบหนา 2px เท่ากับเส้นใต้ (v4 1.5px วาดขอบแต่ละด้านจางไม่เท่ากัน)
- **ไม่มีปุ่ม Paste** (v4 มี · เอาออก 1 ต.ค. 69): browser ต้องขออนุญาตก่อนอ่านคลิปบอร์ด — Chrome ถาม Allow, Safari ไม่มีอะไรเกิดขึ้นเลย · กดค้างแล้ววาง / ⌘V / รหัสที่ iPhone เสนอบนคีย์บอร์ด ใช้ได้อยู่แล้ว
- เลือกข้อความ (⌘A, Shift+ลูกศร): ซ่อนแถบฟ้าของ browser (คลุมเลยช่องไปถึงขวาสุด) ช่องที่ถูกเลือกเป็นกล่องเทาอ่อนแทน
- กล่องยกเหนือกึ่งกลางนิดหน่อย (ขอบล่างเพิ่ม 12vh / มือถือ 10vh) — กลางจอพอดีดูต่ำ · ลองยกถึง ~40% จากบนแล้วเจ้าของให้ถอยกลับ (1 ต.ค. 69)
- ปุ่ม "Continue to admin" = `.btnm` ของ v4 (hover หดเป็นจุดหน้าคำ)
- "Not the admin? Watch how this site works ↗" ข้างปุ่ม · มือถืออยู่ล่างสุดใต้เส้นเทา
- ไม่มีข้อความเตือนใต้ช่อง แค่กล่องแดงแบบ v4 (ลองใส่แล้วเจ้าของไม่เอา)
- `?next=` รับเฉพาะ path ใต้ `/admin` (กันพาไปเว็บอื่น)
- ลิงก์วิดีโอ YouTube ยังเป็น `#`

## Secret

- dev: `.env.development` มี `TOTP_SECRET` / `SESSION_SECRET` สำหรับเครื่องนี้เท่านั้น
- production: `npm run auth-secrets` (ค่าออกแค่ใน terminal) หรือ `-- --out <ไฟล์>` เขียนลงไฟล์ที่เจ้าของอ่านได้คนเดียว ไม่แสดงค่า → ใส่ในแอป authenticator + Vercel (Secret) แล้วลบไฟล์
  - 1 ต.ค. 69 สร้างไว้ที่ `~/Desktop/blog-secrets.txt` (Claude ไม่ได้เห็นค่า)
  - เปลี่ยน `SESSION_SECRET` = ทุกเครื่องหลุด · เปลี่ยน `TOTP_SECRET` = ต้องเพิ่มบัญชีในแอปใหม่

---

## 06 Admin publishing hub (`/admin`) — 5.2a–c

- `app/admin/layout.tsx` — ทุกหน้าใต้ `/admin`: เช็ก `currentSession()` + header ของ admin (`AdminNav`)
  - Posts · Media · Settings · Sign out มีเส้นใต้หน้าปัจจุบัน (v4 `.navl`) · มือถือเมนูลงแถวใต้โลโก้
  - Media / Settings ยังเป็น 404 จนกว่าจะทำ 5.4 / 5.5
- `components/admin/Hub.tsx` — ข้อมูลทั้งหมดจาก `index.json` (รวม draft, blog + project)
  - "Publishing" + จำนวนทั้งหมด · ปุ่ม New post (ยังไม่ทำงาน — 5.3)
  - ตัวเลข: Published · Drafts · Images (ตอนนี้ = ปก + รูปในบทความ จนกว่าจะมี `media.json` ใน 5.4) · Tags in use
  - แท็บ All / Published / Draft · ช่องค้นหาค้นทุกบทความ (ชื่อ, excerpt, tags) ไม่ใช่แค่หน้าที่แสดง (mock ค้นแค่ 24 ใบ)
  - หน้าละ 24 · "Showing 1–24 of N · sorted by …" · เปลี่ยนตัวกรอง = กลับหน้า 1 + เลือกการ์ดใบแรก
  - แถบดำท้ายหน้า: repo · branch · sha · commit ล่าสุดกี่นาทีก่อน (`getRepoHead`, cache 60 วิ) · dev = "fixtures/content · local"
- `FilterPanel.tsx` — กางด้วยความสูง 0.52s · Category (มีบทความ) + Health "issues" · Month ของปีล่าสุด (12 เดือน 2 คอลัมน์) · Sort (Newest / Oldest / A–Z / Z–A, วงกลม เลือกอันเดียว)
  - ตัวเลขข้างแต่ละตัวเลือก = ถ้าติ๊กจะเหลือกี่เรื่อง (คิดจากตัวกรองอื่นที่เลือกอยู่) · SELECTED สรุปสิ่งที่เลือก · CLEAR ALL
- `lib/checks.ts` — "issues" ตอนนี้จาก index: ไม่มีปก · ปกไม่มี alt · excerpt เกิน 200 ตัว · project ไม่มี role — ชื่อการ์ดเป็นสีแดง
  - 5.3 Editor เพิ่ม checks ที่เหลือของ EDITOR-SPEC (ลิงก์, ไฟล์, ขนาดรูป/คลิป, TODO)
- `AdminCards.tsx` — 3 คอลัมน์ ≥1280 · 2 คอลัมน์ต่ำกว่า · คลิก / ลูกศร = เลือก: กล่องเทาวิ่งตามแบบสปริง (v4 `_gAim` .08 / .74, เผื่อ 6px) + จุดดันเลข 14px · Enter / ดับเบิลคลิก = "เปิด" กล่องดำ ตัวหนังสือขาว 1.25 วิ (เปิด Editor ใน 5.3)
  - เลข = post id 3 หลัก (v4 นับ 01–24 ต่อหน้า) · Edit → `/admin/posts/[slug]` (5.3) · View เปิดหน้าจริงแท็บใหม่ · Publish ยังไม่ทำงาน
- `Details.tsx` — ปก · ชื่อ · excerpt · Checks (แดง) · Post · Dates · Content (คำ, เวลาอ่าน, รูป, วิดีโอ, กรอบโค้ด) · File (ขนาด, commit ล่าสุด, revisions, path)
  - ≥1024 อยู่ข้างการ์ด sticky (280 / 1280: 320) · ต่ำกว่า = sheet ขึ้นจากล่างเมื่อแตะการ์ด ปิดด้วย ×
  - Publish / Unpublish / Delete draft แสดงแต่ยังไม่ทำงาน — ต้องเขียน .md + index.json ใน commit เดียว ทำพร้อม Editor (5.3)
- `index.json` เพิ่ม: `images` · `videos` · `codeBlocks` · `bytes` · `lastCommit` (จาก git ใน `rebuild-index`)
