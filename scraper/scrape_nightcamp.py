#!/usr/bin/env python3
"""
Night Camp Wiki Scraper & Normalizer
Fetches live game database, multi-language translations, page manifest, and sprite atlases
from https://play.nightcamp.app/wiki/ and exports normalized JSON (data/db/) and CSV (data/csv/).
"""

from __future__ import annotations

import csv
import json
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE_URL = "https://play.nightcamp.app/wiki/"
HEADERS = {"User-Agent": "NightCampWikiArchiver/1.0 (+https://play.nightcamp.app/wiki/)"}

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
DB_DIR = DATA_DIR / "db"
CSV_DIR = DATA_DIR / "csv"
ASSETS_DIR = ROOT / "assets"
ATLAS_DIR = ASSETS_DIR / "atlas"
EL_DIR = ASSETS_DIR / "el"

WIKI_PAGES = [
    "index.html",
    "season2.html",
    "guide.html",
    "jobs.html",
    "skills.html",
    "runes.html",
    "weapons.html",
    "outfits.html",
    "hats.html",
    "monsters.html",
    "monskills.html",
    "lorebook.html",
    "maps.html",
    "drops.html",
    "quests.html",
    "life.html",
    "systems.html",
    "gallery.html",
    "terms.html",
]

I18N_LANGS = ["th", "ja", "vi", "id", "zh"]

ELEMENTS = [
    "neutral",
    "water",
    "earth",
    "fire",
    "wind",
    "poison",
    "holy",
    "shadow",
    "ghost",
    "undead",
]

ASSET_DOWNLOADS = [
    ("data/wiki_items.webp", ATLAS_DIR / "wiki_items.webp"),
    ("data/wiki_skills.webp", ATLAS_DIR / "wiki_skills.webp"),
    ("data/wiki_mats.webp", ATLAS_DIR / "wiki_mats.webp"),
    ("data/wiki_mons.webp", ATLAS_DIR / "wiki_mons.webp"),
    ("data/wiki_jobs.webp", ATLAS_DIR / "wiki_jobs.webp"),
    ("data/wiki_hats128.webp", ATLAS_DIR / "wiki_hats128.webp"),
    ("assets/b2/map.webp", ASSETS_DIR / "map.webp"),
    ("assets/s2/logo.webp", ASSETS_DIR / "logo.webp"),
    ("assets/favicon.png", ASSETS_DIR / "favicon.png"),
] + [(f"assets/el/{el}.webp", EL_DIR / f"{el}.webp") for el in ELEMENTS]


def fetch_bytes(rel_path: str, retries: int = 3) -> bytes:
    url = BASE_URL + rel_path
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception as exc:
            last_err = exc
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def fetch_text(rel_path: str) -> str:
    return fetch_bytes(rel_path).decode("utf-8", errors="replace")


def write_json(path: Path, data: Any, indent: int | None = 2) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=indent)
    path.write_text(text, encoding="utf-8")
    return path.stat().st_size


def join_vals(vals: Any, sep: str = "|") -> str:
    if not vals:
        return ""
    return sep.join(str(v) for v in vals if v is not None)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path.stat().st_size


def make_translator(th_dict: dict[str, Any]):
    data_map: dict[str, str] = th_dict.get("data", {})
    num_re = re.compile(r"\d+(?:[.,]\d+)*")

    def tr(text: Any) -> str:
        if text is None:
            return ""
        s = str(text)
        if not s:
            return ""
        if s in data_map:
            return data_map[s]
        if any(ch.isdigit() for ch in s):
            nums: list[str] = []

            def _rep(match: re.Match[str]) -> str:
                nums.append(match.group(0))
                return f"{{{len(nums) - 1}}}"

            templ = num_re.sub(_rep, s)
            if templ in data_map:
                out = data_map[templ]
                return re.sub(
                    r"\{(\d+)\}",
                    lambda m: nums[int(m.group(1))] if int(m.group(1)) < len(nums) else m.group(0),
                    out,
                )
        return s

    return tr


