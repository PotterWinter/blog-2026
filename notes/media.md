# Media (ขั้น 5.4)

ต้นฉบับ: v4 08 (คลังดูรูป — อัปโหลดทำจาก Editor) · EDITOR-SPEC (Image / Clip)

## แบ่งขั้น

- 5.4a อัปโหลดภาพปกใน Editor ✅
- 5.4b แทรกรูปในเนื้อหา (RAW) ✅ (รูปคมขึ้นมาเอง: อัปโหลด = webp กว้าง 2400 ใช้ไฟล์ตรงๆ)
- 5.4c หน้า Media (08) ✅ รอบแรก (4 ต.ค. 69 ดึก) — ดูด้านล่าง
- 5.4d คลิปวิดีโอ → Vercel Blob (ตัดสินใจ 29 ก.ย. 69: รูปอยู่ใน git, คลิปอยู่ Blob + media.json)

## 5.4a อัปโหลดรูป (1 ต.ค. 69)

- ช่อง Cover: ปุ่ม Upload / Replace + ลากไฟล์มาวางบนกล่อง
- browser (`editor/shrink.ts`): รูปเกิน 3.5 MB หรือด้านยาวเกิน 3000 px → วาดใหม่ ≤3000 px เป็น JPEG (server action รับได้ 4 MB, Vercel 4.5 MB) · iPhone ส่ง HEIC มาเป็น JPEG ให้เอง
- server (`lib/media.ts`, sharp 0.35.5 pin ไว้): หมุนตาม EXIF → webp กว้าง ≤2400 → บีบคุณภาพ 82 → 58 จนไม่เกิน 500 KB · ยังเกิน = ลดความกว้าง 2000 → 1600 แทนการเบลอ
  - ทดสอบ: รูปถ่าย 4000 px 1.4 MB → 2400 px 229 KB · รูปจุดสุ่ม 10 MB (บีบยากสุด) → 1600 px 490 KB
- ชื่อไฟล์ (2 ต.ค. 69 สาย) ขึ้นต้นด้วย**รหัสโพสต์**แทน id: `media/<ปี>/<code>-cover-<ชื่อเดิม>.webp` · `<code>-<ชื่อเดิม>.webp` — คนอ่านเห็นที่อยู่รูป ไม่ควรเห็น id · รูปเก่าที่ขึ้นต้นด้วย id ยังนับเป็นของโพสต์นั้น (ลบตามได้) · หน้า Media (admin) ยังโชว์ #id / No. ของแต่ละรูปได้ตามปกติ (รู้จาก index ว่ารหัสไหนเป็นโพสต์ไหน)
- (เดิม) ชื่อไฟล์ `media/<ปี>/<id>-cover-<ชื่อไฟล์เดิม>.webp` (เจ้าของ, 2 ต.ค. 69 — เดิม `<id>-cover.webp`) · รูปในเนื้อหา = `<id>-<ชื่อไฟล์เดิม>.webp` · ชื่อแก้ได้ก่อน Save: ปก = ช่อง File, รูปในเนื้อหา = แถวใต้แถบ RAW · ซ้ำ = `-2`, `-3` ไม่ทับไฟล์เดิม
- **อัปโหลดยังไม่เข้า repo** (เจ้าของ, 1 ต.ค. 69): server ทำ webp แล้วส่งกลับมาพักใน Editor (เห็นในกล่อง, โพสต์ชี้ `upload:cover`) · กด Save = รูป + .md + index.json **commit เดียว** · ไม่ save = ไม่มีไฟล์ค้าง
  - ชื่อ / เลข id ตั้งตอน save → โพสต์ใหม่อัปโหลดได้เลยไม่ต้อง save ก่อน
- **รูปเก่าลบเอง**: ตอน Save รูปของโพสต์นั้น (`<id>-…webp`) ที่ไม่ได้ใช้แล้ว (เปลี่ยนปก, เอารูปออกจากเนื้อหา) ลบใน commit เดียวกัน · ลบ draft = ลบรูปของมันด้วย · รูปชื่อโพสต์อื่น / รูปเก่าใน fixtures ไม่แตะ
  - ทดสอบ: Upload + Save → `031-cover.webp` · Replace + Save → `031-cover-2.webp` และตัวเก่าหาย · ใส่ปกเดิมคืน + Save → ไม่เหลือไฟล์
