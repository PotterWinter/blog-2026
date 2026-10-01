# ข้อมูลบทความ: อ่านจากไหน · index.json · cache (ขั้น 4)

ตกลงไว้ตั้งแต่ขั้น 0 (แชท "สรุปการตัดสินใจ", 29 ก.ย. 69)

- Git เป็น DB · content repo แยก (`PotterWinter/blog-content-2026`, private)
- อ่าน: GitHub API + cache มีอายุ (TTL) · เขียน (ขั้น 5): commit ผ่าน API แล้ว `revalidatePath` / `revalidateTag` ทันที — ไม่ใช้ webhook / rebuild ทุก push
- Token: fine-grained PAT เฉพาะ content repo

---

## อ่านจากไหน (`src/lib/content.ts`)

- **ตั้ง `CONTENT_DIR`** → อ่านโฟลเดอร์ในเครื่อง
  - dev ตั้งไว้ใน `.env.development` = `fixtures/content`
  - รายการบทความสร้างจาก .md ทุกไฟล์สดๆ (`buildIndex`) ไม่ต้องมี index.json
- **ไม่ตั้ง** → อ่าน GitHub (`CONTENT_REPO`, `CONTENT_BRANCH`, `GITHUB_TOKEN`)
  - `GET /repos/{repo}/contents/{file}` + `Accept: application/vnd.github.raw+json` → ได้ไฟล์ดิบ (ข้อความหรือรูป)
  - 404 = ไม่มีไฟล์ · error อื่น = throw พร้อมชื่อไฟล์
  - `CONTENT_REPO` มีค่าตั้งต้นในโค้ด = `PotterWinter/blog-content-2026` (ไม่ใช่ความลับ) · ตั้งบน Vercel ไว้ด้วย ย้าย repo แก้ที่ Vercel ได้
  - ตัวแปรบน Vercel อยู่ที่ Settings › Environments › Production › Environment Variables (UI ใหม่)
  - token ไม่มีสิทธิ์ / repo ผิด = GitHub ตอบ 404 → เว็บว่างเฉยๆ ไม่ error (เคยเจอตอนลืมตั้ง `CONTENT_REPO`)
- ตัวแปรทั้งหมดอยู่ใน `.env.example`

## Cache

- ทุก fetch: `next: { revalidate: 3600, tags: ["content", …] }` (`CONTENT_TTL`)
  - tag: `index` · `post:<slug>` · `media`
  - ขั้น 5 เซฟแล้วสั่ง `revalidateTag("content")` → ของใหม่ขึ้นทันที · 1 ชั่วโมงมีผลแค่ตอนแก้นอก admin
- รูป `/media/…`: browser เก็บ 1 วัน (`max-age=86400, stale-while-revalidate=604800`)
- dev ไม่ cache หน้า (Next render ใหม่ทุกครั้ง)

## index.json (ที่ root ของ content repo)

```json
{ "nextId": 37, "posts": [ { …frontmatter ทุกช่อง…, "createdAt", "revisions", "words", "readMinutes" } ] }
```

- หน้ารายการโหลดไฟล์เดียว ไม่ยิง API ทีละบทความ (36 เรื่อง ≈ 24KB)
- `nextId` = id ของบทความใหม่ ไม่ลดลงแม้ลบบทความ → id ไม่ถูกใช้ซ้ำ
- `createdAt` / `revisions` จาก git log (commit แรก / จำนวน commit ของไฟล์) · ไม่ใช่ git repo = วันเผยแพร่ / 1
- `words` นับด้วย `Intl.Segmenter` (ตัดคำไทยได้) · `readMinutes` = words / 220 (อย่างน้อย 1)
  - หน้าบทความใช้ตัวนับเดียวกัน (`src/lib/words.ts`)
- ขั้น 5: admin เขียน .md กับ index.json ใน commit เดียวกัน
- ซ่อม / สร้างใหม่จาก .md ทั้งหมด:

```bash
npm run rebuild-index -- ../blog-content
```

