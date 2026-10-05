# Admin: login และ session (ขั้น 5)

---

## ตัดสินใจ (30 ก.ย. 69)

- TOTP อย่างเดียว ไม่มี user / password (ตกลงไว้ตั้งแต่ขั้น 0)
- rate limit = กฎ Vercel Firewall: POST `/api/login` ≤ 5 ครั้ง / 10 นาที ต่อ IP
- ~~รายการ session = `sessions.json` ใน content repo~~ → **Upstash Redis** (1 ต.ค. 69): login / sign out เคย = 1 commit ใน repo บทความ เจ้าของไม่เอา
  - Vercel Marketplace · แผน Free (500k คำสั่ง/เดือน, 1 ฐานต่อบัญชี) · iad1 · eviction ปิด · env `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Production + Preview + Development, ไม่ sensitive เพื่อให้ dev ดึงได้)
  - dev ใช้ฐานเดียวกัน แยกด้วยคำนำหน้า key: `prod:` / `preview:` / `dev:` · `vercel env pull .env.local`
- มี homelab database เมื่อไหร่ ค่อยย้าย session + ประวัติ + rate limit ไปที่นั่น

## ทำงานยังไง

- `src/lib/totp.ts` — ตรวจรหัส TOTP (RFC 6238) เขียนเอง ไม่ใช้ library
  - รับรหัสช่วงก่อน/หลัง 1 ช่วง (±30 วิ) เผื่อนาฬิกามือถือคลาด
  - ผ่านชุดทดสอบมาตรฐานของ RFC ครบ
- `src/lib/cookie.ts` — cookie `session` = `<id>.<หมดอายุ>.<ลายเซ็น>` เซ็นด้วย `SESSION_SECRET` (HMAC-SHA256) · อายุ 30 วัน · httpOnly
- `src/lib/redis.ts` — Upstash ผ่าน REST (`fetch` เอง ไม่มี library) · `redis(...)` / `pipeline([...])` · ไม่มี env = error บอกชื่อตัวที่ขาด
- `src/lib/session.ts` (key ทุกตัวขึ้นต้นด้วยคำนำหน้า)
  - `session:<id>` = `{ id, device, city, createdAt }` หมดอายุ 30 วันพร้อม cookie · `sessions` = set ของ id (Settings)
  - `totp:<step>` = `SET NX EX 120` → รหัสเดิมใช้ซ้ำไม่ได้ (เช็กกับจองในคำสั่งเดียว)
  - `logins` = ประวัติล่าสุด 500 (in / out / wrong-code / reused-code) ไว้ทำ dashboard · `loginHistory()`
  - `device` จาก User-Agent ("iPhone · Safari") · `city` จาก header `x-vercel-ip-city` (dev = ว่าง)
  - `currentSession()` = cookie ถูก **และ** `session:<id>` ยังอยู่ (1 คำสั่งต่อหน้า admin)
  - 111111 ใน dev → เข้า `dev:` เท่านั้น ไม่ปนของจริง
  - 111111 ใช้ได้เฉพาะ `next dev` **และ** dev อยู่ที่ fixtures (`CONTENT_DIR`) · dev ชี้ GitHub จริง = ต้องใช้รหัส Authenticator (รหัสง่าย + สิทธิ์เขียนของจริงไม่อยู่ด้วยกัน — dev server เข้าถึงได้จาก Wi-Fi บ้าน) (1 ต.ค. 69)
- `src/proxy.ts` (Next 16 เปลี่ยนชื่อ middleware เป็น proxy) — `/admin/…` ไม่มี cookie ถูก → `/login?next=…`
  - เช็กแค่ลายเซ็นกับวันหมดอายุ ไม่อ่าน Redis · หน้า admin เช็กอีกชั้น
- `/api/login` POST `{ code }` → 200 / 401 (ผิด หรือใช้ซ้ำ — ผิดก็ลงประวัติ) / 503 (ยังไม่ตั้ง `TOTP_SECRET` หรือ Redis ใช้ไม่ได้)
- `/api/logout` POST → ลบเครื่องนี้ + ลบ cookie

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

- (สมัย sessions.json: หลัง login GitHub ส่งไฟล์เก่ามาไม่กี่วินาที → เด้งกลับ /login · หมดปัญหาเมื่อย้ายไป Redis)

## หน้า login (ปรับ 2 ต.ค. 69 ตามเจ้าของ)

- พิมพ์อะไรก็ได้ (ตัวอักษรด้วย) · คีย์บอร์ดธรรมดา ไม่ใช่แป้นตัวเลข — ไม่บอกคนแอบดูว่ารหัสเป็นเลข
- คลิกตรงไหนของแถว cursor ไปอยู่หลังตัวสุดท้ายเสมอ (ลากเลือกยังได้)
- cursor วาดเอง (`.caret`) กระพริบกลางช่องถัดไป · ครบ 6 = อยู่หลังตัวสุดท้าย · ของ browser ซ่อน (มันไปอยู่ในช่องว่างระหว่างช่อง และหายตอนครบ 6)
- รหัสผิด (กล่องแดง): ปุ่มแรกที่กดแทนทั้งหมด · Backspace ครั้งเดียว = ล้างหมด

## Secret

- dev: `.env.development` มี `TOTP_SECRET` / `SESSION_SECRET` สำหรับเครื่องนี้เท่านั้น
  - **localhost ใช้รหัส `111111` ได้เสมอ** (แบบรหัสทดสอบของ v4, เจ้าของเลือก 1 ต.ค. 69) — เฉพาะ `next dev` (`NODE_ENV=development`) บนเว็บจริงไม่มีผล
  - รหัสจากแอป Authenticator ใช้ได้เฉพาะเว็บจริง (key คนละตัวกับ dev)
  - **รหัสไหนใช้ที่ไหน** (2 ต.ค. 69):
    - localhost + fixtures (`# CONTENT_DIR=`) → `111111`
    - localhost + repo จริง (`CONTENT_DIR=` ว่าง) → แอป บัญชี **Code by Korn (dev)** (key ใน `.env.development`)
    - เว็บจริง → แอป บัญชี **Code by Korn**
  - key เว็บจริงบน Vercel เป็น Sensitive (ดูค่าไม่ได้แล้ว) → เลยเพิ่ม key dev เข้าแอปเป็นบัญชีที่สองแทน · `.env.development.local` ไม่มี `TOTP_SECRET` / `SESSION_SECRET` (ใช้ของ `.env.development`)