- commit ไฟล์ binary: Git Data API `/git/blobs` (base64) ก่อน แล้วใส่ใน tree

## 5.4b รูปในเนื้อหา (2 ต.ค. 69) — UI ใน RAW เอาออกแล้วตามเจ้าของ (2 ต.ค. 69 สาย) จะกลับมาใน WRITE (Tiptap) · ด้านล่างคือของเดิมเผื่อใช้

- RAW: ปุ่ม Image (เลือกได้หลายรูป) · ลากไฟล์มาวาง · paste screenshot → ใส่ตรง cursor
  - แต่ละรูปเป็นย่อหน้าของตัวเอง (เว้นบรรทัดหน้า-หลังให้เอง) · หลายรูปติดกันคนละบรรทัด → ใส่ `<!-- two -->` / `<!-- carousel -->` ข้างบนได้เลย
  - รูปเดียว: cursor รออยู่ใน `![|]` ให้พิมพ์ alt ต่อ · caption = `![alt](path "caption")`
- ก่อน Save ในเนื้อหาเป็น `![](upload:<ชื่อ>)` · Save = `../media/<ปี>/<id>-<ชื่อ>.webp` commit เดียวกับโพสต์
- **ตั้งชื่อเองได้** (เจ้าของ, 2 ต.ค. 69): แถวใต้แถบ RAW โชว์รูปที่รอ Save + ช่องชื่อ (เริ่มจากชื่อไฟล์เดิม) · พิมพ์แล้ว Enter / คลิกออก · ไทยล้วน = ใช้ชื่อเดิม · ซ้ำ = `-2`
  - รูปที่ save แล้วยังเปลี่ยนชื่อไม่ได้ (ต้องย้ายไฟล์ — ทำทีหลังถ้าต้องการ)
- `upload:photo` ไม่ไปจับ `upload:photo-2` (เทียบทั้งคำ)
- Save ตอน cursor ยังอยู่ในกล่อง RAW: ข้อความในกล่องเปลี่ยนเป็น path จริงทันที cursor อยู่ที่เดิม
- เอารูปออกจากเนื้อหาแล้ว Save = ไฟล์รูปนั้นถูกลบใน commit เดียวกัน (กลไกเดิมของ 5.4a)

