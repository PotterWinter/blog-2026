# ส่วนที่ใช้ร่วมทุกหน้า

Header · footer · nav · page transition · travel dot · จุดกลับสี

---

## Header + footer (3.1)

- Route group `(site)` มี layout ของตัวเอง
- `Header` sticky ใช้ร่วมกับหน้า login/admin ได้ (ด้านขวารับเป็น children)
- โลโก้: กรอบ 6.3em → 6.9em + ข้อความเลื่อน −4.076em
  - CSS ล้วน ค่า em วัดจาก Helvetica Neue
- `Footer`: 3 คอลัมน์ที่ ≥768 / ซ้อนเป็นแถวที่ 390
  - dot link hop
  - ลิงก์ LinkedIn / Behance / CV ยังเป็น `#`
- Back to top เลื่อนแบบ smooth
  - `data-scroll-behavior="smooth"` ให้ Next ปิด smooth ตอนเปลี่ยนหน้า
- Safari: คราบหาง g/j ตอน slot หด
  - แก้ด้วย `padding: 6px 0; margin: -6px 0` บนลิงก์ nav

### Nav (`SiteNav`) — travel dot

- slot 13px
- hop 330ms + settle 600ms (ค่าจริงจากแผงปรับค่าของ v4: hopHeight 76, squash .35)
- กดค้าง = จุดหด .62
- กดหน้าเดิม = boing
- Blog มีจุดบน `/` และ `/posts/…` · Project มีจุดบน `/project` และ `/project/…`

### Page transition

- แผ่น #e8e8e7 ขึ้นคลุมใต้ navbar → เปลี่ยน/โหลดหน้าใต้แผ่น → แผ่นเลื่อนกลับลง
- loader "Korn Natthanat ——— %"
- เปลี่ยนหน้าค้างเกิน 8 วินาที → โหลดหน้าเต็มให้เอง (กันค้างที่ 90% ตอน dev rebuild)

### Footer บนมือถือ

- แถวล่าง padding 6px (เดิม 20/16, สูง 84 → 60px)
- กลุ่ม Contact / Social / Résumé เตี้ยลง (30 ก.ย. 69)
  - เส้น → หัวข้อ 20px · หัวข้อ → ลิงก์ 4px · ใต้ลิงก์สุดท้าย 6px
  - พื้นที่แตะลิงก์ยัง 44px
  - footer ทั้งหมด 467 → 375px · ≥768 เหมือนเดิม
- หน้า About ไม่มีกลุ่ม Contact / Social / Résumé (ซ้ำกับส่วน Contact ของหน้า)
  - `Footer` เป็น client component อ่าน `usePathname()`

---

## ต่างจาก v4 (เจ้าของตัดสินใจ 29 ก.ย. 69)

- Page transition + loader — ไม่มีใน v4 (อ้างอิง dashdigital.studio)
  - กดหน้าเดิม = โหลดหน้าเดิมใหม่ + loader วิ่งอีกรอบ
- ยังไม่มี loader ตอนเปิดเว็บครั้งแรก (ช้าเกินสำหรับบล็อกอ่านเร็ว — ทำเพิ่มได้ถ้าต้องการ)
- กดค้าง: ตัวหนังสือไม่จม 1.5px (v4 จม) — จุดหดรอบจุดกึ่งกลางอย่างเดียว
- กรอบกว้างสุด `--frame: 1680px` (v4 วาดที่ 1280) · ตัวอักษรหยุดโตที่ 1280
- กดปุ่มที่พากลับหน้าเดิม (nav, โลโก้) = โหลดใหม่ + reset ตัวกรอง/หน้า + URL สะอาด

---

## Travel dot (`travel-dot/useTravelDot`) — ข้อควรรู้ทางเทคนิค

ใช้ร่วม: nav · แถบหมวด · pager

- กลุ่มชิดซ้าย กับกลุ่มชิดขวา (pager) ทำนายตำแหน่งปลายทางต่างกัน
  - `restingPoint` อ่าน `justify-content` ของกลุ่มเอง
- ส่ง `layout` (เช่นรายการเลขหน้า) เมื่อ label ขยับได้โดยที่ active ไม่เปลี่ยน
- ResizeObserver ใช้ `border-box`
- จุด 2 ชั้น: ชั้นนอกเดินทาง (transform) · ชั้นใน `.ink` รับการกด (`scale`)
  - ห้ามใช้ `scale` บนชั้นนอก

---

## จุดทุกตัวกลับสีบนของดำ (30 ก.ย. 69)

เจ้าของขอ: จุดที่วิ่งผ่านของสีดำ (รูปมืด, กรอบโค้ด) ให้ตรงที่ทับเป็นสีขาว

- วิธี: `mix-blend-mode: difference` + สีกลับด้าน
  - token ใน globals.css: `--ink-inverse` (#eeeeef = ขาว − ink) · `--line-inverse` (#232529 = ขาว − line)
  - บนกระดาษขาวออกมาเป็น `--ink` / `--line` พอดี
- จุดที่ใช้: จุดบนการ์ด (`PostGrid .dot`) · จุด 01B (`PostList .dot`) · จุดแถบหมวดและ pager (`Dot` ใส่ `data-blend`) · สารบัญ · จุดลิงก์ 04B
- **ยกเว้นจุดใน nav** (`<Dot solid />`)
  - header sticky เป็น stacking context ของตัวเอง → blend แล้วมองไม่เห็นเมื่อจุดลอยพ้น header
  - header พื้นขาวอยู่แล้ว ไม่มีทางทับของดำ
