# Night Camp Wiki Database & Dashboard

ฐานข้อมูลเกม **Night Camp** (Season 2 · `SS2 · v0.2`) ที่กวาดและจัดโครงสร้างจาก [play.nightcamp.app/wiki](https://play.nightcamp.app/wiki/index.html) พร้อม **Interactive Dashboard (ไทย / English)** และชุดข้อมูลพร้อมใช้งานทั้ง **JSON** และ **CSV (UTF-8 BOM สำหรับ Excel)**

---

## 🌐 Interactive Dashboard (GitHub Pages & Local)

- **GitHub Pages URL:** `https://kanoongammy.github.io/ggggggggggggggggggggggddddd/`
  > หากลิงก์ยังไม่เปิดใช้งาน ให้เข้าไปที่ GitHub Repository → **Settings** → **Pages** → **Source: Deploy from a branch** → เลือก **`main` / `/ (root)`** แล้วกด **Save**
- **เปิดดูบนเครื่อง (Local Preview):**
  ```bash
  python -m http.server 8000
  ```
  แล้วเปิด `http://localhost:8000/` (หรือเปิด `index.html` โดยตรง)

### ฟีเจอร์ใน Dashboard (`index.html` + `app.js` + `styles.css`)
- **สลับภาษา ไทย (TH) / English (EN)** ได้ทันทีทุกหน้าและในหน้าต่างรายละเอียด (ใช้พจนานุกรมภาษาไทย 10,834 รายการจากตัวเกมจริง)
- **Global Search (`Ctrl+K`)**: ค้นหามอนสเตอร์ อาวุธ ไอเทม อาชีพ สกิล แผนที่ วัตถุดิบ และรูนพร้อมกัน
- **11 หมวดหมู่หลัก**:
  1. **Overview & Stats** — ภาพรวม KPI, กราฟสัดส่วนไอเทม/ธาตุ/เกราะ, อันดับบอส HP สูงสุด, มอนสเตอร์ EXP สูงสุด และกราฟ EXP Lv 1–98
  2. **Price & Farm Filter (ฟาร์มเงิน & กรองราคา)** — ตัวกรองรวมทุกหมวด (ดรอปมอน ปลา แร่ ไม้ พืชผัก ของหลอม อาหาร รูน) กรองตามราคา เลเวล ธาตุ % ดรอป ช่วงเวลาตกปลา/ขั้นเบ็ด พร้อมหน้า **วิเคราะห์กำไรคราฟต์/หลอมแร่ & Work Orders**
  3. **Monsters & Bosses** — ค้นหา กรองธาตุ/เผ่า/เกราะ/เลเวล ดูแผนที่เกิด อัตราดรอปจริง และเรียงตามเงินเฉลี่ยต่อตัว (`EV/Kill` / `Coin/1k HP`)
  4. **Items & Gear** — อาวุธ ชุด หมวก โล่ เครื่องประดับ พร้อมค่าสเตตัส โบนัสเซ็ต และแหล่งดรอปย้อนกลับ
  5. **Equipment Sets** — 80 เซ็ตทั่วไป + 5 เซ็ตบอส พร้อมชิ้นส่วนกดดูรายละเอียดได้
  6. **Jobs & Skills** — 46 อาชีพ + 428 สกิล พร้อมตารางความแรงตามเลเวล ระยะสกิล และอาวุธเสริมสกิล
  7. **Maps & World** — แผนที่โลก 5 ภูมิภาคแบบปักหมุดคลิกได้ + รายละเอียดมอนสเตอร์ที่เกิด
  8. **Drop Finder & Materials** — ค้นหาจุดดรอป 4,069 รายการ (กรองธาตุ เลเวล % ดรอป ราคา) + 1,530 วัตถุดิบเรียงตามราคา
  9. **Runes, Relics & Keystones** — 47 รูน (Tier 1–3), 10 เรลิก, 4 คีย์สโตน
  10. **Quests & Life Skills** — 97 เควสต์, 5 สกิลชีวิต, ตารางพืช/ปลา/แร่/ไม้ (พร้อมราคาและตัวกรองครบ), 22 สูตรเตาหลอม
  11. **Season 2 & Export Hub** — Patch Notes, Blood Moon, Lore Book, Mounts/Wings และปุ่มดาวน์โหลดไฟล์ JSON / CSV ทุกไฟล์

---

## 📊 สรุปข้อมูลที่กวาดได้ (Scraped Dataset Summary)

ข้อมูลจาก `data/db/metadata.json` (`wiki_built_at`: `2026-11-23T08:52:49.305Z`):

| หมวดข้อมูล | จำนวน | JSON (`data/db/`) | CSV (`data/csv/`) |
| :--- | ---: | :--- | :--- |
| **Items & Gear** (อาวุธ/ชุด/หมวก/ประดับ) | 2,130 | [items.json](data/db/items.json) | [items.csv](data/csv/items.csv) |
| **Equipment Sets** (เซ็ตทั่วไป / เซ็ตบอส) | 80 + 5 | [sets.json](data/db/sets.json), [boss_sets.json](data/db/boss_sets.json) | – |
| **Monsters & Bosses** (52 บอส) | 482 | [monsters.json](data/db/monsters.json) | [monsters.csv](data/csv/monsters.csv) |
| **Maps & Regions** (5 ภูมิภาค) | 176 + 5 | [maps.json](data/db/maps.json), [regions.json](data/db/regions.json) | [maps.csv](data/csv/maps.csv) |
| **Jobs & Skills** | 46 / 428 | [jobs.json](data/db/jobs.json), [skills.json](data/db/skills.json) | [jobs.csv](data/csv/jobs.csv), [skills.csv](data/csv/skills.csv) |
| **Materials** | 1,530 | [materials.json](data/db/materials.json) | [materials.csv](data/csv/materials.csv) |
| **Flat Drop Index** (Item / Mat / Rune) | 4,069 | [drops.json](data/db/drops.json) | [drops.csv](data/csv/drops.csv) |
| **Quests** | 97 | [quests.json](data/db/quests.json) | [quests.csv](data/csv/quests.csv) |
| **Runes / Relics / Keystones** | 47 / 10 / 4 | [runes_relics_keystones.json](data/db/runes_relics_keystones.json) | [runes.csv](data/csv/runes.csv) |
| **Monster Skills, Lore & Map Fit** | 22 Lore / 15 Skills | [monster_skills_lore.json](data/db/monster_skills_lore.json) | – |
| **Life Skills, Tables & Smelting** | 5 Life / 22 Smelt | [life_smelt.json](data/db/life_smelt.json) | – |
| **Mounts, Wings & Gacha** | 6 Mounts / 28 Wings | [mounts_wings_gacha.json](data/db/mounts_wings_gacha.json) | – |
| **Systems & Season 2 Patch** | – | [systems_season2.json](data/db/systems_season2.json) | – |
| **Metadata & Manifest** | 19 Wiki Pages | [metadata.json](data/db/metadata.json) | – |

---

## 🔄 อัปเดตข้อมูลใหม่ (Re-run Scraper)

สคริปต์ [`scraper/scrape_nightcamp.py`](scraper/scrape_nightcamp.py) ใช้ Python 3 standard library ล้วน ไม่ต้องติดตั้ง package เสริม:

```bash
python scraper/scrape_nightcamp.py
```

สคริปต์จะดึง `data/wiki_en.js`, `data/i18n_*.js` (TH/JA/VI/ID/ZH), Sprite Atlases (`assets/atlas/*.webp`), ไอคอนธาตุ และสร้างไฟล์ใน `data/raw/`, `data/db/` และ `data/csv/` ใหม่ทั้งหมด
