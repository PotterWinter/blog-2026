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
- ช่อง: Title (70) · Slug (แสดงอย่างเดียว ตาม title เสมอ — 2 ต.ค. 69; ไทยล้วน = `post-<id>`) · Shows in · Category · Excerpt (200) · Role / Year (project) · Tags / Stack (Manage) · Links (≤3, label เดาจาก URL) · Cover (พิมพ์ path ไปก่อน, อัปโหลดมากับ 5.4)
- Commit › Message ตาม v4 (2 ต.ค. 69): ข้อความของ save ถัดไป **เวลาเดินสด** (ถ้ากดตอนนี้จะได้แบบนี้) สีเทา (ระบบเขียน ไม่ได้พิมพ์) + ป้าย "next save" บนเส้นดำ + บรรทัดเทา "written for you on each save — Draft, or Edit once it's live · Publish · Delete" · Last commit สีเทา
- RAW .MD: ปุ่ม Copy ใช้ตัวเดียวกับกรอบโค้ดในหน้าบทความ (⧉→✓ Copied) · **ไม่มีการแทรกรูปใน RAW แล้ว** (เจ้าของ: syntax รูปเยอะเกินพิมพ์เอง) — ไปทำใน WRITE (Tiptap) · โค้ด 5.4b อยู่ใน git
- แถว Commit · Post · Content · Checks — นับคำในเบราว์เซอร์เท่านั้น (Node กับ Chrome ตัดคำต่างกัน 253 / 250 → hydration ไม่ตรง)
- RAW .MD: frontmatter + เนื้อหา แต่ไม่มี id / no / status / วันที่ (ของระบบ) · พิมพ์แล้วช่องข้างบนตามทันทีเมื่ออ่านเป็นโพสต์ได้ · ยังผิด = บอกว่าผิดอะไร
- มือถือ (ตรวจที่ 375, 2 ต.ค. 69):
  - กล่องยืนยัน Reset ห้อยจากต้นแถวปุ่ม Save (เดิมห้อยจาก Reset → ล้นขวา) · Unpublish / Delete draft ห้อยจากหัวหน้า ชิดขอบขวา (เดิมล้นซ้าย) · กล่องไม่กว้างเกินจอ
  - admin ทั้งหมด `maximum-scale=1`: ช่องตัวเล็ก (11–12px) ไม่ทำให้ iPhone ซูมเองตอนแตะ · ยังถ่างนิ้วซูมได้ · หน้าเว็บทั่วไปไม่ใส่ (Android จะซูมไม่ได้)
  - ไม่มีอะไรล้นจอใน Editor (blog / draft / แถวรูปรอ Save) และ hub
- ระหว่างกด: ใต้ปุ่มนับวินาที "Saving… 3s" (Publish นับต่อเนื่องทั้ง save + publish)
- ข้อความใต้ปุ่ม (2 ต.ค. 69): มีเวลา ("Saved 01:54:56 · live now", "Draft saved …") · แก้อะไรก็หาย · ปุ่มขึ้น Saving… / Publishing… ระหว่างกด · Reset = คืนข้อความของ save ล่าสุดในรอบนี้ (ยังไม่เคย save ตั้งแต่เปิดหน้า = ไม่มีข้อความ)
- **Reset** ข้างปุ่ม Save (เจ้าของ, 2 ต.ค. 69): ทุกช่อง + RAW กลับเป็นค่าที่ save ล่าสุด รูปที่รอ Save ทิ้งด้วย · ถามยืนยันก่อน (กล่องแดง) · ไม่มีอะไรเปลี่ยน = กดไม่ได้
- Publish ตอนมีปัญหา = กดสองครั้ง · ⌘S = save · ออกจากหน้าตอนยังไม่ save = ถาม (เฉพาะปิดแท็บ / reload)
- draft บันทึกได้แม้ไม่มี excerpt (`text(..., optional)` รับ "" ด้วย)