- production: `npm run auth-secrets` (ค่าออกแค่ใน terminal) หรือ `-- --out <ไฟล์>` เขียนลงไฟล์ที่เจ้าของอ่านได้คนเดียว ไม่แสดงค่า → ใส่ในแอป authenticator + Vercel (Secret) แล้วลบไฟล์
  - 1 ต.ค. 69 สร้างไว้ที่ `~/Desktop/blog-secrets.txt` (Claude ไม่ได้เห็นค่า)
  - เปลี่ยน `SESSION_SECRET` = ทุกเครื่องหลุด · เปลี่ยน `TOTP_SECRET` = ต้องเพิ่มบัญชีในแอปใหม่

---

## 06 Admin publishing hub (`/admin`) — 5.2

- ทุกหน้า `/admin` ไม่มีเลื่อนแล้วค่อย ๆ ขึ้น (ไม่มี RevealObserver / `data-reveal`): เปิดมาเห็นครบทันที (เจ้าของ, 1 ต.ค. 69)

- `app/admin/layout.tsx` — ทุกหน้าใต้ `/admin`: เช็ก `currentSession()` + header ของ admin (`AdminNav`)
  - Posts · Media · Settings · Sign out มีเส้นใต้หน้าปัจจุบัน (v4 `.navl`) · มือถือเมนูลงแถวใต้โลโก้
  - Media / Settings ยังเป็น 404 จนกว่าจะทำ 5.4 / 5.5