## 5.4d คลิป (2 ต.ค. 69 ค่ำ) ✅ ทดสอบกับ Blob จริงแล้ว
- **ที่เก็บ:** Vercel Blob store `blog-2026-clips` (public, sin1) — เจ้าของสร้างใน dashboard (ตัวเชื่อม Vercel ได้ 403) · ติ๊ก "read-write token" ตอน connect → `BLOB_READ_WRITE_TOKEN` (ไม่ติ๊ก = ได้แค่ BLOB_STORE_ID แบบ OIDC ใช้ใน dev ไม่ได้) · dev: บรรทัดเดียวกันใน `.env.development.local`
- ฟรี (Hobby, ต่อเดือน): เก็บ 1 GB · ดาวน์โหลด 10 GB · อ่านที่ไม่โดน cache 10,000 · อัปโหลด 2,000 · เกิน = ไม่เสียเงิน แต่ Blob ล็อก 30 วัน
- **ใน .md:** เขียนแบบรูป `![alt](../media/2026/<code>-ชื่อ.mp4 "caption")` · **`media.json`** ใน content repo บอกว่า path นั้นอยู่ไหนจริง: `{ url (Blob), poster (webp ใน git), bytes, seconds, width, height }` (`lib/clips.ts`)
- **อัปโหลด** (Clip block · ปุ่ม Clip · ⇧⌘M · `/clip` · ลากวาง / paste ไฟล์วิดีโอ): MP4 / WebM ≤5 MB · browser ดึง**เฟรมแรก**ทำ poster (`clipFrame.ts`) → poster ไปทางรูป (รอ Save) · ไฟล์ส่งจาก browser ตรงไป Blob (`/api/clip` ออก token ให้เฉพาะคน login · ชนิด + ขนาดจำกัด) · ก่อน Save ในเนื้อหาเป็น `clip:<key>`
- **Save:** `clip:<key>` → `../media/<ปี>/<code>-<key>.mp4` · media.json + poster + .md **commit เดียว** · คลิปของโพสต์ที่เอาออกจากเนื้อหา → ลบ entry + poster ใน commit เดียวกัน แล้วลบไฟล์ใน Blob หลัง commit
- **หน้าเว็บ** (`post/Clip.tsx`): โชว์เฟรมแรกก่อนเสมอ · โหลดไฟล์เมื่อเลื่อนเกือบถึง (200px) · เล่น muted loop · ออกจากจอ = หยุด · **โหลดไม่ได้ (Blob ล็อก) = ค้างเฟรมแรก** (เจ้าของ, 2 ต.ค. 69) · reduced motion = ไม่เล่นเอง
- ทดสอบใน scratch (คลิปทดสอบ + media.json ปลอม): หน้าเว็บเล่นได้ · URL เสีย → เป็นรูปเฟรมแรก · WRITE โชว์ block · อัปโหลดตอนไม่มี token → "Clip not added · Blob isn't connected" · `next build` ผ่าน
- **ทดสอบกับ Blob จริง (scratch, fixtures):** อัปโหลด → Save → .md `../media/2026/yaolsqam-t.mp4` + media.json + poster webp · หน้าเว็บเล่นจาก Blob · เลือก block → กดค้างลบ → Save → entry + poster + ไฟล์ใน Blob หายครบ · ไฟล์ทดสอบใน Blob ลบหมดแล้ว (store ว่าง)
- บั๊กที่เจอระหว่างทดสอบ: path ของ poster ที่ server คืนมามี key แบบ `upload:<key>` (โค้ดคลิปหาแบบไม่มี) · block Clip ไม่ถูกนับเป็น block ที่เลือกได้ (แถบลบไม่ขึ้น) → แก้แล้ว
- ~~ลบ draft ทั้งโพสต์ยังไม่ลบคลิป~~ ทำแล้ว (4 ต.ค. 69): `deletePost` — คลิปที่เนื้อหา / cover ชี้ และชื่อขึ้นต้นด้วยรหัส (หรือ id) ของโพสต์นั้น → entry ใน media.json + poster ลบใน commit เดียวกับโพสต์ · ไฟล์ใน Blob ลบหลัง commit · คลิปชื่อโพสต์อื่นไม่แตะ · ทดสอบ (scratch): Unpublish → Delete draft → media.json `{}`, poster หาย, รูป fixture อื่นอยู่ครบ
- ยังไม่ทำ: คลิปที่อัปแล้วไม่ Save (หรือ Replace ก่อน Save) ค้างใน Blob → ให้หน้า Media (5.4c) หาเจอ

## Cover เป็นคลิปได้ (4 ต.ค. 69) — "ไฮไลต์" ของเจ้าของ
- Editor: ใต้กล่อง Cover แถว **Type: Image | Clip** (บอกว่า Upload / Replace เลือกอะไร · ตาม cover ที่มีเอง) · ลากวางได้ทั้งรูปและคลิป · คลิปเล่น muted loop เต็มกล่อง 2:1 · ขนาด `43 KB · 640 × 360 · cropped to 2:1` (ไม่ 2:1 ไม่แดง — ตั้งใจครอป) · ชื่อไฟล์ของคลิปที่รอ Save แก้ไม่ได้ (ผูกกับ poster)
  - ลองแถว Type ไว้ในแถวหัว Cover ก่อน → ขนาดไฟล์โดนบีบ 3 บรรทัด → ย้ายลงมาเป็นแถวแบบ File / Alt text
