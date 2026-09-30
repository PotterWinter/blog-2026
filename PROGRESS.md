# Progress

เปิดแชทใหม่: แปะไฟล์นี้แล้วบอกว่า "ทำต่อ" · รายละเอียดแต่ละหน้าอยู่ใน `notes/`

---

## ตอนนี้อยู่

- ขั้น 3 (หน้าอ่าน) เหลือชิ้นสุดท้าย
- commit ล่าสุด `6576fb7` · **ยังไม่ push** (ค้าง 3 commit)

## ทำต่อ

- [ ] ตัวอักษรหัวข้อกระโดดหนีเมาส์ + แกว่งไหว (`data-jump` ของ v4 — หน้า 01 / 01B / 02 / 03)
- [ ] push ขึ้น GitHub
- [ ] เริ่มขั้น 4

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
- [ ] ตัวอักษรหัวข้อกระโดด (`data-jump`)

## ขั้น 4 · อ่านผ่าน GitHub API + cache

- [ ] ยังไม่เริ่ม

## ขั้น 5 · Login (05) → Admin (06–09)

- [ ] ยังไม่เริ่ม
- [ ] ย้ายเลขหมวดจาก `src/lib/site.ts` ไป `site.json`

## ขั้น 5.5 · ย้ายพอร์ตเก่า

- [ ] ย้ายเนื้อหา korn-natthanat.vercel.app → หน้า 02 / 03
- [ ] ปิดโปรเจกต์ Vercel เก่า 3 ตัว (เช็ก env vars ของ personal-blog-api ก่อน)
- [ ] ผูก korn-natthanat.vercel.app เข้ากับ blog-2026-vercel (เลือก Redirect old domain to new)
- [ ] ใส่ลิงก์จริง: LinkedIn, Behance, CV (ตอนนี้เป็น `#`)
- [ ] ภาพพรีวิวลิงก์ของ project จริง (ตอนนี้ Buddy Blog ใช้รูป interior ชั่วคราว)

## ขั้น 6 · Dark mode

- [ ] ยังไม่เริ่ม

---

## โฟลเดอร์

- `~/Desktop/PersonalBlog2026/blog` — โค้ด (Next.js 16.3.6, React 19.2, CSS Modules, ไม่ใช้ Tailwind)
- `~/Desktop/PersonalBlog2026/blog-content` — บทความ .md + media
- `notes/` — รายละเอียดและการตัดสินใจของแต่ละหน้า
  - [shared.md](notes/shared.md) — header, footer, nav, page transition, travel dot, จุดกลับสี
  - [01-home.md](notes/01-home.md) — หน้า 01 / 01B
  - [02-03-10.md](notes/02-03-10.md) — Project, About, 404
  - [04-post.md](notes/04-post.md) — หน้าบทความ, project detail, สารบัญ
  - [dev.md](notes/dev.md) — รัน dev, วัด v4, ทดสอบ Chrome / Safari / iPhone
