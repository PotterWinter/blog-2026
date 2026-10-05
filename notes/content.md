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

- ฝั่งเขียน (`write.ts` › `readAt`) อ่านแบบ raw เหมือนกัน (5 ต.ค. 69) — เดิมเป็น JSON base64 ซึ่ง GitHub ส่งได้ไม่เกิน 1 MB → index.json (~0.7 KB/โพสต์) เกินที่ ~1,500 โพสต์แล้ว Save จะพัง · raw ได้ถึง 100 MB
- ขีดจำกัดถัดไป: Next.js ไม่ cache fetch ที่ใหญ่กว่า 2 MB (index.json ~3,000 โพสต์) · โฟลเดอร์ละ 1,000 ไฟล์ (contents) → ใช้ `git/trees?recursive=1` (100,000 ไฟล์ / 7 MB) · rate 5,000/ชม., 900 point/นาที, สร้าง content 80/นาที 500/ชม. · รายละเอียดในโพสต์ #5

## Cache

- ทุก fetch: `next: { revalidate: 3600, tags: ["content", …] }` (`CONTENT_TTL`)
  - tag: `index` · `post:<slug>` · `media`
  - ขั้น 5 เซฟแล้วสั่ง `revalidateTag("content")` → ของใหม่ขึ้นทันที · 1 ชั่วโมงมีผลแค่ตอนแก้นอก admin
- รูป `/media/…`: browser เก็บ 1 วัน (`max-age=86400, stale-while-revalidate=604800`)
- dev ไม่ cache หน้า (Next render ใหม่ทุกครั้ง)
- **cache แยกกันคนละเครื่อง** (เจอ 2 ต.ค. 69): เว็บจริงกับ dev ต่างคนต่างจำ · save ที่ไหนล้างแค่ cache ของที่นั่น
  - save บนเว็บจริง → dev (ชี้ repo จริง) เคยเห็นช้าสูงสุด 1 ชม. → แก้แล้ว: dev อ่าน GitHub ใหม่ทุก 10 วิ (`CONTENT_TTL`)
  - save จาก dev → เว็บจริงเคยเห็นช้าสูงสุด 1 ชม. → แก้แล้ว (เจ้าของเลือก ข): dev commit เสร็จเรียก `POST <เว็บจริง>/api/revalidate` (Bearer `REVALIDATE_SECRET`) ให้เว็บจริงล้าง index + โพสต์นั้น
    - ต้องมี `REVALIDATE_SECRET` ค่าเดียวกันทั้งใน `.env.development.local` และ Vercel (Production) · บนเว็บจริงไม่มีค่า = endpoint ปิด (503)
    - เรียกไม่สำเร็จ: save ยังสำเร็จ แต่ข้อความใต้ Publish เป็นสีแดงบอกว่า "shows within the hour"
    - เลือกแทนการลด cache เว็บจริงเหลือ 1 นาที (กิน resource ทุกนาทีที่มีคนเข้า)

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

## ชื่อไฟล์ (1 ต.ค. 69)

- `posts/037-<slug>.md` — id 3 หลักนำหน้า: เรียงตามลำดับที่สร้างใน GitHub / Finder / Obsidian · URL ยังเป็น `/posts/<slug>`
- index เก็บ `file` ของแต่ละโพสต์ · เปิดโพสต์ด้วย slug = หา file จาก index (ไม่มีใน index = ลอง `posts/<slug>.md`)
- slug ของไฟล์ = ชื่อไฟล์ตัด `<id>-` ที่ตรงกับ id ใน frontmatter (slug ที่ขึ้นต้นด้วยเลขเองไม่โดนตัด)
- ไฟล์เก่าไม่มีเลข (hello-world ใน repo จริง) ย้ายเป็นชื่อใหม่เองตอน save ครั้งถัดไป ใน commit เดียวกัน
- media แยกโฟลเดอร์ต่างหาก (ไม่ทำโฟลเดอร์ต่อโพสต์แบบ v4) · ชื่อรูปจะมี id นำหน้าเหมือนกัน — ทำใน 5.4

## โค้ด

