# 07 Editor + 07P Preview (ขั้น 5.3)

ต้นฉบับ: v4 07 / 07N / 07P + `specs/EDITOR-SPEC.md`

## แบ่งเป็นขั้นย่อย

- 5.3a เลข `id` / `no` (ตัดสินใจ 1 ต.ค. 69 → [content.md](content.md))
  - frontmatter เพิ่ม `no` · fixtures: blog no = id เดิม, project ออกเลขตามวันที่
  - หน้าเว็บโชว์ `no` แทน `id` · admin: blog `012`, project `P01`, draft `—`
- 5.3b ฝั่งเขียน (backend)
  - commit หลายไฟล์ในครั้งเดียว (Git Data API: blob → tree → commit → ref) · dev เขียนลง fixtures
  - Save draft · Publish (ออก `no`) · Unpublish · Delete draft → .md + `index.json` commit เดียว + ล้าง cache
  - ข้อความ commit: `YYYY-MM-DD HH:MM:SS · Action #ID`
- 5.3c หน้า Editor: header, ช่อง frontmatter (title, slug, section, category, excerpt, tags, links, cover), แถว Commit / Post / Content / Checks, โหมด RAW .MD (แก้เป็น markdown ได้ครบตั้งแต่ขั้นนี้)
- 5.3d โหมด WRITE (แก้แบบเห็นผล): ตัวหนา / เอียง / H2 / H3 / quote / note / code / ลิงก์, toolbar + ปุ่มลัด, แถบลอยตอนเลือกข้อความ, เมนู "/", สารบัญด้านขวา
- 5.3e block: รูป (single / two / carousel), clip, YouTube, code block + attach, ตาราง, divider · ลบแบบกดค้าง + Undo
- 5.3f Checks ตรวจจริง (Links, Files, Image size, Video size, TODO) · Publish ตอนมีปัญหา = กดสองครั้ง
- 5.3g 07P `/preview/[slug]` (login, ไม่ cache, noindex, ใช้ renderer เดียวกับ 04)
- มือถือ (v4 07 ที่ 390) ทำไปพร้อมแต่ละขั้น

## 5.3b ฝั่งเขียน (ทำแล้ว)

- `lib/edit.ts` — คิดว่าแต่ละปุ่มเปลี่ยนอะไร (ไม่แตะ GitHub / ดิสก์ ลองจาก script ได้)
  - Save: ใหม่ = id ถัดไป เป็น draft · เปลี่ยน slug = ย้ายไฟล์ใน commit เดียวกัน · slug ซ้ำ / ผิดรูป = ไม่ยอม
  - Publish: ครั้งแรก = `no` สูงสุดใน section + 1 และวันนี้ · publish ซ้ำหลัง unpublish = เลขและวันเดิม
  - Unpublish = draft แต่เก็บเลข · Delete = draft เท่านั้น
  - ข้อความ commit เวลาไทย `2026-10-01 20:33:45 · Publish #37` · index เก็บข้อความนี้เป็น `lastCommit` (sha รู้ทีหลัง)
  - ลบ draft ที่เคย publish แล้ว: เลขของมันว่าง publish ถัดไปอาจได้เลขนั้นซ้ำ (ลิงก์ใช้ slug ไม่ใช่เลข)
- `lib/write.ts` — commit: GitHub = Git Data API (tree → commit → ย้าย branch), branch ขยับก่อน (422) = อ่านใหม่ ลองใหม่สูงสุด 3 ครั้ง · dev = เขียนไฟล์ลง fixtures (ไม่เขียน index.json)
  - เสร็จแล้วล้าง cache `index` + `post:<slug>` → หน้าเว็บเห็นทันที
- `app/admin/actions.ts` — server actions: save / publish / unpublish / remove · เช็ก session ทุกครั้ง · คืน `{ ok, error }`
- index.json เก่าที่ไม่มี `no` อ่านผ่าน `readIndex()` (published = ใช้ id) ทั้งตอนอ่านและตอนเขียน