def scrape_pages_manifest() -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    def _fetch_page(page: str) -> dict[str, Any]:
        html = fetch_text(page)
        title_m = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
        desc_m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html, re.I)
        scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)
        return {
            "page": page,
            "url": BASE_URL + page,
            "title": title_m.group(1).strip() if title_m else "",
            "description": desc_m.group(1).strip() if desc_m else "",
            "bytes": len(html.encode("utf-8")),
            "scripts": scripts,
        }

    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(_fetch_page, p): p for p in WIKI_PAGES}
        by_page: dict[str, dict[str, Any]] = {}
        for fut in as_completed(futs):
            info = fut.result()
            by_page[info["page"]] = info
        for p in WIKI_PAGES:
            results.append(by_page[p])
    return results


def download_assets() -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    def _dl(item: tuple[str, Path]) -> dict[str, Any]:
        rel_url, dest = item
        raw = fetch_bytes(rel_url)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return {
            "source": rel_url,
            "path": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(raw),
        }

    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(_dl, entry) for entry in ASSET_DOWNLOADS]
        for fut in as_completed(futs):
            results.append(fut.result())
    results.sort(key=lambda x: x["path"])
    return results


def main() -> None:
    started = time.time()
    for d in (DATA_DIR, RAW_DIR, DB_DIR, CSV_DIR, ASSETS_DIR, ATLAS_DIR, EL_DIR):
        d.mkdir(parents=True, exist_ok=True)

    print("[1/5] Fetching wiki_en.js and i18n bundles...")
    wiki_js = fetch_text("data/wiki_en.js")
    (DATA_DIR / "wiki_en.js").write_text(wiki_js, encoding="utf-8")
    m_wiki = re.search(r"window\.WIKI\s*=\s*(\{.*\})\s*;?\s*$", wiki_js, re.S)
    if not m_wiki:
        raise RuntimeError("Could not parse window.WIKI JSON from data/wiki_en.js")
    W: dict[str, Any] = json.loads(m_wiki.group(1))
    write_json(RAW_DIR / "wiki_en.json", W, indent=None)

    i18n_bundles: dict[str, dict[str, Any]] = {}
    for lang in I18N_LANGS:
        js_txt = fetch_text(f"data/i18n_{lang}.js")
        if lang == "th":
            (DATA_DIR / "i18n_th.js").write_text(js_txt, encoding="utf-8")
        m_i18n = re.search(r"NCWLang\.apply\((\{.*\})\)\s*;?\s*$", js_txt, re.S)
        if not m_i18n:
            raise RuntimeError(f"Could not parse NCWLang.apply JSON from data/i18n_{lang}.js")
        parsed = json.loads(m_i18n.group(1))
        i18n_bundles[lang] = parsed
        write_json(RAW_DIR / f"i18n_{lang}.json", parsed, indent=None)

    th_dict = i18n_bundles["th"]
    tr = make_translator(th_dict)

    print("[2/5] Fetching HTML pages manifest...")
    pages_manifest = scrape_pages_manifest()
    write_json(RAW_DIR / "pages_manifest.json", pages_manifest)

    print("[3/5] Downloading compact visual assets (atlases, map, logo, elements)...")
    assets_manifest = download_assets()

    print("[4/5] Building normalized JSON databases (data/db/) and CSV exports (data/csv/)...")
    items_raw: list[dict[str, Any]] = W.get("items", [])
    sets_raw: list[dict[str, Any]] = W.get("sets", [])
    boss_sets_raw: list[dict[str, Any]] = W.get("bossSets", [])
    monsters_raw: list[dict[str, Any]] = W.get("monsters", [])
    maps_raw: list[dict[str, Any]] = W.get("maps", [])
    regions_raw: list[dict[str, Any]] = W.get("regions", [])
    jobs_raw: list[dict[str, Any]] = W.get("jobs", [])
    materials_raw: list[dict[str, Any]] = W.get("materials", [])
    quests_raw: list[dict[str, Any]] = W.get("quests", [])
    life_raw: list[dict[str, Any]] = W.get("life", [])
    life_tables: dict[str, Any] = W.get("lifeTables", {})
    wtypes: dict[str, str] = W.get("wtypes", {})
    races: dict[str, str] = W.get("races", {})
    elements: dict[str, str] = W.get("elements", {})
    sys_data: dict[str, Any] = W.get("sys", {})
    s2: dict[str, Any] = W.get("s2", {})

    item_by_id = {x["id"]: x for x in items_raw}
    mat_by_id = {x["id"]: x for x in materials_raw}
    map_by_id = {x["id"]: x for x in maps_raw}
    mon_by_id = {x["id"]: x for x in monsters_raw}
    runes_dict: dict[str, Any] = s2.get("runes", {}).get("list", {})

    # Map item -> set_id
    item_to_set: dict[str, str] = {}
    for st in sets_raw:
        for pid in st.get("pcs", []):
            item_to_set[pid] = st["id"]

    # Reverse drop maps & flat drops list
    item_droppers: dict[str, list[dict[str, Any]]] = {}
    mat_droppers: dict[str, list[dict[str, Any]]] = {}
    rune_droppers: dict[str, list[dict[str, Any]]] = {}
    flat_drops: list[dict[str, Any]] = []

    for m in monsters_raw:
        mid = m["id"]
        mn = m.get("n", "")
        mn_th = tr(mn)
        mlv = m.get("lv")
        mboss = bool(m.get("boss"))
        m_maps = [mp for mp in (m.get("maps") or []) if mp is not None]
        m_map_names = [map_by_id[mp]["n"] if mp in map_by_id else mp for mp in m_maps]

        # Note: monster.drops chance is ALREADY percent (e.g. 0.06 = 0.06%)
        for d in m.get("drops", []):
            tid, rate_pct = d[0], round(float(d[1]), 6)
            it = item_by_id.get(tid)
            tn = it["n"] if it else tid
            tn_th = tr(tn)
            item_droppers.setdefault(tid, []).append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "rate_pct": rate_pct,
                }
            )
            flat_drops.append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "drop_type": "item",
                    "target_id": tid,
                    "target_name": tn,
                    "target_name_th": tn_th,
                    "rate_pct": rate_pct,
                    "maps": m_maps,
                    "map_names": m_map_names,
                }
            )

        # Note: monster.mats chance is a fraction (0..1 -> multiply by 100 for %)
        for mt in m.get("mats", []):
            tid, frac = mt[0], float(mt[1])
            rate_pct = round(frac * 100.0, 6)
            mat = mat_by_id.get(tid)
            tn = mat["n"] if mat else tid
            tn_th = tr(tn)
            mat_droppers.setdefault(tid, []).append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "rate_pct": rate_pct,
                }
            )
            flat_drops.append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "drop_type": "material",
                    "target_id": tid,
                    "target_name": tn,
                    "target_name_th": tn_th,
                    "rate_pct": rate_pct,
                    "maps": m_maps,
                    "map_names": m_map_names,
                }
            )

        # Note: monster.rune chance is a fraction (0..1 -> multiply by 100 for %)
        if m.get("rune"):
            rid, frac = m["rune"][0], float(m["rune"][1])
            rate_pct = round(frac * 100.0, 6)
            robj = runes_dict.get(rid, {})
            rn = robj.get("n", rid)
            rn_th = tr(rn)
            rune_droppers.setdefault(rid, []).append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "rate_pct": rate_pct,
                }
            )
            flat_drops.append(
                {
                    "monster_id": mid,
                    "monster_name": mn,
                    "monster_name_th": mn_th,
                    "monster_lv": mlv,
                    "boss": mboss,
                    "drop_type": "rune",
                    "target_id": rid,
                    "target_name": rn,
                    "target_name_th": rn_th,
                    "rate_pct": rate_pct,
                    "maps": m_maps,
                    "map_names": m_map_names,
                }
            )

    for lst in (item_droppers, mat_droppers, rune_droppers):
        for k in lst:
            lst[k].sort(key=lambda x: (-x["rate_pct"], x["monster_lv"] or 0, x["monster_name"]))

    # Items
    items_norm: list[dict[str, Any]] = []
    for it in items_raw:
        entry = dict(it)
        entry["name_th"] = tr(it.get("n", ""))
        entry["desc_th"] = tr(it.get("d", ""))
        if it.get("wt"):
            entry["wtype_name"] = wtypes.get(it["wt"], it["wt"])
            entry["wtype_name_th"] = tr(entry["wtype_name"])
        if it["id"] in item_to_set:
            entry["set_id"] = item_to_set[it["id"]]
        entry["dropped_by"] = item_droppers.get(it["id"], [])
        items_norm.append(entry)

    # Sets & Boss sets
    sets_norm: list[dict[str, Any]] = []
    for st in sets_raw:
        entry = dict(st)
        entry["name_th"] = tr(st.get("n", ""))
        entry["b2_th"] = tr(st.get("b2", ""))
        entry["b3_th"] = tr(st.get("b3", ""))
        entry["pas_th"] = tr(st.get("pas", ""))
        sets_norm.append(entry)

    boss_sets_norm: list[dict[str, Any]] = []
    for bs in boss_sets_raw:
        entry = dict(bs)
        entry["name_th"] = tr(bs.get("n", ""))
        entry["text_th"] = tr(bs.get("text", ""))
        boss_sets_norm.append(entry)

    # Monsters
    monsters_norm: list[dict[str, Any]] = []
    for m in monsters_raw:
        entry = dict(m)
        entry["name_th"] = tr(m.get("n", ""))
        entry["element_name"] = elements.get(m.get("el", "neutral"), m.get("el", "neutral"))
        entry["element_name_th"] = tr(entry["element_name"])
        entry["race_name"] = races.get(m.get("race", ""), m.get("race", ""))
        entry["race_name_th"] = tr(entry["race_name"])
        clean_maps = [mp for mp in (m.get("maps") or []) if mp is not None]
        entry["maps"] = clean_maps
        entry["map_names"] = [map_by_id[mp]["n"] if mp in map_by_id else mp for mp in clean_maps]
        entry["map_names_th"] = [tr(n) for n in entry["map_names"]]
        entry["drop_count"] = len(m.get("drops", []))
        entry["mat_count"] = len(m.get("mats", []))
        monsters_norm.append(entry)

    # Maps & Regions
    maps_norm: list[dict[str, Any]] = []
    for mp in maps_raw:
        entry = dict(mp)
        entry["name_th"] = tr(mp.get("n", ""))
        entry["zones_th"] = [tr(z) for z in mp.get("zones", [])]
        entry["monsters_detail"] = [
            {
                "id": mid,
                "name": mon_by_id[mid]["n"] if mid in mon_by_id else mid,
                "name_th": tr(mon_by_id[mid]["n"]) if mid in mon_by_id else mid,
                "lv": mon_by_id[mid].get("lv") if mid in mon_by_id else None,
                "boss": bool(mon_by_id[mid].get("boss")) if mid in mon_by_id else False,
            }
            for mid in mp.get("mons", [])
        ]
        maps_norm.append(entry)

    regions_norm: list[dict[str, Any]] = []
    for r in regions_raw:
        entry = dict(r)
        entry["name_th"] = tr(r.get("n", ""))
        regions_norm.append(entry)

    # Jobs & Skills
    jobs_norm: list[dict[str, Any]] = []
    skills_flat: list[dict[str, Any]] = []
    seen_skill_ids: set[str] = set()
    for j in jobs_raw:
        j_entry = dict(j)
        j_entry["name_th"] = tr(j.get("n", ""))
        j_entry["desc_th"] = tr(j.get("d", ""))
        j_entry["lines_norm"] = [
            {**ln, "name_th": tr(ln.get("n", ""))} for ln in j.get("lines", [])
        ]
        sk_list: list[dict[str, Any]] = []
        for s in j.get("sk", []):
            s_entry = dict(s)
            s_entry["name_th"] = tr(s.get("n", ""))
            s_entry["desc_th"] = tr(s.get("d", ""))
            sk_list.append(s_entry)
            if s["id"] not in seen_skill_ids:
                seen_skill_ids.add(s["id"])
                skills_flat.append(
                    {
                        "id": s["id"],
                        "n": s.get("n", ""),
                        "name_th": s_entry["name_th"],
                        "d": s.get("d", ""),
                        "desc_th": s_entry["desc_th"],
                        "job_id": j["id"],
                        "job_name": j.get("n", ""),
                        "job_name_th": j_entry["name_th"],
                        "line": s.get("line", ""),
                        "el": s.get("el", ""),
                        "type": s.get("type", ""),
                        "active": bool(s.get("active", True)),
                        "max": s.get("max"),
                        "sp": s.get("sp"),
                        "cd": s.get("cd"),
                        "rg": s.get("rg"),
                        "icon": s.get("icon", ""),
                        "req": s.get("req", []),
                        "lvs": s.get("lvs", []),
                    }
                )
        j_entry["sk"] = sk_list
        jobs_norm.append(j_entry)

    # Materials
    materials_norm: list[dict[str, Any]] = []
    for mat in materials_raw:
        entry = dict(mat)
        entry["name_th"] = tr(mat.get("n", ""))
        entry["desc_th"] = tr(mat.get("d", ""))
        entry["from_th"] = tr(mat.get("from", ""))
        entry["dropped_by"] = mat_droppers.get(mat["id"], [])
        materials_norm.append(entry)

    # Quests
    quests_norm: list[dict[str, Any]] = []
    for q in quests_raw:
        entry = dict(q)
        entry["title_th"] = tr(q.get("t", ""))
        entry["chapter_th"] = tr(q.get("ch", ""))
        entry["map_th"] = tr(q.get("map", ""))
        entry["obj_th"] = [tr(o) for o in q.get("obj", [])]
        quests_norm.append(entry)

    # Runes, Relics, Keystones
    runes_enriched: dict[str, Any] = {}
    for rid, robj in runes_dict.items():
        r_entry = dict(robj)
        r_entry["id"] = rid
        r_entry["name_th"] = tr(robj.get("n", ""))
        r_entry["t_th"] = [tr(txt) for txt in robj.get("t", [])]
        r_entry["dropped_by"] = rune_droppers.get(rid, [])
        runes_enriched[rid] = r_entry

    runes_relics_keystones = {
        "runes": {**s2.get("runes", {}), "list": runes_enriched},
        "relics": s2.get("relics", {}),
        "keystone": s2.get("keystone", {}),
        "runeMats": s2.get("runeMats", []),
        "procs": s2.get("procs", {}),
    }

    monster_skills_lore = {
        "monSkills": s2.get("monSkills", {}),
        "bossMoves": s2.get("bossMoves", {}),
        "lore": s2.get("lore", {}),
        "mapFit": s2.get("mapFit", {}),
    }

    life_smelt = {
        "life": life_raw,
        "lifeTables": life_tables,
        "cookMins": W.get("cookMins"),
        "smelt": s2.get("smelt", {}),
        "orders": s2.get("orders", {}),
        "mines": s2.get("mines", {}),
        "farm": s2.get("farm", {}),
        "refineNeeds": s2.get("refineNeeds", {}),
        "lifeXpK": s2.get("lifeXpK"),
    }

    mounts_wings_gacha = {
        "mounts": s2.get("mounts", {}),
        "wings": s2.get("wings", {}),
        "gacha": s2.get("gacha", {}),
        "checkin": s2.get("checkin", []),
        "sbBig": W.get("sbBig", []),
    }

    systems_season2 = {
        "version": s2.get("version"),
        "season": W.get("season"),
        "sys": sys_data,
        "patch": s2.get("patch", {}),
        "posts": s2.get("posts", []),
        "armour": s2.get("armour", {}),
        "bloodMoon": s2.get("bloodMoon", {}),
        "mapEvent": s2.get("mapEvent", {}),
        "xp": s2.get("xp", []),
        "after99": s2.get("after99", {}),
        "gwar": s2.get("gwar", {}),
        "pvp": s2.get("pvp", {}),
        "stats": s2.get("stats", {}),
        "econ": s2.get("econ", {}),
        "mstatus": s2.get("mstatus", {}),
        "fresh": s2.get("fresh", {}),
        "faint": s2.get("faint", []),
        "hpMul": s2.get("hpMul", []),
        "party": s2.get("party", {}),
        "dropK": s2.get("dropK", {}),
        "bossK": s2.get("bossK", {}),
        "wtypes": wtypes,
        "races": races,
        "elements": elements,
    }

    # Write DB JSONs
    db_files: list[dict[str, Any]] = []
    db_exports = [
        ("items.json", items_norm),
        ("sets.json", sets_norm),
        ("boss_sets.json", boss_sets_norm),
        ("monsters.json", monsters_norm),
        ("maps.json", maps_norm),
        ("regions.json", regions_norm),
        ("jobs.json", jobs_norm),
        ("skills.json", skills_flat),
        ("materials.json", materials_norm),
        ("drops.json", flat_drops),
        ("quests.json", quests_norm),
        ("runes_relics_keystones.json", runes_relics_keystones),
        ("monster_skills_lore.json", monster_skills_lore),
        ("life_smelt.json", life_smelt),
        ("mounts_wings_gacha.json", mounts_wings_gacha),
        ("systems_season2.json", systems_season2),
    ]
    for fname, payload in db_exports:
        sz = write_json(DB_DIR / fname, payload, indent=None if fname in ("items.json", "drops.json", "materials.json") else 2)
        db_files.append({"path": f"data/db/{fname}", "bytes": sz})

    # Write CSV exports (UTF-8 BOM)
    csv_files: list[dict[str, Any]] = []

    def add_csv(fname: str, fields: list[str], rows: list[dict[str, Any]]) -> None:
        sz = write_csv(CSV_DIR / fname, fields, rows)
        csv_files.append({"path": f"data/csv/{fname}", "bytes": sz, "rows": len(rows)})

    add_csv(
        "items.csv",
        ["id", "n", "name_th", "s", "r", "lv", "wt", "el", "atk", "set_id", "st_json", "d", "desc_th", "drop_sources"],
        [
            {
                "id": x["id"],
                "n": x.get("n", ""),
                "name_th": x.get("name_th", ""),
                "s": x.get("s", ""),
                "r": x.get("r", ""),
                "lv": x.get("lv", ""),
                "wt": x.get("wt", ""),
                "el": x.get("el", ""),
                "atk": x.get("atk", ""),
                "set_id": x.get("set_id", ""),
                "st_json": json.dumps(x.get("st", {}), ensure_ascii=False) if x.get("st") else "",
                "d": x.get("d", ""),
                "desc_th": x.get("desc_th", ""),
                "drop_sources": len(x.get("dropped_by", [])),
            }
            for x in items_norm
        ],
    )

    add_csv(
        "monsters.csv",
        [
            "id", "n", "name_th", "lv", "boss", "story", "el", "atkEl", "race", "arm", "armKind", "armBar",
            "hp", "atk_min", "atk_max", "def", "mdef", "hit", "flee", "exp", "jexp", "maps", "drop_count", "mat_count",
        ],
        [
            {
                "id": m["id"],
                "n": m.get("n", ""),
                "name_th": m.get("name_th", ""),
                "lv": m.get("lv", ""),
                "boss": m.get("boss", False),
                "story": m.get("story", False),
                "el": m.get("el", ""),
                "atkEl": m.get("atkEl", ""),
                "race": m.get("race", ""),
                "arm": m.get("arm", ""),
                "armKind": m.get("armKind", ""),
                "armBar": m.get("armBar", ""),
                "hp": m.get("hp", ""),
                "atk_min": m["atk"][0] if isinstance(m.get("atk"), list) and len(m["atk"]) > 0 else "",
                "atk_max": m["atk"][1] if isinstance(m.get("atk"), list) and len(m["atk"]) > 1 else "",
                "def": m.get("def", ""),
                "mdef": m.get("mdef", ""),
                "hit": m.get("hit", ""),
                "flee": m.get("flee", ""),
                "exp": m.get("exp", ""),
                "jexp": m.get("jexp", ""),
                "maps": join_vals(m.get("maps")),
                "drop_count": m.get("drop_count", 0),
                "mat_count": m.get("mat_count", 0),
            }
            for m in monsters_norm
        ],
    )

    add_csv(
        "maps.csv",
        ["id", "n", "name_th", "lv", "kind", "parent", "secret", "region", "pin_x", "pin_y", "zones", "monster_ids"],
        [
            {
                "id": mp["id"],
                "n": mp.get("n", ""),
                "name_th": mp.get("name_th", ""),
                "lv": mp.get("lv", ""),
                "kind": mp.get("kind", ""),
                "parent": mp.get("parent", ""),
                "secret": mp.get("secret", False),
                "region": mp["pin"][0] if isinstance(mp.get("pin"), list) and len(mp["pin"]) >= 3 else "",
                "pin_x": mp["pin"][1] if isinstance(mp.get("pin"), list) and len(mp["pin"]) >= 3 else "",
                "pin_y": mp["pin"][2] if isinstance(mp.get("pin"), list) and len(mp["pin"]) >= 3 else "",
                "zones": join_vals(mp.get("zones")),
                "monster_ids": join_vals(mp.get("mons")),
            }
            for mp in maps_norm
        ],
    )

    add_csv(
        "jobs.csv",
        ["id", "n", "name_th", "tier", "from", "maxJob", "hp_per_lv", "sp_per_lv", "weapons", "skill_count", "d", "desc_th"],
        [
            {
                "id": j["id"],
                "n": j.get("n", ""),
                "name_th": j.get("name_th", ""),
                "tier": j.get("tier", ""),
                "from": j.get("from", ""),
                "maxJob": j.get("maxJob", ""),
                "hp_per_lv": j.get("hp", ""),
                "sp_per_lv": j.get("sp", ""),
                "weapons": join_vals(j.get("wt")),
                "skill_count": len(j.get("sk", [])),
                "d": j.get("d", ""),
                "desc_th": j.get("desc_th", ""),
            }
            for j in jobs_norm
        ],
    )

    add_csv(
        "skills.csv",
        ["id", "n", "name_th", "job_id", "job_name", "job_name_th", "line", "active", "type", "el", "max", "sp", "cd", "rg", "d", "desc_th"],
        [
            {
                "id": s["id"],
                "n": s["n"],
                "name_th": s["name_th"],
                "job_id": s["job_id"],
                "job_name": s["job_name"],
                "job_name_th": s["job_name_th"],
                "line": s["line"],
                "active": s["active"],
                "type": s["type"],
                "el": s["el"],
                "max": s["max"],
                "sp": s["sp"],
                "cd": s["cd"],
                "rg": s["rg"],
                "d": s["d"],
                "desc_th": s["desc_th"],
            }
            for s in skills_flat
        ],
    )

    add_csv(
        "materials.csv",
        ["id", "n", "name_th", "p", "rare", "life", "from", "from_th", "d", "desc_th", "drop_sources"],
        [
            {
                "id": mat["id"],
                "n": mat.get("n", ""),
                "name_th": mat.get("name_th", ""),
                "p": mat.get("p", ""),
                "rare": mat.get("rare", False),
                "life": mat.get("life", False),
                "from": mat.get("from", ""),
                "from_th": mat.get("from_th", ""),
                "d": mat.get("d", ""),
                "desc_th": mat.get("desc_th", ""),
                "drop_sources": len(mat.get("dropped_by", [])),
            }
            for mat in materials_norm
        ],
    )

    add_csv(
        "drops.csv",
        ["monster_id", "monster_name", "monster_name_th", "monster_lv", "boss", "drop_type", "target_id", "target_name", "target_name_th", "rate_pct", "maps"],
        [
            {
                **d,
                "maps": join_vals(d.get("maps")),
            }
            for d in flat_drops
        ],
    )

    add_csv(
        "quests.csv",
        ["id", "ch", "chapter_th", "t", "title_th", "lv", "map", "map_th", "coins", "ok", "obj", "obj_th"],
        [
            {
                "id": q["id"],
                "ch": q.get("ch", ""),
                "chapter_th": q.get("chapter_th", ""),
                "t": q.get("t", ""),
                "title_th": q.get("title_th", ""),
                "lv": q.get("lv", ""),
                "map": q.get("map", ""),
                "map_th": q.get("map_th", ""),
                "coins": q.get("coins", 0),
                "ok": q.get("ok", True),
                "obj": join_vals(q.get("obj"), " | "),
                "obj_th": join_vals(q.get("obj_th"), " | "),
            }
            for q in quests_norm
        ],
    )

    add_csv(
        "runes.csv",
        ["id", "n", "name_th", "kind", "on", "price_t1", "price_t2", "price_t3", "tier1", "tier2", "tier3", "tier1_th", "drop_sources"],
        [
            {
                "id": rid,
                "n": r.get("n", ""),
                "name_th": r.get("name_th", ""),
                "kind": r.get("kind", ""),
                "on": r.get("on", ""),
                "price_t1": r.get("price", [None, None, None])[0] if len(r.get("price", [])) > 0 else "",
                "price_t2": r.get("price", [None, None, None])[1] if len(r.get("price", [])) > 1 else "",
                "price_t3": r.get("price", [None, None, None])[2] if len(r.get("price", [])) > 2 else "",
                "tier1": r.get("t", ["", "", ""])[0] if len(r.get("t", [])) > 0 else "",
                "tier2": r.get("t", ["", "", ""])[1] if len(r.get("t", [])) > 1 else "",
                "tier3": r.get("t", ["", "", ""])[2] if len(r.get("t", [])) > 2 else "",
                "tier1_th": r.get("t_th", [""])[0] if len(r.get("t_th", [])) > 0 else "",
                "drop_sources": len(r.get("dropped_by", [])),
            }
            for rid, r in runes_enriched.items()
        ],
    )

    scraped_at = datetime.now(timezone.utc).isoformat()
    metadata = {
        "source": BASE_URL + "index.html",
        "wiki_version": W.get("v"),
        "season": W.get("season"),
        "s2_version": s2.get("version"),
        "wiki_built_at": W.get("at"),
        "scraped_at": scraped_at,
        "counts": {
            "items": len(items_norm),
            "sets": len(sets_norm),
            "boss_sets": len(boss_sets_norm),
            "monsters": len(monsters_norm),
            "bosses": sum(1 for m in monsters_norm if m.get("boss")),
            "maps": len(maps_norm),
            "regions": len(regions_norm),
            "jobs": len(jobs_norm),
            "skills": len(skills_flat),
            "materials": len(materials_norm),
            "drops_total": len(flat_drops),
            "quests": len(quests_norm),
            "runes": len(runes_enriched),
            "relics": len(s2.get("relics", {}).get("list", {})),
            "keystones": len(s2.get("keystone", {}).get("branches", {})),
            "mounts": len(s2.get("mounts", {}).get("list", [])),
            "wings": len(s2.get("wings", {}).get("list", [])),
            "lore_families": len(s2.get("lore", {}).get("fam", {})),
            "smelt_recipes": len(s2.get("smelt", {}).get("recipes", {})),
            "pages": len(pages_manifest),
            "th_data_entries": len(th_dict.get("data", {})),
            "th_ui_entries": len(th_dict.get("ui", {})),
        },
        "db_files": db_files,
        "csv_files": csv_files,
        "assets": assets_manifest,
    }
    write_json(DB_DIR / "metadata.json", metadata, indent=2)

    elapsed = time.time() - started
    print("[5/5] Done in %.2fs!" % elapsed)
    print(json.dumps(metadata["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
