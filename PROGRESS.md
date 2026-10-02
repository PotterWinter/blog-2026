# Progress

เปิดแชทใหม่: แปะไฟล์นี้แล้วบอกว่า "ทำต่อ" · รายละเอียดแต่ละหน้าอยู่ใน `notes/`

---

## ตอนนี้อยู่

- push แล้ว (2 ต.ค. 69 ตี 2): ทุกอย่างถึงรอบ "ข้อความใต้ปุ่ม" — รายละเอียดใน notes/content.md (URL), notes/editor.md, notes/media.md
- 5.3g Preview ทำแล้ว (หน้าซ้อนในแท็บเดิม) · **ถัดไป: 5.3d WRITE (Tiptap)** แบบ Obsidian + เมนู `/` แทรกรูป/โค้ด/note → notes/editor.md
- แล้วค่อย 5.4c หน้า Media · 5.4d คลิป · 5.3d WRITE (Tiptap)
- **URL = รหัสสุ่ม 8 ตัว** `/posts/<code>` (frontmatter `code:`) · ไม่ใช่ slug / no / id · หน้าเว็บไม่ส่ง id ให้ browser
  - no = เลขโชว์: ลบ = เลขหลังจากนั้นลด 1 · unpublish = เลขค้างไว้
  - slug ตามชื่อเรื่องเสมอ แก้เองไม่ได้ (ชื่อไฟล์ + URL ของ Editor)
