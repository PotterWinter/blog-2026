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

- [ ] 01 · 04 · 02 · 04B · 03 · 10

## ขั้น 4 · อ่านผ่าน GitHub API + cache

## ขั้น 5 · Login (05) → Admin (06–09)

## ขั้น 5.5 · ย้ายพอร์ตเก่า

- [ ] ย้ายเนื้อหา korn-natthanat.vercel.app → หน้า 02/03
- [ ] ปิดโปรเจกต์ Vercel เก่า 3 ตัว (เช็ก env vars ของ personal-blog-api ก่อน)
- [ ] ผูก korn-natthanat.vercel.app เข้ากับ blog-2026-vercel (เลือก Redirect old domain to new)

## ขั้น 6 · Dark mode

## ตอนนี้อยู่

ขั้น 3 · หน้าอ่าน → เริ่มจาก header + footer ใน layout.tsx