- `components/admin/Hub.tsx` — ข้อมูลทั้งหมดจาก `index.json` (รวม draft, blog + project)
  - "Publishing" + จำนวนทั้งหมด · ปุ่ม New post (ยังไม่ทำงาน — 5.3)
  - ตัวเลข: Published · Drafts · Images (ตอนนี้ = ปก + รูปในบทความ จนกว่าจะมี `media.json` ใน 5.4) · Tags in use
  - แท็บ All / Published / Draft · ช่องค้นหาค้นทุกบทความ (ชื่อ, excerpt, tags) ไม่ใช่แค่หน้าที่แสดง (mock ค้นแค่ 24 ใบ)
  - หน้าละ 24 · "Showing 1–24 of N · sorted by …" · เปลี่ยนตัวกรอง = กลับหน้า 1 (การ์ดที่เลือกหลุดหน้า = ไม่เลือกอะไร)
  - แถบดำท้ายหน้า: repo · branch · sha · commit ล่าสุดกี่นาทีก่อน (`getRepoHead`, cache 60 วิ) · dev = "fixtures/content · local"
- ปุ่ม Filter: + หมุนตามเข็ม 90° ทุกครั้งที่กด ไม่หมุนกลับ (v4) · สีเข้มตอน hover / เปิด
  - + เป็น SVG หมุนเส้นข้างใน: ถ้าหมุนกล่อง (pseudo element) Safari แยก layer ปัดพิกเซล เส้นตั้งเลื่อนขวาแล้วค่อยเด้งเข้ากลางตอนหมุนจบ
- `FilterPanel.tsx` — กางด้วยความสูง 0.52s · Category (มีบทความ) + Health "issues" · Month ของปีล่าสุด (12 เดือน 2 คอลัมน์) · Sort (Newest / Oldest / A–Z / Z–A, วงกลม เลือกอันเดียว)
  - ตัวเลขข้างแต่ละตัวเลือก = ถ้าติ๊กจะเหลือกี่เรื่อง (คิดจากตัวกรองอื่นที่เลือกอยู่) · SELECTED สรุปสิ่งที่เลือก · CLEAR ALL
- `lib/checks.ts` — Checks แสดงตลอด (v4): สี่เหลี่ยม 7px ดำ = ผ่าน · แดง = ต้องแก้ · กรอบเทา = ยังไม่ได้ตรวจ ("in editor")
  - สองคอลัมน์เรียงลงของใครของมัน (บรรทัด note ไม่ดันช่องว่างให้ข้าง ๆ)
  - hover = ป้ายดำตามเมาส์ (`useHoverTip`, v4 dp-tip): สปริง .16 · โตจากครึ่ง · เปลี่ยนข้อ = ความกว้างไหล + คำเลื่อนขึ้น · ยาวเกิน 320 ขึ้นบรรทัดใหม่ มุมโค้ง 10 · ไม่ล้นขอบขวาแผง · เมาส์เท่านั้น
  - ตรวจจาก index ได้แล้ว: Cover · Excerpt (ไม่มี / เกิน 200 ตัว) · Alt text (ปก) · Role (project) — มีข้อแดง = ชื่อการ์ดแดง + นับใน filter issues
  - 5.3 Editor ทำให้ Links · Files · Image size · Video size · TODO ตรวจจริง