- Cover: กรอบ 2:1 (ตรงกับไฟล์ปก 2400 × 1200 — v4 วาด 16:9) อยู่กลางคอลัมน์ · ≥1024 กว้างขึ้นจนเส้น Alt text เสมอขอบล่างปุ่ม Save (วัดด้วย JS → `--cover-w`, ไม่ต่ำกว่า 560 ไม่เกินคอลัมน์) — project คอลัมน์ซ้ายสูงกว่า เลยเต็มคอลัมน์แล้วยังไม่ถึง (เจ้าของ, 2 ต.ค. 69) · <1024 กว้างไม่เกิน 560
- รูปแตก (เช็ก 1 ต.ค. 69): รูป fixtures กว้างแค่ 736–1200px แต่ cover โชว์ถึง 1680 และรูปในเนื้อหาใช้ `<img>` ไฟล์ต้นฉบับตรง ๆ (คอลัมน์ 880 บนจอ 2× ต้องการ 1760) → แก้ใน 5.4: อัปโหลดแล้วย่อเป็น webp เอง + ขนาดที่ต้องการชัด ๆ

## ตัวแก้ข้อความ (WRITE) — Tiptap (เจ้าของเลือก 1 ต.ค. 69)

- แนะนำ Tiptap (ProseMirror) + แปลง markdown เอง: React node view ทำ block รูป / code / carousel ได้, ecosystem ใหญ่
- ทางอื่น: Milkdown (ใช้ remark เหมือน renderer เรา แต่คนใช้น้อยกว่า), เขียน contenteditable เอง (ไม่แนะนำ: เปราะ)
- ไม่ว่าแบบไหน: syntax ของเราเอง (`<!-- two 4:5 -->`, ```` ```ts search.ts ````, `attach`, `> [!NOTE]`) ต้องเขียนตัวแปลงเอง

## 5.3g Preview (2 ต.ค. 69)

- ปุ่ม Preview อยู่แถวเดียวกับ Save / Reset (เจ้าของ: กดบ่อย ไม่ควรอยู่ข้าง Unpublish) · ทั้งโพสต์ใหม่ / draft / published · View live ยังอยู่บนหัว
- ปิดได้ 5 ทาง ไปทางเดียวกัน: Close · Esc · Back to Blog / Projects · ปุ่ม back ของ browser (เปิด Preview = push history) · มือถือ**ปัดขวาจากตรงไหนก็ได้** (ท่า back ของ Safari ต้องชิดขอบ — อันนี้สะดวกกว่า, เจ้าของเลือก 2 ต.ค. 69 หลังลองลากลงแล้วไม่เอา) · ไม่นับจากขอบซ้าย 30px (ของ Safari) / สารบัญ / carousel / โค้ด / ตาราง · เกิน 1/3 จอหรือสะบัด = เลื่อนออกขวาแล้วปิด ไม่ถึง = เด้งกลับ · มีแค่ใน Preview · ระหว่างปัด html/body `overflow-x: clip` (ไม่งั้น iOS ซูมออกให้เห็นทั้งหน้า เพราะหน้าโผล่เกินขอบจอ) ปล่อยแล้วเอาออก
- **หน้าซ้อนในแท็บเดิม** (เจ้าของเลือก): Editor ซ่อนไว้ (ทุกอย่างที่พิมพ์ยังอยู่) · Preview เริ่มบนสุด · Close / Esc กลับที่เดิม (scroll เดิม)
- ใช้ component ชุดเดียวกับหน้า 04 / 04B: PostHeader + PostBody + ContentsRail (+ ProjectEnd สำหรับ project)
- แสดงสิ่งที่อยู่ใน Editor ตอนนั้น รวมที่ยังไม่ save · ปกที่รอ save โชว์จาก memory (`coverUrl`)
- เปิด = เลื่อนเข้าจากขวาทับ Editor (Editor ยังเห็นข้างใต้ระหว่างเลื่อน) 0.36s · เข้าที่แล้วค่อยซ่อน Editor + เลื่อนหน้าไปบนสุดในเฟรมเดียวกัน (เดิมสลับทันที = กะพริบ, เจ้าของ 2 ต.ค. 69) · สารบัญวางหลังเลื่อนเข้าเสร็จ
- ไม่มี rise-in (admin ไม่มี RevealObserver) · ลิงก์ภายในเว็บ (Back to Blog ฯลฯ) กดแล้วไม่ไปไหน กันหลุดจาก Editor · ลิงก์ออกนอก + สารบัญใช้ได้
- (แผนเดิม `/preview/[slug]` แยกหน้า ไม่ทำ)

## 5.3d WRITE — รอบ 1 (2 ต.ค. 69)

- Tiptap 3 (`@tiptap/react` + starter-kit + code-block) · `components/editor/WriteBox.tsx`
- เปิด Editor = WRITE ก่อน (v4) · สลับ RAW .MD ได้ ข้อความเดียวกัน
- แปลง .md ↔ เอกสาร Tiptap เอง: `lib/richtext.ts` (mdast อ่าน / เขียน — ตัวเดียวกับที่หน้าเว็บใช้อ่าน)
  - ทุก block จำ markdown ต้นฉบับ (`src`) → block ที่ไม่ได้แก้ เขียนกลับตามเดิมทุกตัวอักษร · แก้ย่อหน้าเดียว .md เปลี่ยนบรรทัดเดียว (ทดสอบแล้ว)
  - ที่ WRITE ยังแก้ไม่ได้ (รูป + layout, ตาราง, YouTube, HTML) = block `raw` โชว์แบบหน้าเว็บ ป้าย "edit in Raw .md for now" · เขียนกลับไม่แตะ → 5.3e
  - `npm run check-richtext [-- ../blog-content/posts]` = เปิดแล้วเขียนกลับทุกโพสต์ · ตอนนี้ fixtures 36/36 + repo จริง 2/2 ตรงทุกไบต์
- พิมพ์ markdown แล้วเป็นรูปแบบทันที (แบบ Obsidian): `## ` `### ` `> ` `[!NOTE] ` `- ` `1. ` ```` ``` ```` (+ ภาษา) `---` `**ตัวหนา**` `*เอียง*` `` `โค้ด` ``
- Toolbar ตาม v4 (34px, เทา, ดำเมื่อ caret อยู่ในรูปแบบนั้น — เฉพาะตอนพิมพ์อยู่) · tooltip ชื่อ · ปุ่มลัด (useHoverTip เดียวกับ admin)
  - T ⌥⌘0 · B ⌘B · I ⌘I · H2 ⌥⌘2 · H3 ⌥⌘3 · Quote ⇧⌘. · Note ⌥⌘N · Code ⌘E (เลือกคำ = inline, ไม่เลือก = code block)
  - Link / Image / Clip / YouTube ยังกดไม่ได้ (รอบหน้า / 5.3e)
- กรอบโค้ด: แถบเทาแบบ 04 · ชี้ที่แถบ = แก้ info ของ fence ได้ (`ts title="search.ts"`)
- ⌘U (ขีดเส้นใต้) ปิด — markdown ไม่มี
- Toolbar บรรทัดเดียว ไม่ตัดบรรทัด เกินจอ = เลื่อนข้าง (ไม่มี scrollbar) · มือถือแยกบรรทัดใต้ WRITE / RAW (เจ้าของ: ตัด 3 บรรทัดน่าเกลียด)
- **มือถือ (<768): แบบ Gmail** (เจ้าของเลือก 2 ต.ค. 69 — ลองมาแล้ว: แถบเหนือคีย์บอร์ดติดขอบ / บนสุดตอนคีย์บอร์ดขึ้น / บรรทัดที่สองถาวร)
  - แถว: WRITE / RAW · Preview ชิดขวา · ปุ่มกลม **Aa** · ไม่มีแถบเครื่องมือในแถว
  - แตะ Aa = แถบมนลอยเหนือคีย์บอร์ด 10px (`visualViewport`) + ปุ่ม ✕ กลมแยก · ปุ่มที่ยังไม่เสร็จไม่โผล่ · ปัดข้างได้ · คีย์บอร์ดหาย = แถบหาย
  - แตะปุ่ม = ทำงานตอน touchend + ยกเลิก click → คีย์บอร์ดไม่หุบ (`useTapKeepsFocus`) · ระวังใส่ hook ซ้อนสองชั้น = กดครั้งเดียวทำงานสองครั้ง (H3 กลับเป็นย่อหน้า)
  - iPad (≥768) = แถวเดียวกับ WRITE / RAW แบบคอม
- **Undo ↶ / Redo ↷** ท้ายแถบเครื่องมือ (⌘Z / ⇧⌘Z) — เทาเมื่อไม่มีให้ย้อน · อยู่ในแถบลอยของมือถือด้วย
- ปุ่ม Preview ข้าง WRITE / RAW .MD เส้นใต้เข้มแบบ View live (เจ้าของ: กดบ่อย อยู่ใกล้ที่เขียน) · ปุ่มเดิมแถว Save ยังอยู่
- แถว WRITE / RAW ขึ้นไปชนแถบบน = ดันแถบบนออกจนเหลือแถบเดียว (เจ้าของ, 2 ต.ค. 69) · **CSS ล้วน**: แถบบน sticky อยู่ใน `.head` (หัว + ช่องกรอก + Commit row + ช่องว่าง 48px) — พ้นท้าย `.head` แถบบนก็ถูกดันขึ้นเอง · แถว WRITE / RAW sticky top 0 · (ลองแบบ JS ตอน scroll ก่อน — บน iPhone สะดุด)
- Cover ไม่ขยายตอนเปิด Tags › Manage แล้ว (ไม่นับความสูงของ panel ที่เปิดชั่วคราว)
- ป้าย "next save" ใน Commit ล้นจอ 390 ไป 19px → ตัดลงบรรทัดใหม่ได้

## 5.3d — รอบ 2 (2 ต.ค. 69) · `WriteMenus.tsx`
- **Link** (ปุ่ม Link · ⌘K · แถบลอย · คลิกลิงก์ในข้อความ = แก้ / Remove link)
  - ช่อง Text (ค่าเริ่ม = คำที่เลือก) + To · พิมพ์คำ = ค้นโพสต์ที่ publish แล้ว ↑↓ Enter → `/posts/<code>` · วาง URL = ลิงก์ออกนอก
  - รายชื่อโพสต์ส่งมาจาก `admin/posts/[slug]/page.tsx` (`targets`)
- **แถบลอยสีดำ** เหนือคำที่เลือก: B · I · Code · Link — เฉพาะเมาส์ (iPhone มีเมนูเลือกข้อความของตัวเอง) · ไม่โผล่ระหว่างลากเลือก
- **เมนู `/`** ต้นบรรทัดหรือหลังเว้นวรรค · พิมพ์กรอง · ↑↓ Enter / Tab · Esc ปิด (ไม่เด้งซ้ำที่ `/` เดิม)
  - Heading · Subheading · Code block · Quote · Numbered list · Bullet list · Note · Divider · Output (กรอบ output ต่อใต้โค้ด) · Table (แทรกตารางตั้งต้น แก้ใน Raw ไปก่อน)
  - Image · Two images · Carousel · Clip · YouTube = เทา รอ 5.3e
- ทดสอบใน Chrome: `/ta` Enter = ตาราง · ดับเบิลคลิกคำ = แถบลอย · ⌘K พิมพ์ "debo" Enter = `[world](/posts/l6e54q4l)`

- **ตาราง แก้ใน WRITE ได้จริง** (เจ้าของไม่ใช้ RAW): ปุ่ม Table ใน toolbar (แยกเส้นเฉพาะ Image · Clip · YouTube) + `/table` · Tab ไปช่องถัดไป · caret ในตาราง = แถบใต้ตาราง + Row · + Column · − Row · − Column · Delete table
  - `@tiptap/extension-table` · ช่องละหนึ่งย่อหน้า (ตาราง markdown ช่องละบรรทัด) · หน้าตาแบบ 04
  - richtext: ตาราง gfm ↔ table (เก็บ align) · fixtures ยัง 36/36 ตรงทุกไบต์ · ตารางที่มีของแปลกในช่อง (รูป) ยังเป็น raw
- **Code + Output ติดกัน**: ปุ่ม "+ Output" บนแถบเทาของกรอบโค้ด = ใส่กรอบ Output ต่อใต้ (ติดกันไม่มีช่อง เหมือนหน้าเว็บ — กรอบโค้ดสองอันติดกันจะต่อกันเสมอ) · หรือ `/output`
- Preview ข้าง WRITE / RAW: เส้นใต้จาง เข้มตอน hover

- **สารบัญด้านขวาใน WRITE** (ปิด 5.3d): ContentsRail ตัวเดียวกับหน้า 04 · `live` = อ่านหัวข้อใหม่เมื่อข้อความเปลี่ยน (MutationObserver) · `ends={false}` = ไม่มี Title / End · H2 = 01, H3 = 02.1
  - หัวข้อใน WRITE ได้ id จากคำ (`w-` + headingId) ด้วย decoration — ไม่เขียนลง .md
  - กดหัวข้อ = เลื่อนไป (หัวข้ออยู่ 96px ใต้ขอบบน พ้นแถว sticky) + กะพริบเทา + caret ท้ายหัวข้อ (คอมเท่านั้น — มือถือคีย์บอร์ดจะเด้ง)
  - มือถือ (<768) ไม่มีสารบัญใน WRITE: ขอบขวาเป็นที่นิ้วพิมพ์
  - ทดสอบ: พิมพ์ `## Brand new section` แล้วสารบัญขึ้น "05 Brand new section" ทันที · กด 02.1 แล้วหัวข้อมาอยู่ที่ 96px พร้อม caret

## WRITE (5.3d) — จดไว้
- แทรกรูป / code / note / YouTube / ตาราง ด้วยเมนู `/` ตรงที่พิมพ์ (เจ้าของ, 2 ต.ค. 69: ปุ่มบนสุดต้องเลื่อนขึ้นไปทุกครั้ง ไม่ work)
- พิมพ์ markdown แล้วกลายเป็นรูปแบบทันทีแบบ Obsidian live preview

## 5.3e — รอบ 1: block รูป (2 ต.ค. 69) · `WriteFigure.tsx`
- richtext: ย่อหน้าที่มีรูปเดียว = figure single · comment layout + รูป = figure (two / carousel / fit height / full + ratio) · เขียนกลับตามที่ PostBody อ่าน (`figureMd`) · fixtures ยัง 36/36 ตรงทุกไบต์ · เหลือ raw แค่ YouTube
- กล่อง IMAGE / CAROUSEL ตาม v4: รูปตาม layout + ปุ่ม Replace / Remove บนรูป · SINGLE · TWO · CAROUSEL + ตัวเลือก (Fit W / Fit H / Full · 4:5 / 16:10) + คำแนะนำขนาดอัปโหลด · ต่อรูป: File (ตั้งชื่อได้ตอนยังไม่ Save) · Alt text · Caption (serif)
- ใส่รูป: ปุ่ม Image · ⇧⌘I · `/image` `/two` `/carousel` · ลากวาง · paste — หลายรูปพร้อมกัน = carousel · อัปโหลด = ทำ WebP รอ Save แบบปก (`upload:<key>`)
- Remove รูปสุดท้าย = ลบทั้ง block
- ปุ่ม SINGLE / TWO มองไม่เห็นใน block → ป้ายของ Segmented วาดแบบ difference ต้องมีพื้นกระดาษใน group (`isolation: isolate`)
- iPhone: ทดสอบใน Chrome จำลองแล้ว (Aa → H3 → Undo → ✕) — ต้องลองบนเครื่องจริง

## 5.3e — รอบ 2 (2 ต.ค. 69 ค่ำ)
- **YouTube block** (`WriteYouTube.tsx`): poster จาก i.ytimg.com + ช่อง Link / Caption / Duration · ใส่ด้วยปุ่ม YouTube · ⇧⌘Y · `/youtube` · **วางลิงก์ YouTube บนบรรทัดว่าง** · .md = `[caption](link "3:32")` · ตอนนี้ทุก block ในทุกโพสต์แก้ใน WRITE ได้ (raw 0)
- **ลบ block แบบกดค้าง + Undo** (`BlockBar`): กดที่ block (รูป / YouTube / divider) = เลือก ขอบดำ + แถบดำล่างจอ "Image selected · Esc to deselect · × Hold to delete" · กดค้าง 0.9s แดงไหลเต็มแล้วลบ · ปล่อยก่อน = ไหลกลับ · ชี้ที่ปุ่ม = ขอบ block แดง · ลบแล้ว toast "Image removed · Undo ⌘Z" 8s (แก้อะไรต่อ toast หาย)
- **Undo ↶ / Redo ↷** ในแถบเครื่องมือ
- ทดสอบใน Chrome: เลือก YouTube → กดค้าง → ลบ (6→5 block) → Undo (กลับมา 6)

## 5.3e — ยังเหลือ
- Clip (Vercel Blob — ดู memory: lazy-load + poster)
- **iPhone: ปุ่ม URL ของ Safari (ตุ่ม `blog-2026-vercel.vercel.app`) + แถบ ^ ˅ ✓ ลอยเหนือคีย์บอร์ดบนเว็บจริงด้วย** → แถบ Aa ลอยอยู่เหนือตุ่มพวกนี้ · ต้องหาทาง (เจ้าของ, 2 ต.ค. 69) — ลองวัดบนเครื่องจริงก่อน (ใช้ตัวบันทึกแบบสารบัญ iPad)
- ข้อเสนอที่ยังไม่ได้ตอบ: ปุ่ม "ออกจากโค้ด ↓" บนแถบเทา · ช่องชื่อไฟล์ของโค้ดโชว์ตลอด

## Footer ท้ายหน้า Editor (2 ต.ค. 69)
- แถบดำแบบแถบ repo ของ hub (v4 07): ไฟล์ · `live · /posts/<code>` / `draft · not on the site` / `not saved yet` · last commit (ข้อความ) — หน้าเลยมีจุดจบ (เจ้าของ)

## iPhone: ปุ่ม URL ของ Safari ลอยเหนือคีย์บอร์ด (2 ต.ค. 69)
- แถบ URL + ^ ˅ ✓ เป็นของ Safari — หน้าเว็บสั่งซ่อนไม่ได้ · แถบ Aa เลยต้องลอยเหนือมัน (visualViewport ไม่รวมพื้นที่นั้น)
- ลองทำให้ admin ติดตั้งเป็นแอปบนหน้าจอโฮม (ไม่มีแถบ URL) — เจ้าของไม่เอา (ไม่อยาก Add to Home Screen) → เอาออกแล้ว
- เมนู Format (B I U) ที่ Gmail บนเว็บใช้ = เมนูของ iOS เอง ไม่ใช่ของ Gmail · เจ้าของไม่เอา (มีแค่ B I U)
- **ใช้: แถบ Aa + ✕ เป็นกระจกโปร่งแบบปุ่มของ Safari** (blur + เส้นบาง + เงานุ่ม) — ซ้อนกับปุ่ม URL และ ^ ˅ ✓ แล้วดูเป็นชุดเดียวกัน (เจ้าของ, 2 ต.ค. 69)
- ลองปุ่ม Aa ลอยมุมขวาล่าง (กางเป็นแถบ) — เจ้าของเห็นว่าแบบแถบบนสุดบนเว็บจริงใช้ดีกว่า
- **ใช้ (2 ต.ค. 69 ดึก): แถบเครื่องมือติดบนสุดของจอตอนคีย์บอร์ดขึ้น** (`KeyboardTop`, ตาม `visualViewport.offsetTop`) กระจกโปร่งเต็มกว้าง · ⌄ ซ่อนคีย์บอร์ด · ระหว่างนั้น**แถว WRITE / RAW หลบ** (`html[data-keys]` → visibility hidden บนมือถือ) แก้ที่สองแถบตีกัน
