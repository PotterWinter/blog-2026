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

### 3.2 หน้า 01 Blog home
- [x] 3.2a Data layer `src/lib/content.ts` (อ่าน .md + ตรวจ schema) · fixtures 30 เรื่องใน `fixtures/content` (`.env.development` ชี้ไปที่นี่)
- [x] 3.2b Hero (flow < 1024 · แถวเดียว 1024–1279 · 3 คอลัมน์ ≥ 1280) · reveal on scroll (`data-reveal`, `RevealObserver`)
- [x] 3.2c แถบกรองหมวด + travel dot แยกเป็น `travel-dot/useTravelDot` ใช้ร่วมกับ nav · `/?category=`
- [x] 3.2d Grid การ์ด 3/2/1 คอลัมน์ + pager (`/?page=`) · `/media/...` route · กดหน้าเดิม = reset ทุกอย่าง (`PageSlot`)
- [x] 3.2d-2 (บางส่วน) animation เปลี่ยนหน้า: การ์ดออก 180ms → เข้า 220ms (stagger 34ms) → จุดลงจอด 450ms → เลื่อนกลับแถบกรองด้วย `glideTo` (เขียนเอง 640–1400ms ตามระยะ)
- [ ] 3.2d-2 ที่เหลือ: จุดวิ่งบนการ์ด, เคอร์เซอร์ VIEW
- [x] 3.2e-1 Tags panel (`Filters.tsx`), ช่องค้นหา + แผงผลลัพธ์ (`SearchPanel.tsx`, ≥1024) · URL `?category= &tags=a,b &q= &page=`
- [x] 3.2e-2 ปุ่ม GRID / LIST (`ViewToggle` ใน `Filters.tsx`) + มุมมองรายการ 01B (`PostList.tsx`) · `?view=list`
  - คอลัมน์: ≥1280 NO 52 · Title · Category 110 · Tags 190 · Date 90 / 1024: 44 · 1fr · 100 · 150 · 80 / 768: NO · Title (+หมวด, tags ใต้ชื่อ) · Date / 390: Title (+หมวด, tags, วันที่ใต้ชื่อ)
  - hover (เมาส์ ≥768): แถวอื่นจาง .65 · จุด 8px แทนเลข NO วิ่งตามแถวแบบสปริง · แผงพรีวิว 224px ที่ 60% ของคอลัมน์ Title (รูปเลื่อนแบบสปริง, excerpt blur 110/260ms)
  - สลับ GRID ↔ LIST: pill เลื่อน 390ms · โพสต์ชุดเดิมออก/เข้าแบบเดียวกับเปลี่ยนหน้า (`--dir: 0` ไม่เลื่อนข้าง) · CSS เปลี่ยนหน้าย้ายไป `globals.css` (`[data-swap]`) ใช้ร่วม grid/list
- [x] 3.2e-3 01B < 768: การ์ดติดขอบล่าง (sticky, 12px + safe-area) = รูป 220×110 + excerpt (serif 14px, blur swap แบบ desktop) · จุดอยู่ในขอบซ้าย
  - มือถือจริง (< 768 + `pointer: coarse`): เลือกตามการเลื่อน — แถวที่อยู่สูงกว่าขอบบนการ์ด 1 แถวเต็ม (เว้นให้อ่าน) · กันกระพริบ: ขอบแถวต้องเลยเส้น 8px (`HOLD`) ถึงเปลี่ยน · excerpt ในการ์ดสูงตามข้อความ 1–3 บรรทัด (ค่อยๆ ยืดหด 0.3s) แต่เส้นที่ใช้วัดคิดจากขอบล่างการ์ด − ความสูงการ์ดแบบ 1 บรรทัด (`CARD_MIN_H`) จึงไม่ขยับตามความสูงจริง (ถ้าขยับ = สลับแถวกลับไปมา) · แถวอื่นจาง .65 แบบ hover · เปลี่ยนแถว = สั่นเบาๆ เฉพาะ Android (`vibrate`; iOS ไม่มีทางให้เว็บสั่น ลอง `<input switch>` แล้วไม่ได้) · ระยะแถวที่เลือก→การ์ด 2 แถว (`GAP_ROWS`) · สุดรายการ: แถวสุดท้าย · 12px (`REST`) · การ์ด · 14px · pager · 4 แถวสุดท้ายก่อนการ์ดหยุด ระยะเว้นค่อยๆ หดเหลือ 0 (`CLOSE_ROWS`) ทุกแถวถึงถูกเลือกได้ · `HOLD` 8px แถวสุดท้ายถูกเลือกตอนการ์ดหยุด · คำนวณจาก offset ไม่ใช่กรอบที่วาด (reveal เลื่อนแถว 22px)
  - คอมหน้าต่างแคบ: การ์ดที่เดิม แต่ตาม hover แทน (ไม่ hover = ซ่อน) · ≥ 768 ใช้แผงข้างชื่อตาม v4