- `AdminCards.tsx` — 3 คอลัมน์ ≥1280 · 2 คอลัมน์ต่ำกว่า · คลิก / ลูกศร = เลือก: กล่องเทาวิ่งตามแบบสปริง (v4 `_gAim` .08 / .74, เผื่อ 6px) + จุดดันเลข 14px · Enter / ดับเบิลคลิก = "เปิด" กล่องดำ ตัวหนังสือขาว 1.25 วิ (เปิด Editor ใน 5.3)
  - เริ่มต้นไม่เลือกอะไร (v4 เลือกใบแรก) · คลิกใบที่เลือกอยู่ซ้ำ / Esc = ยกเลิก · ลูกศรตอนยังไม่เลือก = เริ่มใบแรก · ใบที่เลือกหลุดจอ = หน้าเลื่อนตามทีละแถว (`scrollIntoView` nearest + `scroll-margin` 64 / 24) (เจ้าของ, 1 ต.ค. 69)
  - กดลูกศรรัว ๆ ต้องลื่น: สปริงกล่องเทานับตามเวลา (เฟรมหลุด = เดินหลายก้าว ไม่ slow motion) · การ์ดเป็น `memo` + คลิกอ่านจาก grid (`data-id`) · FilterPanel `memo` + ตัวเลือก `useMemo` → กดหนึ่งครั้ง render แค่ 2 การ์ด + แผง
  - เลข = post id 3 หลัก (v4 นับ 01–24 ต่อหน้า) · Edit → `/admin/posts/[slug]` (5.3) · View เปิดหน้าจริงแท็บใหม่ · Publish ยังไม่ทำงาน
  - Edit / View hover: เส้นดำวาดทับเส้นเทาจากซ้าย ออกไปทางขวา 0.36s (แบบ tag หน้า post)
- `Details.tsx` — ปก · ชื่อ · excerpt · Checks (แดง) · Post · Dates · Content (คำ, เวลาอ่าน, รูป, วิดีโอ, กรอบโค้ด) · File (ขนาด, commit ล่าสุด, revisions, path)
  - ยังไม่เลือกการ์ด = มีแค่เส้นบน (คอลัมน์ยังกันที่ไว้ การ์ดไม่ขยับ)
  - ≥1024 คอลัมน์ข้างการ์ด (280 / 1280: 320) · เส้นบนอยู่กับที่ ไม่ตาม · ตามลงมาแค่เนื้อหา (ตั้งแต่รูป) ติดใต้ header ที่ 56px · สูงตามเนื้อหา สูงสุด = จอ − 56 − 24 แล้ว scroll ข้างใน (ไม่แต่ง scrollbar: Safari แต่งแล้ว trackpad ฝืด) · ท้ายหน้าหยุดที่เส้น pager เอง
  - รายละเอียดโดนตัด = คลิกรูปปกได้ (cursor pointer + ป้าย hover บอกว่าจะเลื่อนทางไหน) เลื่อนหน้าแค่พอให้เห็นครบ (เจ้าของ, 1 ต.ค. 69):
    - หน้าอยู่สูงกว่าแผง: "Scroll down to see it all" → เลื่อนลงจนเส้นแผงทับเส้นล่าง header เป็นเส้นเดียว (ปัดขึ้น ไม่ให้เหลือเศษเป็นสองเส้น)
    - ท้ายรายการ แผงโดนดันขึ้นใต้ header: "Scroll up to see it all" → เลื่อนขึ้นนิดเดียวจนแผงกลับไปอยู่ที่ 56
    - ระหว่างนั้นเห็นครบอยู่แล้ว = คลิกไม่มีผล ไม่มีป้าย
  - ป้าย hover ปล่อยเองเมื่อหน้าหรือแผงเลื่อน
  - ลูก ๆ ใน paneBody ห้ามหด (`flex-shrink: 0`) ไม่งั้นรูปปกหดเหลือ 0
  - Status: Published หนา 600 · Draft สีเทา (v4)
  - Edit post / View อยู่ใต้ชื่อ + excerpt (ก่อน Checks) ให้เห็นทันทีที่เลือก · Unpublish / Delete อยู่ล่างสุด ห่างปุ่มที่กดบ่อย (เจ้าของ, 1 ต.ค. 69)
  - Enter / ดับเบิลคลิก = เปิด Editor (5.3) ไม่ใช่ View
  - ข้าง Delete / Unpublish มีหมายเหตุ "drafts only" / "published posts can’t be deleted" (v4)
  - Publish / Unpublish / Delete draft แสดงแต่ยังไม่ทำงาน — ต้องเขียน .md + index.json ใน commit เดียว ทำพร้อม Editor (5.3)