- อัปโหลดทางเดียวกับ Clip ในเนื้อหา: ไฟล์ → Blob · เฟรมแรก → poster ชื่อ `cover-<ชื่อ>` (รอ Save แบบรูป) · ฟอร์มเก็บ `clip:cover-<ชื่อ>`
- .md: `cover: ../media/2026/<code>-cover-<ชื่อ>.mp4` · media.json มี entry · poster = path เดียวกันแต่ `.webp` (`still()` ใน `lib/clips.ts` — ไม่ต้องอ่าน media.json)
- Save: `clipsIn` นับบรรทัด `cover:` ใน frontmatter ด้วย → เปลี่ยน cover จากคลิปเป็นรูป = entry + poster ลบใน commit เดียวกัน + ไฟล์ใน Blob ลบหลัง commit
- หน้าเว็บ: หัวบทความ (`PostHeader` `clip`) เล่นเต็มกรอบ 2:1 (`object-fit: cover`) ด้วย `ClipVideo` ตัวเดียวกับ Clip ในเนื้อหา — poster ก่อน, โหลดตอนใกล้เข้าจอ, ออกจอหยุด, Blob ล็อก = ค้าง poster, reduced motion = ไม่เล่น · Preview ใน Editor เล่นคลิปที่ยังไม่ Save ได้
- การ์ด Home / List / Project / Admin / พรีวิวลิงก์ 04B = poster นิ่ง (ไม่เล่น: ประหยัดโควตา Blob, ไม่หนักมือถือ)
- ทดสอบ (scratch, fixtures, Blob จริง): คลิป WebM 2.5 วิ → Save → frontmatter / media.json / poster ถูก · หัวบทความเล่นจาก Blob · การ์ด admin = poster · เปลี่ยนกลับเป็นรูป → Save → media.json ว่าง, poster หาย, Blob 404 · มือถือ 375px ไม่ล้น · `next build` ผ่าน
- เว็บคลิปสั้นฟรีไว้ทดสอบ: Coverr (วนได้ เหมาะกับ cover) · Pexels Videos · Pixabay · Mixkit — เลือก SD / 720p ไม่งั้นเกิน 5 MB
- **การ์ดเล่นคลิปด้วย** (เจ้าของ, 4 ต.ค. 69 — เดิมการ์ดเป็นภาพนิ่ง): `getPublished` แนบ `coverClip` (entry ใน media.json) ไปกับโพสต์ที่ cover เป็นคลิป → การ์ด Grid หน้า Blog และแถวหน้า Project เล่นด้วย `ClipVideo` (เข้าจอ = โหลด + เล่น, ออกจอ = หยุด) · List (01B) / Admin / พรีวิวลิงก์ยังเป็นภาพนิ่ง
  - ทดสอบ (scratch: คลิป 6 วิ 4.35 MB เป็นไฟล์ในเครื่อง ไม่ขึ้น Blob): การ์ดเล่น, object-fit cover เต็มกรอบ 2:1
  - Blob: แต่ละคนที่เห็นการ์ด = โหลดคลิปหนึ่งครั้ง (เบราว์เซอร์ cache ไว้) → คลิปเล็กยิ่งดี