- [x] ~~3.2f Closing block "What this is"~~ ยกเลิก (30 ก.ย. 69) — รวมเนื้อหาเข้าคำอธิบายใน hero แทน
- [x] 3.2g 1024–1279 คำอธิบายครึ่งขวา (ขีดซ้าย = กลางจอ = กลางการ์ดใบกลาง, ไม่ชน "Korn.") · "Korn." อยู่กึ่งกลางช่องว่างระหว่าง "Hello, I am" กับคำอธิบาย (≥1280 กลับไปต้นคอลัมน์ตามเดิม) · 768–1023: "Korn." กึ่งกลางระหว่าง "Hello, I am" กับกลางจอ (span `.half` แทนครึ่งขวา) · มือถือ: "Korn." กึ่งกลางระหว่าง "Hello, I am" กับขอบขวา · คำอธิบายยังชิดหัว (ลองย้ายไปชิดแถวหมวดแล้วดูแปลก) · วลีห้ามตัด `.keep` (ended up / put together. / a notebook, / not a publication. / I finally understand why.) · ≥1280 คำอธิบายเริ่มที่ 532/1192 (คอลัมน์ 352/180/660: 3 บรรทัดเรียบตั้งแต่ ~1570, 4 บรรทัดต่ำกว่า · ลองเริ่มกลางการ์ดใบกลางแล้วบรรทัด 2 แหว่ง, ลอง justify แล้วช่องไฟคำกว้าง 28px ที่ 1680 — ไม่เอาทั้งคู่) ถึงขอบขวาหน้า (= ขอบขวา "About") ไม่จำกัด 584px แบบ v4 · ≥1280 ใช้ `text-wrap: pretty` (บรรทัดยาวชิดขวา) ต่ำกว่านั้น `balance` · ย่อหน้าเดียว · คำอธิบาย hero: "I graduated in architecture, ended up building software, and write here about how things are put together. This is a notebook, not a publication. Posts go up when something breaks and I finally understand why."

**ตัดสินใจเพิ่ม (29 ก.ย. 69) — ต่างจาก v4 ตามที่เจ้าของเลือก**
- กรอบกว้างสุด `--frame: 1680px` (v4 วาดที่ 1280) ตัวอักษรหยุดโตที่ 1280
- กดปุ่มที่พากลับหน้าเดิม (nav, โลโก้) = โหลดใหม่ + reset ตัวกรอง/หน้า + URL สะอาด
- เลขหมวดใช้ `src/lib/site.ts` ไปก่อน (ขั้น 5 ย้ายไป `site.json`)
- All มีตัวเลขท้าย (v4 ไม่มี) · ตัวเลขหลังหมวดยกสูงเสมอขอบบนตัวพิมพ์ใหญ่ (v4 ใช้ super)
- เส้นแถวของ grid ยาวเต็มแถวเสมอ (วาดจากการ์ดใบแรกของแถว) แม้แถวสุดท้ายไม่เต็ม
- Tag ที่ไม่มีในหมวดที่เลือก = สีจาง กดไม่ได้ · ตัวเลข tag นับในหมวดที่เลือก · เปลี่ยนหมวดแล้ว tag ที่ไม่มีถูกเอาออกเอง
- ค้นหา = กรอง grid + แผงผลลัพธ์ทุกรายการ (ชื่อที่ตรงขึ้นก่อน, ขีดเส้นใต้ทีละคำ) เห็นราว 6 แถวครึ่งแล้ว scroll ในแผง (↑↓ เลื่อนตาม) · แสดงทุกขนาด: <1024 กว้างเท่าช่องค้นหา, มือถือชื่อบรรทัดบน หมวด·วันที่บรรทัดล่าง, จอสัมผัสซ่อนแถบ ↑↓/↵/Esc (30 ก.ย. 69)
- "Tags +" บนมือถือ: wrapper ขึ้นแถวเอง ปุ่มกว้างเท่าตัวหนังสือ (เดิมกดได้ทั้งแถว) · เครื่องหมาย + เป็น em (16/2.4px ที่ 30px → 12.8/1.9px ที่ 24px)
- Footer แถวล่างบนมือถือ padding 6px (เดิม 20/16, สูง 84 → 60px)
- ช่องค้นหาบนจอสัมผัสใช้ตัว 16px (v4 14px) กัน iOS ซูมเข้าตอนแตะ
- แผงผลลัพธ์มีแถบ scroll ของเราเอง 2px (เส้นเทา + thumb ดำ) แสดงตลอดเมื่อรายการยาวเกิน ซ่อนแถบของ browser
- จอสัมผัส: แผงผลลัพธ์ไม่ปิดเมื่อคีย์บอร์ดหุบ · เลื่อนในแผง = หุบคีย์บอร์ดให้เอง · แตะนอกช่อง/แผง = ปิด · ความสูงรายการไม่เกินพื้นที่เหนือคีย์บอร์ด (`visualViewport`)
- เส้นแถว 01B < 768 เป็น 1px (.5px บน iPhone จางและบางตำแหน่งหาย)
- สปริง hover ของ 01B ไวกว่า v4 (`FOLLOW` .45/.45, `STRIP` .35/.5 ใน `PostList.tsx`) เจ้าของรู้สึกว่า v4 ตามเมาส์ช้า
- เลข NO ใน 01B = post id 3 หลัก (`030`) ให้ตรงกับรูปแบบ `#NNN` ใน commit message
- ช่องค้นหากว้าง 210px ที่ 1280 → 330px ที่ 1680
- Pager: จุดไถลโค้งต่ำ 12px / 410ms (ท่า `"slide"` ตาม v4) · ลูกศร SVG ข้าง PREV/NEXT เฉพาะมือถือ (v4 ไม่มี)
- มือถือจริง (< 480 **และ** จอสัมผัส `pointer: coarse`): 4 หมวดแถวเดียว (`space-between`, gap ขั้นต่ำ 14px, ตัวเลขลอยในช่องว่าง) · Tags ขึ้นแถวของตัวเอง
- นอกนั้น (≥ 480 หรือคอมที่ย่อหน้าต่างแคบ): หมวดเป็นแถวธรรมดาแบบ 768 (gap 20) · Tags อยู่แถวเดียวกัน ตกบรรทัดเองเมื่อที่ไม่พอ (30 ก.ย. 69 — เดิมใช้แบบมือถือถึง 767 แล้วยืดห่างเกินไป)
- 768–1023: ปุ่ม GRID/LIST ขึ้นไปอยู่ท้ายแถวหมวด ช่องค้นหาได้เต็มแถวล่าง (v4 วางคู่กับช่องค้นหา) · < 768 ยังอยู่ข้างช่องค้นหา · ≥ 1024 ตาม v4
- หมวดบนมือถือคง 24px: iPhone จริงไม่ตกแถว (Reading ตกแค่ตอนจำลองบนคอมที่มี scrollbar 15px ซึ่งตอนนี้ได้แถวธรรมดาแทนแล้ว)