- `AdminList.tsx` (06B) — No. · Title + ไฟล์ · Status · Cat. (2 ตัว) · Date
  - คอลัมน์ v4: 1280 `40 1fr 84 36 84` gap 24 · 1024 `32 … 76` gap 16 · 768 `32 … 84` gap 20 · มือถือ `24 1fr 66 66` gap 12 ไม่มีไฟล์ / Cat. (v4 64 / 60 ตัดบรรทัดวันที่)
  - เลือกเหมือนการ์ด: แถบเทาสปริง .16 / .64 (เลยขอบ 12px) + จุดแทนเลข · คลิกซ้ำ / Esc ยกเลิก · ↑ ↓ · Enter / ดับเบิลคลิก = แถบดำ ตัวขาว ชื่อเลื่อน 14px
  - หัวคอลัมน์ทุกอันกด sort ได้ (`SortHead` ของ 01B · มือถือกด No. / Title ได้) — ยังไม่กด = No. มากไปน้อย (ลำดับที่สร้าง: draft ใหม่อยู่บน · หน้าเว็บผู้อ่านยังเรียงตามวันที่) ไม่มีลูกศร ไม่ติ๊กในแผง Filter · กฎกดแบบ 01B: · กดแรก ↓ (001, A, Draft, เก่าสุด) · กดอีกที กลับด้าน
    - กลับด้านแค่คีย์ของคอลัมน์ เรื่องที่เท่ากัน (Status, Cat.) ยังใหม่สุดก่อนเสมอ
    - แผง Filter มีแค่ Newest / Oldest / A–Z / Z–A · sort จากหัวอื่นแผงจะไม่ติ๊กอันไหน · บรรทัด "sorted by …" บอกครบ
  - Cat. ตัวย่อ 2 ตัว · Development = DV, Design = DS (ไม่ให้ชนกันเป็น DE) · hover เห็นชื่อเต็ม
- มือถือ: sheet เปิดเฉพาะตอนมีการ์ด / แถวที่เลือก (sort / filter แล้วหลุดหน้า = ปิดเอง)
- sheet มือถือ (ต่ำกว่า 1024): หน้าหลังมืดลง (scrim 32%) · ปิดได้ 3 ทาง: ×, แตะหน้าหลัง, ลากลงจากบนสุด (เกิน 1/3 หรือปัดเร็ว = ปิด, ไม่ถึง = เด้งกลับ) (เจ้าของ, 1 ต.ค. 69)
  - ของจอใหญ่ (scroll ในแผง, คลิกรูปปกเลื่อนหน้า, ป้าย hover) ทำงานเฉพาะ ≥1024 / เมาส์
  - sheet เปิดอยู่ = หน้าหลังเลื่อนไม่ได้ (html `overflow: hidden`, ทั้งนิ้ว ล้อเมาส์ และ scrollbar) · sheet เลื่อนสุดแล้วไม่ไหลต่อไปหน้าหลัง · โพสต์ใหม่เริ่มจากบนสุด