- **List (01B) เล่นด้วย** (เจ้าของ, 4 ต.ค. 69): แผงพรีวิวที่ตามจุด (คอม) และการ์ดล่าง (มือถือ) มี `data-clip-gate` → `ClipVideo` เล่นเฉพาะตอนแผงโชว์ (`data-on`) และเฟรมนั้นอยู่ในกรอบ · ไม่ชี้แถว = ไม่โหลดเลย · ทดสอบ: ชี้แถว = เล่น, เอาเมาส์ออก = หยุด
- **ทุกที่เล่นเมื่อใกล้จะเห็นเท่านั้น** (หัวบทความ · เนื้อหา · การ์ด · List): ห่างจอเกิน 200px = ยังไม่โหลด · ออกจอ = หยุด
- **Blob ชนเพดาน / ล็อก = ภาพเฟรมแรกแทน** (เจ้าของ, 4 ต.ค. 69 — มีอยู่แล้วตั้งแต่ 5.4d) · ทดสอบ: url คลิปเสีย → การ์ดเป็นภาพ poster
- cache: ไฟล์ใน Blob ตั้ง `cache-control` 1 เดือน (ค่าเริ่มต้น, ชื่อไฟล์สุ่มไม่ซ้ำเลยไม่ต้องกลัวค้างของเก่า) · เบราว์เซอร์ที่โหลดแล้วใช้จากเครื่องไม่นับ Blob — แต่วิดีโอขอเป็นช่วง (Range) Safari / iPhone มักโหลดใหม่ ไม่การันตี
- **คลิปขึ้น Blob ตอนกด Save เท่านั้น** (เจ้าของ, 4 ต.ค. 69 — "media ต้องตรงกับ Save ล่าสุด ไม่มีอะไรค้าง"): เลือกคลิป = เก็บไฟล์ไว้ใน editor (`HeldClip`, เล่นจาก blob: ในเครื่อง) + เฟรมแรกทำ poster รอแบบรูป · กด Save = `toBlob` ส่งคลิปที่โพสต์ใช้ขึ้น Blob ก่อน แล้วค่อย save · ส่งพังกลางทาง / save ไม่ผ่าน = `discardClips` (server action, เฉพาะไฟล์ใน `clips/` ของ store เรา) ลบที่เพิ่งส่งทิ้ง · ไม่ Save / Replace / ปิดหน้า = ไม่มีอะไรขึ้น Blob
  - ทดสอบ (scratch, Blob จริง): เลือกคลิป → ไม่มีการเรียก /api/clip · Save → เรียกครั้งเดียว, Blob 200 · Delete draft → media.json ว่าง, poster หาย, Blob 404
  - กด Save ที่มีคลิปใหม่ช้าขึ้นตามเวลาอัป (ไม่เกิน 5 MB)
- **คลิปในเนื้อหามี Fit | Full** (เจ้าของ, 4 ต.ค. 69) แบบรูปเดี่ยว: Fit = ทั้งภาพ แตะความกว้างคอลัมน์หรือ --img-max (สัดส่วนจาก width/height ใน media.json) · Full = `<!-- full -->` บนบรรทัดคลิป เต็มคอลัมน์ที่ --img-max ครอป · ไม่มีตัวเลือกสัดส่วน · Cover = 2:1 เสมอ
  - ทดสอบ: หน้าเว็บ Fit 960 × 507 (1280 × 676), Full 960 × 600 cover · Editor สลับ Fit → Full แล้ว RAW ได้ `<!-- full -->` · check-richtext 36/36

