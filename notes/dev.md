# ข้อควรรู้ตอน dev และการทดสอบ

---

## รัน dev server

- เปิดผ่าน `localhost:3000`
- เปิดจาก IP (ทดสอบบนมือถือ): ต้องใส่ IP ใน `allowedDevOrigins` ของ `next.config.ts` แล้วรีสตาร์ท dev server ไม่งั้น JS ไม่ทำงาน
  - ตอนนี้ใส่ `192.168.1.35` ไว้ · iPhone ต่อผ่าน `http://192.168.1.35:3000`
- เปลี่ยนหน้าค้างเกิน 8 วินาที → PageTransition โหลดหน้าเต็มให้เอง (กันค้างที่ 90% ตอน dev rebuild)
- Node ในเครื่องมีหลายเวอร์ชัน (nvm) — lint ต้องใช้ Node 22
  - `export PATH=~/.nvm/versions/node/v22.13.1/bin:$PATH` ก่อน `npx eslint` / `npx tsc`

---

## วัดดีไซน์ v4 ก่อนเขียนทุกครั้ง

- `python3 -m http.server` ในโฟลเดอร์ `design/` แล้วเปิดใน browser วัด `getBoundingClientRect`
- v4 บางจุดได้หน้าตาจากการคำนวณของ browser ไม่ใช่เลขในโค้ด
- ใน v4 แต่ละหน้ามีหลายขนาดใน `section[data-col="…"]` (`data-bp` = 1024 / 768 / 390, ไม่มี = 1280)

---

## ทดสอบ

### Chrome headless ผ่าน CDP — ดีที่สุดสำหรับแอนิเมชันและมือถือ

- Browser pane ของแอปมักถูกซ่อน (rAF 0 เฟรม, transition / scroll event ไม่ทำงาน)
- Node 22 มี `WebSocket` + `fetch` ในตัว เขียนสคริปต์คุม Chrome ได้เลย
- `Emulation.setDeviceMetricsOverride` + `Emulation.setTouchEmulationEnabled` = จำลองมือถือ (`pointer: coarse`)
- `Input.dispatchTouchEvent` / `Input.dispatchMouseEvent` = แตะ ลาก เมาส์จริง
- วัดตำแหน่งทุกเฟรมด้วย rAF ได้ · `Page.captureScreenshot` (ไม่ใส่ clip แล้วค่อยครอปด้วย `sips`)
- headless มี scrollbar กินที่ 15px (เหมือน Windows) — ตัวเลขความกว้างจะน้อยกว่า Mac

### Safari

- เปิด Safari › Develop › Allow Remote Automation แล้วใช้ `safaridriver`
  - ถ้ากดหยุด automation ในหน้าต่างสีส้ม สวิตช์จะถูกปิด ต้องเปิดใหม่
- สคริปต์ Python ส่ง WebDriver actions ได้ (คลิก ขยับเมาส์)
  - ใช้ `scrollIntoView({behavior: 'instant'})` — html ตั้ง smooth ไว้ พิกัดจะผิด
  - บางหน้า pointer event จาก safaridriver ไม่ถึงหน้า (hover ปุ่มลิงก์ 04B) → ให้เจ้าของลองเอง
- Safari แสดง CSS เก่าค้างบ่อย: `Cmd + Option + E` แล้ว `Cmd + R`

### iPhone จริง

- ทดสอบจากเครื่องไม่ได้ (ไม่มี iOS Simulator) — จำลอง touch ใน Chrome ได้แค่ลอจิก
- ถ้าต้อง debug บน iPhone: ทำ route POST ชั่วคราวที่ append ลงไฟล์ + `navigator.sendBeacon` ใน handler
  - ให้เจ้าของลองหนึ่งครั้งแล้วอ่าน log · ลบ route ก่อน commit
  - ใช้หา bug ลากสารบัญบน iPhone ได้ (30 ก.ย. 69)

### iPad จริง (ต่อสายกับ Mac)

- สำเนาโปรเจกต์ใน scratchpad รัน port 3001 → iPad เปิด `http://192.168.1.35:3001/...` (ต้องมี IP ใน `allowedDevOrigins`)
  - Turbopack ไม่รับ node_modules ที่เป็น symlink → copy เข้าไปจริง
- ตัวบันทึกทุกเฟรมในคอมโพเนนต์ + route POST ชั่วคราวเขียนไฟล์ · ส่งด้วย `fetch` ไม่ใช่ `sendBeacon` (beacon จำกัด 64 KB ข้อมูลลากหาย)
- เจ้าของลาก + อัดจอ แล้วอ่าน log — ใช้หาสาเหตุสารบัญ iPad ได้ (2 ต.ค. 69)
- Safari บน iPad: UA เป็น Macintosh · `screenY` นับรวมการเลื่อนหน้า