- header admin: CSS ต้องเป็น `header.header` (ชนะ .header ของ Header.module.css) · มือถือสูง 87 (v4 86, เดิม 127 เพราะ padding / gap ของ header เว็บทับ) · คอม gap 32 ตาม v4
- มือถือ: Filter อยู่แถวเดียวกับ All / Published / Draft · แถวสองคือค้นหา + GRID / LIST
- Sign out → หน้าแรกของ blog (`/`) ผ่าน page transition (เจ้าของ, 1 ต.ค. 69)
- กด Posts ใน header ตอนอยู่ `/admin` อยู่แล้ว = page transition แล้วเริ่มใหม่: grid, ไม่มี filter / sort, หน้า 1, ไม่เลือก, ขึ้นบนสุด + ดึงข้อมูลใหม่ (กลไกเดียวกับ nav ของเว็บ: `PageSlot` remount)
- `index.json` เพิ่ม: `images` · `videos` · `codeBlocks` · `bytes` · `lastCommit` (จาก git ใน `rebuild-index`)

## ขีดขาวใต้ footer หน้า admin (2 ต.ค. 69)
- เดิม hub สูงอย่างน้อย `100svh − 40px` (ความสูงหัวที่วัดใน Chrome) — Safari วาดหัวเตี้ยกว่า หน้าเลยขาดไม่กี่ px เห็นขาวใต้แถบดำ
- แก้: `(main)/layout` ห่อหัว + หน้าใน `.frame` (flex column, min-height 100svh) · hub `flex: 1` · ไม่ต้องรู้ความสูงหัว

## 5.5a Settings `/admin/settings` (5 ต.ค. 69) — ยังไม่ commit
- ตัดสินใจ (เจ้าของ): แบ่ง 2 รอบ · ค่าตั้ง (5.5b) เก็บ `site.json` ใน content repo ("ไม่งั้นมันก็ไม่แสดงผล") · ไม่ทำ Reset authenticator / Recovery codes · ไม่ทำ Rebuild site · Dashboard ไม่อยู่ใน Settings
- หน้าตาตาม v4 09: หัวข้อ + เส้นใต้ · แถบซ้าย 200 (01 Site … 06 Danger zone, Danger zone แยกห่าง) จุดทำแบบสารบัญหน้าบทความ: หัวส่วนผ่านเส้น 35% ของจอแล้วจุดค่อยไหลไป (0.36s `--ease-draw`) · ท้ายหน้า = Maintenance · ไม่ตาม hover (เจ้าของ 5 ต.ค. 69 · ลองแบบไหลต่อเนื่องตาม scroll แล้วไม่เอา) · คลิก = เลื่อนไปส่วนนั้น · ต่ำกว่า 1024 = แถบ tab แนวนอนติดใต้ header (วัดความสูง header เอง `--head`) · แต่ละส่วน: เลข + หัวข้อ 30 + คำอธิบายขวา · แถว 220 / ที่เหลือ (มือถือเรียงบน-ล่าง)
- 01 Site / 02 Categories / 03 Checks: แสดงค่าปัจจุบัน "Read only" (แก้ได้ใน 5.5b)
  - Categories: Name · Slug (เทา — ค่าใน frontmatter `category:` และ `?category=` · 5.5b ห้ามแก้ slug ของหมวดที่มีโพสต์) · Posts · ตารางเดียว ไม่แยก Blog / Project (เจ้าของ, 5 ต.ค. 69)
  - Checks: คงไว้แบบนี้ (On ทุกข้อ) · คำใต้ Links = "other sites: asked once you stop typing" (เดิมเขียนผิดว่าตอนเปิด / save) (เจ้าของ, 5 ต.ค. 69)
  - ชื่อย่อ Cat. ในหน้า Posts (List) คิดเองจากรายการหมวด: 2 ตัวแรก · ชนกัน = ตัวแรก + พยัญชนะถัดไปที่ยังว่าง (DV / DS · เพิ่ม Research = RD / RS) · ไม่โชว์ใน Settings
  - Description = `HomeIntro` ตัวเดียวกับข้าง hero หน้าแรก (ไม่ก๊อปข้อความ) · Posts per page = ตัวเลือก 6 / 12 / 18 / 24 (หาร 2 และ 3 ลงตัว · `perPageChoices` / `postsPerPage` ใน `lib/site.ts`) ขีดเส้นใต้ตัวที่ใช้ · ไม่โชว์ของ admin (24 คงที่) (เจ้าของ, 5 ต.ค. 69) · Categories นับโพสต์จริงต่อหมวด (blog + project) · Checks บอกเพดาน 500 KB / 5 MB จากโค้ดจริง