## 5.4c หน้า Media `/admin/media` (4 ต.ค. 69 ดึก) — รอบแรก ยังไม่ commit
- **หลักคิด** (เจ้าของ): media ตามการ Save ล่าสุด ไม่มีอะไรค้าง → หน้านี้**ดูอย่างเดียว** ไม่มีอัปโหลด / ลบ (v4 ก็ไม่มี) · Unused ปกติ = 0 ถ้าไม่ใช่ 0 แปลว่ามีคนแก้ไฟล์ตรงใน GitHub
- ข้อมูล (`lib/library.ts` `getMediaLibrary`): รูปทุกไฟล์ใน media/ (git tree / โฟลเดอร์) + คลิปใน media.json · poster ของคลิปไม่โชว์แยก (เป็นส่วนของคลิป) · "ใช้ที่ไหน" อ่านจากทุกโพสต์ (drafts ด้วย): cover + `![…](media/…)` ในเนื้อหา + ภาพพรีวิวลิงก์ของ project · Over = รูป > 500 KB / คลิป > 5 MB · Missing alt = ถูกใช้ที่ไหนสักที่โดยไม่มี alt (พรีวิวลิงก์ไม่นับ)
- History (Added · Commit): ถาม GitHub ตอนเลือกไฟล์ (`getMediaHistory` commit แรกของไฟล์ · คลิปใช้ของ poster) · fixtures = —
- หน้าตาตาม v4 08: Media + จำนวน · ตัวเลข Files / Total size / Over size / Unused (แดงถ้า > 0) · All · Images · Videos | Over size · Unused · Missing alt · ค้นชื่อไฟล์ · grid 2 / 4 (768) / 5 (1280) ช่องสี่เหลี่ยม ชื่อ + ขนาด (ชื่อแดง = unused / ไม่มี alt, ขนาดแดง = เกิน) · คลิปมี ▶ ความยาว · ตัวที่เลือก = พื้นเทารอบ
- แผงรายละเอียด = กรอบเดียวกับหน้า Posts (`PaneShell` แยกออกมาจาก Details: ข้างขวา ≥1024, sheet ข้างล่างบนมือถือ ลากปิด / แตะหลังปิด): รูปใหญ่ 4:3 (คลิปเล่น) · ชื่อ + All clear / ปัญหาสีแดง · File (Size · Dimensions อ่านจากรูป · Format · Alt) · Usage (Used in: ชื่อโพสต์ · cover / image / clip / preview · draft, Path) · History · Open post (ไป Editor) · Copy path · Download as JPG / PNG / WEBP (แปลงในเบราว์เซอร์, JPG ถมขาว) — คลิป = ดาวน์โหลดไฟล์เดิม
- คีย์บอร์ด: ← → ↑ ↓ (↑↓ ข้ามตามจำนวนคอลัมน์จริง) · Enter / ดับเบิลคลิก = เต็มจอ · ในเต็มจอ ← → / ปุ่มบนจอ · Esc / × ปิด
- ต่างจาก v4: path จริง `media/2026/<code>-ชื่อ.webp` (v4 `posts/<slug>/cover.webp`) · ข้อความใต้หัวข้อ "Comes and goes with the posts that use it, on Save" · footer: repo · files · size · "images in git · clips in Vercel Blob"
- มือถือ (v4 390): ข้อความลงใต้หัวข้อ · ป้ายสั้น Files / Size / Over / Unused · ไม่มีเส้นคั่นกลุ่มปุ่ม
- ทดสอบ (scratch fixtures, 1280 + 375): 29 ไฟล์ (รูป 28 คลิป 1) · Unused 1 = interior-16 (cover ของโพสต์ที่ลบตอนทดสอบ — ถูก) · → ↓ Enter → ในเต็มจอ ← → Esc ทำงาน · ดาวน์โหลด PNG ได้ชื่อ `.png` · เต็มจอรูปพอดีจอ · มือถือ sheet ขึ้น ไม่ล้น · หน้า Posts หลังแยก PaneShell ยังเลือกการ์ด / แผงปกติ
- **แก้ใน Safari** (เจ้าของ, 5 ต.ค. 69 — ภาพย่อไม่ขึ้น, ชื่อทับกัน, Dimensions ค้าง "…"): Safari ไม่ยืดลูกของ `<button>` ให้เต็มความกว้างแบบ Chrome → ช่องภาพกว้าง 0 · ใส่ `width: 100%` ให้ `.tile` `.thumb` `.caption` ตรงๆ · Dimensions: ไฟล์แรกที่เลือกไว้ตั้งแต่เปิดหน้า รูปโหลดเสร็จก่อน React พร้อม onLoad เลยหลุด → อ่านจาก `img.complete` ใน ref ด้วย · ทดสอบผ่าน safaridriver: ช่อง 183 × 183, Dimensions ขึ้นทั้งตอนเปิดหน้าและตอนคลิก
- ปุ่ม JPG / PNG / WEBP มองไม่เห็นบนพื้นขาว (เจ้าของ, 5 ต.ค. 69): Segmented วาดตัวอักษรแบบ difference ต้องมีพื้นกระดาษข้างหลัง → `.downloadRow` ใส่ `isolation: isolate; background: var(--paper)` แบบเดียวกับ `.fig` ใน Editor
- ดูเต็มจอ: แตะพื้นหลังมืดรอบรูปแล้วปิดได้ (เจ้าของ, 5 ต.ค. 69 — เดิมปิดได้แค่ ×): รูปเคยกินเต็มพื้นที่ (100% + contain) เลยรับคลิกพื้นหลังไปหมด → รูปเท่าตัวเอง (absolute + max 100% + margin auto) · ทดสอบ: รูป 640 × 800 กลางจอ, คลิกข้างรูป = ปิด, คลิกบนรูป = ไม่ปิด