- repo จริง: Debouncing (#3, No. 2) ได้รหัสแล้ว · **hello-world ยังไม่มีรหัส → เปิด Editor แล้วกด Save changes หนึ่งครั้ง**
- login: fixtures = `111111` · localhost + repo จริง = แอป บัญชี Code by Korn (dev) · เว็บจริง = บัญชี Code by Korn
- dev: `.env.development.local` บรรทัด `CONTENT_DIR=` ไม่มี `#` = repo จริง · ใส่ `#` = fixtures (36 เรื่อง) · Save จาก dev บอกเว็บจริงล้าง cache ให้เอง (`REVALIDATE_SECRET`)

## ทำต่อ

- [ ] เจ้าของลอง hover ตัวอักษรหัวข้อใน Safari (บนเว็บจริงได้)
- [x] ลบ `sessions.json` ออกจาก content repo แล้ว · หลัง push ทุกเครื่องต้อง login ใหม่ครั้งเดียว
- [ ] เจ้าของลองบน iPhone: แถบใต้ URL สีเรียบ · sheet ลากลง / แตะหลังปิด · header admin เตี้ยลง
- [ ] เจ้าของกด Save changes ที่ hello-world (ให้ได้รหัส URL)
- [x] ชื่อไฟล์รูปขึ้นต้นด้วยรหัสโพสต์แล้ว (รูปเก่าที่ขึ้นด้วย id ยังใช้ได้ · Debouncing กด Replace ปกถ้าอยากได้ชื่อใหม่)
- [ ] เจ้าของลองบน iPhone: แตะช่อง Slug / RAW แล้วหน้าไม่ซูม · กล่องยืนยันไม่ล้นจอ
- [ ] rebuild `index.json` ใน content repo (ช่องใหม่: images, videos, codeBlocks, bytes, lastCommit) แล้ว push

---

## ขั้น 0 · Data shape ✅

- [x] Frontmatter schema, index.json, post ID, tags, preview route, settings
- [x] blog-content: git init, `posts/hello-world.md`, commit แรก, branch `main`

## ขั้น 1 · Scaffold + deploy ✅

- [x] create-next-app (โฟลเดอร์ต้องเป็นตัวเล็ก → ชื่อ `blog`)
- [x] รันได้ที่ localhost:3000
- [x] repo `PotterWinter/blog-2026` (public) + `PotterWinter/blog-content-2026` (private)
- [x] Deploy ขึ้น Vercel → https://blog-2026-vercel.vercel.app

## ขั้น 2 · Design tokens ✅

- [x] ฟอนต์ผ่าน next/font (Newsreader, IBM Plex Mono, IBM Plex Sans Thai) · Helvetica Neue ใช้ของในเครื่อง
- [x] globals.css: สี, font stack, type scale (clamp), inset 20/32/44, rules, easing
  - ห้ามใส่ `overflow-x: hidden` (ทำให้ sticky พัง)
- [x] ตรวจที่ 390 / 768 / 1280 ตรงกับ TYPE-SCALE.md

## ขั้น 3 · หน้าอ่าน (อ่าน .md จากเครื่อง)

- [x] 3.1 Header + footer + nav + page transition → [notes/shared.md](notes/shared.md)
- [x] 3.2 หน้า 01 Blog home → [notes/01-home.md](notes/01-home.md)
  - [x] Data layer + fixtures 30 เรื่อง
  - [x] Hero
  - [x] แถบกรองหมวด · Tags · ค้นหา
  - [x] Grid การ์ด + pager + จุดบนการ์ด (มือถือตามการเลื่อน)
  - [x] 01B List: sort หัวคอลัมน์ · การ์ดติดขอบล่างบนมือถือ
- [x] 02 Project → [notes/02-03-10.md](notes/02-03-10.md)
- [x] 03 About + วงกลม View / Email → [notes/02-03-10.md](notes/02-03-10.md)
- [x] 10 Not found (404 เป็นจุด) → [notes/02-03-10.md](notes/02-03-10.md)
- [x] 04 Post detail → [notes/04-post.md](notes/04-post.md)
  - [x] ส่วนหัว · เนื้อหา · รูปทุกเลย์เอาต์ · carousel
  - [x] กรอบโค้ด + Copy · Note · YouTube
  - [x] สารบัญ (คอม + มือถือ)
  - [x] Previous | Next
- [x] 04B Project detail (ลิงก์ + พรีวิว) → [notes/04-post.md](notes/04-post.md)
- [x] จุดทุกตัวกลับสีบนของดำ → [notes/shared.md](notes/shared.md)
- [x] ตัวอักษรหัวข้อกระโดด (`data-jump`) → [notes/shared.md](notes/shared.md)

## ขั้น 4 · อ่านผ่าน GitHub API + cache → [notes/content.md](notes/content.md)

- [x] อ่านได้สองแหล่ง: โฟลเดอร์ในเครื่อง (dev) / GitHub (production)
- [x] cache 1 ชั่วโมง + tag ไว้ล้างตอน admin เซฟ
- [x] `index.json` + script `npm run rebuild-index`
- [x] รูป `/media` อ่านจาก GitHub
- [x] token (fine-grained, Contents read-only) + `GITHUB_TOKEN` / `CONTENT_REPO` บน Vercel (Environments › Production)
- [x] ตรวจเว็บจริง: /posts/hello-world เปิดได้

## ขั้น 5 · Login (05) → Admin (06–09)

ตัดสินใจ (30 ก.ย. 69): rate limit = กฎ Vercel Firewall (POST `/api/login` ≤ 5 ครั้ง / 10 นาที ต่อ IP) · รายการ session = ~~`sessions.json`~~ **Upstash Redis** (1 ต.ค. 69 — login / sign out ไม่เป็น commit แล้ว) · มี homelab database เมื่อไหร่ค่อยย้ายไปที่นั่น

- [x] 5.1 Login (05) → [notes/admin.md](notes/admin.md)
  - [x] TOTP เขียนเอง · session cookie + Redis (เดิม `sessions.json`) · `proxy.ts` กัน `/admin`
  - [x] หน้า `/login` ตาม v4 (ช่องรหัส 6 ช่อง, Paste, Continue)
  - [x] token Read and write · `TOTP_SECRET` / `SESSION_SECRET` บน Vercel · กฎ Firewall "Login rate limit" (POST `/api/login`, 5 ครั้ง / 600 วิ ต่อ IP → 429)
- [x] 5.2 Admin hub (06 / 06B) → [notes/admin.md](notes/admin.md)
  - [x] 5.2a header ของ admin · หัวข้อ · ตัวเลข · แท็บ · ค้นหา
  - [x] 5.2b แผง Filter (Category, issues, Month, Sort)
  - [x] 5.2c การ์ด + เลือก + แผงรายละเอียด (sheet บนมือถือ) + pager + แถบ repo
  - [x] 5.2d รายการ 06B · ปรับ grid: ไม่เลือกเอง, คลิกซ้ำยกเลิก, แผงติดขวา, Checks ครบ + ป้าย hover, ลูกศรเลื่อนหน้าตาม
- [ ] 5.3 Editor (07) + preview (07P) → [notes/editor.md](notes/editor.md)
  - [x] 5.3a เลข `no` แยกต่อ section (`id` ภายใน) · fixtures ใส่แล้ว · index เก่าที่ไม่มี `no` ใช้ id แทน → [notes/content.md](notes/content.md)
  - [x] 5.3b ฝั่งเขียน: commit .md + index.json ครั้งเดียว · Save / Publish / Unpublish / Delete — ทดสอบใน dev แล้ว · **ทาง GitHub ยังไม่ได้ลองกับ repo จริง**
  - ตัวแก้ข้อความ WRITE = Tiptap (เจ้าของเลือก 1 ต.ค. 69)
  - [x] 5.3c หน้า Editor + โหมด RAW .MD — ทดสอบกับ GitHub จริงผ่าน (1 ต.ค. 69): Draft / Publish / Delete เป็น commit เดียวต่อครั้ง · repo จริงมี hello-world (No. 1) + Debouncing without useEffect (#3, No. 2, ยังไม่มีรูป — ใส่ตอน 5.4)
  - [x] ชื่อไฟล์ `posts/<id>-<slug>.md` · hello-world ย้ายชื่อเองตอน save ครั้งถัดไป
  - [ ] 5.3d โหมด WRITE (ต้องเลือกตัวแก้ข้อความก่อน — แนะนำ Tiptap)
  - [ ] 5.3e block รูป / clip / YouTube / code / ตาราง
  - [ ] 5.3f Checks ตรวจจริง
  - [x] 5.3g 07P preview (หน้าซ้อนในแท็บเดิม, 2 ต.ค. 69)
- [ ] 5.4 Media (08) → [notes/media.md](notes/media.md)
  - [x] 5.4a อัปโหลดภาพปก (ย่อ + webp ≤500 KB อัตโนมัติ)
  - [x] 5.4b รูปในเนื้อหา: ปุ่ม Image / ลากวาง / paste · ตั้งชื่อเองก่อน Save
  - [ ] 5.4c หน้า Media · 5.4d คลิป (Vercel Blob)
- [ ] 5.5 Settings (09) — รายการ session + Sign out ทีละเครื่อง
- [ ] ย้ายเลขหมวดจาก `src/lib/site.ts` ไป `site.json`

## ขั้น 5.5 · เลิกพอร์ตเก่า

- ไม่ย้ายเนื้อหาจาก korn-natthanat.vercel.app — เจ้าของเขียนใหม่เองผ่าน Admin (1 ต.ค. 69)
- [ ] ปิดโปรเจกต์ Vercel เก่า 3 ตัว (เช็ก env vars ของ personal-blog-api ก่อน)
- [ ] ผูก korn-natthanat.vercel.app เข้ากับ blog-2026-vercel (เลือก Redirect old domain to new)
- [ ] ใส่ลิงก์จริง: LinkedIn, Behance, CV, วิดีโอ walkthrough ในหน้า Login (ตอนนี้เป็น `#`)
- [ ] ภาพพรีวิวลิงก์ของ project จริง (ตอนนี้ Buddy Blog ใช้รูป interior ชั่วคราว)
- [ ] เจ้าของสร้าง project เองผ่าน Admin — ฝั่ง Design มี 3 project ที่ใส่แน่

## อนาคต (มี homelab database แล้ว)

- [ ] ย้าย rate limit + sessions + ประวัติ login จาก Firewall / Redis ไป database
- [ ] ย้ายบทความไป database (ถ้าทำ): .md เป็นต้นฉบับ มี `id` + `no` ครบ → [notes/content.md](notes/content.md)
- [ ] แยก backend เป็น API ของตัวเองบน homelab (ตอนนี้ Next.js ทำทั้งหน้าเว็บและ backend ใน `npm run dev` ตัวเดียว) — เปลี่ยนแค่ `lib/write.ts` + `lib/content.ts` ให้เรียก API นั้น · `lib/edit.ts` และหน้า Editor ไม่ต้องแตะ (เจ้าของ, 1 ต.ค. 69)
- [ ] Dashboard ยอดคนอ่านต่อบทความ, บทความยอดนิยม, ประวัติ login

## ขั้น 6 · Dark mode

- [ ] ยังไม่เริ่ม

---

## โฟลเดอร์

- `~/Desktop/PersonalBlog2026/blog` — โค้ด (Next.js 16.3.6, React 19.2, CSS Modules, ไม่ใช้ Tailwind)
- `~/Desktop/PersonalBlog2026/blog-content` — บทความ .md + media
- `notes/` — รายละเอียดและการตัดสินใจของแต่ละหน้า
  - [editor.md](notes/editor.md) — 07 Editor / 07P Preview: แผนขั้นย่อย
  - [shared.md](notes/shared.md) — header, footer, nav, page transition, travel dot, จุดกลับสี, ตัวอักษรกระโดด
  - [01-home.md](notes/01-home.md) — หน้า 01 / 01B
  - [02-03-10.md](notes/02-03-10.md) — Project, About, 404
  - [04-post.md](notes/04-post.md) — หน้าบทความ, project detail, สารบัญ
  - [content.md](notes/content.md) — อ่านบทความจากไหน, index.json, cache
  - [admin.md](notes/admin.md) — login, session, secret
  - [media.md](notes/media.md) — อัปโหลดรูป, ย่อรูป, คลิป
  - [dev.md](notes/dev.md) — รัน dev, วัด v4, ทดสอบ Chrome / Safari / iPhone