- 04 Repository: Code = repo / branch / sha ที่ Vercel build (dev = "this folder · next dev") · Content = getRepoHead (fixtures = local folder) · Connected / Not connected · Deploy on push: On
- 05 Security (ปรับ 5 ต.ค. 69 ตามเจ้าของ — เดิมรก 24 แถว + Sign-ins 20 แถว): Authenticator Enabled · **Sessions** หัวบอก "n devices signed in" · แถว = อุปกรณ์ · IP · เมือง · signed in … ago · This device / **Sign out** · **Sign out all other devices (n)** · บรรทัดแดง "n wrong codes in the last 7 days · last … from <IP>" (ไม่มี = เทา) · ตาราง Sign-ins เอาออก (ประวัติยังเก็บใน Redis ไว้ทำ dashboard)
  - แต่ละที่แยกกันอยู่แล้ว (Redis prefix `dev:` / `preview:` / `prod:`) · หัว Sessions บอกว่าที่ไหน: "on localhost" / "on previews" / "on the live site" · localhost ไม่มีเมือง → ขึ้น "dev" แทน
  - **Rate limit** (Read only): "5 tries in 10 min, then locked out" · localhost = "Off on localhost" · Firewall บล็อกก่อนถึงแอป แอปเลยไม่เห็นตัวที่โดนบล็อก → นับเอง: IP ไหนรหัสผิดครบ 5 ใน 10 นาที = ต่อท้ายบรรทัดแดง "locked out: <IP>" (ไม่คิดบน localhost)
  - **1 เครื่อง = 1 session**: login ใหม่จาก อุปกรณ์ + IP เดิม ลบ session เก่าของเครื่องนั้นก่อน (`signIn`)
  - IP: `x-real-ip` (Vercel) / `x-forwarded-for` (next dev = `::1` → "this machine") · session / ประวัติก่อน 5 ต.ค. ไม่มี IP = "" · `Where = { device, city, ip }`
  - dev: กด Sign out all other devices ล้าง 24 session ทดสอบแล้ว (localhost:3000 ของเจ้าของอาจต้อง login ใหม่ด้วย 111111 / แอป)
  - หน้าเว็บไม่เห็น session id (เป็นส่วนหนึ่งของ cookie) — ได้ fingerprint (`handleOf` sha256 16 ตัว) แทน · server action หาเครื่องจาก fingerprint
- 06 **Maintenance** (เดิม Danger zone — ชื่อดูน่ากลัวเกิน เปลี่ยนชื่อ แต่คงกรอบแดง + ปุ่มแดงแบบ v4 ไว้ "สะดุดตาดี", เจ้าของ 5 ต.ค. 69 · "When the site shows something old") · **Clear cache** = `revalidateTag("content")` + ถ้าเป็น dev บน repo จริง สั่งเว็บจริงล้างด้วย (`/api/revalidate` รับ `{ all: true }` แล้ว)
- ทดสอบ (scratch, 1440 + 375): ทุกส่วนขึ้น · จุดตามส่วนที่ดู · Clear cache ตอบ "Cleared · …" · มือถือ: แถบ tab ติดใต้ header (87), กด tab แล้วหัวข้อมาอยู่ใต้แถบ (151) · แถบ tab เลื่อนแนวนอนเองเท่านั้น (scrollIntoView เคยดึงหน้าทั้งหน้า ขัดการเลื่อนไปส่วนที่กด)
  - ไม่ได้กด Sign out ในการทดสอบ: เว็บทดสอบใช้ Redis ชุดเดียวกับ dev ของเจ้าของ (prefix `dev:`)