## 5.3c หน้า Editor (ทำแล้ว)

- route เดียว `/admin/posts/[slug]` · `new` = โพสต์ใหม่ (slug "new" จองไว้) · save ครั้งแรกแล้ว URL เปลี่ยนเป็น slug (`history.replaceState`)
  - Next สร้างหน้าใหม่เมื่อ `[slug]` เปลี่ยน → ข้อความใต้ Publish เก็บไว้นอก component (`notes` ต่อ id) · เวลา saved อ่านจาก `lastCommit`
- header ของ editor เอง (แทน nav admin: `admin/(main)/layout` สำหรับ hub / Media / Settings): ← Publishing · #id · path · สถานะ · saved / Not saved · Retry · View live / Preview · Unpublish · Delete draft (กล่องยืนยัน)
- ช่อง: Title (70) · Slug (อัตโนมัติจาก title จนกว่าจะแก้เอง, ไทยไม่มีตัวอักษร a–z = ต้องพิมพ์เอง) · Shows in · Category · Excerpt (200) · Role / Year (project) · Tags / Stack (Manage) · Links (≤3, label เดาจาก URL) · Cover (พิมพ์ path ไปก่อน, อัปโหลดมากับ 5.4)
- แถว Commit · Post · Content · Checks — นับคำในเบราว์เซอร์เท่านั้น (Node กับ Chrome ตัดคำต่างกัน 253 / 250 → hydration ไม่ตรง)
- RAW .MD: frontmatter + เนื้อหา แต่ไม่มี id / no / status / วันที่ (ของระบบ) · พิมพ์แล้วช่องข้างบนตามทันทีเมื่ออ่านเป็นโพสต์ได้ · ยังผิด = บอกว่าผิดอะไร
- Publish ตอนมีปัญหา = กดสองครั้ง · ⌘S = save · ออกจากหน้าตอนยังไม่ save = ถาม (เฉพาะปิดแท็บ / reload)
- draft บันทึกได้แม้ไม่มี excerpt (`text(..., optional)` รับ "" ด้วย)

- Cover: ≥1024 เต็มคอลัมน์ขวา สูงจนเส้น Alt text เสมอขอบล่างปุ่ม Save (เจ้าของ, 2 ต.ค. 69) · รูปโชว์ทั้งรูป (contain) ไม่ครอป · <1024 กว้างไม่เกิน 560 กลางคอลัมน์ 16:9 · ข้าง label โชว์ขนาดไฟล์จริง + pixel ("164 KB · 2400 × 1500", วัดจากไฟล์ต้นฉบับ) · ไม่ใช่ 2:1 = แดง · ยังไม่มี = "2400 × 1200 recommended · 2:1"
- รูปแตก (เช็ก 1 ต.ค. 69): รูป fixtures กว้างแค่ 736–1200px แต่ cover โชว์ถึง 1680 และรูปในเนื้อหาใช้ `<img>` ไฟล์ต้นฉบับตรง ๆ (คอลัมน์ 880 บนจอ 2× ต้องการ 1760) → แก้ใน 5.4: อัปโหลดแล้วย่อเป็น webp เอง + ขนาดที่ต้องการชัด ๆ

## ตัวแก้ข้อความ (WRITE) — Tiptap (เจ้าของเลือก 1 ต.ค. 69)

- แนะนำ Tiptap (ProseMirror) + แปลง markdown เอง: React node view ทำ block รูป / code / carousel ได้, ecosystem ใหญ่
- ทางอื่น: Milkdown (ใช้ remark เหมือน renderer เรา แต่คนใช้น้อยกว่า), เขียน contenteditable เอง (ไม่แนะนำ: เปราะ)
- ไม่ว่าแบบไหน: syntax ของเราเอง (`<!-- two 4:5 -->`, ```` ```ts search.ts ````, `attach`, `> [!NOTE]`) ต้องเขียนตัวแปลงเอง