- ต้องใช้ Node 22 (`nvm use` — มี `.nvmrc`) · script ใช้ `src/lib/schema.ts` ตัวเดียวกับเว็บ
  - ไฟล์ผิด schema หรือ id ซ้ำ = หยุดพร้อมบอกชื่อไฟล์

## เลข No. (ตัดสินใจ 1 ต.ค. 69 · ทำใน 5.3)

- แยกเป็น 2 ค่า:
  - `id` — primary key: อยู่ใน frontmatter ของ .md แล้ว (`id: 26`), ได้ตอนสร้าง (draft ก็มี) จาก `nextId` · กระโดดได้ ไม่ใช้ซ้ำ · ไม่โชว์ผู้อ่าน
  - `no` — เลขที่ผู้อ่านเห็น เก็บใน frontmatter เหมือนกัน (`no: 12`) · **นับแยกต่อ section** (blog 001, 002… · project นับของตัวเอง, admin โชว์ P01…) → เลข blog ไม่กระโดดเพราะ project
- `no` ได้ตอน **publish ครั้งแรก** = เลขสูงสุดใน section + 1 → publish ใหม่ = เลขใหม่เสมอ, เลขเรียงตรงกับวันที่
  - draft ยังไม่มี `no` (admin โชว์ "—", อยู่บนสุดของลำดับเริ่มต้น เรียงตามวันสร้าง)
  - แก้บทความ = เลขและวันที่ไม่เปลี่ยน ไม่ขยับตำแหน่ง
  - unpublish แล้ว publish ใหม่ = ได้เลขเดิม (ไม่ออกเลขใหม่)
- ไม่ย้ายงานจากพอร์ตเก่า: เจ้าของเขียนใหม่ผ่าน admin ทั้งหมด → ทุกเลขมาจาก publish
- เผื่อย้ายไป homelab database (อนาคต):
  - .md คือต้นฉบับ (frontmatter มี `id`, `no` ครบ) · `index.json` สร้างใหม่จาก .md ได้เสมอ → ย้าย = อ่าน .md ทุกไฟล์แล้ว insert
  - ตาราง: `id` = primary key · `(section, no)` = unique (no ว่างได้สำหรับ draft) · ออกเลข = `max(no) + 1` ใน transaction
  - ตอนนี้ (git) กันออกเลขชนด้วย sha ของ `index.json`: commit ซ้อน = 409 → อ่านใหม่แล้วลองอีกที
- ลำดับ: ผู้อ่าน = วันที่ใหม่สุดก่อน · admin = draft ก่อน (สร้างใหม่สุดก่อน) แล้วที่ publish ล่าสุด (blog / project นับเลขแยก → ข้าม section เรียงตามวันที่ publish)
- ทำแล้ว (5.3a): `no` ใน frontmatter + `PostMeta` · ไม่มี `no` แต่ published = ใช้ `id` (hello-world ใน repo จริง, index.json เก่า) · `(section, no)` ซ้ำ = buildIndex หยุด · แสดงด้วย `postNo()` (`012`, admin `P01`, draft `—`)

## โค้ด

- `src/lib/schema.ts` — ชนิดข้อมูล, ตรวจ frontmatter, `buildIndex` (ไม่มี import ฝั่ง server ใช้ใน script ได้)
- `src/lib/words.ts` — นับคำ
- `src/lib/content.ts` — `getPosts` (จาก index) · `getPost` (.md) · `getMedia` (รูป)
- `scripts/rebuild-index.ts`
- `tsconfig`: `allowImportingTsExtensions` (Node รัน .ts ต้อง import พร้อมนามสกุล)

## ข้อควรรู้

- `path.resolve(/*turbopackIgnore: true*/ …)` — ไม่งั้น Turbopack แพ็กทั้งโปรเจกต์ (fixtures, รูป) ไปกับ server function
- GitHub ไม่ใส่ token จำกัด 60 ครั้ง/ชม. · ใส่ token 5,000 ครั้ง/ชม. (cache ทำให้ใช้น้อยอยู่แล้ว)