- `src/lib/schema.ts` — ชนิดข้อมูล, ตรวจ frontmatter, `buildIndex` (ไม่มี import ฝั่ง server ใช้ใน script ได้)
- `src/lib/words.ts` — นับคำ
- `src/lib/content.ts` — `getPosts` (จาก index) · `getPost` (.md) · `getMedia` (รูป)
- `scripts/rebuild-index.ts`
- `tsconfig`: `allowImportingTsExtensions` (Node รัน .ts ต้อง import พร้อมนามสกุล)

## ข้อควรรู้

- `path.resolve(/*turbopackIgnore: true*/ …)` — ไม่งั้น Turbopack แพ็กทั้งโปรเจกต์ (fixtures, รูป) ไปกับ server function
- GitHub ไม่ใส่ token จำกัด 60 ครั้ง/ชม. · ใส่ token 5,000 ครั้ง/ชม. (cache ทำให้ใช้น้อยอยู่แล้ว)

## URL ใช้รหัสสุ่ม (2 ต.ค. 69 — เจ้าของเลือก)

- `/posts/<code>` · `/project/<code>` · code = a–z 0–9 สุ่ม 8 ตัว ได้ตอน save ครั้งแรก เก็บใน frontmatter (`code:`) + index · ไม่เปลี่ยน ไม่ซ้ำ
  - ไม่ใช้ slug (ตามชื่อเรื่อง) · ไม่ใช้ no (ขยับตอนลบ) · ไม่ใช้ id (pk — คนอ่านไม่ควรรู้ และไล่นับไม่ได้)
  - ลองแบบคูณสลับเลข id แล้ว ไม่เอา: ลำดับยังเดาได้ + repo โค้ด public = ถอดกลับได้
- โพสต์ที่ save ก่อนมี code: ยังไม่มี code จน save / publish ครั้งถัดไป · ระหว่างนั้น URL = slug · Editor เปิดปุ่ม Save changes ให้โพสต์ที่ยังไม่มี code แม้ไม่ได้แก้อะไร + ข้อความ "Save once to give it its address"
- ลิงก์เก่า `/posts/<slug>` → 308 ไป code (เฉพาะ slug ปัจจุบัน) · อย่างอื่น 404
- หน้าเว็บสาธารณะส่งให้ browser แบบตัด id, file, lastCommit, revisions, createdAt ออก (`forReaders`)
- slug: ตามชื่อเรื่องเสมอ แก้เองไม่ได้ · ใช้ตั้งชื่อไฟล์ + URL ของ Editor · ไทยล้วน = `post-<id>` · ซ้ำ = ต่อ `-<id>`
- **no = เลขลำดับโชว์อย่างเดียว:** ออกตอน publish ครั้งแรก (สูงสุดใน section + 1) · unpublish เก็บเลขไว้ · **ลบ = โพสต์หลังจากนั้นใน section เดียวกันเลขลด 1** (แก้ .md ของพวกนั้นใน commit เดียวกัน) ไม่มีเลขว่าง · unpublish = เลขค้างไว้ ไม่ขยับ (เจ้าของยืนยัน 2 ต.ค. 69)

## โฟลเดอร์ blog-content ในเครื่อง (5 ต.ค. 69)
- ใช้ดูอย่างเดียว ไม่แก้ในนี้ — Admin เขียนลง GitHub ตรง
- เคย "นำหน้า 1 · ตามหลัง 16": Admin รวม Save ใน 30 นาทีเป็น commit เดียว (fold) โดยเขียนทับ commit ล่าสุดบน GitHub → เครื่องที่ pull commit นั้นไว้ก่อนจะแยกทาง `git pull` ไม่ได้
- แก้ (5 ต.ค.): ของเดิมเก็บไว้ที่ branch `backup/local-before-sync-2026-10-05` + `git stash` (แก้ #3 ที่ลบไปแล้ว) แล้ว `reset --hard origin/main`
- ถ้าแยกทางอีก: `git fetch` แล้ว `git reset --hard origin/main` (ไม่มีอะไรของเครื่องที่ต้องเก็บ ถ้าไม่ได้แก้ไฟล์ในนี้)