**ข้อควรรู้ทางเทคนิคของ travel dot (`useTravelDot`)**
- กลุ่มชิดซ้าย vs ชิดขวา (pager) ทำนายตำแหน่งปลายทางต่างกัน — `restingPoint` อ่าน `justify-content` ของกลุ่มเอง
- ส่ง `layout` (เช่นรายการเลขหน้า) เมื่อ label ขยับได้โดยที่ active ไม่เปลี่ยน · ResizeObserver ใช้ `border-box`
- จุด 2 ชั้น: ชั้นนอกเดินทาง (transform) ชั้นใน `.ink` รับการกด (`scale`) — ห้ามใช้ `scale` บนชั้นนอก

### 3.3 หน้าอื่น
- [ ] 04 · 02 · 04B · 03 · 10

## ขั้น 4 · อ่านผ่าน GitHub API + cache

## ขั้น 5 · Login (05) → Admin (06–09)

## ขั้น 5.5 · ย้ายพอร์ตเก่า

- [ ] ย้ายเนื้อหา korn-natthanat.vercel.app → หน้า 02/03
- [ ] ปิดโปรเจกต์ Vercel เก่า 3 ตัว (เช็ก env vars ของ personal-blog-api ก่อน)
- [ ] ผูก korn-natthanat.vercel.app เข้ากับ blog-2026-vercel (เลือก Redirect old domain to new)

## ขั้น 6 · Dark mode

## ข้อควรรู้ตอน dev

- เปิดผ่าน `localhost:3000` · ถ้าเปิดจาก IP (เช่นทดสอบบนมือถือ) ต้องใส่ IP ใน `allowedDevOrigins` ของ `next.config.ts` แล้วรีสตาร์ท dev server ไม่งั้น JS ไม่ทำงาน
- ทดสอบ Safari อัตโนมัติ: Safari › Develop › Allow Remote Automation แล้วใช้ `safaridriver` (ถ้ากดหยุด automation ในหน้าต่างสีส้ม สวิตช์จะถูกปิด ต้องเปิดใหม่)
- วัดดีไซน์ v4 จริงก่อนเขียนทุกครั้ง: `python3 -m http.server` ในโฟลเดอร์ `design/` แล้วเปิดใน browser วัด `getBoundingClientRect` — v4 บางจุดได้หน้าตาจากการคำนวณของ browser ไม่ใช่เลขในโค้ด
- Safari แสดง CSS เก่าค้างบ่อยตอน dev: `Cmd + Option + E` แล้ว `Cmd + R`
- เปลี่ยนหน้าค้างเกิน 8 วินาที → PageTransition โหลดหน้าเต็มให้เอง (กันค้างที่ 90% ตอน dev rebuild)

## ตอนนี้อยู่

ขั้น 3.2d-2 ที่เหลือ: จุดวิ่งบนการ์ด, เคอร์เซอร์ VIEW
ถัดไป: หน้า 04 Post
