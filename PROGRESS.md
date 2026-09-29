# Progress

อัปเดตทุกครั้งที่จบขั้นย่อย · เปิดแชทใหม่ให้แปะไฟล์นี้ + ไฟล์สรุปการตัดสินใจ

## โฟลเดอร์

- `~/Desktop/PersonalBlog2026/blog` — โค้ด (Next.js 16.3.6, React 19.2, CSS Modules, ไม่ใช้ Tailwind)
- `~/Desktop/PersonalBlog2026/blog-content` — บทความ .md + media

## ขั้น 0 · Data shape ✅

- [x] Frontmatter schema, index.json, post ID, tags, preview route, settings
- [x] blog-content: git init, `posts/hello-world.md`, commit แรก, branch `main`

## ขั้น 1 · Scaffold + deploy

- [x] 1.2 create-next-app (โฟลเดอร์ต้องเป็นตัวเล็ก → ใช้ชื่อ `blog`)
- [x] 1.3 รันได้ที่ localhost:3000 (page.tsx เหลือ h1 อย่างเดียว, ลบ page.module.css + public/\*.svg แล้ว)
- [x] 1.4 สร้าง repo `PotterWinter/blog-2026` (public) + `PotterWinter/blog-content-2026` (private) แล้ว push
- [x] 1.5 Deploy ขึ้น Vercel → https://blog-2026-vercel.vercel.app

## ขั้น 2 · Design tokens ✅

- [x] 2.1 ฟอนต์ผ่าน next/font (Newsreader, IBM Plex Mono, IBM Plex Sans Thai) · Helvetica Neue ใช้ของในเครื่อง
- [x] 2.2 globals.css: สี, font stack, type scale (clamp), inset 20/32/44, rules, easing · ลบ overflow-x:hidden (ทำให้ sticky พัง)
- [x] 2.3 ตรวจที่ 390/768/1280 ตรงกับ TYPE-SCALE.md · page.tsx ตอนนี้เป็นหน้าทดสอบชั่วคราว

## ขั้น 3 · หน้าอ่าน (อ่าน .md จากเครื่อง)

### 3.1 Header + footer (ใช้ร่วมทุกหน้า) ✅
- [x] Route group `(site)` มี layout ของตัวเอง · หน้า `/project`, `/about` ยังเป็นหน้าเปล่าชั่วคราว
- [x] `Header` (sticky, ใช้ร่วมกับ login/admin ได้ — ด้านขวารับเป็น children)
- [x] โลโก้: กรอบ 6.3em → 6.9em + ข้อความเลื่อน −4.076em (CSS ล้วน, ค่า em วัดจาก Helvetica Neue)
- [x] `Footer`: 3 คอลัมน์ ≥768 / ซ้อนแถวที่ 390 · dot link hop · ลิงก์ LinkedIn/Behance/CV ยังเป็น `#`
- [x] `SiteNav` travel dot: slot 13px · hop 330ms + settle 600ms (ค่าจริงจากแผงปรับค่าของ v4: hopHeight 76, squash .35) · กดค้าง = จุดหด .62 · กดหน้าเดิม = boing
- [x] Page transition: แผ่น #e8e8e7 ขึ้นคลุมใต้ navbar → เปลี่ยน/โหลดหน้าใต้แผ่น → แผ่นเลื่อนกลับลง · loader "Korn Natthanat ——— %"
- [x] Back to top เลื่อนแบบ smooth (`data-scroll-behavior="smooth"` ให้ Next ปิด smooth ตอนเปลี่ยนหน้า)
- [x] Safari: คราบหาง g/j ตอน slot หด → แก้ด้วย `padding: 6px 0; margin: -6px 0` บนลิงก์ nav

**เปลี่ยน/เพิ่มจาก v4 (เจ้าของตัดสินใจ 29 ก.ย. 69)**
- Page transition + loader (ไม่มีใน v4, อ้างอิง dashdigital.studio) · กดหน้าเดิม = โหลดหน้าเดิมใหม่ + loader วิ่งอีกรอบ
- กดค้าง: ตัวหนังสือไม่จม 1.5px (v4 จม) — จุดหดรอบจุดกึ่งกลางอย่างเดียว
- จุดใน nav ใช้สี ink ตรงๆ แทน white + difference blend (blend มองไม่เห็นเมื่อจุดลอยต่ำกว่า header)
- ยังไม่มี loader ตอนเปิดเว็บครั้งแรก (ช้าเกินสำหรับบล็อกอ่านเร็ว — ทำเพิ่มได้ถ้าต้องการ)

### 3.2 หน้าอ่าน
- [ ] 01 · 04 · 02 · 04B · 03 · 10

## ขั้น 4 · อ่านผ่าน GitHub API + cache

## ขั้น 5 · Login (05) → Admin (06–09)

## ขั้น 5.5 · ย้ายพอร์ตเก่า

- [ ] ย้ายเนื้อหา korn-natthanat.vercel.app → หน้า 02/03
- [ ] ปิดโปรเจกต์ Vercel เก่า 3 ตัว (เช็ก env vars ของ personal-blog-api ก่อน)
- [ ] ผูก korn-natthanat.vercel.app เข้ากับ blog-2026-vercel (เลือก Redirect old domain to new)

## ขั้น 6 · Dark mode

## ข้อควรรู้ตอน dev

- เปิดผ่าน `localhost:3000` · ถ้าเปิดจาก IP (เช่นทดสอบบนมือถือ) ต้องใส่ IP ใน `allowedDevOrigins` ของ `next.config.ts` แล้วรีสตาร์ท dev server ไม่งั้น JS ไม่ทำงาน
- ทดสอบ Safari อัตโนมัติ: Safari › Develop › Allow Remote Automation แล้วใช้ `safaridriver`

## ตอนนี้อยู่

ขั้น 3.2 · หน้า 01 Blog home (อ่าน .md จาก `blog-content` ในเครื่อง)
