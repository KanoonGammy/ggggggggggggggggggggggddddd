(function () {
  'use strict';

  const W = window.WIKI || {};
  const DICT = (window.NCWLang && window.NCWLang.dict) || { data: {}, ui: {} };
  const DATA_TR = DICT.data || {};
  const UI_TR = DICT.ui || {};
  const NUM_RE = /\d+(?:[.,]\d+)*/g;

  const state = {
    lang: 'th',
    view: 'overview',
    market: {
      tab: 'filter',
      cat: 'all',
      q: '',
      minPrice: '',
      maxPrice: '',
      minLv: '',
      maxLv: '',
      el: '',
      map: '',
      minRate: '',
      monType: 'all',
      when: 'all',
      maxRod: '',
      sort: 'ev',
      dir: -1,
      page: 0,
      craftSkill: '',
      craftMinLv: '',
      craftMaxLv: '',
      craftQ: '',
      craftSort: 'profit',
      craftDir: -1
    },
    monsters: { q: '', kind: 'all', el: '', race: '', arm: '', minLv: '', maxLv: '', sort: 'lv', dir: 1, page: 0 },
    items: { tab: 'all', q: '', r: '', wt: '', el: '', minLv: '', maxLv: '', sort: 'lv', dir: 1, page: 0 },
    sets: { tab: 'regular', q: '', g: '' },
    jobs: { tab: 'jobs', tier: 'all', q: '', skJob: '', skType: '', skEl: '', skQ: '', skSort: 'n', skDir: 1, skPage: 0 },
    maps: { region: '', kind: '', secret: 'all', q: '' },
    drops: { tab: 'drops', q: '', dtype: 'all', monType: 'all', el: '', map: '', minLv: '', maxLv: '', minRate: '', minPrice: '', maxPrice: '', sort: 'rate', dir: -1, page: 0, matFilter: 'all', matQ: '', matMinPrice: '', matMaxPrice: '', matSort: 'p', matDir: -1, matPage: 0 },
    cards: { q: '', kind: 'all', el: '', map: '', minLv: '', maxLv: '', sort: 'price', dir: -1, page: 0 },
    runes: { tab: 'runes', kind: '', on: '', q: '' },
    quests: { tab: 'quests', ch: '', q: '', lifeTab: 'crops', lifeQ: '', lifeMinLv: '', lifeMaxLv: '', lifeMinPrice: '', lifeMaxPrice: '', lifeWhen: 'all', lifeSort: 'price', lifeDir: -1 },
    s2: { tab: 'patch' }
  };

  // ------------------------------------------------------------------ Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const fmt = (n) => (n == null || n === '' ? '–' : Number(n).toLocaleString('en-US'));
  const fmtCoin = (v) => {
    if (v == null || v === '' || Number.isNaN(Number(v))) return '–';
    const n = Number(v);
    if (n === 0) return '0c';
    if (Math.abs(n) >= 100) return Math.round(n).toLocaleString('en-US') + 'c';
    if (Math.abs(n) >= 10) return n.toFixed(1).replace(/\.0$/, '') + 'c';
    return n.toFixed(2).replace(/\.?0+$/, '') + 'c';
  };
  const fmtPct = (v) => {
    const n = Number(v || 0);
    if (n >= 10) return n.toFixed(1).replace(/\.0$/, '') + '%';
    if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, '') + '%';
    if (n >= 0.01) return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
    return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '%';
  };
  const norm = (s) => String(s || '').toLowerCase().trim();
  const WHEN_LABELS = {
    0: { th: 'ตลอดวัน', en: 'Any time', color: '#6e6a86' },
    1: { th: 'กลางคืน', en: 'Night', color: '#8a4fe0' },
    2: { th: 'กลางวัน', en: 'Day', color: '#f5b942' }
  };
  function keepFocus(selector, renderFn) {
    const el = $(selector);
    const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : null;
    renderFn();
    const el2 = $(selector);
    if (el2) {
      el2.focus();
      if (pos != null && typeof el2.setSelectionRange === 'function') el2.setSelectionRange(pos, pos);
    }
  }

  function trAlways(text) {
    if (text == null) return '';
    const s = String(text);
    if (!s) return '';
    if (Object.prototype.hasOwnProperty.call(DATA_TR, s)) return DATA_TR[s];
    if (Object.prototype.hasOwnProperty.call(UI_TR, s)) return UI_TR[s];
    if (/\d/.test(s)) {
      const nums = [];
      const tpl = s.replace(NUM_RE, (m) => '{' + (nums.push(m) - 1) + '}');
      const hit = DATA_TR[tpl] || UI_TR[tpl];
      if (hit) return hit.replace(/\{(\d+)\}/g, (m, i) => (nums[i] != null ? nums[i] : m));
    }
    return s;
  }

  function tr(text) {
    if (text == null) return '';
    const s = String(text);
    if (!s || state.lang === 'en') return s;
    return trAlways(s);
  }

  function collectBi(val, out) {
    if (val == null || val === false) return;
    if (Array.isArray(val)) {
      for (const x of val) collectBi(x, out);
      return;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        out.push(k);
        collectBi(v, out);
      }
      return;
    }
    const s = String(val);
    if (!s) return;
    out.push(s);
    const th = trAlways(s);
    if (th && th !== s) out.push(th);
  }

  function biText(...vals) {
    const out = [];
    for (const v of vals) collectBi(v, out);
    return norm(out.join(' '));
  }

  function matchesQuery(haystack, rawQuery) {
    const q = norm(rawQuery);
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      if (!haystack.includes(tok)) return false;
    }
    return true;
  }

  function L(thText, enText) {
    return state.lang === 'th' ? thText : enText;
  }

  function nameHtml(enName, subExtra = '') {
    const tName = tr(enName);
    const sub = state.lang === 'th' && tName !== enName ? enName : subExtra;
    return `<div class="name-main">${esc(tName)}</div>${sub ? `<div class="name-sub">${esc(sub)}</div>` : ''}`;
  }

  // ------------------------------------------------------------------ Color Palettes
  const EL_COLOR = {
    neutral: '#8d8578', water: '#2f86e8', earth: '#a8692c', fire: '#ea5a24',
    wind: '#3f9e4c', poison: '#9a4fd0', holy: '#c99a0a', shadow: '#6a4fd0',
    ghost: '#3aa6c4', undead: '#6f7f5c'
  };
  const RAR_COLOR = {
    common: '#8a8499', rare: '#3f95ff', epic: '#9a5cf0', legend: '#f5b942', fashion: '#e667ad'
  };
  const ARM_COLOR = {
    heavy: '#8a94a6', spirit: '#9a5cf0', hide: '#c78342', flesh: '#e05b6d'
  };
  const GRADE_COLOR = { 1: '#8a8499', 2: '#38c97a', 3: '#3f95ff', 4: '#ff8f3f' };
  const pill = (text, color, cls = '') =>
    `<span class="pill ${cls}" style="--c:${color || '#8a8499'}">${esc(text)}</span>`;
  const elIcon = (el, s = 18) =>
    `<img class="el-icon" src="assets/el/${esc(el || 'neutral')}.webp" alt="" width="${s}" height="${s}" loading="lazy">`;
  const elPill = (el) => {
    const key = el || 'neutral';
    const label = tr((W.elements && W.elements[key]) || key);
    return `<span class="pill" style="--c:${EL_COLOR[key] || EL_COLOR.neutral}">${elIcon(key, 15)}${esc(label)}</span>`;
  };

  // ------------------------------------------------------------------ Atlas & Sprites
  const ATLAS = W.atlas || { items: [], skills: [], mats: [], mons: [], jobs: [], meta: {} };
  const AI = {};
  for (const k of ['items', 'skills', 'mats', 'mons', 'jobs']) {
    AI[k] = Object.fromEntries((ATLAS[k] || []).map((id, idx) => [id, idx]));
  }
  const HI = Object.fromEntries(((W.hats128 && W.hats128.ids) || []).map((id, idx) => [id, idx]));
  const ATLAS_FILE = {
    items: 'assets/atlas/wiki_items.webp',
    skills: 'assets/atlas/wiki_skills.webp',
    mats: 'assets/atlas/wiki_mats.webp',
    mons: 'assets/atlas/wiki_mons.webp',
    jobs: 'assets/atlas/wiki_jobs.webp'
  };

  function atlasImg(kind, id, size = 40, extraStyle = '') {
    const idx = AI[kind] ? AI[kind][id] : null;
    const meta = ATLAS.meta ? ATLAS.meta[kind] : null;
    if (idx == null || !meta) {
      return `<i class="ai" style="width:${size}px;height:${size}px;border-radius:8px;background:rgba(255,255,255,.05)"></i>`;
    }
    const k = size / meta.cell;
    const x = (idx % meta.cols) * meta.cell * k;
    const y = Math.floor(idx / meta.cols) * meta.cell * k;
    const rows = Math.ceil(meta.n / meta.cols);
    const bgW = meta.cols * meta.cell * k;
    const bgH = rows * meta.cell * k;
    return `<i class="ai" style="width:${size}px;height:${size}px;background:url('${ATLAS_FILE[kind]}') -${x}px -${y}px/${bgW}px ${bgH}px no-repeat;${extraStyle}"></i>`;
  }

  function hatImg(id, size = 48) {
    const idx = HI[id];
    const M = W.hats128;
    if (idx == null || !M) return atlasImg('items', id, size);
    const k = size / M.cell;
    const x = (idx % M.cols) * M.cell * k;
    const y = Math.floor(idx / M.cols) * M.cell * k;
    const rows = Math.ceil(M.ids.length / M.cols);
    return `<i class="ai" style="width:${size}px;height:${size}px;background:url('assets/atlas/wiki_hats128.webp') -${x}px -${y}px/${M.cols * M.cell * k}px ${rows * M.cell * k}px no-repeat"></i>`;
  }

  function monSprite(m, size = 44) {
    if (!m) return atlasImg('mons', '', size);
    const useId = AI.mons[m.id] != null ? m.id : (m.eliteOf || m.id);
    const filter = m.eliteOf && AI.mons[m.id] == null && m.hue ? `filter:hue-rotate(${m.hue}deg) saturate(1.2);` : '';
    return atlasImg('mons', useId, size, filter);
  }

  function itemSprite(it, size = 40) {
    if (!it) return atlasImg('items', '', size);
    if ((it.s === 'hat' || it.s === 'glasses') && HI[it.id] != null && size >= 44) {
      return hatImg(it.id, size);
    }
    return atlasImg('items', it.id, size);
  }

  // ------------------------------------------------------------------ Indexes
  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  const IT = byId(W.items);
  const MON = byId(W.monsters);
  const MAP = byId(W.maps);
  const REG = byId(W.regions);
  const JOB = byId(W.jobs);
  const MAT = byId(W.materials);
  const SET = byId(W.sets);
  const S2 = W.s2 || {};
  const RUNE_CFG = S2.runes || {};
  const RUNES = RUNE_CFG.list || {};
  const GUN_DROP = RUNE_CFG.gunDrop || {};
  const SPELL_CFG = RUNE_CFG.spell || null;

  const GUN_DROP_MON_KEYS = new Set();
  const GUN_DROP_BY_MON = {};
  for (const [rid, rows] of Object.entries(GUN_DROP)) {
    for (const [mid, frac] of (rows || [])) {
      const f = Number(frac || 0);
      if (!(f > 0)) continue;
      GUN_DROP_MON_KEYS.add(`${rid}|${mid}`);
      (GUN_DROP_BY_MON[mid] = GUN_DROP_BY_MON[mid] || []).push({ rid, ratePct: f * 100 });
    }
  }
  for (const rows of Object.values(GUN_DROP_BY_MON)) {
    rows.sort((a, b) => b.ratePct - a.ratePct);
  }

  const SPELL_ELS_BY_RUNE = {};
  if (SPELL_CFG && SPELL_CFG.of) {
    for (const [el, rids] of Object.entries(SPELL_CFG.of)) {
      for (const rid of (rids || [])) {
        (SPELL_ELS_BY_RUNE[rid] = SPELL_ELS_BY_RUNE[rid] || []).push(el);
      }
    }
  }

  function getMonLvOnMap(mp, mon) {
    const mlv = mp && mp.mlv && mon ? mp.mlv[mon.id] : null;
    if (Array.isArray(mlv) && mlv.length >= 2) {
      const lo = Number(mlv[0]);
      const hi = Number(mlv[1]);
      return { min: lo, max: hi, label: lo === hi ? `Lv ${lo}` : `Lv ${lo}–${hi}` };
    }
    if (mlv != null && !Number.isNaN(Number(mlv))) {
      const n = Number(mlv);
      return { min: n, max: n, label: `Lv ${n}` };
    }
    const baseLv = mon && mon.lv != null ? Number(mon.lv) : null;
    return {
      min: baseLv ?? 0,
      max: baseLv ?? 0,
      label: baseLv != null ? `Lv ${baseLv}` : 'Lv ?'
    };
  }

  function parseMapMinLv(mp) {
    const m = String((mp && mp.lv) || '').match(/\d+/);
    return m ? Number(m[0]) : 999;
  }

  for (const m of (W.monsters || [])) {
    const mapLvs = (m.maps || []).filter(Boolean).map((mpId) => {
      const mp = MAP[mpId] || null;
      const lvInfo = getMonLvOnMap(mp, m);
      return { mapId: mpId, mp, min: lvInfo.min, max: lvInfo.max, label: lvInfo.label };
    });
    mapLvs.sort((a, b) => a.min - b.min || a.max - b.max);
    m._mapLvs = mapLvs;
    if (mapLvs.length) {
      m._lvMin = Math.min(...mapLvs.map((x) => x.min));
      m._lvMax = Math.max(...mapLvs.map((x) => x.max));
    } else {
      const base = Number(m.lv || 0);
      m._lvMin = base;
      m._lvMax = base;
    }
    m._lvLabel = m._lvMin === m._lvMax ? String(m._lvMin) : `${m._lvMin}–${m._lvMax}`;
  }

  function rangeMatchesLv(lo, hi, minLv, maxLv) {
    if (minLv != null && hi < minLv) return false;
    if (maxLv != null && lo > maxLv) return false;
    return true;
  }

  function getEligibleMapLvs(mon, maps, selectedMap, minLv, maxLv) {
    const baseIds = (maps && maps.length) ? maps : ((mon && mon.maps) || []).filter(Boolean);
    const targetIds = selectedMap ? (baseIds.includes(selectedMap) ? [selectedMap] : []) : baseIds;
    let entries = targetIds.map((mpId) => {
      const mp = MAP[mpId] || null;
      const lvInfo = getMonLvOnMap(mp, mon);
      return { mapId: mpId, mp, min: lvInfo.min, max: lvInfo.max, label: lvInfo.label };
    });
    if (minLv != null || maxLv != null) {
      entries = entries.filter((e) => rangeMatchesLv(e.min, e.max, minLv, maxLv));
    }
    entries.sort((a, b) => a.min - b.min || a.max - b.max);
    return entries;
  }

  function hasSpawnInLvRange(mon, maps, selectedMap, minLv, maxLv) {
    if (minLv == null && maxLv == null) return true;
    if (!mon) return true;
    const allMaps = (maps && maps.length) ? maps : (mon.maps || []).filter(Boolean);
    if (!allMaps.length) return rangeMatchesLv(mon._lvMin, mon._lvMax, minLv, maxLv);
    return getEligibleMapLvs(mon, allMaps, selectedMap, minLv, maxLv).length > 0;
  }

  function getDropLvRange(mon, maps, selectedMap, minLv, maxLv) {
    if (!mon) return { min: 0, max: 0, label: '–', entries: [] };
    let entries = getEligibleMapLvs(mon, maps, selectedMap, minLv, maxLv);
    if (!entries.length) {
      entries = getEligibleMapLvs(mon, maps, selectedMap, null, null);
    }
    if (entries.length) {
      const lo = Math.min(...entries.map((e) => e.min));
      const hi = Math.max(...entries.map((e) => e.max));
      return { min: lo, max: hi, label: lo === hi ? String(lo) : `${lo}–${hi}`, entries };
    }
    return { min: mon._lvMin, max: mon._lvMax, label: mon._lvLabel, entries: [] };
  }

  function renderMapLvChips(entries, limit = 2) {
    if (!entries || !entries.length) return '<span class="muted">–</span>';
    const shown = entries.slice(0, limit).map((e) => {
      const n = e.mp ? tr(e.mp.n) : e.mapId;
      return `<button type="button" class="chip-link" style="padding:2px 7px;font-size:11.5px" data-open="map" data-id="${esc(e.mapId)}">${esc(n)} · ${esc(e.label)}</button>`;
    }).join(' ');
    const more = entries.length > limit ? `<span class="muted" style="font-size:11px">+${entries.length - limit}</span>` : '';
    return shown + (more ? ' ' + more : '');
  }

  const ITEM_TO_SET = {};
  for (const st of (W.sets || [])) {
    for (const pid of (st.pcs || [])) ITEM_TO_SET[pid] = st;
  }

  const ALL_SKILLS = [];
  const SKILL_MAP = {};
  for (const j of (W.jobs || [])) {
    for (const sk of (j.sk || [])) {
      if (!SKILL_MAP[sk.id]) {
        const entry = { ...sk, jobId: j.id, jobName: j.n };
        SKILL_MAP[sk.id] = entry;
        ALL_SKILLS.push(entry);
      }
    }
  }

  const SKILL_BOOSTERS = {};
  for (const it of (W.items || [])) {
    for (const b of (it.wsk || [])) {
      (SKILL_BOOSTERS[b[0]] = SKILL_BOOSTERS[b[0]] || []).push({ item: it, boost: b });
    }
  }

  // Reverse Drop Indexes & Flat Drop Table
  const ITEM_DROPPERS = {};
  const MAT_DROPPERS = {};
  const RUNE_DROPPERS = {};
  const FLAT_DROPS = [];

  for (const m of (W.monsters || [])) {
    const maps = (m.maps || []).filter(Boolean);
    let evSum = 0;
    for (const d of (m.drops || [])) {
      const [tid, ratePct] = [d[0], Number(d[1])];
      (ITEM_DROPPERS[tid] = ITEM_DROPPERS[tid] || []).push({ mon: m, ratePct });
      const it = IT[tid];
      FLAT_DROPS.push({
        mon: m,
        dtype: 'item',
        targetId: tid,
        targetName: it ? it.n : tid,
        ratePct,
        price: null,
        ev: null,
        evPer1kHp: null,
        maps
      });
    }
    for (const mt of (m.mats || [])) {
      const [tid, frac] = [mt[0], Number(mt[1])];
      const ratePct = frac * 100;
      (MAT_DROPPERS[tid] = MAT_DROPPERS[tid] || []).push({ mon: m, ratePct });
      const mat = MAT[tid];
      const price = mat && mat.p != null ? Number(mat.p) : null;
      const ev = price != null ? price * frac : null;
      if (ev != null) evSum += ev;
      FLAT_DROPS.push({
        mon: m,
        dtype: 'material',
        targetId: tid,
        targetName: mat ? mat.n : tid,
        ratePct,
        price,
        ev,
        evPer1kHp: ev != null && m.hp > 0 ? (ev / m.hp) * 1000 : null,
        maps
      });
    }
    if (m.rune) {
      const [rid, frac] = [m.rune[0], Number(m.rune[1])];
      if (!GUN_DROP_MON_KEYS.has(`${rid}|${m.id}`)) {
        const ratePct = frac * 100;
        (RUNE_DROPPERS[rid] = RUNE_DROPPERS[rid] || []).push({ mon: m, ratePct, source: 'direct', minLv: 0 });
        const rObj = RUNES[rid];
        const price = rObj && Array.isArray(rObj.price) ? Number(rObj.price[0] ?? 0) : null;
        const ev = price != null ? price * frac : null;
        FLAT_DROPS.push({
          mon: m,
          dtype: 'rune',
          targetId: rid,
          targetName: rObj ? rObj.n : rid,
          ratePct,
          price,
          ev,
          evPer1kHp: ev != null && m.hp > 0 ? (ev / m.hp) * 1000 : null,
          maps
        });
      }
    }
    m._evCoin = evSum;
    m._evPer1kHp = m.hp > 0 ? (evSum / m.hp) * 1000 : 0;
  }

  // Index Gun Runes (W.s2.runes.gunDrop)
  for (const [rid, rows] of Object.entries(GUN_DROP)) {
    const rObj = RUNES[rid];
    const price = rObj && Array.isArray(rObj.price) ? Number(rObj.price[0] ?? 0) : null;
    for (const [mid, fracRaw] of (rows || [])) {
      const frac = Number(fracRaw || 0);
      const m = MON[mid];
      if (!m || !(frac > 0)) continue;
      const ratePct = frac * 100;
      (RUNE_DROPPERS[rid] = RUNE_DROPPERS[rid] || []).push({ mon: m, ratePct, source: 'gun', minLv: 0 });
      const ev = price != null ? price * frac : null;
      FLAT_DROPS.push({
        mon: m,
        dtype: 'rune',
        targetId: rid,
        targetName: rObj ? rObj.n : rid,
        ratePct,
        price,
        ev,
        evPer1kHp: ev != null && m.hp > 0 ? (ev / m.hp) * 1000 : null,
        maps: (m.maps || []).filter(Boolean)
      });
    }
  }

  // Index Lv 70+ Element Spell Runes (W.s2.runes.spell)
  if (SPELL_CFG && SPELL_CFG.of) {
    const spellMinLv = Number(SPELL_CFG.lv || 70);
    const spellFrac = Number(SPELL_CFG.rate || 0.00002);
    const spellRatePct = spellFrac * 100;
    for (const [rid, els] of Object.entries(SPELL_ELS_BY_RUNE)) {
      const elSet = new Set(els);
      const rObj = RUNES[rid];
      const price = rObj && Array.isArray(rObj.price) ? Number(rObj.price[0] ?? 0) : null;
      const ev = price != null ? price * spellFrac : null;
      for (const m of (W.monsters || [])) {
        if (!elSet.has(m.el)) continue;
        const allMaps = (m.maps || []).filter(Boolean);
        const eligibleMaps = allMaps.filter((mpId) => getMonLvOnMap(MAP[mpId], m).max >= spellMinLv);
        const noMapEligible = allMaps.length === 0 && Number(m.lv || 0) >= spellMinLv;
        if (!eligibleMaps.length && !noMapEligible) continue;
        (RUNE_DROPPERS[rid] = RUNE_DROPPERS[rid] || []).push({ mon: m, ratePct: spellRatePct, source: 'spell', minLv: spellMinLv });
        FLAT_DROPS.push({
          mon: m,
          dtype: 'rune',
          targetId: rid,
          targetName: rObj ? rObj.n : rid,
          ratePct: spellRatePct,
          price,
          ev,
          evPer1kHp: ev != null && m.hp > 0 ? (ev / m.hp) * 1000 : null,
          maps: eligibleMaps
        });
      }
    }
  }

  for (const dict of [ITEM_DROPPERS, MAT_DROPPERS, RUNE_DROPPERS]) {
    for (const k of Object.keys(dict)) {
      dict[k].sort((a, b) => b.ratePct - a.ratePct || (a.mon.lv || 0) - (b.mon.lv || 0));
    }
  }

  function groupRuneDroppersByMap(droppers, sortMode = 'density') {
    const mapBuckets = new Map();
    for (const d of (droppers || [])) {
      const reqLv = d.minLv || 0;
      const mapIds = (d.mon.maps || []).filter(Boolean);
      if (!mapIds.length) {
        if (reqLv && Number(d.mon.lv || 0) < reqLv) continue;
        let bucket = mapBuckets.get('__none__');
        if (!bucket) {
          bucket = {
            mapId: '__none__',
            mp: null,
            mapMinLv: 9999,
            maxRatePct: 0,
            sortName: 'zzzzzz',
            seenMons: new Set(),
            monsters: []
          };
          mapBuckets.set('__none__', bucket);
        }
        if (!bucket.seenMons.has(d.mon.id)) {
          bucket.seenMons.add(d.mon.id);
          bucket.monsters.push({ ...d, lvInfo: getMonLvOnMap(null, d.mon) });
          if (d.ratePct > bucket.maxRatePct) bucket.maxRatePct = d.ratePct;
        }
        continue;
      }
      for (const mpId of mapIds) {
        const mp = MAP[mpId] || null;
        const lvInfo = getMonLvOnMap(mp, d.mon);
        if (reqLv && lvInfo.max < reqLv) continue;
        let bucket = mapBuckets.get(mpId);
        if (!bucket) {
          bucket = {
            mapId: mpId,
            mp,
            mapMinLv: mp ? parseMapMinLv(mp) : 9999,
            maxRatePct: 0,
            sortName: mp ? mp.n : mpId,
            seenMons: new Set(),
            monsters: []
          };
          mapBuckets.set(mpId, bucket);
        }
        if (!bucket.seenMons.has(d.mon.id)) {
          bucket.seenMons.add(d.mon.id);
          bucket.monsters.push({ ...d, lvInfo });
          if (d.ratePct > bucket.maxRatePct) bucket.maxRatePct = d.ratePct;
        }
      }
    }
    const groups = Array.from(mapBuckets.values());
    for (const g of groups) {
      g.monsters.sort((a, b) =>
        b.ratePct - a.ratePct ||
        a.lvInfo.min - b.lvInfo.min ||
        String(a.mon.n || '').localeCompare(String(b.mon.n || ''))
      );
    }
    groups.sort((a, b) => {
      if (a.mapId === '__none__' && b.mapId !== '__none__') return 1;
      if (b.mapId === '__none__' && a.mapId !== '__none__') return -1;
      if (sortMode === 'level') {
        return a.mapMinLv - b.mapMinLv ||
          b.monsters.length - a.monsters.length ||
          b.maxRatePct - a.maxRatePct ||
          a.sortName.localeCompare(b.sortName);
      }
      return b.maxRatePct - a.maxRatePct ||
        b.monsters.length - a.monsters.length ||
        a.mapMinLv - b.mapMinLv ||
        a.sortName.localeCompare(b.sortName);
    });
    return groups;
  }

  const RUNE_MAP_COUNTS = {};
  for (const rid of Object.keys(RUNES)) {
    const groups = groupRuneDroppersByMap(RUNE_DROPPERS[rid] || []);
    RUNE_MAP_COUNTS[rid] = groups.filter((g) => g.mapId !== '__none__').length;
  }

  // Monster Art Cards (s2.lore.arts + bl_card_*)
  const LORE_CFG = S2.lore || {};
  const CARD_CFG = LORE_CFG.card || { rate: 0.0001, price: 500, priceBoss: 5000 };
  const CARD_RATE_PCT = Number(CARD_CFG.rate || 0.0001) * 100;
  const CARD_BY_MON = {};
  const CARDS_LIST = (LORE_CFG.arts || []).map((a) => {
    const cardId = 'bl_card_' + a.t;
    const matObj = MAT[cardId];
    const monObj = MON[a.t] || null;
    const isBoss = !!a.boss;
    const cardName = (matObj && matObj.n) || (a.mon + ' Card');
    const stallPrice = Number(isBoss ? (CARD_CFG.priceBoss || 5000) : (CARD_CFG.price || 500));
    const basePrice = Number((matObj && matObj.p) ?? (isBoss ? 225 : 23));
    const maps = monObj ? (monObj.maps || []).filter(Boolean) : [];
    const el = a.el || (monObj && monObj.el) || 'neutral';
    const passives = (a.apw || []).map((row) => row.join(' · '));
    const cardObj = {
      id: a.t,
      cardId,
      cardName,
      monName: a.mon || (monObj ? monObj.n : a.t),
      artName: a.n || '',
      artDesc: a.d || '',
      boss: isBoss,
      lv: Number(a.lv || (monObj && monObj.lv) || 0),
      el,
      fam: a.fam || '',
      cd: a.cd || 0,
      ratePct: CARD_RATE_PCT,
      stallPrice,
      basePrice,
      passives,
      mon: monObj,
      maps
    };
    CARD_BY_MON[a.t] = cardObj;
    if (monObj) {
      FLAT_DROPS.push({
        mon: monObj,
        dtype: 'card',
        targetId: a.t,
        cardMatId: cardId,
        targetName: cardName,
        ratePct: CARD_RATE_PCT,
        price: stallPrice,
        ev: stallPrice * (CARD_RATE_PCT / 100),
        evPer1kHp: monObj.hp > 0 ? ((stallPrice * (CARD_RATE_PCT / 100)) / monObj.hp) * 1000 : null,
        maps
      });
    }
    return cardObj;
  });

  const MAPS_WITH_MONS = (W.maps || []).filter((mp) => (mp.mons || []).length > 0);
  function mapOptionsHtml(selectedId) {
    return MAPS_WITH_MONS
      .slice()
      .sort((a, b) => tr(a.n).localeCompare(tr(b.n)))
      .map((mp) => `<option value="${esc(mp.id)}" ${selectedId === mp.id ? 'selected' : ''}>${esc(tr(mp.n))}${mp.lv ? ' (' + esc(mp.lv) + ')' : ''}</option>`)
      .join('');
  }

  // Smelter & Crafting Value-Add Analysis
  const SMELT_GOODS = (S2.smelt && S2.smelt.goods) || {};
  const SMELT_ANALYSIS = Object.entries((S2.smelt && S2.smelt.recipes) || {}).map(([rid, rc]) => {
    const outId = rc.out;
    const good = SMELT_GOODS[outId] || {};
    const outMat = MAT[outId];
    const outName = good.n || (outMat ? outMat.n : outId);
    const outPrice = Number(good.price != null ? good.price : (outMat && outMat.p != null ? outMat.p : 0));
    const outQty = Number(rc.n || 1);
    const fee = Number(rc.coins || 0);
    let rawCost = 0;
    let hasWildcard = false;
    const inputs = Object.entries(rc.in || {}).map(([mid, qty]) => {
      const isWild = String(mid).startsWith('*');
      if (isWild) hasWildcard = true;
      const mp = isWild ? 0 : Number((MAT[mid] && MAT[mid].p) ?? (SMELT_GOODS[mid] && SMELT_GOODS[mid].price) ?? 0);
      rawCost += mp * qty;
      return { id: mid, qty, price: mp, isWild, name: (MAT[mid] && MAT[mid].n) || (SMELT_GOODS[mid] && SMELT_GOODS[mid].n) || mid };
    });
    const totalCost = rawCost + fee;
    const revenue = outPrice * outQty;
    const netProfit = revenue - totalCost;
    const mult = rawCost > 0 ? revenue / rawCost : 0;
    return {
      id: rid,
      outId,
      outName,
      outPrice,
      outQty,
      revenue,
      fee,
      rawCost,
      totalCost,
      netProfit,
      mult,
      lv: rc.lv || 1,
      skill: rc.skill || '',
      xp: rc.xp || 0,
      hasWildcard,
      inputs
    };
  });

  // Unified Market Index (Gear Drops + Material Drops + Cards + Fish + Ore + Wood + Crops + Smelter + Dishes + Runes)
  const UNIFIED_MARKET = [];
  for (const d of FLAT_DROPS) {
    if (d.dtype === 'item') {
      UNIFIED_MARKET.push({
        cat: 'gear',
        dtype: 'item',
        id: d.targetId,
        openKind: 'item',
        spriteKind: 'items',
        name: d.targetName,
        lv: d.mon.lv || 0,
        price: null,
        ev: 0,
        ratePct: d.ratePct,
        el: d.mon.el || 'neutral',
        boss: !!d.mon.boss,
        hp: d.mon.hp || 0,
        evPer1kHp: 0,
        mon: d.mon,
        maps: d.maps || []
      });
      continue;
    }
    if (d.dtype === 'card') {
      UNIFIED_MARKET.push({
        cat: 'card',
        dtype: 'card',
        id: d.targetId,
        cardMatId: d.cardMatId,
        openKind: 'card',
        spriteKind: 'mats',
        name: d.targetName,
        lv: d.mon.lv || 0,
        price: d.price ?? 500,
        ev: d.ev ?? 0,
        ratePct: d.ratePct,
        el: d.mon.el || 'neutral',
        boss: !!d.mon.boss,
        hp: d.mon.hp || 0,
        evPer1kHp: d.evPer1kHp || 0,
        mon: d.mon,
        maps: d.maps || []
      });
      continue;
    }
    if (d.dtype !== 'material' && d.dtype !== 'rune') continue;
    UNIFIED_MARKET.push({
      cat: 'drop',
      dtype: d.dtype,
      id: d.targetId,
      openKind: d.dtype === 'material' ? 'mat' : 'rune',
      spriteKind: d.dtype === 'material' ? 'mats' : null,
      name: d.targetName,
      lv: d.mon.lv || 0,
      price: d.price ?? 0,
      ev: d.ev ?? 0,
      ratePct: d.ratePct,
      el: d.mon.el || 'neutral',
      boss: !!d.mon.boss,
      hp: d.mon.hp || 0,
      evPer1kHp: d.evPer1kHp || 0,
      mon: d.mon,
      maps: d.maps || []
    });
  }
  const LIFE_T = W.lifeTables || {};
  for (const f of (LIFE_T.fish || [])) {
    UNIFIED_MARKET.push({
      cat: 'fish',
      id: f.id,
      openKind: 'mat',
      spriteKind: 'mats',
      name: f.n,
      lv: f.lv || 1,
      price: Number(f.price || 0),
      ev: Number(f.price || 0),
      rod: f.rod || 1,
      when: f.when || 0,
      waters: f.waters || [],
      xp: f.xp || 0
    });
  }
  for (const o of (LIFE_T.ore || [])) {
    const mat = MAT[o.mat];
    const p = Number((mat && mat.p) || 0);
    UNIFIED_MARKET.push({
      cat: 'ore',
      id: o.mat || o.id,
      openKind: 'mat',
      spriteKind: 'mats',
      name: (mat && mat.n) || o.n,
      nodeName: o.n,
      lv: o.lv || 1,
      tier: o.tier || 1,
      hits: o.hits || 0,
      price: p,
      ev: p,
      xp: o.xp || 0
    });
  }
  for (const w of (LIFE_T.wood || [])) {
    const mat = MAT[w.mat];
    const p = Number((mat && mat.p) || 0);
    UNIFIED_MARKET.push({
      cat: 'wood',
      id: w.mat || w.id,
      openKind: 'mat',
      spriteKind: 'mats',
      name: (mat && mat.n) || w.n,
      nodeName: w.n,
      lv: w.lv || 1,
      tier: w.tier || 1,
      hits: w.hits || 0,
      price: p,
      ev: p,
      xp: w.xp || 0
    });
  }
  const seenCrops = new Set();
  for (const c of [...(LIFE_T.crops || []), ...Object.entries(S2.farm || {}).map(([id, v]) => ({ id, ...v }))]) {
    if (seenCrops.has(c.id)) continue;
    seenCrops.add(c.id);
    const mat = MAT[c.mat];
    const p = Number(c.price != null ? c.price : ((mat && mat.p) || 0));
    UNIFIED_MARKET.push({
      cat: 'crop',
      id: c.mat || c.id,
      openKind: 'mat',
      spriteKind: 'mats',
      name: c.n || (mat && mat.n) || c.id,
      lv: c.lv || 1,
      mins: c.mins || 0,
      price: p,
      ev: p,
      xp: c.xp || 0
    });
  }
  for (const sm of SMELT_ANALYSIS) {
    UNIFIED_MARKET.push({
      cat: 'smelt',
      id: sm.outId,
      openKind: 'mat',
      spriteKind: 'mats',
      name: sm.outName,
      lv: sm.lv,
      skill: sm.skill,
      price: sm.outPrice,
      ev: sm.netProfit,
      rawCost: sm.rawCost,
      fee: sm.fee,
      mult: sm.mult,
      outQty: sm.outQty,
      hasWildcard: sm.hasWildcard,
      xp: sm.xp
    });
  }
  for (const d of (LIFE_T.dishes || [])) {
    UNIFIED_MARKET.push({
      cat: 'dish',
      id: d.id,
      openKind: null,
      spriteKind: null,
      name: d.n,
      lv: d.lv || 1,
      price: Number(d.coins || 0),
      ev: Number(d.coins || 0),
      pot: d.pot || 1,
      xp: d.xp || 0
    });
  }
  for (const [rid, r] of Object.entries(RUNES)) {
    const prices = r.price || [0, 0, 0];
    UNIFIED_MARKET.push({
      cat: 'rune',
      id: rid,
      openKind: 'rune',
      spriteKind: null,
      name: r.n,
      lv: 1,
      price: Number(prices[2] || prices[0] || 0),
      ev: Number(prices[0] || 0),
      prices,
      kind: r.kind || '',
      on: r.on || ''
    });
  }

  // Stat formatting
  const STAT_N = {
    def: 'DEF', mdef: 'MDEF', hp: 'Max HP', sp: 'Max SP',
    str: 'STR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DEX', luk: 'LUK',
    hit: 'HIT', flee: 'FLEE', watk: 'Weapon ATK'
  };
  const STAT_F = {
    crit: 'Critical', atk: 'ATK', skill: 'Skill Power', cdr: 'Cooldown', spd: 'Move Speed'
  };

  function itemStatsList(it) {
    const out = [];
    if (it.atk) out.push(`ATK +${fmt(it.atk)}`);
    const st = it.st || {};
    for (const [k, label] of Object.entries(STAT_N)) {
      if (st[k] != null && st[k] !== 0) {
        const sign = st[k] > 0 ? '+' : '';
        out.push(`${label} ${sign}${fmt(st[k])}`);
      }
    }
    for (const [k, label] of Object.entries(STAT_F)) {
      if (st[k] != null && st[k] !== 0) {
        const pct = Math.round(st[k] * 1000) / 10;
        const sign = pct > 0 ? '+' : '';
        out.push(`${label} ${sign}${pct}%`);
      }
    }
    return out;
  }

  // Pre-build bilingual full-text search indexes (_q) across all entities
  for (const it of (W.items || [])) {
    const setObj = ITEM_TO_SET[it.id];
    const droppers = ITEM_DROPPERS[it.id] || [];
    const wskNames = (it.wsk || []).map((b) => [b[0], SKILL_MAP[b[0]] && SKILL_MAP[b[0]].n]);
    it._q = biText(
      it.id, it.n, it.d, it.ab, it.s, it.r, `lv ${it.lv || 1}`,
      it.wt, W.wtypes && W.wtypes[it.wt],
      it.el, W.elements && W.elements[it.el],
      it.atk ? `atk ${it.atk}` : '',
      itemStatsList(it), it.st,
      setObj ? [setObj.n, setObj.b2, setObj.b3, setObj.pas] : '',
      wskNames,
      droppers.map((d) => [d.mon.id, d.mon.n])
    );
  }

  for (const s of (W.sets || [])) {
    const pcsInfo = (s.pcs || []).map((pid) => {
      const it = IT[pid];
      return it ? [pid, it.n, it.d, it.ab, itemStatsList(it), it.st] : pid;
    });
    s._q = biText(
      s.id, s.n, s.line, `g${s.g}`, `grade ${s.g}`, `lv ${s.lv}`,
      s.b2, s.b3, s.pas, s.bonuses, pcsInfo
    );
  }

  for (const bs of (W.bossSets || [])) {
    const m = MON[bs.boss];
    const hatIt = IT[bs.hat];
    const accIt = IT[bs.acc];
    const wInfo = (bs.w || []).map((wid) => IT[wid] ? [wid, IT[wid].n, IT[wid].ab] : wid);
    bs._q = biText(
      bs.boss, m && m.n, bs.n, bs.text,
      hatIt && [hatIt.n, hatIt.ab, itemStatsList(hatIt)],
      accIt && [accIt.n, accIt.ab, itemStatsList(accIt)],
      wInfo
    );
  }

  for (const m of (W.monsters || [])) {
    const armTypes = (S2.armour && S2.armour.types) || {};
    const bm = S2.bossMoves && S2.bossMoves[m.id];
    const cObj = CARD_BY_MON[m.id];
    m._q = biText(
      m.id, m.n, `lv ${m.lv ?? ''}`,
      m.boss ? 'boss' : 'normal', m.story ? 'story' : '',
      m.el, W.elements && W.elements[m.el],
      m.race, W.races && W.races[m.race],
      m.arm, armTypes[m.arm] && armTypes[m.arm].n, m.st,
      (m.maps || []).map((mpid) => [mpid, MAP[mpid] && MAP[mpid].n]),
      (m.drops || []).map(([tid]) => [tid, IT[tid] && IT[tid].n]),
      (m.mats || []).map(([tid]) => [tid, MAT[tid] && MAT[tid].n]),
      m.rune ? [m.rune[0], RUNES[m.rune[0]] && RUNES[m.rune[0]].n] : '',
      cObj ? [cObj.cardName, cObj.artName, cObj.passives] : '',
      bm ? [bm.moves, bm.minion] : ''
    );
  }

  for (const j of (W.jobs || [])) {
    j._q = biText(
      j.id, j.n, j.d, `tier ${j.tier}`,
      j.from && [j.from, JOB[j.from] && JOB[j.from].n],
      (j.wt || []).map((w) => [w, W.wtypes && W.wtypes[w]]),
      (j.lines || []).map((ln) => [ln.id, ln.n, ln.el]),
      (j.sk || []).map((sk) => [sk.id, sk.n, sk.d])
    );
  }

  for (const s of ALL_SKILLS) {
    const boosters = SKILL_BOOSTERS[s.id] || [];
    s._q = biText(
      s.id, s.n, s.d, s.jobId, s.jobName, s.line,
      s.active ? (s.type === 'magic' ? 'magic' : 'attack') : 'passive',
      s.type, s.el, W.elements && W.elements[s.el], s.rg ? `range ${s.rg}` : '',
      boosters.map((b) => [b.item.id, b.item.n])
    );
  }

  for (const mp of (W.maps || [])) {
    const reg = mp.pin && REG[mp.pin[0]];
    const parent = mp.parent && MAP[mp.parent];
    mp._q = biText(
      mp.id, mp.n, mp.lv, mp.kind, mp.secret ? 'secret' : '',
      reg && [reg.id, reg.n],
      parent && [parent.id, parent.n],
      mp.zones,
      (mp.mons || []).map((mid) => MON[mid] ? [mid, MON[mid].n, MON[mid].el, W.elements && W.elements[MON[mid].el]] : mid)
    );
  }

  for (const mat of (W.materials || [])) {
    const droppers = MAT_DROPPERS[mat.id] || [];
    mat._q = biText(
      mat.id, mat.n, mat.d, mat.from, mat.p != null ? `${mat.p}c` : '',
      mat.rare ? 'rare' : '', mat.life ? 'life' : '',
      droppers.map((d) => [d.mon.id, d.mon.n, (d.mon.maps || []).map((mp) => MAP[mp] && MAP[mp].n)])
    );
  }

  for (const c of CARDS_LIST) {
    const fam = c.fam && LORE_CFG.fam && LORE_CFG.fam[c.fam];
    c._q = biText(
      c.id, c.cardId, c.cardName, c.monName, c.artName, c.artDesc,
      c.el, W.elements && W.elements[c.el],
      c.boss ? 'boss 5000' : 'normal 500', `lv ${c.lv}`,
      c.fam, fam && [fam.n, fam.perks],
      c.passives,
      (c.maps || []).map((mp) => [mp, MAP[mp] && MAP[mp].n])
    );
  }

  for (const d of FLAT_DROPS) {
    const extra = d.dtype === 'item' ? (IT[d.targetId] && IT[d.targetId]._q)
      : d.dtype === 'material' ? (MAT[d.targetId] && MAT[d.targetId]._q)
      : d.dtype === 'card' ? (CARD_BY_MON[d.targetId] && CARD_BY_MON[d.targetId]._q)
      : (RUNES[d.targetId] ? biText(RUNES[d.targetId].n, RUNES[d.targetId].t, RUNES[d.targetId].kind, RUNES[d.targetId].on) : '');
    d._q = `${extra || ''} ` + biText(
      d.dtype, d.targetId, d.targetName,
      d.mon.id, d.mon.n, d.mon.el, W.elements && W.elements[d.mon.el],
      d.mon.boss ? 'boss' : 'normal', `lv ${d.mon.lv ?? ''}`,
      (d.maps || []).map((mp) => [mp, MAP[mp] && MAP[mp].n])
    );
  }

  const SMELT_WORK_ORDER_NPCS = {};
  for (const [gid, gv] of Object.entries((S2.orders && S2.orders.givers) || {})) {
    for (const tierList of (gv.goods || [])) {
      for (const id of tierList) {
        (SMELT_WORK_ORDER_NPCS[id] = SMELT_WORK_ORDER_NPCS[id] || []).push(gv.n);
      }
    }
  }
  for (const r of SMELT_ANALYSIS) {
    const good = SMELT_GOODS[r.outId];
    r._q = biText(
      r.id, r.outId, r.outName, r.skill, `lv ${r.lv}`,
      good && good.d,
      r.inputs.map((i) => [i.id, i.name]),
      SMELT_WORK_ORDER_NPCS[r.outId]
    );
  }

  for (const x of UNIFIED_MARKET) {
    const extra = x.cat === 'gear' ? (IT[x.id] && IT[x.id]._q)
      : x.cat === 'card' ? (CARD_BY_MON[x.id] && CARD_BY_MON[x.id]._q)
      : x.cat === 'smelt' ? (SMELT_ANALYSIS.find((r) => r.outId === x.id)?._q || '')
      : (MAT[x.id] && MAT[x.id]._q) || '';
    const wObj = x.when != null ? WHEN_LABELS[x.when] : null;
    x._q = `${extra} ` + biText(
      x.cat, x.id, x.name, x.nodeName, x.skill, x.kind, x.on,
      x.waters, wObj && [wObj.th, wObj.en],
      x.el, W.elements && W.elements[x.el],
      x.mon && [x.mon.id, x.mon.n],
      (x.maps || []).map((mp) => [mp, MAP[mp] && MAP[mp].n]),
      `lv ${x.lv ?? ''}`, x.price != null ? `${x.price}c` : ''
    );
  }

  for (const qObj of (W.quests || [])) {
    qObj._q = biText(qObj.id, qObj.t, qObj.ch, qObj.map, `lv ${qObj.lv ?? 1}`, qObj.obj);
  }

  const RUNES_LIST = Object.entries(RUNES).map(([id, r]) => {
    const droppers = RUNE_DROPPERS[id] || [];
    const spellEls = SPELL_ELS_BY_RUNE[id] || [];
    const groups = groupRuneDroppersByMap(droppers);
    return {
      id,
      ...r,
      _q: biText(
        id, r.n, r.kind, r.on, r.t, r.price,
        r.el, W.elements && W.elements[r.el],
        spellEls, spellEls.map((el) => W.elements && W.elements[el]),
        droppers.map((d) => [d.mon.id, d.mon.n]),
        groups.filter((g) => g.mapId !== '__none__').map((g) => [g.mapId, g.mp && g.mp.n])
      )
    };
  });
  const RELICS_LIST = Object.entries((S2.relics && S2.relics.list) || {}).map(([id, rel]) => ({
    id,
    ...rel,
    _q: biText(id, rel.n, rel.el, W.elements && W.elements[rel.el], rel.gain, rel.price)
  }));
  const KEYSTONES_LIST = Object.entries((S2.keystone && S2.keystone.branches) || {}).map(([id, ks]) => ({
    id,
    ...ks,
    _q: biText(id, ks.n, ks.small, ks.gain, ks.price)
  }));

  // ------------------------------------------------------------------ Navigation Config
  const NAV_ITEMS = [
    { id: 'overview', icon: '📊', th: 'ภาพรวม & สถิติ', en: 'Overview & Stats', count: null },
    { id: 'market', icon: '💰', th: 'ฟาร์มเงิน & กรองราคา', en: 'Price & Farm Filter', count: UNIFIED_MARKET.length },
    { id: 'monsters', icon: '👾', th: 'มอนสเตอร์ & บอส', en: 'Monsters & Bosses', count: (W.monsters || []).length },
    { id: 'items', icon: '⚔️', th: 'อาวุธ & อุปกรณ์', en: 'Items & Gear', count: (W.items || []).length },
    { id: 'sets', icon: '🛡️', th: 'เซ็ตอุปกรณ์', en: 'Equipment Sets', count: (W.sets || []).length + (W.bossSets || []).length },
    { id: 'jobs', icon: '🧙', th: 'อาชีพ & สกิล', en: 'Jobs & Skills', count: (W.jobs || []).length },
    { id: 'maps', icon: '🗺️', th: 'แผนที่ & โลก', en: 'Maps & World', count: (W.maps || []).length },
    { id: 'drops', icon: '💎', th: 'ค้นหาดรอป & วัตถุดิบ', en: 'Drops & Materials', count: FLAT_DROPS.length },
    { id: 'cards', icon: '🃏', th: 'การ์ดมอนสเตอร์', en: 'Monster Cards', count: CARDS_LIST.length },
    { id: 'runes', icon: '🔮', th: 'รูน, เรลิก & คีย์สโตน', en: 'Runes & Relics', count: Object.keys(RUNES).length },
    { id: 'quests', icon: '📜', th: 'เควสต์ & สกิลชีวิต', en: 'Quests & Life Skills', count: (W.quests || []).length },
    { id: 'season2', icon: '🌙', th: 'Season 2 & Export', en: 'Season 2 & Export', count: null }
  ];

  function renderNav() {
    $('#navMenu').innerHTML = NAV_ITEMS.map((item) => {
      const label = L(item.th, item.en);
      const badge = item.count != null ? `<span class="nav__badge">${fmt(item.count)}</span>` : '';
      return `<button type="button" class="nav__item ${state.view === item.id ? 'is-active' : ''}" data-view="${item.id}">
        <span class="nav__left"><span class="nav__icon">${item.icon}</span><span class="nav__label">${esc(label)}</span></span>
        ${badge}
      </button>`;
    }).join('');
    $('#seasonBadge').textContent = W.season || 'SS2 · v0.2';
    $('#buildInfo').textContent = `Built: ${String(W.at || '').slice(0, 10)} · ${fmt(Object.keys(DATA_TR).length)} TH strings`;
    $('#langPillTH').classList.toggle('is-on', state.lang === 'th');
    $('#langPillEN').classList.toggle('is-on', state.lang === 'en');
    $('#globalSearchInput').placeholder = L('ค้นหา มอนสเตอร์ ไอเทม อาชีพ สกิล แผนที่... (Ctrl+K)', 'Search monsters, items, jobs, skills, maps... (Ctrl+K)');
  }

  function setView(viewId) {
    if (!NAV_ITEMS.some((x) => x.id === viewId)) viewId = 'overview';
    state.view = viewId;
    if (location.hash !== '#' + viewId) {
      history.replaceState(null, '', '#' + viewId);
    }
    renderNav();
    renderCurrentView();
    closeMobileSidebar();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ------------------------------------------------------------------ Pagination Helper
  function renderPager(total, perPage, page, extraAttrs = '') {
    const pages = Math.max(1, Math.ceil(total / perPage));
    const cur = Math.min(page, pages - 1);
    const nums = [];
    for (let i = 0; i < pages; i++) {
      if (i < 2 || i >= pages - 2 || Math.abs(i - cur) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== -1) nums.push(-1);
    }
    return `<div class="pager">
      <div class="muted">${L('ทั้งหมด', 'Total')} <strong class="num">${fmt(total)}</strong> ${L('รายการ', 'entries')} · ${L('หน้า', 'Page')} ${cur + 1}/${pages}</div>
      <div class="pager__btns">
        <button type="button" class="pager__btn" ${extraAttrs} data-page="${cur - 1}" ${cur <= 0 ? 'disabled' : ''}>◀</button>
        ${nums.map((n) => n < 0
          ? '<span class="muted" style="padding:0 4px">…</span>'
          : `<button type="button" class="pager__btn ${n === cur ? 'is-on' : ''}" ${extraAttrs} data-page="${n}">${n + 1}</button>`
        ).join('')}
        <button type="button" class="pager__btn" ${extraAttrs} data-page="${cur + 1}" ${cur >= pages - 1 ? 'disabled' : ''}>▶</button>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------ VIEW 1: OVERVIEW
  function renderOverview() {
    const mons = W.monsters || [];
    const items = W.items || [];
    const bosses = mons.filter((m) => m.boss);
    const kpis = [
      { view: 'items', icon: '⚔️', label: L('ไอเทม & อาวุธ', 'Items & Weapons'), val: items.length, sub: `${items.filter((x) => x.s === 'weapon').length} ${L('อาวุธ', 'weapons')}` },
      { view: 'monsters', icon: '👾', label: L('มอนสเตอร์', 'Monsters'), val: mons.length, sub: `${bosses.length} ${L('บอส', 'bosses')}` },
      { view: 'maps', icon: '🗺️', label: L('แผนที่', 'Maps'), val: (W.maps || []).length, sub: `${(W.regions || []).length} ${L('ภูมิภาค', 'regions')}` },
      { view: 'jobs', icon: '🧙', label: L('อาชีพ & สกิล', 'Jobs & Skills'), val: (W.jobs || []).length, sub: `${ALL_SKILLS.length} ${L('สกิล', 'skills')}` },
      { view: 'drops', icon: '💎', label: L('วัตถุดิบ & ดรอป', 'Materials & Drops'), val: (W.materials || []).length, sub: `${fmt(FLAT_DROPS.length)} ${L('รายการดรอป', 'drop links')}` },
      { view: 'sets', icon: '🛡️', label: L('เซ็ตอุปกรณ์', 'Equipment Sets'), val: (W.sets || []).length, sub: `+ ${(W.bossSets || []).length} ${L('เซ็ตบอส', 'boss sets')}` },
      { view: 'runes', icon: '🔮', label: L('รูน & เรลิก', 'Runes & Relics'), val: Object.keys(RUNES).length, sub: `${Object.keys((S2.relics && S2.relics.list) || {}).length} ${L('เรลิก', 'relics')}` },
      { view: 'quests', icon: '📜', label: L('เควสต์', 'Quests'), val: (W.quests || []).length, sub: `${(W.life || []).length} ${L('สกิลชีวิต', 'life skills')}` }
    ];

    const countBy = (arr, keyFn) => {
      const map = {};
      for (const x of arr) {
        const k = keyFn(x) || 'unknown';
        map[k] = (map[k] || 0) + 1;
      }
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    };

    const slots = countBy(items, (x) => x.s);
    const rarities = countBy(items, (x) => x.r);
    const monEls = countBy(mons, (x) => x.el || 'neutral');
    const monArms = countBy(mons, (x) => x.arm || 'flesh');

    const renderBars = (entries, maxVal, colorFn, labelFn) =>
      `<div class="bar-list">${entries.map(([k, v]) => `
        <div class="bar-row">
          <div class="bar-row__label">${labelFn(k)}</div>
          <div class="bar-row__track"><div class="bar-row__fill" style="width:${Math.max(4, (v / maxVal) * 100)}%;background:${colorFn(k)}"></div></div>
          <div class="bar-row__val">${fmt(v)}</div>
        </div>`).join('')}</div>`;

    const topBosses = bosses.slice().sort((a, b) => (b.hp || 0) - (a.hp || 0)).slice(0, 8);
    const topExp = mons.filter((m) => !m.boss && (m.exp || 0) > 0).sort((a, b) => (b.exp || 0) - (a.exp || 0)).slice(0, 8);

    // XP Curve SVG
    const xpArr = S2.xp || [];
    let xpSvg = '<div class="muted">No XP table</div>';
    if (xpArr.length) {
      const w = 640, h = 190, padL = 50, padR = 12, padT = 14, padB = 26;
      const maxXp = Math.max(...xpArr);
      const pts = xpArr.map((v, i) => {
        const x = padL + (i / Math.max(1, xpArr.length - 1)) * (w - padL - padR);
        const y = h - padB - (v / maxXp) * (h - padT - padB);
        return [x, y];
      });
      const poly = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      const area = `${padL},${h - padB} ${poly} ${w - padR},${h - padB}`;
      xpSvg = `<svg class="svg-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f5b942" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#f5b942" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="rgba(255,255,255,0.12)"/>
        <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="rgba(255,255,255,0.12)"/>
        <polygon points="${area}" fill="url(#xpGrad)"/>
        <polyline points="${poly}" fill="none" stroke="#f5b942" stroke-width="2.5"/>
        <text x="${padL}" y="${h - 6}" fill="#8f86b3" font-size="11">Lv 1</text>
        <text x="${w / 2}" y="${h - 6}" fill="#8f86b3" font-size="11" text-anchor="middle">Lv ${Math.round(xpArr.length / 2)}</text>
        <text x="${w - padR}" y="${h - 6}" fill="#8f86b3" font-size="11" text-anchor="end">Lv ${xpArr.length}</text>
        <text x="${padL - 6}" y="${padT + 8}" fill="#8f86b3" font-size="10" text-anchor="end">${fmt(maxXp)}</text>
      </svg>`;
    }

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>${L('Night Camp Wiki · ฐานข้อมูลเกมฉบับสมบูรณ์', 'Night Camp Wiki · Complete Game Database')}</h1>
          <p>${L('รวบรวมข้อมูลจาก play.nightcamp.app/wiki พร้อมภาษาไทยและอังกฤษ', 'Scraped from play.nightcamp.app/wiki with full Thai & English support')} · <code>${esc(W.season || 'SS2')}</code> (${esc((S2 && S2.version) || '')})</p>
        </div>
        <button type="button" class="btn btn--gold" data-jump="season2">📦 ${L('ดาวน์โหลด JSON / CSV', 'Export JSON / CSV')}</button>
      </div>

      <div class="kpi-grid">
        ${kpis.map((k) => `
          <div class="kpi-card" data-jump="${k.view}">
            <div class="kpi-card__top"><span>${esc(k.label)}</span><span>${k.icon}</span></div>
            <div class="kpi-card__val">${fmt(k.val)}</div>
            <div class="kpi-card__sub">${esc(k.sub)}</div>
          </div>`).join('')}
      </div>

      <div class="grid-2">
        <section class="panel">
          <h2 class="panel__title"><span>⚔️ ${L('สัดส่วนไอเทมตามช่องสวมใส่', 'Items by Slot')}</span><span class="muted num">${fmt(items.length)}</span></h2>
          ${renderBars(slots, slots[0][1], () => 'linear-gradient(90deg, #8a4fe0, #f5b942)', (k) => esc(tr(k.toUpperCase())))}
        </section>
        <section class="panel">
          <h2 class="panel__title"><span>✨ ${L('ไอเทมตามระดับความหายาก', 'Items by Rarity')}</span><span class="muted num">${fmt(items.length)}</span></h2>
          ${renderBars(rarities, rarities[0][1], (k) => RAR_COLOR[k] || '#8a8499', (k) => esc(tr(k)))}
        </section>
      </div>

      <div class="grid-2">
        <section class="panel">
          <h2 class="panel__title"><span>🔥 ${L('มอนสเตอร์แยกตามธาตุ', 'Monsters by Element')}</span><span class="muted num">${fmt(mons.length)}</span></h2>
          ${renderBars(monEls, monEls[0][1], (k) => EL_COLOR[k] || '#8d8578', (k) => `${elIcon(k, 14)}<span>${esc(tr((W.elements && W.elements[k]) || k))}</span>`)}
        </section>
        <section class="panel">
          <h2 class="panel__title"><span>🛡️ ${L('มอนสเตอร์แยกตามประเภทเกราะ (Season 2)', 'Monsters by Armor Type (Season 2)')}</span><span class="muted num">${fmt(mons.length)}</span></h2>
          ${renderBars(monArms, monArms[0][1], (k) => ARM_COLOR[k] || '#8a94a6', (k) => {
            const info = S2.armour && S2.armour.types && S2.armour.types[k];
            return esc(tr(info ? info.n : k));
          })}
        </section>
      </div>

      <div class="grid-2">
        <section class="panel">
          <h2 class="panel__title"><span>💀 ${L('บอส HP สูงสุด', 'Top Bosses by HP')}</span></h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>${L('มอนสเตอร์', 'Monster')}</th><th>Lv</th><th>${L('ธาตุ', 'El')}</th><th style="text-align:right">HP</th></tr></thead>
            <tbody>
              ${topBosses.map((m) => `<tr data-open="monster" data-id="${esc(m.id)}">
                <td><div class="name-cell">${monSprite(m, 34)}<div>${nameHtml(m.n)}</div></div></td>
                <td class="num">${m.lv ?? '–'}</td>
                <td>${elIcon(m.el, 18)}</td>
                <td class="num" style="text-align:right;color:var(--red);font-weight:700">${fmt(m.hp)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </section>
        <section class="panel">
          <h2 class="panel__title"><span>⭐ ${L('มอนสเตอร์ทั่วไปที่ให้ EXP สูงสุด', 'Top Normal Monsters by EXP')}</span></h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>${L('มอนสเตอร์', 'Monster')}</th><th>Lv</th><th style="text-align:right">EXP</th><th style="text-align:right">JEXP</th></tr></thead>
            <tbody>
              ${topExp.map((m) => `<tr data-open="monster" data-id="${esc(m.id)}">
                <td><div class="name-cell">${monSprite(m, 34)}<div>${nameHtml(m.n)}</div></div></td>
                <td class="num">${m.lv ?? '–'}</td>
                <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmt(m.exp)}</td>
                <td class="num" style="text-align:right">${fmt(m.jexp)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </section>
      </div>

      <section class="panel">
        <h2 class="panel__title"><span>📈 ${L('กราฟ EXP ต่อเลเวล (Lv 1–98)', 'Level 1–98 XP Requirement Curve')}</span></h2>
        ${xpSvg}
      </section>
    `;

    $('#mainView').querySelectorAll('[data-jump]').forEach((el) => {
      el.addEventListener('click', () => setView(el.dataset.jump));
    });
  }

  // ------------------------------------------------------------------ VIEW: MARKET & PRICE FILTER
  function renderMarket() {
    const st = state.market;
    if (st.tab === 'craft') {
      renderCraftAnalyzer();
      return;
    }

    const q = norm(st.q);
    const minP = st.minPrice !== '' ? Number(st.minPrice) : null;
    const maxP = st.maxPrice !== '' ? Number(st.maxPrice) : null;
    const minLv = st.minLv !== '' ? Number(st.minLv) : null;
    const maxLv = st.maxLv !== '' ? Number(st.maxLv) : null;
    const minR = st.minRate !== '' ? Number(st.minRate) : null;
    const maxRod = st.maxRod !== '' ? Number(st.maxRod) : null;

    const cats = [
      ['all', L('ทั้งหมด', 'All')],
      ['drop', L('วัตถุดิบดรอป', 'Material Drops')],
      ['gear', L('ไอเทม/อาวุธดรอป', 'Gear Drops')],
      ['card', L('การ์ดมอนสเตอร์', 'Monster Cards')],
      ['fish', L('ปลา', 'Fish')],
      ['ore', L('แร่', 'Ore')],
      ['wood', L('ไม้', 'Wood')],
      ['crop', L('พืชผัก', 'Crops')],
      ['smelt', L('ของหลอม (Smelt)', 'Smelted')],
      ['dish', L('อาหาร', 'Dishes')],
      ['rune', L('รูน', 'Runes')]
    ];
    const catCounts = { all: UNIFIED_MARKET.length };
    for (const row of UNIFIED_MARKET) catCounts[row.cat] = (catCounts[row.cat] || 0) + 1;
    const isDropCat = (c) => c === 'drop' || c === 'gear' || c === 'card';

    let list = UNIFIED_MARKET.filter((x) => {
      if (st.cat !== 'all' && x.cat !== st.cat) return false;
      if (minP != null && (x.price == null || x.price < minP)) return false;
      if (maxP != null && (x.price == null || x.price > maxP)) return false;
      if (minLv != null || maxLv != null) {
        if (isDropCat(x.cat) && x.mon) {
          if (!hasSpawnInLvRange(x.mon, x.maps, st.map, minLv, maxLv)) return false;
        } else {
          if (minLv != null && (x.lv ?? 0) < minLv) return false;
          if (maxLv != null && (x.lv ?? 0) > maxLv) return false;
        }
      }
      if (st.el) {
        if (!isDropCat(x.cat) || x.el !== st.el) return false;
      }
      if (st.map) {
        if (!isDropCat(x.cat) || !(x.maps || []).includes(st.map)) return false;
      }
      if (minR != null) {
        if (!isDropCat(x.cat) || (x.ratePct || 0) <= minR) return false;
      }
      if (st.monType !== 'all') {
        if (!isDropCat(x.cat)) return false;
        if (st.monType === 'boss' && !x.boss) return false;
        if (st.monType === 'normal' && x.boss) return false;
      }
      if (st.when !== 'all') {
        if (x.cat !== 'fish' || String(x.when) !== st.when) return false;
      }
      if (maxRod != null) {
        if (x.cat !== 'fish' || (x.rod || 1) > maxRod) return false;
      }
      if (q && !matchesQuery(x._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      let va = 0, vb = 0;
      if (st.sort === 'ev') { va = a.ev ?? -1; vb = b.ev ?? -1; }
      else if (st.sort === 'price') { va = a.price ?? -1; vb = b.price ?? -1; }
      else if (st.sort === 'rate') { va = a.ratePct ?? -1; vb = b.ratePct ?? -1; }
      else if (st.sort === 'lv') {
        const ra = isDropCat(a.cat) && a.mon ? getDropLvRange(a.mon, a.maps, st.map, minLv, maxLv) : null;
        const rb = isDropCat(b.cat) && b.mon ? getDropLvRange(b.mon, b.maps, st.map, minLv, maxLv) : null;
        va = ra ? (st.dir > 0 ? ra.min : ra.max) : (a.lv ?? 0);
        vb = rb ? (st.dir > 0 ? rb.min : rb.max) : (b.lv ?? 0);
      }
      else if (st.sort === 'hp') { va = a.hp ?? 0; vb = b.hp ?? 0; }
      else if (st.sort === 'evPerHp') { va = a.evPer1kHp ?? 0; vb = b.evPer1kHp ?? 0; }
      else { va = tr(a.name); vb = tr(b.name); }
      if (typeof va === 'number') return (va - vb) * st.dir;
      return String(va).localeCompare(String(vb)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);

    const catColor = { drop: '#3f95ff', gear: '#e667ad', card: '#f5b942', fish: '#3aa6c4', ore: '#ff8f3f', wood: '#38c97a', crop: '#c99a0a', smelt: '#f5b942', dish: '#e667ad', rune: '#9a5cf0' };
    const catLabel = Object.fromEntries(cats);
    const elOpts = Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.el === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>💰 ${L('ฟาร์มเงิน & ตัวกรองราคาทุกหมวด', 'Price, Level & Life Resource Filter')}</h1>
          <p>${L('กรองราคา เลเวล มอนสเตอร์ แมพ ธาตุ % ดรอป การ์ด ปลา (เวลา/เบ็ด) แร่ ไม้ พืชผัก ของหลอม และรูน ในหน้าเดียว', 'Unified filter across gear/material/card drops, maps, elements, fish, ore, wood, crops, smelted goods, and runes')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn is-on" data-mktab="filter">🔍 ${L('กรองราคา & แหล่งฟาร์ม', 'Unified Filter')} (${fmt(UNIFIED_MARKET.length)})</button>
        <button type="button" class="tab-btn" data-mktab="craft">🔥 ${L('วิเคราะห์กำไรคราฟต์ / หลอมแร่', 'Crafting & Smelter Value-Add')} (${SMELT_ANALYSIS.length})</button>
      </div>

      <div class="tabs">
        ${cats.map(([k, lbl]) => `<button type="button" class="tab-btn ${st.cat === k ? 'is-on' : ''}" data-mkcat="${k}">${esc(lbl)} (${fmt(catCounts[k] || 0)})</button>`).join('')}
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <button type="button" class="chip-link" data-preset="water30">💧 ${L('ธาตุน้ำ Lv≤30 ดรอป>30%', 'Water Lv≤30 Drop>30%')}</button>
        <button type="button" class="chip-link" data-preset="early">🌱 ${L('ต้นเกม Lv≤30 เฉลี่ยแพงสุด', 'Early Lv≤30 Best EV')}</button>
        <button type="button" class="chip-link" data-preset="cards">🃏 ${L('การ์ดบอส (5,000c)', 'Boss Cards (5,000c)')}</button>
        <button type="button" class="chip-link" data-preset="fishnight">🌙 ${L('ปลากลางคืน เบ็ด≤2', 'Night Fish Rod≤2')}</button>
        <button type="button" class="chip-link" data-preset="orewood">⛏️ ${L('แร่ทั้งหมด', 'All Ores')}</button>
        <button type="button" class="chip-link" data-preset="smelt">🔥 ${L('ของหลอมกำไรสูง', 'Best Smelt Profit')}</button>
        <button type="button" class="chip-link" data-preset="reset">↺ ${L('ล้างตัวกรอง', 'Reset')}</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="mkQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อของ / การ์ด / มอนสเตอร์ / แผนที่...', 'Search item, card, monster, map...')}">
        <input class="input input--sm" id="mkMinP" type="number" step="any" placeholder="Min c" value="${esc(st.minPrice)}">
        <input class="input input--sm" id="mkMaxP" type="number" step="any" placeholder="Max c" value="${esc(st.maxPrice)}">
        <input class="input input--sm" id="mkMinLv" type="number" placeholder="Min Lv" value="${esc(st.minLv)}">
        <input class="input input--sm" id="mkMaxLv" type="number" placeholder="Max Lv" value="${esc(st.maxLv)}">
        <select class="select" id="mkEl"><option value="">${L('ทุกธาตุ (มอน)', 'All Elements')}</option>${elOpts}</select>
        <select class="select" id="mkMap"><option value="">${L('ทุกแมพ', 'All Maps')}</option>${mapOptionsHtml(st.map)}</select>
        <input class="input input--sm" id="mkMinR" type="number" step="any" placeholder="Drop >%" value="${esc(st.minRate)}" title="${L('โอกาสดรอปมากกว่า (%)', 'Drop rate greater than (%)')}">
        <select class="select" id="mkMonT">
          <option value="all" ${st.monType === 'all' ? 'selected' : ''}>${L('มอน: ทั้งหมด', 'Mon: All')}</option>
          <option value="normal" ${st.monType === 'normal' ? 'selected' : ''}>${L('เฉพาะมอนทั่วไป', 'Normal Only')}</option>
          <option value="boss" ${st.monType === 'boss' ? 'selected' : ''}>${L('เฉพาะบอส', 'Boss Only')}</option>
        </select>
        <select class="select" id="mkWhen">
          <option value="all" ${st.when === 'all' ? 'selected' : ''}>${L('เวลาตกปลา: ทั้งหมด', 'Fish Time: All')}</option>
          <option value="0" ${st.when === '0' ? 'selected' : ''}>${L('ตลอดวัน', 'Any time')}</option>
          <option value="1" ${st.when === '1' ? 'selected' : ''}>${L('กลางคืน', 'Night')}</option>
          <option value="2" ${st.when === '2' ? 'selected' : ''}>${L('กลางวัน', 'Day')}</option>
        </select>
        <select class="select" id="mkRod">
          <option value="">${L('เบ็ด: ทุกขั้น', 'Rod: Any')}</option>
          ${[1, 2, 3, 4].map((r) => `<option value="${r}" ${st.maxRod === String(r) ? 'selected' : ''}>Rod ≤ ${r}</option>`).join('')}
        </select>
        <select class="select" id="mkSort">
          <option value="ev" ${st.sort === 'ev' ? 'selected' : ''}>Sort: ${L('เฉลี่ย/กำไร (EV)', 'EV / Profit')}</option>
          <option value="price" ${st.sort === 'price' ? 'selected' : ''}>Sort: ${L('ราคาต่อชิ้น', 'Unit Price')}</option>
          <option value="rate" ${st.sort === 'rate' ? 'selected' : ''}>Sort: ${L('โอกาสดรอป %', 'Drop Rate %')}</option>
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
          <option value="hp" ${st.sort === 'hp' ? 'selected' : ''}>Sort: HP</option>
          <option value="evPerHp" ${st.sort === 'evPerHp' ? 'selected' : ''}>Sort: Coin/1k HP</option>
          <option value="name" ${st.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
        </select>
        <button type="button" class="btn" id="mkDir">${st.dir > 0 ? '▲ ASC' : '▼ DESC'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('ไอเทม / ทรัพยากร', 'Item / Resource')}</th>
          <th>${L('หมวด', 'Category')}</th>
          <th>Lv</th>
          <th>${L('แหล่งที่มา / แมพ', 'Source / Map')}</th>
          <th style="text-align:right">${L('เรต / ขั้น', 'Rate / Info')}</th>
          <th style="text-align:right">${L('ราคา', 'Price')}</th>
          <th style="text-align:right">${L('EV / กำไร', 'EV / Profit')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((x) => {
            const spriteId = x.cardMatId || x.id;
            const icon = x.spriteKind ? atlasImg(x.spriteKind, spriteId, 30) : (x.cat === 'rune' ? '🔮' : '🍲');
            const openAttr = x.openKind ? `style="cursor:pointer" data-open="${x.openKind}" data-id="${esc(x.id)}"` : '';
            const lvRange = isDropCat(x.cat) && x.mon ? getDropLvRange(x.mon, x.maps, st.map, minLv, maxLv) : null;
            let srcHtml = '<span class="muted">–</span>';
            let metaHtml = '–';
            if (isDropCat(x.cat)) {
              const mapChips = renderMapLvChips(lvRange ? lvRange.entries : [], 2);
              srcHtml = `<div class="name-cell">${monSprite(x.mon, 28)}<div><div style="cursor:pointer" data-open="monster" data-id="${esc(x.mon.id)}">${esc(tr(x.mon.n))} ${x.boss ? pill('BOSS', '#f25c69') : ''}</div><div class="name-sub" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${elIcon(x.el, 12)} <span>HP ${fmt(x.hp)}</span> ${mapChips}</div></div></div>`;
              metaHtml = fmtPct(x.ratePct);
            } else if (x.cat === 'fish') {
              const w = WHEN_LABELS[x.when] || WHEN_LABELS[0];
              srcHtml = `<div style="display:flex;gap:5px;flex-wrap:wrap">${pill(L(w.th, w.en), w.color)} <span class="muted">${esc((x.waters || []).join(', '))}</span></div>`;
              metaHtml = `Rod ${x.rod}`;
            } else if (x.cat === 'ore' || x.cat === 'wood') {
              srcHtml = `<span class="muted">${esc(tr(x.nodeName || ''))} · ${x.hits} hits</span>`;
              metaHtml = `Tier ${x.tier}`;
            } else if (x.cat === 'crop') {
              srcHtml = `<span class="muted">${x.mins} min · EXP ${x.xp}</span>`;
              metaHtml = `EXP ${x.xp}`;
            } else if (x.cat === 'smelt') {
              srcHtml = `<span class="muted">${esc(x.skill)} · Raw ${fmtCoin(x.rawCost)} + Fee ${fmtCoin(x.fee)}${x.hasWildcard ? ' (+wildcard)' : ''}</span>`;
              metaHtml = `×${x.mult ? x.mult.toFixed(1) : '–'}`;
            } else if (x.cat === 'dish') {
              srcHtml = `<span class="muted">Pot Lv ${x.pot} · EXP ${x.xp}</span>`;
              metaHtml = `EXP ${x.xp}`;
            } else if (x.cat === 'rune') {
              srcHtml = `<span class="muted">${esc(x.kind)} / ${esc(x.on)}</span>`;
              metaHtml = `${(x.prices || []).join('/')}`;
            }
            return `<tr>
              <td><div class="name-cell" ${openAttr}>${icon}<div>${nameHtml(x.name)}</div></div></td>
              <td>${pill(catLabel[x.cat] || x.cat, catColor[x.cat] || '#8a8499')}</td>
              <td class="num">${lvRange ? esc(lvRange.label) : (x.lv ?? '–')}</td>
              <td>${srcHtml}</td>
              <td class="num" style="text-align:right">${esc(metaHtml)}</td>
              <td class="num" style="text-align:right;font-weight:700">${fmtCoin(x.price)}</td>
              <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtCoin(x.ev)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">${L('ไม่พบรายการที่ตรงกับตัวกรอง', 'No matching entries')}</td></tr>`}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-mkpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-mktab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.mktab; renderMarket(); }));
    $('#mainView').querySelectorAll('[data-mkcat]').forEach((b) => b.addEventListener('click', () => { st.cat = b.dataset.mkcat; st.page = 0; renderMarket(); }));
    $('#mainView').querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const p = b.dataset.preset;
      Object.assign(st, { cat: 'all', q: '', minPrice: '', maxPrice: '', minLv: '', maxLv: '', el: '', map: '', minRate: '', monType: 'all', when: 'all', maxRod: '', sort: 'ev', dir: -1, page: 0 });
      if (p === 'water30') Object.assign(st, { cat: 'drop', el: 'water', maxLv: '30', minRate: '30', monType: 'normal', sort: 'ev' });
      else if (p === 'early') Object.assign(st, { cat: 'drop', maxLv: '30', minRate: '1', monType: 'normal', sort: 'ev' });
      else if (p === 'cards') Object.assign(st, { cat: 'card', monType: 'boss', sort: 'price' });
      else if (p === 'fishnight') Object.assign(st, { cat: 'fish', when: '1', maxRod: '2', sort: 'price' });
      else if (p === 'orewood') Object.assign(st, { cat: 'ore', sort: 'price' });
      else if (p === 'smelt') Object.assign(st, { cat: 'smelt', sort: 'ev' });
      renderMarket();
    }));

    $('#mkQ').addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; keepFocus('#mkQ', renderMarket); });
    $('#mkMinP').addEventListener('input', (e) => { st.minPrice = e.target.value; st.page = 0; keepFocus('#mkMinP', renderMarket); });
    $('#mkMaxP').addEventListener('input', (e) => { st.maxPrice = e.target.value; st.page = 0; keepFocus('#mkMaxP', renderMarket); });
    $('#mkMinLv').addEventListener('input', (e) => { st.minLv = e.target.value; st.page = 0; keepFocus('#mkMinLv', renderMarket); });
    $('#mkMaxLv').addEventListener('input', (e) => { st.maxLv = e.target.value; st.page = 0; keepFocus('#mkMaxLv', renderMarket); });
    $('#mkMinR').addEventListener('input', (e) => { st.minRate = e.target.value; st.page = 0; keepFocus('#mkMinR', renderMarket); });
    $('#mkEl').addEventListener('change', (e) => { st.el = e.target.value; st.page = 0; renderMarket(); });
    $('#mkMap').addEventListener('change', (e) => { st.map = e.target.value; st.page = 0; renderMarket(); });
    $('#mkMonT').addEventListener('change', (e) => { st.monType = e.target.value; st.page = 0; renderMarket(); });
    $('#mkWhen').addEventListener('change', (e) => { st.when = e.target.value; st.page = 0; renderMarket(); });
    $('#mkRod').addEventListener('change', (e) => { st.maxRod = e.target.value; st.page = 0; renderMarket(); });
    $('#mkSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderMarket(); });
    $('#mkDir').addEventListener('click', () => { st.dir = -st.dir; renderMarket(); });
    $('#mainView').querySelectorAll('[data-mkpage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderMarket(); }));
  }

  function renderCraftAnalyzer() {
    const st = state.market;
    const q = norm(st.craftQ);
    const minLv = st.craftMinLv !== '' ? Number(st.craftMinLv) : null;
    const maxLv = st.craftMaxLv !== '' ? Number(st.craftMaxLv) : null;

    const list = SMELT_ANALYSIS.filter((r) => {
      if (st.craftSkill && r.skill !== st.craftSkill) return false;
      if (minLv != null && r.lv < minLv) return false;
      if (maxLv != null && r.lv > maxLv) return false;
      if (q && !matchesQuery(r._q, q)) return false;
      return true;
    }).sort((a, b) => {
      let va = 0, vb = 0;
      if (st.craftSort === 'profit') { va = a.netProfit; vb = b.netProfit; }
      else if (st.craftSort === 'mult') { va = a.mult; vb = b.mult; }
      else if (st.craftSort === 'revenue') { va = a.revenue; vb = b.revenue; }
      else { va = a.lv; vb = b.lv; }
      return (va - vb) * st.craftDir;
    });

    const givers = Object.entries((S2.orders && S2.orders.givers) || {});
    const caps = (S2.orders && S2.orders.cap) || {};

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🔥 ${L('วิเคราะห์กำไรคราฟต์ / หลอมแร่ & Work Orders', 'Crafting & Smelter Value-Add Analyzer')}</h1>
          <p>${L('เปรียบเทียบราคาขายของดิบ vs ต้นทุน + ค่าหลอม เทียบเป็นกำไรสุทธิและตัวคูณมูลค่า', 'Compare raw ingredient sell price + smelting fee against output sell value')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn" data-mktab="filter">🔍 ${L('กรองราคา & แหล่งฟาร์ม', 'Unified Filter')} (${fmt(UNIFIED_MARKET.length)})</button>
        <button type="button" class="tab-btn is-on" data-mktab="craft">🔥 ${L('วิเคราะห์กำไรคราฟต์ / หลอมแร่', 'Crafting & Smelter Value-Add')} (${SMELT_ANALYSIS.length})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="crQ" type="search" value="${esc(st.craftQ)}" placeholder="${L('ค้นหาชื่อไอเทม / วัตถุดิบ...', 'Search recipe or material...')}">
        <select class="select" id="crSkill">
          <option value="">${L('ทุกสายสกิล', 'All Skills')}</option>
          ${['mine', 'wood', 'farm', 'fish'].map((sk) => `<option value="${sk}" ${st.craftSkill === sk ? 'selected' : ''}>${esc(sk.toUpperCase())}</option>`).join('')}
        </select>
        <input class="input input--sm" id="crMinLv" type="number" placeholder="Min Lv" value="${esc(st.craftMinLv)}">
        <input class="input input--sm" id="crMaxLv" type="number" placeholder="Max Lv" value="${esc(st.craftMaxLv)}">
        <select class="select" id="crSort">
          <option value="profit" ${st.craftSort === 'profit' ? 'selected' : ''}>Sort: ${L('กำไรสุทธิ', 'Net Profit')}</option>
          <option value="mult" ${st.craftSort === 'mult' ? 'selected' : ''}>Sort: ${L('ตัวคูณมูลค่า (×)', 'Value Multiplier')}</option>
          <option value="revenue" ${st.craftSort === 'revenue' ? 'selected' : ''}>Sort: ${L('ราคาขาย', 'Sell Value')}</option>
          <option value="lv" ${st.craftSort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
        </select>
        <button type="button" class="btn" id="crDir">${st.craftDir > 0 ? '▲ ASC' : '▼ DESC'}</button>
      </div>

      <div class="table-wrap" style="margin-bottom:18px"><table class="data-table">
        <thead><tr>
          <th>${L('ของที่หลอมได้', 'Output')}</th>
          <th>${L('สาย / Lv', 'Skill / Lv')}</th>
          <th>${L('วัตถุดิบที่ใช้', 'Ingredients')}</th>
          <th style="text-align:right">${L('ทุนดิบ + ค่าหลอม', 'Raw + Fee')}</th>
          <th style="text-align:right">${L('ราคาขาย', 'Sell')}</th>
          <th style="text-align:right">${L('กำไรสุทธิ', 'Net Profit')}</th>
          <th style="text-align:right">${L('เพิ่มมูลค่า', 'Mult')}</th>
        </tr></thead>
        <tbody>
          ${list.map((r) => `<tr>
            <td><div class="name-cell" style="cursor:pointer" data-open="mat" data-id="${esc(r.outId)}">${atlasImg('mats', r.outId, 30)}<div>${nameHtml(r.outName)}${r.outQty > 1 ? `<span class="name-sub">×${r.outQty}</span>` : ''}</div></div></td>
            <td>${pill(r.skill.toUpperCase(), '#ff8f3f')} <span class="num">Lv ${r.lv}</span></td>
            <td><div style="display:flex;gap:5px;flex-wrap:wrap">
              ${r.inputs.map((inp) => inp.isWild
                ? `<span class="stat-chip">${esc(inp.id)} ×${inp.qty}</span>`
                : `<button type="button" class="chip-link" data-open="mat" data-id="${esc(inp.id)}">${atlasImg('mats', inp.id, 18)}<span>${esc(tr(inp.name))} ×${inp.qty} (${fmtCoin(inp.price)})</span></button>`
              ).join('')}
            </div></td>
            <td class="num" style="text-align:right">${fmtCoin(r.rawCost)} + ${fmtCoin(r.fee)}</td>
            <td class="num" style="text-align:right;font-weight:700">${fmtCoin(r.revenue)}</td>
            <td class="num" style="text-align:right;font-weight:700;color:${r.netProfit >= 0 ? 'var(--green)' : 'var(--red)'}">${r.netProfit >= 0 ? '+' : ''}${fmtCoin(r.netProfit)}</td>
            <td class="num" style="text-align:right;color:var(--gold)">${r.mult > 0 ? '×' + r.mult.toFixed(1) : (r.hasWildcard ? 'Wildcard' : '–')}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>

      <section class="panel">
        <h2 class="panel__title"><span>📦 ${L('ส่งเควสต์ Work Orders กับ NPC (เพิ่มโบนัสเงินจากของหลอม)', 'Work Order NPCs (Sell Smelted Goods at Bonus Value)')}</span></h2>
        <div class="kv-grid" style="margin-bottom:12px">
          ${Object.entries(caps).map(([tier, cap]) => `<div class="kv-box"><div class="kv-box__k">Tier ${tier} Cap</div><div class="kv-box__v" style="color:var(--gold)">${fmt(cap)}c</div></div>`).join('')}
        </div>
        <div class="card-grid">
          ${givers.map(([gid, gv]) => `
            <article class="entity-card" style="cursor:default">
              <div class="entity-card__head"><div style="flex:1">${nameHtml(gv.n)}</div>${pill(gid.toUpperCase(), '#3f95ff')}</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
                ${(gv.goods || []).map((tierList, idx) => `<div><strong style="color:var(--gold)">T${idx + 1}:</strong> ${tierList.map((id) => esc(tr((SMELT_GOODS[id] && SMELT_GOODS[id].n) || id))).join(', ')}</div>`).join('')}
              </div>
            </article>`).join('')}
        </div>
      </section>
    `;

    $('#mainView').querySelectorAll('[data-mktab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.mktab; renderMarket(); }));
    $('#crQ').addEventListener('input', (e) => { st.craftQ = e.target.value; keepFocus('#crQ', renderCraftAnalyzer); });
    $('#crMinLv').addEventListener('input', (e) => { st.craftMinLv = e.target.value; keepFocus('#crMinLv', renderCraftAnalyzer); });
    $('#crMaxLv').addEventListener('input', (e) => { st.craftMaxLv = e.target.value; keepFocus('#crMaxLv', renderCraftAnalyzer); });
    $('#crSkill').addEventListener('change', (e) => { st.craftSkill = e.target.value; renderCraftAnalyzer(); });
    $('#crSort').addEventListener('change', (e) => { st.craftSort = e.target.value; renderCraftAnalyzer(); });
    $('#crDir').addEventListener('click', () => { st.craftDir = -st.craftDir; renderCraftAnalyzer(); });
  }

  // ------------------------------------------------------------------ VIEW 2: MONSTERS
  function renderMonsters() {
    const st = state.monsters;
    const q = norm(st.q);
    const minLv = st.minLv !== '' ? Number(st.minLv) : null;
    const maxLv = st.maxLv !== '' ? Number(st.maxLv) : null;

    let list = (W.monsters || []).filter((m) => {
      if (st.kind === 'boss' && !m.boss) return false;
      if (st.kind === 'normal' && (m.boss || m.story)) return false;
      if (st.kind === 'story' && !m.story) return false;
      if (st.el && (m.el || 'neutral') !== st.el) return false;
      if (st.race && m.race !== st.race) return false;
      if (st.arm && (m.arm || 'flesh') !== st.arm) return false;
      if (!hasSpawnInLvRange(m, m.maps, '', minLv, maxLv)) return false;
      if (q && !matchesQuery(m._q, q)) return false;
      return true;
    });

    const getVal = (m) => {
      if (st.sort === 'lv') return st.dir > 0 ? m._lvMin : m._lvMax;
      if (st.sort === 'hp') return m.hp || 0;
      if (st.sort === 'exp') return m.exp || 0;
      if (st.sort === 'jexp') return m.jexp || 0;
      if (st.sort === 'atk') return Array.isArray(m.atk) ? m.atk[1] || m.atk[0] || 0 : 0;
      if (st.sort === 'ratio') return m.hp ? (m.exp || 0) / m.hp : 0;
      if (st.sort === 'ev') return m._evCoin || 0;
      if (st.sort === 'evhp') return m._evPer1kHp || 0;
      return tr(m.n);
    };
    list.sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (typeof va === 'number') return (va - vb) * st.dir;
      return String(va).localeCompare(String(vb)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);

    const elsOpts = Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.el === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');
    const raceOpts = Object.entries(W.races || {}).map(([k, v]) => `<option value="${k}" ${st.race === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');
    const armTypes = (S2.armour && S2.armour.types) || {};
    const armOpts = Object.entries(armTypes).map(([k, v]) => `<option value="${k}" ${st.arm === k ? 'selected' : ''}>${esc(tr(v.n))}</option>`).join('');

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>👾 ${L('มอนสเตอร์ & บอส', 'Monsters & Bosses')}</h1>
          <p>${L('คลิกที่แถวเพื่อดูแผนที่เกิด ไอเทมดรอป วัตถุดิบ รูน และท่าบอส', 'Click any monster to inspect spawn maps, item drops, materials, runes, and boss moves')}</p>
        </div>
      </div>

      <div class="tabs">
        ${[['all', L('ทั้งหมด', 'All')], ['boss', L('บอส (Boss)', 'Bosses')], ['normal', L('มอนสเตอร์ทั่วไป', 'Normal')], ['story', L('เนื้อเรื่อง', 'Story')]].map(([k, lbl]) =>
          `<button type="button" class="tab-btn ${st.kind === k ? 'is-on' : ''}" data-mkind="${k}">${esc(lbl)}</button>`
        ).join('')}
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="monQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อมอนสเตอร์ / ID...', 'Search monster name or ID...')}">
        <select class="select" id="monEl"><option value="">${L('ทุกธาตุ', 'All Elements')}</option>${elsOpts}</select>
        <select class="select" id="monRace"><option value="">${L('ทุกเผ่าพันธุ์', 'All Races')}</option>${raceOpts}</select>
        <select class="select" id="monArm"><option value="">${L('ทุกประเภทเกราะ', 'All Armor')}</option>${armOpts}</select>
        <input class="input input--sm" id="monMinLv" type="number" placeholder="Min Lv" value="${esc(st.minLv)}">
        <input class="input input--sm" id="monMaxLv" type="number" placeholder="Max Lv" value="${esc(st.maxLv)}">
        <select class="select" id="monSort">
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
          <option value="hp" ${st.sort === 'hp' ? 'selected' : ''}>Sort: HP</option>
          <option value="exp" ${st.sort === 'exp' ? 'selected' : ''}>Sort: EXP</option>
          <option value="jexp" ${st.sort === 'jexp' ? 'selected' : ''}>Sort: JEXP</option>
          <option value="atk" ${st.sort === 'atk' ? 'selected' : ''}>Sort: ATK</option>
          <option value="ratio" ${st.sort === 'ratio' ? 'selected' : ''}>Sort: EXP/HP</option>
          <option value="ev" ${st.sort === 'ev' ? 'selected' : ''}>Sort: Coin/Kill (EV)</option>
          <option value="evhp" ${st.sort === 'evhp' ? 'selected' : ''}>Sort: Coin/1k HP</option>
        </select>
        <button type="button" class="btn" id="monDir">${st.dir > 0 ? '▲ ASC' : '▼ DESC'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('มอนสเตอร์', 'Monster')}</th>
          <th>Lv</th>
          <th>${L('ธาตุ', 'Element')}</th>
          <th>${L('เผ่า / เกราะ', 'Race / Armor')}</th>
          <th style="text-align:right">HP</th>
          <th style="text-align:right">ATK</th>
          <th style="text-align:right">EXP / JEXP</th>
          <th style="text-align:right">${L('เฉลี่ย/ตัว', 'EV/Kill')}</th>
          <th style="text-align:right">${L('ดรอป', 'Drops')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((m) => `
            <tr data-open="monster" data-id="${esc(m.id)}">
              <td><div class="name-cell">${monSprite(m, 40)}<div>${nameHtml(m.n)}${m.boss ? pill('BOSS', '#f25c69') : ''}${m.story ? pill('STORY', '#3f95ff') : ''}</div></div></td>
              <td class="num">${esc(getDropLvRange(m, m.maps, '', minLv, maxLv).label)}</td>
              <td>${elPill(m.el)}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${pill(tr((W.races && W.races[m.race]) || m.race || '–'), '#6e6a86')}
                  ${m.arm ? pill(tr((armTypes[m.arm] && armTypes[m.arm].n) || m.arm), ARM_COLOR[m.arm] || '#8a94a6') : ''}
                </div>
              </td>
              <td class="num" style="text-align:right">${fmt(m.hp)}</td>
              <td class="num" style="text-align:right">${Array.isArray(m.atk) ? `${fmt(m.atk[0])}–${fmt(m.atk[1])}` : '–'}</td>
              <td class="num" style="text-align:right"><span style="color:var(--gold)">${fmt(m.exp)}</span> / ${fmt(m.jexp)}</td>
              <td class="num" style="text-align:right;color:var(--green);font-weight:700">${m._evCoin > 0 ? fmtCoin(m._evCoin) : '–'}</td>
              <td class="num" style="text-align:right">${(m.drops || []).length} ${L('ชิ้น', 'it')} · ${(m.mats || []).length} ${L('แร่', 'mt')}</td>
            </tr>`).join('') || `<tr><td colspan="9" class="muted" style="text-align:center;padding:24px">${L('ไม่พบมอนสเตอร์ที่ตรงเงื่อนไข', 'No matching monsters')}</td></tr>`}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-mpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-mkind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.mkind; st.page = 0; renderMonsters(); }));
    $('#monQ').addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; renderMonstersKeepFocus('#monQ'); });
    $('#monEl').addEventListener('change', (e) => { st.el = e.target.value; st.page = 0; renderMonsters(); });
    $('#monRace').addEventListener('change', (e) => { st.race = e.target.value; st.page = 0; renderMonsters(); });
    $('#monArm').addEventListener('change', (e) => { st.arm = e.target.value; st.page = 0; renderMonsters(); });
    $('#monMinLv').addEventListener('change', (e) => { st.minLv = e.target.value; st.page = 0; renderMonsters(); });
    $('#monMaxLv').addEventListener('change', (e) => { st.maxLv = e.target.value; st.page = 0; renderMonsters(); });
    $('#monSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderMonsters(); });
    $('#monDir').addEventListener('click', () => { st.dir = -st.dir; renderMonsters(); });
    $('#mainView').querySelectorAll('[data-mpage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderMonsters(); }));
  }

  function renderMonstersKeepFocus(selector) {
    const el = $(selector);
    const pos = el ? el.selectionStart : null;
    renderMonsters();
    const el2 = $(selector);
    if (el2) {
      el2.focus();
      if (pos != null) el2.setSelectionRange(pos, pos);
    }
  }

  // ------------------------------------------------------------------ VIEW 3: ITEMS
  function renderItems() {
    const st = state.items;
    const q = norm(st.q);
    const minLv = st.minLv !== '' ? Number(st.minLv) : null;
    const maxLv = st.maxLv !== '' ? Number(st.maxLv) : null;
    const rarRank = { common: 1, rare: 2, epic: 3, legend: 4, fashion: 5 };

    let list = (W.items || []).filter((it) => {
      if (st.tab === 'weapons' && it.s !== 'weapon') return false;
      if (st.tab === 'outfits' && !['top', 'pants', 'robe', 'cape'].includes(it.s)) return false;
      if (st.tab === 'hats' && !['hat', 'glasses'].includes(it.s)) return false;
      if (st.tab === 'acc' && !['shield', 'acc'].includes(it.s)) return false;
      if (st.r && it.r !== st.r) return false;
      if (st.wt && it.wt !== st.wt) return false;
      if (st.el && (it.el || 'neutral') !== st.el) return false;
      if (minLv != null && (it.lv || 0) < minLv) return false;
      if (maxLv != null && (it.lv || 0) > maxLv) return false;
      if (q && !matchesQuery(it._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      let va, vb;
      if (st.sort === 'lv') { va = a.lv || 0; vb = b.lv || 0; }
      else if (st.sort === 'atk') { va = a.atk || 0; vb = b.atk || 0; }
      else if (st.sort === 'r') { va = rarRank[a.r] || 0; vb = rarRank[b.r] || 0; }
      else { va = tr(a.n); vb = tr(b.n); }
      if (typeof va === 'number') return (va - vb) * st.dir;
      return String(va).localeCompare(String(vb)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);

    const wtOpts = Object.entries(W.wtypes || {}).map(([k, v]) => `<option value="${k}" ${st.wt === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');
    const elOpts = Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.el === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>⚔️ ${L('อาวุธ & อุปกรณ์ทั้งหมด', 'Items, Weapons & Gear')}</h1>
          <p>${L('คลิกไอเทมเพื่อดูค่าสเตตัส โบนัสเซ็ต และมอนสเตอร์ที่ดรอป', 'Click any item to inspect stats, set bonuses, and drop sources')}</p>
        </div>
      </div>

      <div class="tabs">
        ${[
          ['all', L('ทั้งหมด', 'All')],
          ['weapons', L('อาวุธ', 'Weapons')],
          ['outfits', L('เสื้อผ้า & ผ้าคลุม', 'Outfits & Capes')],
          ['hats', L('หมวก & แว่นตา', 'Hats & Glasses')],
          ['acc', L('โล่ & เครื่องประดับ', 'Shields & Acc')]
        ].map(([k, lbl]) => `<button type="button" class="tab-btn ${st.tab === k ? 'is-on' : ''}" data-itab="${k}">${esc(lbl)}</button>`).join('')}
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="itQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อไอเทม / คำอธิบาย / ID...', 'Search item name, description, ID...')}">
        <select class="select" id="itR">
          <option value="">${L('ทุกระดับ', 'All Rarities')}</option>
          ${['common', 'rare', 'epic', 'legend', 'fashion'].map((r) => `<option value="${r}" ${st.r === r ? 'selected' : ''}>${esc(tr(r))}</option>`).join('')}
        </select>
        <select class="select" id="itWt"><option value="">${L('ทุกประเภทอาวุธ', 'All Weapon Types')}</option>${wtOpts}</select>
        <select class="select" id="itEl"><option value="">${L('ทุกธาตุ', 'All Elements')}</option>${elOpts}</select>
        <input class="input input--sm" id="itMinLv" type="number" placeholder="Min Lv" value="${esc(st.minLv)}">
        <input class="input input--sm" id="itMaxLv" type="number" placeholder="Max Lv" value="${esc(st.maxLv)}">
        <select class="select" id="itSort">
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
          <option value="atk" ${st.sort === 'atk' ? 'selected' : ''}>Sort: ATK</option>
          <option value="r" ${st.sort === 'r' ? 'selected' : ''}>Sort: Rarity</option>
          <option value="n" ${st.sort === 'n' ? 'selected' : ''}>Sort: Name</option>
        </select>
        <button type="button" class="btn" id="itDir">${st.dir > 0 ? '▲ ASC' : '▼ DESC'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('ไอเทม', 'Item')}</th>
          <th>${L('ช่อง / ประเภท', 'Slot / Type')}</th>
          <th>${L('ระดับ', 'Rarity')}</th>
          <th>Lv</th>
          <th>${L('ค่าสเตตัส', 'Stats')}</th>
          <th style="text-align:right">${L('แหล่งดรอป', 'Drops')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((it) => {
            const droppers = ITEM_DROPPERS[it.id] || [];
            const stats = itemStatsList(it);
            return `<tr data-open="item" data-id="${esc(it.id)}">
              <td><div class="name-cell"><span class="sprite-box">${itemSprite(it, 36)}</span><div>${nameHtml(it.n)}</div></div></td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  ${pill(tr(it.s), '#6e6a86')}
                  ${it.wt ? pill(tr((W.wtypes && W.wtypes[it.wt]) || it.wt), '#3f95ff') : ''}
                  ${it.el && it.el !== 'neutral' ? elPill(it.el) : ''}
                </div>
              </td>
              <td>${pill(tr(it.r), RAR_COLOR[it.r] || '#8a8499')}</td>
              <td class="num">${it.lv ?? 1}</td>
              <td><div class="stat-chips">${stats.slice(0, 4).map((s) => `<span class="stat-chip">${esc(s)}</span>`).join('') || (it.ab ? '' : '<span class="muted">–</span>')}</div>${it.ab ? `<div class="name-sub" style="margin-top:3px">✨ ${esc(tr(it.ab))}</div>` : ''}</td>
              <td class="num" style="text-align:right">${droppers.length ? `<span style="color:var(--gold)">${droppers.length} ${L('ตัว', 'mons')}</span>` : '<span class="muted">–</span>'}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">${L('ไม่พบไอเทมที่ตรงเงื่อนไข', 'No matching items')}</td></tr>`}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-ipage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-itab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.itab; st.page = 0; renderItems(); }));
    $('#itQ').addEventListener('input', (e) => {
      st.q = e.target.value; st.page = 0;
      const pos = e.target.selectionStart;
      renderItems();
      const inp = $('#itQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#itR').addEventListener('change', (e) => { st.r = e.target.value; st.page = 0; renderItems(); });
    $('#itWt').addEventListener('change', (e) => { st.wt = e.target.value; st.page = 0; renderItems(); });
    $('#itEl').addEventListener('change', (e) => { st.el = e.target.value; st.page = 0; renderItems(); });
    $('#itMinLv').addEventListener('change', (e) => { st.minLv = e.target.value; st.page = 0; renderItems(); });
    $('#itMaxLv').addEventListener('change', (e) => { st.maxLv = e.target.value; st.page = 0; renderItems(); });
    $('#itSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderItems(); });
    $('#itDir').addEventListener('click', () => { st.dir = -st.dir; renderItems(); });
    $('#mainView').querySelectorAll('[data-ipage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderItems(); }));
  }

  // ------------------------------------------------------------------ VIEW 4: SETS
  function renderSets() {
    const st = state.sets;
    const q = norm(st.q);
    const sets = (W.sets || []).filter((s) => {
      if (st.g && String(s.g) !== st.g) return false;
      if (q && !matchesQuery(s._q, q)) return false;
      return true;
    });
    const bossSets = (W.bossSets || []).filter((bs) => {
      if (q && !matchesQuery(bs._q, q)) return false;
      return true;
    });

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🛡️ ${L('เซ็ตอุปกรณ์ & เซ็ตบอส', 'Equipment Sets & Boss Sets')}</h1>
          <p>${L('แสดงโบนัส 2 ชิ้น / 3 ชิ้น และพาสซีฟประจำเซ็ต พร้อมชิ้นส่วนที่กดดูดรอปได้', '2-piece / 3-piece bonuses, set passives, and clickable pieces')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn ${st.tab === 'regular' ? 'is-on' : ''}" data-stab="regular">${L('เซ็ตทั่วไป', 'Regular Sets')} (${(W.sets || []).length})</button>
        <button type="button" class="tab-btn ${st.tab === 'boss' ? 'is-on' : ''}" data-stab="boss">${L('เซ็ตบอส', 'Boss Sets')} (${(W.bossSets || []).length})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="setQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อเซ็ต / ค่าพลัง (เช่น MATK, SP, HP, CRIT) / เอฟเฟกต์ / ชิ้นส่วน...', 'Search set name, stats (MATK, SP, CRIT), passive, or piece...')}">
        ${st.tab === 'regular' ? `
          <select class="select" id="setG">
            <option value="">${L('ทุกเกรด (Grade)', 'All Grades')}</option>
            ${[1, 2, 3, 4].map((g) => `<option value="${g}" ${st.g === String(g) ? 'selected' : ''}>Grade ${g}</option>`).join('')}
          </select>` : ''}
      </div>

      ${st.tab === 'regular' ? `
        <div class="card-grid">
          ${sets.map((s) => `
            <article class="entity-card" style="cursor:default">
              <div class="entity-card__head">
                <div style="flex:1">${nameHtml(s.n)}</div>
                ${pill(`G${s.g} · Lv ${s.lv}`, GRADE_COLOR[s.g] || '#8a8499')}
              </div>
              <div style="font-size:12.5px">
                <div><strong style="color:var(--gold)">2pc:</strong> ${esc(tr(s.b2))}</div>
                <div><strong style="color:var(--gold)">3pc:</strong> ${esc(tr(s.b3))}</div>
                ${s.pas ? `<div style="margin-top:4px;color:var(--text-1)">✨ ${esc(tr(s.pas))}</div>` : ''}
              </div>
              <div class="entity-card__meta">
                ${(s.pcs || []).map((pid) => {
                  const it = IT[pid];
                  return `<button type="button" class="chip-link" data-open="item" data-id="${esc(pid)}">${itemSprite(it, 24)}<span>${esc(tr(it ? it.n : pid))}</span></button>`;
                }).join('')}
              </div>
            </article>`).join('')}
        </div>` : `
        <div class="card-grid">
          ${bossSets.map((bs) => {
            const m = MON[bs.boss];
            const hatIt = IT[bs.hat];
            const accIt = IT[bs.acc];
            return `<article class="entity-card" style="cursor:default">
              <div class="entity-card__head">
                ${m ? monSprite(m, 48) : ''}
                <div style="flex:1">${nameHtml(bs.n)}<div class="name-sub">${m ? esc(tr(m.n)) : esc(bs.boss)}</div></div>
                ${pill('BOSS SET', '#f25c69')}
              </div>
              <div style="font-size:12.5px;color:var(--text-1)">✨ ${esc(tr(bs.text))}</div>
              <div class="entity-card__meta">
                ${hatIt ? `<button type="button" class="chip-link" data-open="item" data-id="${esc(hatIt.id)}">${itemSprite(hatIt, 24)}<span>${esc(tr(hatIt.n))}</span></button>` : ''}
                ${accIt ? `<button type="button" class="chip-link" data-open="item" data-id="${esc(accIt.id)}">${itemSprite(accIt, 24)}<span>${esc(tr(accIt.n))}</span></button>` : ''}
                <span class="pill" style="--c:#8a4fe0">+ ${(bs.w || []).length} ${L('อาวุธในเซ็ต', 'weapons')}</span>
              </div>
            </article>`;
          }).join('')}
        </div>`
      }
    `;

    $('#mainView').querySelectorAll('[data-stab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.stab; renderSets(); }));
    $('#setQ').addEventListener('input', (e) => {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderSets();
      const inp = $('#setQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    if ($('#setG')) $('#setG').addEventListener('change', (e) => { st.g = e.target.value; renderSets(); });
  }

  // ------------------------------------------------------------------ VIEW 5: JOBS & SKILLS
  function renderJobs() {
    const st = state.jobs;
    if (st.tab === 'skills') {
      renderSkillsSubtab();
      return;
    }

    const q = norm(st.q);
    const jobs = (W.jobs || []).filter((j) => {
      if (st.tier !== 'all' && String(j.tier) !== st.tier) return false;
      if (q && !matchesQuery(j._q, q)) return false;
      return true;
    });

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🧙 ${L('อาชีพ & สกิลทั้งหมด', 'Jobs & Skills')}</h1>
          <p>${L('46 อาชีพและ 428 สกิล คลิกที่อาชีพหรือสกิลเพื่อดูตารางความแรงแต่ละเลเวลและอาวุธที่เสริมสกิล', '46 jobs and 428 skills — click to view level scaling tables and skill-boosting weapons')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn is-on" data-jtab="jobs">${L('อาชีพ', 'Jobs')} (${(W.jobs || []).length})</button>
        <button type="button" class="tab-btn" data-jtab="skills">${L('สารบัญสกิลทั้งหมด', 'All Skills')} (${ALL_SKILLS.length})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="jobQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาอาชีพ / คำอธิบาย...', 'Search job name or description...')}">
        <select class="select" id="jobTier">
          <option value="all" ${st.tier === 'all' ? 'selected' : ''}>${L('ทุก Tier', 'All Tiers')}</option>
          ${[0, 1, 2, 3].map((t) => `<option value="${t}" ${st.tier === String(t) ? 'selected' : ''}>Tier ${t}</option>`).join('')}
        </select>
      </div>

      <div class="card-grid">
        ${jobs.map((j) => `
          <article class="entity-card" data-open="job" data-id="${esc(j.id)}">
            <div class="entity-card__head">
              <span class="sprite-box">${atlasImg('jobs', j.id, 56)}</span>
              <div style="flex:1">
                ${nameHtml(j.n)}
                <div style="margin-top:4px;display:flex;gap:5px;flex-wrap:wrap">
                  ${pill(`Tier ${j.tier}`, GRADE_COLOR[(j.tier || 0) + 1] || '#8a8499')}
                  ${j.from && JOB[j.from] ? pill(`← ${tr(JOB[j.from].n)}`, '#3f95ff') : ''}
                </div>
              </div>
            </div>
            <div style="font-size:12.5px;color:var(--text-1)">${esc(tr(j.d))}</div>
            <div class="stat-chips">
              <span class="stat-chip">HP/Lv +${j.hp}</span>
              <span class="stat-chip">SP/Lv +${j.sp}</span>
              <span class="stat-chip">${(j.sk || []).length} ${L('สกิล', 'skills')}</span>
              ${(j.wt || []).slice(0, 3).map((w) => `<span class="stat-chip">${esc(tr((W.wtypes && W.wtypes[w]) || w))}</span>`).join('')}
            </div>
          </article>`).join('')}
      </div>
    `;

    $('#mainView').querySelectorAll('[data-jtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.jtab; renderJobs(); }));
    $('#jobQ').addEventListener('input', (e) => {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderJobs();
      const inp = $('#jobQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#jobTier').addEventListener('change', (e) => { st.tier = e.target.value; renderJobs(); });
  }

  function renderSkillsSubtab() {
    const st = state.jobs;
    const q = norm(st.skQ);
    const typeOf = (s) => (s.active ? (s.type === 'magic' ? 'Magic' : 'Attack') : 'Passive');

    let list = ALL_SKILLS.filter((s) => {
      if (st.skJob && s.jobId !== st.skJob) return false;
      if (st.skType && typeOf(s) !== st.skType) return false;
      if (st.skEl && (s.el || 'neutral') !== st.skEl) return false;
      if (q && !matchesQuery(s._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      const va = st.skSort === 'rg' ? (a.rg || 0) : st.skSort === 'cd' ? (Number(a.cd) || 0) : st.skSort === 'sp' ? (Number(a.sp) || 0) : tr(a.n);
      const vb = st.skSort === 'rg' ? (b.rg || 0) : st.skSort === 'cd' ? (Number(b.cd) || 0) : st.skSort === 'sp' ? (Number(b.sp) || 0) : tr(b.n);
      if (typeof va === 'number') return (va - vb) * st.skDir;
      return String(va).localeCompare(String(vb)) * st.skDir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.skPage = Math.min(st.skPage, pages - 1);
    const slice = list.slice(st.skPage * PER, st.skPage * PER + PER);

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>✨ ${L('สารบัญสกิลทั้งหมด', 'Skill Explorer')}</h1>
          <p>${L('ค้นหาสกิลจากทุกอาชีพ ดูดาเมจ ระยะสกิล คูลดาวน์ และอาวุธที่เสริมพลัง', 'Browse all skills, reach, cooldown, SP cost, and boosting weapons')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn" data-jtab="jobs">${L('อาชีพ', 'Jobs')} (${(W.jobs || []).length})</button>
        <button type="button" class="tab-btn is-on" data-jtab="skills">${L('สารบัญสกิลทั้งหมด', 'All Skills')} (${ALL_SKILLS.length})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="skQ" type="search" value="${esc(st.skQ)}" placeholder="${L('ค้นหาชื่อสกิล / เอฟเฟกต์...', 'Search skill name or effect...')}">
        <select class="select" id="skJob">
          <option value="">${L('ทุกอาชีพ', 'All Jobs')}</option>
          ${(W.jobs || []).map((j) => `<option value="${esc(j.id)}" ${st.skJob === j.id ? 'selected' : ''}>${esc(tr(j.n))}</option>`).join('')}
        </select>
        <select class="select" id="skType">
          <option value="">${L('ทุกประเภท', 'All Types')}</option>
          <option value="Attack" ${st.skType === 'Attack' ? 'selected' : ''}>Attack</option>
          <option value="Magic" ${st.skType === 'Magic' ? 'selected' : ''}>Magic</option>
          <option value="Passive" ${st.skType === 'Passive' ? 'selected' : ''}>Passive</option>
        </select>
        <select class="select" id="skEl">
          <option value="">${L('ทุกธาตุ', 'All Elements')}</option>
          ${Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.skEl === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('')}
        </select>
        <select class="select" id="skSort">
          <option value="n" ${st.skSort === 'n' ? 'selected' : ''}>Sort: Name</option>
          <option value="rg" ${st.skSort === 'rg' ? 'selected' : ''}>Sort: Range</option>
          <option value="sp" ${st.skSort === 'sp' ? 'selected' : ''}>Sort: SP</option>
          <option value="cd" ${st.skSort === 'cd' ? 'selected' : ''}>Sort: CD</option>
        </select>
        <button type="button" class="btn" id="skDir">${st.skDir > 0 ? '▲' : '▼'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('สกิล', 'Skill')}</th>
          <th>${L('อาชีพ', 'Job')}</th>
          <th>${L('ประเภท / ธาตุ', 'Type / El')}</th>
          <th style="text-align:right">Max Lv</th>
          <th style="text-align:right">SP</th>
          <th style="text-align:right">CD</th>
          <th style="text-align:right">${L('ระยะ', 'Range')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((s) => `<tr data-open="skill" data-id="${esc(s.id)}">
            <td><div class="name-cell">${atlasImg('skills', s.icon, 36)}<div>${nameHtml(s.n)}</div></div></td>
            <td>${esc(tr(s.jobName))}</td>
            <td><div style="display:flex;gap:4px">${pill(typeOf(s), typeOf(s) === 'Magic' ? '#8a4fe0' : typeOf(s) === 'Attack' ? '#e667ad' : '#38c97a')}${s.el ? elPill(s.el) : ''}</div></td>
            <td class="num" style="text-align:right">${s.max}</td>
            <td class="num" style="text-align:right">${s.active ? esc(s.sp || '0') : '–'}</td>
            <td class="num" style="text-align:right">${s.active && s.cd ? s.cd + 's' : '–'}</td>
            <td class="num" style="text-align:right">${s.rg ? fmt(s.rg) : '–'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.skPage, 'data-skpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-jtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.jtab; renderJobs(); }));
    $('#skQ').addEventListener('input', (e) => {
      st.skQ = e.target.value; st.skPage = 0;
      const pos = e.target.selectionStart;
      renderSkillsSubtab();
      const inp = $('#skQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#skJob').addEventListener('change', (e) => { st.skJob = e.target.value; st.skPage = 0; renderSkillsSubtab(); });
    $('#skType').addEventListener('change', (e) => { st.skType = e.target.value; st.skPage = 0; renderSkillsSubtab(); });
    $('#skEl').addEventListener('change', (e) => { st.skEl = e.target.value; st.skPage = 0; renderSkillsSubtab(); });
    $('#skSort').addEventListener('change', (e) => { st.skSort = e.target.value; st.skPage = 0; renderSkillsSubtab(); });
    $('#skDir').addEventListener('click', () => { st.skDir = -st.skDir; renderSkillsSubtab(); });
    $('#mainView').querySelectorAll('[data-skpage]').forEach((b) => b.addEventListener('click', () => { st.skPage = Number(b.dataset.page); renderSkillsSubtab(); }));
  }

  // ------------------------------------------------------------------ VIEW 6: MAPS
  function renderMaps() {
    const st = state.maps;
    const q = norm(st.q);
    const regions = W.regions || [];

    const maps = (W.maps || []).filter((mp) => {
      if (st.region) {
        const reg = mp.pin ? mp.pin[0] : (mp.parent && MAP[mp.parent] && MAP[mp.parent].pin ? MAP[mp.parent].pin[0] : '');
        if (reg !== st.region) return false;
      }
      if (st.kind && mp.kind !== st.kind) return false;
      if (st.secret === 'secret' && !mp.secret) return false;
      if (q && !matchesQuery(mp._q, q)) return false;
      return true;
    });

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🗺️ ${L('แผนที่โลก & ดันเจี้ยน', 'World Map & Locations')}</h1>
          <p>${L('คลิกหมุดภูมิภาคบนแผนที่เพื่อกรอง หรือคลิกที่การ์ดแผนที่เพื่อดูมอนสเตอร์ที่เกิด', 'Click region pins on the map to filter, or click any map card to inspect spawning monsters')}</p>
        </div>
      </div>

      <div class="grid-2" style="grid-template-columns: 1.25fr 1fr; align-items:start">
        <div class="panel">
          <h2 class="panel__title">
            <span>🌍 ${L('แผนที่โลก Night Camp (5 ภูมิภาค)', 'Night Camp World Map (5 Regions)')}</span>
            ${st.region ? `<button type="button" class="btn" id="clearReg">${L('แสดงทั้งหมด', 'Show All Regions')}</button>` : ''}
          </h2>
          <div class="world-map-wrap">
            <img src="assets/map.webp" alt="World Map">
            ${regions.map((r) => `
              <button type="button" class="map-pin ${st.region === r.id ? 'is-on' : ''}" data-reg="${esc(r.id)}" style="left:${r.over[0]}%;top:${r.over[1]}%">
                📍 ${esc(tr(r.n))}
              </button>`).join('')}
          </div>
        </div>

        <div class="panel">
          <h2 class="panel__title"><span>🧭 ${L('สรุปภูมิภาค', 'Regions Directory')}</span></h2>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${regions.map((r) => {
              const cnt = (W.maps || []).filter((m) => m.pin && m.pin[0] === r.id).length;
              return `<button type="button" class="chip-link" style="justify-content:space-between;width:100%;padding:10px 12px;${st.region === r.id ? 'border-color:var(--gold);' : ''}" data-reg="${esc(r.id)}">
                <span><strong>${esc(tr(r.n))}</strong> <span class="muted">(${esc(r.n)})</span></span>
                <span class="pill" style="--c:#f5b942">${cnt} ${L('แผนที่หลัก', 'maps')}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="mapQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อแผนที่ / โซน...', 'Search map or zone name...')}">
        <select class="select" id="mapKind">
          <option value="">${L('ทุกประเภทแผนที่', 'All Kinds')}</option>
          ${['field', 'dungeon', 'camp', 'safe'].map((k) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
        </select>
        <select class="select" id="mapSecret">
          <option value="all" ${st.secret === 'all' ? 'selected' : ''}>${L('ทั้งหมด', 'All Maps')}</option>
          <option value="secret" ${st.secret === 'secret' ? 'selected' : ''}>${L('แผนที่ลับ (Secret)', 'Secret Only')}</option>
        </select>
      </div>

      <div class="card-grid">
        ${maps.map((mp) => {
          const regName = mp.pin && REG[mp.pin[0]] ? tr(REG[mp.pin[0]].n) : '';
          return `<article class="entity-card" data-open="map" data-id="${esc(mp.id)}">
            <div class="entity-card__head">
              <div style="flex:1">${nameHtml(mp.n)}</div>
              ${pill(mp.lv || '–', '#f5b942')}
            </div>
            <div class="entity-card__meta">
              ${pill(mp.kind || 'field', mp.kind === 'dungeon' ? '#8a4fe0' : mp.kind === 'camp' ? '#ff8f3f' : '#38c97a')}
              ${regName ? pill(regName, '#3f95ff') : ''}
              ${mp.secret ? pill('SECRET', '#f25c69') : ''}
              ${mp.parent && MAP[mp.parent] ? pill(`↳ ${tr(MAP[mp.parent].n)}`, '#6e6a86') : ''}
            </div>
            <div class="muted" style="font-size:12px">
              👾 ${(mp.mons || []).length} ${L('ชนิดมอนสเตอร์', 'monster types')}
              ${(mp.zones || []).length ? ` · 📌 ${mp.zones.slice(0, 2).map((z) => esc(tr(z))).join(', ')}` : ''}
            </div>
          </article>`;
        }).join('')}
      </div>
    `;

    $('#mainView').querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', () => {
      st.region = st.region === b.dataset.reg ? '' : b.dataset.reg;
      renderMaps();
    }));
    if ($('#clearReg')) $('#clearReg').addEventListener('click', () => { st.region = ''; renderMaps(); });
    $('#mapQ').addEventListener('input', (e) => {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderMaps();
      const inp = $('#mapQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#mapKind').addEventListener('change', (e) => { st.kind = e.target.value; renderMaps(); });
    $('#mapSecret').addEventListener('change', (e) => { st.secret = e.target.value; renderMaps(); });
  }

  // ------------------------------------------------------------------ VIEW 7: DROPS & MATERIALS
  function renderDrops() {
    const st = state.drops;
    if (st.tab === 'materials') {
      renderMaterialsSubtab();
      return;
    }

    const q = norm(st.q);
    const minLv = st.minLv !== '' ? Number(st.minLv) : null;
    const maxLv = st.maxLv !== '' ? Number(st.maxLv) : null;
    const minR = st.minRate !== '' ? Number(st.minRate) : null;
    const minP = st.minPrice !== '' ? Number(st.minPrice) : null;
    const maxP = st.maxPrice !== '' ? Number(st.maxPrice) : null;

    let list = FLAT_DROPS.filter((d) => {
      if (st.dtype !== 'all' && d.dtype !== st.dtype) return false;
      if (st.monType === 'boss' && !d.mon.boss) return false;
      if (st.monType === 'normal' && d.mon.boss) return false;
      if (st.el && (d.mon.el || 'neutral') !== st.el) return false;
      if (st.map && !(d.maps || []).includes(st.map)) return false;
      if (minLv != null || maxLv != null) {
        if (!hasSpawnInLvRange(d.mon, d.maps, st.map, minLv, maxLv)) return false;
      }
      if (minR != null && d.ratePct <= minR) return false;
      if (minP != null && (d.price == null || d.price < minP)) return false;
      if (maxP != null && (d.price == null || d.price > maxP)) return false;
      if (q && !matchesQuery(d._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (st.sort === 'ev') return ((a.ev ?? -1) - (b.ev ?? -1)) * st.dir;
      if (st.sort === 'price') return ((a.price ?? -1) - (b.price ?? -1)) * st.dir;
      if (st.sort === 'rate') return (a.ratePct - b.ratePct) * st.dir;
      if (st.sort === 'lv') {
        const ra = getDropLvRange(a.mon, a.maps, st.map, minLv, maxLv);
        const rb = getDropLvRange(b.mon, b.maps, st.map, minLv, maxLv);
        return ((st.dir > 0 ? ra.min : ra.max) - (st.dir > 0 ? rb.min : rb.max)) * st.dir;
      }
      if (st.sort === 'hp') return ((a.mon.hp || 0) - (b.mon.hp || 0)) * st.dir;
      return tr(a.targetName).localeCompare(tr(b.targetName)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);
    const elOpts = Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.el === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>💎 ${L('ค้นหาดรอป & สารบัญวัตถุดิบ', 'Drop Finder & Materials')}</h1>
          <p>${L('ค้นหาไอเทม วัตถุดิบ การ์ด หรือรูนที่ดรอปจากมอนสเตอร์ พร้อมตัวกรองแมพ ธาตุ เลเวล % ดรอป และราคา', 'Search across 4,403 drops — filter by map, element, monster level, drop rate %, and price')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn is-on" data-dtab="drops">${L('ตารางดรอปทั้งหมด', 'Drop Finder')} (${fmt(FLAT_DROPS.length)})</button>
        <button type="button" class="tab-btn" data-dtab="materials">${L('สารบัญวัตถุดิบ', 'Materials')} (${fmt((W.materials || []).length)})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="dropQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาไอเทม / การ์ด / วัตถุดิบ / มอนสเตอร์ / แมพ...', 'Search item, card, mat, monster, map...')}">
        <select class="select" id="dropType">
          <option value="all" ${st.dtype === 'all' ? 'selected' : ''}>${L('ทุกประเภทดรอป', 'All Drop Types')}</option>
          <option value="item" ${st.dtype === 'item' ? 'selected' : ''}>${L('ไอเทมสวมใส่/อาวุธ', 'Items / Gear')}</option>
          <option value="material" ${st.dtype === 'material' ? 'selected' : ''}>${L('วัตถุดิบ', 'Materials')}</option>
          <option value="card" ${st.dtype === 'card' ? 'selected' : ''}>${L('การ์ดมอนสเตอร์', 'Monster Cards')}</option>
          <option value="rune" ${st.dtype === 'rune' ? 'selected' : ''}>${L('รูน', 'Runes')}</option>
        </select>
        <select class="select" id="dropEl"><option value="">${L('ทุกธาตุ', 'All Elements')}</option>${elOpts}</select>
        <select class="select" id="dropMap"><option value="">${L('ทุกแมพ', 'All Maps')}</option>${mapOptionsHtml(st.map)}</select>
        <select class="select" id="dropMonT">
          <option value="all" ${st.monType === 'all' ? 'selected' : ''}>${L('มอน: ทั้งหมด', 'Mon: All')}</option>
          <option value="normal" ${st.monType === 'normal' ? 'selected' : ''}>${L('เฉพาะมอนทั่วไป', 'Normal Only')}</option>
          <option value="boss" ${st.monType === 'boss' ? 'selected' : ''}>${L('เฉพาะบอส', 'Boss Only')}</option>
        </select>
        <input class="input input--sm" id="dropMinLv" type="number" placeholder="Min Lv" value="${esc(st.minLv)}">
        <input class="input input--sm" id="dropMaxLv" type="number" placeholder="Max Lv" value="${esc(st.maxLv)}">
        <input class="input input--sm" id="dropMinR" type="number" step="any" placeholder="Drop >%" value="${esc(st.minRate)}">
        <input class="input input--sm" id="dropMinP" type="number" step="any" placeholder="Min c" value="${esc(st.minPrice)}">
        <input class="input input--sm" id="dropMaxP" type="number" step="any" placeholder="Max c" value="${esc(st.maxPrice)}">
        <select class="select" id="dropSort">
          <option value="rate" ${st.sort === 'rate' ? 'selected' : ''}>Sort: Rate %</option>
          <option value="ev" ${st.sort === 'ev' ? 'selected' : ''}>Sort: EV (เฉลี่ย/ตัว)</option>
          <option value="price" ${st.sort === 'price' ? 'selected' : ''}>Sort: Price (ราคา)</option>
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Monster Lv</option>
          <option value="hp" ${st.sort === 'hp' ? 'selected' : ''}>Sort: HP</option>
          <option value="name" ${st.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
        </select>
        <button type="button" class="btn" id="dropDir">${st.dir > 0 ? '▲' : '▼'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('ของที่ดรอป', 'Drop Target')}</th>
          <th>${L('ประเภท', 'Type')}</th>
          <th>${L('มอนสเตอร์', 'Monster')}</th>
          <th>Lv</th>
          <th>${L('แมพ', 'Map')}</th>
          <th style="text-align:right">${L('ราคา', 'Price')}</th>
          <th style="text-align:right">${L('โอกาสดรอป', 'Drop Rate')}</th>
          <th style="text-align:right">${L('เฉลี่ย/ตัว', 'EV/Kill')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((d) => {
            const icon = d.dtype === 'item' ? itemSprite(IT[d.targetId], 32)
              : d.dtype === 'material' ? atlasImg('mats', d.targetId, 32)
              : d.dtype === 'card' ? atlasImg('mats', d.cardMatId, 32)
              : atlasImg('mats', `bl_rune_${d.targetId}_1`, 32);
            const openKind = d.dtype === 'item' ? 'item' : d.dtype === 'material' ? 'mat' : d.dtype === 'card' ? 'card' : 'rune';
            const typeColor = d.dtype === 'item' ? '#3f95ff' : d.dtype === 'material' ? '#38c97a' : d.dtype === 'card' ? '#f5b942' : '#9a5cf0';
            const lvRange = getDropLvRange(d.mon, d.maps, st.map, minLv, maxLv);
            const mapChips = renderMapLvChips(lvRange.entries, 2);
            return `<tr>
              <td><div class="name-cell" style="cursor:pointer" data-open="${openKind}" data-id="${esc(d.targetId)}">${icon}<div>${nameHtml(d.targetName)}</div></div></td>
              <td>${pill(d.dtype.toUpperCase(), typeColor)}</td>
              <td><div class="name-cell" style="cursor:pointer" data-open="monster" data-id="${esc(d.mon.id)}">${monSprite(d.mon, 32)}<div>${nameHtml(d.mon.n)}${d.mon.boss ? pill('BOSS', '#f25c69') : ''} ${elIcon(d.mon.el, 13)}</div></div></td>
              <td class="num">${esc(lvRange.label)}</td>
              <td><div style="display:flex;gap:4px;flex-wrap:wrap">${mapChips}</div></td>
              <td class="num" style="text-align:right">${fmtCoin(d.price)}</td>
              <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtPct(d.ratePct)}</td>
              <td class="num" style="text-align:right;color:var(--green);font-weight:700">${fmtCoin(d.ev)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">${L('ไม่พบรายการที่ตรงเงื่อนไข', 'No matching drops')}</td></tr>`}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-dpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-dtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.dtab; renderDrops(); }));
    $('#dropQ').addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; keepFocus('#dropQ', renderDrops); });
    $('#dropMinLv').addEventListener('input', (e) => { st.minLv = e.target.value; st.page = 0; keepFocus('#dropMinLv', renderDrops); });
    $('#dropMaxLv').addEventListener('input', (e) => { st.maxLv = e.target.value; st.page = 0; keepFocus('#dropMaxLv', renderDrops); });
    $('#dropMinR').addEventListener('input', (e) => { st.minRate = e.target.value; st.page = 0; keepFocus('#dropMinR', renderDrops); });
    $('#dropMinP').addEventListener('input', (e) => { st.minPrice = e.target.value; st.page = 0; keepFocus('#dropMinP', renderDrops); });
    $('#dropMaxP').addEventListener('input', (e) => { st.maxPrice = e.target.value; st.page = 0; keepFocus('#dropMaxP', renderDrops); });
    $('#dropType').addEventListener('change', (e) => { st.dtype = e.target.value; st.page = 0; renderDrops(); });
    $('#dropEl').addEventListener('change', (e) => { st.el = e.target.value; st.page = 0; renderDrops(); });
    $('#dropMap').addEventListener('change', (e) => { st.map = e.target.value; st.page = 0; renderDrops(); });
    $('#dropMonT').addEventListener('change', (e) => { st.monType = e.target.value; st.page = 0; renderDrops(); });
    $('#dropSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderDrops(); });
    $('#dropDir').addEventListener('click', () => { st.dir = -st.dir; renderDrops(); });
    $('#mainView').querySelectorAll('[data-dpage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderDrops(); }));
  }

  function renderMaterialsSubtab() {
    const st = state.drops;
    const q = norm(st.matQ);
    const minP = st.matMinPrice !== '' ? Number(st.matMinPrice) : null;
    const maxP = st.matMaxPrice !== '' ? Number(st.matMaxPrice) : null;

    let list = (W.materials || []).filter((mat) => {
      if (st.matFilter === 'rare' && !mat.rare) return false;
      if (st.matFilter === 'life' && !mat.life) return false;
      if (minP != null && (mat.p ?? 0) < minP) return false;
      if (maxP != null && (mat.p ?? 0) > maxP) return false;
      if (q && !matchesQuery(mat._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (st.matSort === 'p') return ((a.p || 0) - (b.p || 0)) * st.matDir;
      if (st.matSort === 'droppers') return ((MAT_DROPPERS[a.id] || []).length - (MAT_DROPPERS[b.id] || []).length) * st.matDir;
      return tr(a.n).localeCompare(tr(b.n)) * st.matDir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.matPage = Math.min(st.matPage, pages - 1);
    const slice = list.slice(st.matPage * PER, st.matPage * PER + PER);

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🧱 ${L('สารบัญวัตถุดิบทั้งหมด', 'Materials Directory')}</h1>
          <p>${L('1,530 วัตถุดิบและของคราฟต์ กรองตามราคาหรือประเภทแล้วคลิกเพื่อดูมอนสเตอร์ที่ดรอป', '1,530 materials — filter by price/type and click to see drop sources')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn" data-dtab="drops">${L('ตารางดรอปทั้งหมด', 'Drop Finder')} (${fmt(FLAT_DROPS.length)})</button>
        <button type="button" class="tab-btn is-on" data-dtab="materials">${L('สารบัญวัตถุดิบ', 'Materials')} (${fmt((W.materials || []).length)})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="matQ" type="search" value="${esc(st.matQ)}" placeholder="${L('ค้นหาชื่อวัตถุดิบ / คำอธิบาย...', 'Search material name or description...')}">
        <select class="select" id="matFilter">
          <option value="all" ${st.matFilter === 'all' ? 'selected' : ''}>${L('ทั้งหมด', 'All Materials')}</option>
          <option value="rare" ${st.matFilter === 'rare' ? 'selected' : ''}>${L('หายาก (Rare)', 'Rare Only')}</option>
          <option value="life" ${st.matFilter === 'life' ? 'selected' : ''}>${L('จากสกิลชีวิต (Life)', 'Life Skills Only')}</option>
        </select>
        <input class="input input--sm" id="matMinP" type="number" step="any" placeholder="Min c" value="${esc(st.matMinPrice)}">
        <input class="input input--sm" id="matMaxP" type="number" step="any" placeholder="Max c" value="${esc(st.matMaxPrice)}">
        <select class="select" id="matSort">
          <option value="p" ${st.matSort === 'p' ? 'selected' : ''}>Sort: Price (ราคา)</option>
          <option value="droppers" ${st.matSort === 'droppers' ? 'selected' : ''}>Sort: Droppers</option>
          <option value="n" ${st.matSort === 'n' ? 'selected' : ''}>Sort: Name</option>
        </select>
        <button type="button" class="btn" id="matDir">${st.matDir > 0 ? '▲' : '▼'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('วัตถุดิบ', 'Material')}</th>
          <th>${L('ประเภท', 'Tags')}</th>
          <th style="text-align:right">${L('ราคาขาย', 'Price')}</th>
          <th>${L('แหล่งที่มา', 'From')}</th>
          <th style="text-align:right">${L('ดรอปจาก', 'Droppers')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((m) => `<tr data-open="mat" data-id="${esc(m.id)}">
            <td><div class="name-cell"><span class="sprite-box">${atlasImg('mats', m.id, 32)}</span><div>${nameHtml(m.n)}</div></div></td>
            <td><div style="display:flex;gap:4px">${m.rare ? pill('RARE', '#f5b942') : ''}${m.life ? pill('LIFE', '#38c97a') : ''}${!m.rare && !m.life ? '<span class="muted">Common</span>' : ''}</div></td>
            <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtCoin(m.p)}</td>
            <td class="muted">${esc(tr(m.from || '–'))}</td>
            <td class="num" style="text-align:right">${(MAT_DROPPERS[m.id] || []).length || '–'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.matPage, 'data-mtpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-dtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.dtab; renderDrops(); }));
    $('#matQ').addEventListener('input', (e) => { st.matQ = e.target.value; st.matPage = 0; keepFocus('#matQ', renderMaterialsSubtab); });
    $('#matMinP').addEventListener('input', (e) => { st.matMinPrice = e.target.value; st.matPage = 0; keepFocus('#matMinP', renderMaterialsSubtab); });
    $('#matMaxP').addEventListener('input', (e) => { st.matMaxPrice = e.target.value; st.matPage = 0; keepFocus('#matMaxP', renderMaterialsSubtab); });
    $('#matFilter').addEventListener('change', (e) => { st.matFilter = e.target.value; st.matPage = 0; renderMaterialsSubtab(); });
    $('#matSort').addEventListener('change', (e) => { st.matSort = e.target.value; st.matPage = 0; renderMaterialsSubtab(); });
    $('#matDir').addEventListener('click', () => { st.matDir = -st.matDir; renderMaterialsSubtab(); });
    $('#mainView').querySelectorAll('[data-mtpage]').forEach((b) => b.addEventListener('click', () => { st.matPage = Number(b.dataset.page); renderMaterialsSubtab(); }));
  }

  // ------------------------------------------------------------------ VIEW: CARDS
  function renderCards() {
    const st = state.cards;
    const q = norm(st.q);
    const minLv = st.minLv !== '' ? Number(st.minLv) : null;
    const maxLv = st.maxLv !== '' ? Number(st.maxLv) : null;

    let list = CARDS_LIST.filter((c) => {
      if (st.kind === 'boss' && !c.boss) return false;
      if (st.kind === 'normal' && c.boss) return false;
      if (st.el && c.el !== st.el) return false;
      if (st.map && !(c.maps || []).includes(st.map)) return false;
      if (minLv != null || maxLv != null) {
        if (c.mon) {
          if (!hasSpawnInLvRange(c.mon, c.maps, st.map, minLv, maxLv)) return false;
        } else if (!rangeMatchesLv(c.lv, c.lv, minLv, maxLv)) {
          return false;
        }
      }
      if (q && !matchesQuery(c._q, q)) return false;
      return true;
    });

    list.sort((a, b) => {
      if (st.sort === 'price') return (a.stallPrice - b.stallPrice) * st.dir;
      if (st.sort === 'lv') {
        const ra = a.mon ? getDropLvRange(a.mon, a.maps, st.map, minLv, maxLv) : { min: a.lv, max: a.lv };
        const rb = b.mon ? getDropLvRange(b.mon, b.maps, st.map, minLv, maxLv) : { min: b.lv, max: b.lv };
        return ((st.dir > 0 ? ra.min : ra.max) - (st.dir > 0 ? rb.min : rb.max)) * st.dir;
      }
      return tr(a.cardName).localeCompare(tr(b.cardName)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);
    const elOpts = Object.entries(W.elements || {}).map(([k, v]) => `<option value="${k}" ${st.el === k ? 'selected' : ''}>${esc(tr(v))}</option>`).join('');

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🃏 ${L('การ์ดมอนสเตอร์ (Lore Art Cards)', 'Monster Cards (Lore Art Cards)')}</h1>
          <p>${L('การ์ดทั้งหมด 338 ใบ ดรอป 0.01% จากมอนสเตอร์ — ตั้งร้านขายแนะนำ 500c (ทั่วไป) / 5,000c (บอส)', '338 Monster Art Cards · 0.01% drop rate · Suggested stall price: 500c (normal) / 5,000c (boss)')}</p>
        </div>
      </div>

      <div class="tabs">
        ${[['all', L('ทั้งหมด', 'All Cards') + ` (${CARDS_LIST.length})`], ['boss', L('การ์ดบอส 5,000c', 'Boss Cards (5,000c)') + ` (${CARDS_LIST.filter((c) => c.boss).length})`], ['normal', L('การ์ดทั่วไป 500c', 'Normal Cards (500c)') + ` (${CARDS_LIST.filter((c) => !c.boss).length})`]].map(([k, lbl]) =>
          `<button type="button" class="tab-btn ${st.kind === k ? 'is-on' : ''}" data-ckind="${k}">${esc(lbl)}</button>`
        ).join('')}
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="cardQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อการ์ด / มอนสเตอร์ / สกิล / พาสซีฟ / แมพ...', 'Search card, monster, art, passive, map...')}">
        <select class="select" id="cardEl"><option value="">${L('ทุกธาตุ', 'All Elements')}</option>${elOpts}</select>
        <select class="select" id="cardMap"><option value="">${L('ทุกแมพ', 'All Maps')}</option>${mapOptionsHtml(st.map)}</select>
        <input class="input input--sm" id="cardMinLv" type="number" placeholder="Min Lv" value="${esc(st.minLv)}">
        <input class="input input--sm" id="cardMaxLv" type="number" placeholder="Max Lv" value="${esc(st.maxLv)}">
        <select class="select" id="cardSort">
          <option value="price" ${st.sort === 'price' ? 'selected' : ''}>Sort: ${L('ราคาตั้งร้าน', 'Stall Price')}</option>
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
          <option value="name" ${st.sort === 'name' ? 'selected' : ''}>Sort: Name</option>
        </select>
        <button type="button" class="btn" id="cardDir">${st.dir > 0 ? '▲ ASC' : '▼ DESC'}</button>
      </div>

      <div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>${L('การ์ด & ท่า Lore Art', 'Card & Lore Art')}</th>
          <th>${L('มอนสเตอร์', 'Monster')}</th>
          <th>Lv</th>
          <th>${L('ธาตุ', 'Element')}</th>
          <th>${L('แมพที่ดรอป', 'Maps')}</th>
          <th>${L('พาสซีฟ', 'Passives')}</th>
          <th style="text-align:right">${L('โอกาส', 'Rate')}</th>
          <th style="text-align:right">${L('ราคาตั้งร้าน', 'Stall Price')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((c) => {
            const lvRange = c.mon ? getDropLvRange(c.mon, c.maps, st.map, minLv, maxLv) : null;
            const mapChips = lvRange ? renderMapLvChips(lvRange.entries, 2) : ((c.maps || []).slice(0, 2).map((mp) => `<button type="button" class="chip-link" style="padding:2px 7px;font-size:11.5px" data-open="map" data-id="${esc(mp)}">${esc(MAP[mp] ? tr(MAP[mp].n) : mp)}</button>`).join(' ') || '<span class="muted">–</span>');
            return `<tr>
              <td><div class="name-cell" style="cursor:pointer" data-open="card" data-id="${esc(c.id)}"><span class="sprite-box">${atlasImg('mats', c.cardId, 34)}</span><div>${nameHtml(c.cardName, tr(c.artName))}</div></div></td>
              <td>${c.mon ? `<div class="name-cell" style="cursor:pointer" data-open="monster" data-id="${esc(c.mon.id)}">${monSprite(c.mon, 30)}<div>${esc(tr(c.monName))} ${c.boss ? pill('BOSS', '#f25c69') : ''}</div></div>` : esc(tr(c.monName))}</td>
              <td class="num">${lvRange ? esc(lvRange.label) : c.lv}</td>
              <td>${elPill(c.el)}</td>
              <td><div style="display:flex;gap:4px;flex-wrap:wrap">${mapChips}</div></td>
              <td><div class="stat-chips">${c.passives.map((p) => `<span class="stat-chip">${esc(tr(p))}</span>`).join('') || '<span class="muted">–</span>'}</div></td>
              <td class="num" style="text-align:right">${fmtPct(c.ratePct)}</td>
              <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtCoin(c.stallPrice)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">${L('ไม่พบการ์ดที่ตรงเงื่อนไข', 'No matching cards')}</td></tr>`}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-cpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-ckind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.ckind; st.page = 0; renderCards(); }));
    $('#cardQ').addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; keepFocus('#cardQ', renderCards); });
    $('#cardMinLv').addEventListener('input', (e) => { st.minLv = e.target.value; st.page = 0; keepFocus('#cardMinLv', renderCards); });
    $('#cardMaxLv').addEventListener('input', (e) => { st.maxLv = e.target.value; st.page = 0; keepFocus('#cardMaxLv', renderCards); });
    $('#cardEl').addEventListener('change', (e) => { st.el = e.target.value; st.page = 0; renderCards(); });
    $('#cardMap').addEventListener('change', (e) => { st.map = e.target.value; st.page = 0; renderCards(); });
    $('#cardSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderCards(); });
    $('#cardDir').addEventListener('click', () => { st.dir = -st.dir; renderCards(); });
    $('#mainView').querySelectorAll('[data-cpage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderCards(); }));
  }

  // ------------------------------------------------------------------ VIEW 8: RUNES, RELICS, KEYSTONES
  function renderRunes() {
    const st = state.runes;
    const q = norm(st.q);
    const runeEntries = RUNES_LIST.filter((r) => {
      if (st.kind && r.kind !== st.kind) return false;
      if (st.on && r.on !== st.on) return false;
      if (q && !matchesQuery(r._q, q)) return false;
      return true;
    });
    const relics = RELICS_LIST.filter((rel) => !q || matchesQuery(rel._q, q));
    const keystones = KEYSTONES_LIST.filter((ks) => !q || matchesQuery(ks._q, q));
    const onSet = Array.from(new Set(Object.values(RUNES).map((r) => r.on).filter(Boolean)));
    const kindSet = Array.from(new Set(Object.values(RUNES).map((r) => r.kind).filter(Boolean)));

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🔮 ${L('รูน, เรลิก & คีย์สโตน', 'Runes, Relics & Keystones')}</h1>
          <p>${L('รายละเอียดรูนทั้ง 3 ระดับ ราคาผสม มอนสเตอร์ที่ดรอป รวมถึงเรลิกและคีย์สโตน Season 2', 'All 47 runes across Tiers 1–3, merge prices, monster droppers, 10 relics, and 4 keystone branches')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn ${st.tab === 'runes' ? 'is-on' : ''}" data-rtab="runes">${L('รูน', 'Runes')} (${RUNES_LIST.length})</button>
        <button type="button" class="tab-btn ${st.tab === 'relics' ? 'is-on' : ''}" data-rtab="relics">${L('เรลิก', 'Relics')} (${RELICS_LIST.length})</button>
        <button type="button" class="tab-btn ${st.tab === 'keystones' ? 'is-on' : ''}" data-rtab="keystones">${L('คีย์สโตน', 'Keystones')} (${KEYSTONES_LIST.length})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="runeQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหารูน / เรลิก / คีย์สโตน / เอฟเฟกต์ / มอนที่ดรอป...', 'Search rune, relic, keystone, effect, dropper...')}">
        ${st.tab === 'runes' ? `
          <select class="select" id="runeKind"><option value="">${L('ทุกหมวด', 'All Kinds')}</option>${kindSet.map((k) => `<option value="${esc(k)}" ${st.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
          <select class="select" id="runeOn"><option value="">${L('ทุกเงื่อนไข (On)', 'All Triggers')}</option>${onSet.map((k) => `<option value="${esc(k)}" ${st.on === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        ` : ''}
      </div>

      ${st.tab === 'runes' ? `
        <div class="card-grid">
          ${runeEntries.map((r) => {
            const droppers = RUNE_DROPPERS[r.id] || [];
            const mapCount = RUNE_MAP_COUNTS[r.id] || 0;
            const isSpell = !!SPELL_ELS_BY_RUNE[r.id];
            return `<article class="entity-card" data-open="rune" data-id="${esc(r.id)}">
              <div class="entity-card__head">
                ${atlasImg('mats', `bl_rune_${r.id}_1`, 38)}
                <div style="flex:1">${nameHtml(r.n)}</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
                  ${pill(r.kind || 'rune', '#9a5cf0')}
                  ${r.on ? pill(r.on, '#3f95ff') : ''}
                  ${r.el ? elPill(r.el) : ''}
                  ${isSpell ? pill(`Lv ${SPELL_CFG.lv || 70}+`, '#ff8f3f') : ''}
                </div>
              </div>
              <div style="font-size:12.5px;display:flex;flex-direction:column;gap:4px">
                ${(r.t || []).map((txt, idx) => `<div><strong style="color:var(--gold)">Lv ${idx + 1}:</strong> ${esc(tr(txt))}</div>`).join('')}
              </div>
              <div class="muted" style="font-size:12px">
                💰 ${(r.price || []).join(' / ')} · 👾 ${droppers.length} ${L('มอน', 'mons')} · 🗺️ ${mapCount} ${L('แมพ', 'maps')}
              </div>
            </article>`;
          }).join('') || `<div class="muted">${L('ไม่พบรูนที่ตรงเงื่อนไข', 'No matching runes')}</div>`}
        </div>` : st.tab === 'relics' ? `
        <div class="card-grid">
          ${relics.map((rel) => `
            <article class="entity-card" style="cursor:default">
              <div class="entity-card__head">
                ${elIcon(rel.el, 28)}
                <div style="flex:1">${nameHtml(rel.n)}</div>
                ${elPill(rel.el)}
              </div>
              <div style="font-size:12.5px">
                <div style="color:var(--green)">▲ <strong>${L('จุดเด่น:', 'Gain:')}</strong> ${esc(tr(rel.gain))}</div>
                <div style="color:var(--red);margin-top:6px">▼ <strong>${L('ข้อเสีย:', 'Price:')}</strong> ${esc(tr(rel.price))}</div>
              </div>
            </article>`).join('') || `<div class="muted">${L('ไม่พบเรลิกที่ตรงเงื่อนไข', 'No matching relics')}</div>`}
        </div>` : `
        <div class="card-grid">
          ${keystones.map((ks) => `
            <article class="entity-card" style="cursor:default">
              <div class="entity-card__head">
                <div style="flex:1">${nameHtml(ks.n)}</div>
                ${pill(ks.id.toUpperCase(), '#f5b942')}
              </div>
              <div style="font-size:12.5px;display:flex;flex-direction:column;gap:6px">
                <div><strong style="color:var(--text-2)">${L('โหนดย่อย:', 'Small Node:')}</strong> ${esc(tr(ks.small))}</div>
                <div style="color:var(--green)">▲ <strong>${L('คีย์สโตน:', 'Gain:')}</strong> ${esc(tr(ks.gain))}</div>
                <div style="color:var(--red)">▼ <strong>${L('ข้อแลกเปลี่ยน:', 'Price:')}</strong> ${esc(tr(ks.price))}</div>
              </div>
            </article>`).join('') || `<div class="muted">${L('ไม่พบคีย์สโตนที่ตรงเงื่อนไข', 'No matching keystones')}</div>`}
        </div>`}
    `;

    $('#mainView').querySelectorAll('[data-rtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.rtab; renderRunes(); }));
    if ($('#runeQ')) $('#runeQ').addEventListener('input', (e) => { st.q = e.target.value; keepFocus('#runeQ', renderRunes); });
    if ($('#runeKind')) $('#runeKind').addEventListener('change', (e) => { st.kind = e.target.value; renderRunes(); });
    if ($('#runeOn')) $('#runeOn').addEventListener('change', (e) => { st.on = e.target.value; renderRunes(); });
  }

  // ------------------------------------------------------------------ VIEW 9: QUESTS & LIFE SKILLS
  function renderQuests() {
    const st = state.quests;
    const chapters = Array.from(new Set((W.quests || []).map((q) => q.ch)));

    let contentHtml = '';
    if (st.tab === 'quests') {
      const q = norm(st.q);
      const list = (W.quests || []).filter((x) => {
        if (st.ch && x.ch !== st.ch) return false;
        if (q && !matchesQuery(x._q, q)) return false;
        return true;
      });
      contentHtml = `
        <div class="filter-bar">
          <input class="input input--search" id="qQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อเควสต์ / เป้าหมาย / บท...', 'Search quest title, chapter, objective...')}">
          <select class="select" id="qCh">
            <option value="">${L('ทุกบท (All Chapters)', 'All Chapters')}</option>
            ${chapters.map((c) => `<option value="${esc(c)}" ${st.ch === c ? 'selected' : ''}>${esc(tr(c))}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr>
            <th>ID</th>
            <th>${L('ชื่อเควสต์ & บท', 'Quest & Chapter')}</th>
            <th>Lv</th>
            <th>${L('สถานที่', 'Map')}</th>
            <th style="text-align:right">${L('เหรียญ', 'Coins')}</th>
            <th>${L('เป้าหมาย', 'Objectives')}</th>
          </tr></thead>
          <tbody>
            ${list.map((item) => `<tr>
              <td class="num"><strong>${esc(item.id)}</strong></td>
              <td>${nameHtml(item.t, tr(item.ch))}</td>
              <td class="num">${item.lv ?? 1}</td>
              <td>${esc(tr(item.map || '–'))}</td>
              <td class="num" style="text-align:right;color:var(--gold)">${fmt(item.coins)}</td>
              <td style="font-size:12.5px;color:var(--text-1)">${(item.obj || []).map((o) => `• ${esc(tr(o))}`).join('<br>')}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    } else if (st.tab === 'life') {
      const tables = W.lifeTables || {};
      const tKeys = Object.keys(tables);
      const rawRows = st.lifeTab === 'crops'
        ? [...(tables.crops || []), ...Object.entries(S2.farm || {}).map(([id, v]) => ({ id, ...v }))]
        : (tables[st.lifeTab] || []);
      const lq = norm(st.lifeQ);
      const minLv = st.lifeMinLv !== '' ? Number(st.lifeMinLv) : null;
      const maxLv = st.lifeMaxLv !== '' ? Number(st.lifeMaxLv) : null;
      const minP = st.lifeMinPrice !== '' ? Number(st.lifeMinPrice) : null;
      const maxP = st.lifeMaxPrice !== '' ? Number(st.lifeMaxPrice) : null;

      const resolvePrice = (r) => {
        if (r.price != null) return Number(r.price);
        if (r.mat && MAT[r.mat] && MAT[r.mat].p != null) return Number(MAT[r.mat].p);
        if (r.coins != null) return Number(r.coins);
        return 0;
      };

      const curRows = rawRows.map((r) => {
        const wObj = r.when != null ? WHEN_LABELS[r.when] : null;
        const matInfo = r.mat && MAT[r.mat];
        const ingNames = r.mats ? Object.keys(r.mats).map((mid) => [mid, MAT[mid] && MAT[mid].n]) : '';
        const rowQ = biText(r.id, r.n, r.waters, r.where, wObj && [wObj.th, wObj.en], r.rod ? `rod ${r.rod}` : '', r.tier ? `tier ${r.tier}` : '', r.buff, ingNames, matInfo && [matInfo.n, matInfo.d]);
        return { ...r, _price: resolvePrice(r), _q: rowQ };
      }).filter((r) => {
        if (minLv != null && (r.lv ?? 0) < minLv) return false;
        if (maxLv != null && (r.lv ?? 0) > maxLv) return false;
        if (minP != null && r._price < minP) return false;
        if (maxP != null && r._price > maxP) return false;
        if (st.lifeTab === 'fish' && st.lifeWhen !== 'all' && String(r.when || 0) !== st.lifeWhen) return false;
        if (lq && !matchesQuery(r._q, lq)) return false;
        return true;
      }).sort((a, b) => {
        let va = 0, vb = 0;
        if (st.lifeSort === 'price') { va = a._price; vb = b._price; }
        else if (st.lifeSort === 'lv') { va = a.lv || 0; vb = b.lv || 0; }
        else if (st.lifeSort === 'xp') { va = a.xp || 0; vb = b.xp || 0; }
        else { va = tr(a.n || a.id); vb = tr(b.n || b.id); }
        if (typeof va === 'number') return (va - vb) * st.lifeDir;
        return String(va).localeCompare(String(vb)) * st.lifeDir;
      });

      contentHtml = `
        <div class="card-grid" style="margin-bottom:18px">
          ${(W.life || []).map((lf) => `
            <article class="panel">
              <h2 class="panel__title"><span>🛠️ ${esc(tr(lf.n))}</span><span class="muted">${(lf.perks || []).length} perks</span></h2>
              <div style="font-size:12.5px;display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
                ${(lf.perks || []).map(([lv, desc]) => `<div><strong style="color:var(--gold)">Lv ${lv}:</strong> ${esc(tr(desc))}</div>`).join('')}
              </div>
              <div style="font-size:12px;color:var(--text-2)">
                ${(lf.guide || []).slice(0, 5).map((g) => `• <strong>${esc(tr(g.n))}</strong> (Lv ${g.lv}) — ${esc(tr(g.where))}`).join('<br>')}
              </div>
            </article>`).join('')}
        </div>

        <div class="panel">
          <div class="panel__title">
            <span>📋 ${L('ตารางสกิลชีวิต', 'Life Skill Tables')} (${curRows.length})</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${tKeys.map((k) => `<button type="button" class="tab-btn ${st.lifeTab === k ? 'is-on' : ''}" data-ltab="${esc(k)}">${esc(k.toUpperCase())} (${k === 'crops' ? (tables[k].length + Object.keys(S2.farm || {}).length) : tables[k].length})</button>`).join('')}
            </div>
          </div>

          <div class="filter-bar">
            <input class="input input--search" id="lfQ" type="search" value="${esc(st.lifeQ)}" placeholder="${L('ค้นหาชื่อปลา / แร่ / ไม้ / พืช...', 'Search fish, ore, wood, crop...')}">
            <input class="input input--sm" id="lfMinLv" type="number" placeholder="Min Lv" value="${esc(st.lifeMinLv)}">
            <input class="input input--sm" id="lfMaxLv" type="number" placeholder="Max Lv" value="${esc(st.lifeMaxLv)}">
            <input class="input input--sm" id="lfMinP" type="number" step="any" placeholder="Min c" value="${esc(st.lifeMinPrice)}">
            <input class="input input--sm" id="lfMaxP" type="number" step="any" placeholder="Max c" value="${esc(st.lifeMaxPrice)}">
            ${st.lifeTab === 'fish' ? `
              <select class="select" id="lfWhen">
                <option value="all" ${st.lifeWhen === 'all' ? 'selected' : ''}>${L('ทุกช่วงเวลา', 'Any When')}</option>
                <option value="0" ${st.lifeWhen === '0' ? 'selected' : ''}>${L('ตลอดวัน', 'Any time')}</option>
                <option value="1" ${st.lifeWhen === '1' ? 'selected' : ''}>${L('กลางคืน', 'Night')}</option>
                <option value="2" ${st.lifeWhen === '2' ? 'selected' : ''}>${L('กลางวัน', 'Day')}</option>
              </select>` : ''}
            <select class="select" id="lfSort">
              <option value="price" ${st.lifeSort === 'price' ? 'selected' : ''}>Sort: Price (ราคา)</option>
              <option value="lv" ${st.lifeSort === 'lv' ? 'selected' : ''}>Sort: Lv</option>
              <option value="xp" ${st.lifeSort === 'xp' ? 'selected' : ''}>Sort: EXP</option>
              <option value="name" ${st.lifeSort === 'name' ? 'selected' : ''}>Sort: Name</option>
            </select>
            <button type="button" class="btn" id="lfDir">${st.lifeDir > 0 ? '▲' : '▼'}</button>
          </div>

          <div class="table-wrap"><table class="data-table">
            <thead><tr>
              <th>${L('ชื่อ', 'Name')}</th>
              <th>Lv</th>
              <th>EXP</th>
              <th style="text-align:right">${L('ราคา', 'Price')}</th>
              <th>${L('รายละเอียด', 'Details')}</th>
            </tr></thead>
            <tbody>
              ${curRows.map((r) => {
                const iconId = r.mat || (st.lifeTab === 'fish' ? r.id : '');
                const wLabel = st.lifeTab === 'fish' ? (WHEN_LABELS[r.when || 0] || WHEN_LABELS[0]) : null;
                const detailParts = [];
                if (r.mins) detailParts.push(`${r.mins} min`);
                if (r.rod) detailParts.push(`Rod ${r.rod}`);
                if (wLabel) detailParts.push(L(wLabel.th, wLabel.en));
                if (r.waters) detailParts.push(r.waters.join(', '));
                if (r.tier) detailParts.push(`Tier ${r.tier}`);
                if (r.hits) detailParts.push(`${r.hits} hits`);
                if (r.where) detailParts.push(tr(r.where));
                return `<tr>
                  <td><div class="name-cell" ${iconId ? `style="cursor:pointer" data-open="mat" data-id="${esc(iconId)}"` : ''}>${iconId ? atlasImg('mats', iconId, 28) : ''}<div>${nameHtml(r.n || r.id)}</div></div></td>
                  <td class="num">${r.lv ?? '–'}</td>
                  <td class="num">${r.xp ?? '–'}</td>
                  <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtCoin(r._price)}</td>
                  <td class="muted" style="font-size:12px">${esc(detailParts.join(' · ') || '–')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        </div>`;
    } else {
      const recipes = Object.values((S2.smelt && S2.smelt.recipes) || {});
      const floors = Object.entries((S2.mines && S2.mines.floors) || {});
      contentHtml = `
        <div class="panel" style="margin-bottom:16px">
          <h2 class="panel__title"><span>🔥 ${L('สูตรหลอมแร่ & คราฟต์ (Smelter)', 'Smelter Recipes')} (${recipes.length})</span></h2>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>${L('ผลลัพธ์', 'Output')}</th><th>Lv</th><th>${L('วัตถุดิบที่ใช้', 'Ingredients')}</th><th style="text-align:right">${L('ค่าหลอม', 'Fee')}</th><th style="text-align:right">EXP</th></tr></thead>
            <tbody>
              ${recipes.map((rc) => {
                const outMat = MAT[rc.out];
                return `<tr>
                  <td><div class="name-cell">${atlasImg('mats', rc.out, 30)}<div>${nameHtml(outMat ? outMat.n : rc.out)}</div></div></td>
                  <td class="num">${rc.lv ?? 1}</td>
                  <td><div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${Object.entries(rc.in || {}).map(([mid, qty]) => {
                      const mm = MAT[mid];
                      return `<span class="chip-link" data-open="mat" data-id="${esc(mid)}">${atlasImg('mats', mid, 20)}<span>${esc(tr(mm ? mm.n : mid))} ×${qty}</span></span>`;
                    }).join('')}
                  </div></td>
                  <td class="num" style="text-align:right;color:var(--gold)">${fmt(rc.coins)}</td>
                  <td class="num" style="text-align:right">${fmt(rc.xp)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        </div>

        <div class="panel">
          <h2 class="panel__title"><span>⛏️ ${L('ชั้นเหมืองแร่ (Mines)', 'Mine Floors')} (${floors.length})</span></h2>
          <div class="card-grid">
            ${floors.map(([fid, fl]) => `
              <article class="entity-card" style="cursor:default">
                <div class="entity-card__head">
                  <div style="flex:1">${nameHtml(fl.n)}</div>
                  ${pill(fl.mine || 'mine', '#ff8f3f')}
                </div>
                <div class="muted" style="font-size:12px">${esc(tr(fl.lv))}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${(fl.ores || []).map(([ore, qty, mid]) => `<span class="chip-link" data-open="mat" data-id="${esc(mid)}">${atlasImg('mats', mid, 20)}<span>${esc(ore)} (${qty})</span></span>`).join('')}
                </div>
              </article>`).join('')}
          </div>
        </div>`;
    }

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>📜 ${L('เควสต์, สกิลชีวิต & การหลอมแร่', 'Quests, Life Skills & Smelting')}</h1>
          <p>${L('ภารกิจเนื้อเรื่อง 97 เควสต์ อาชีพเสริม 5 สาย ตารางปลูกผัก/ตกปลา/ขุดแร่ และสูตรเตาหลอม', '97 quests, 5 life professions, crops/fish/ore tables, and 22 smelter recipes')}</p>
        </div>
      </div>
      <div class="tabs">
        <button type="button" class="tab-btn ${st.tab === 'quests' ? 'is-on' : ''}" data-qtab="quests">${L('เควสต์ทั้งหมด', 'Quests')} (${(W.quests || []).length})</button>
        <button type="button" class="tab-btn ${st.tab === 'life' ? 'is-on' : ''}" data-qtab="life">${L('สกิลชีวิต & ตาราง', 'Life Skills & Tables')}</button>
        <button type="button" class="tab-btn ${st.tab === 'smelt' ? 'is-on' : ''}" data-qtab="smelt">${L('เตาหลอม & เหมืองแร่', 'Smelter & Mines')}</button>
      </div>
      ${contentHtml}
    `;

    $('#mainView').querySelectorAll('[data-qtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.qtab; renderQuests(); }));
    $('#mainView').querySelectorAll('[data-ltab]').forEach((b) => b.addEventListener('click', () => { st.lifeTab = b.dataset.ltab; renderQuests(); }));
    if ($('#qQ')) $('#qQ').addEventListener('input', (e) => {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderQuests();
      const inp = $('#qQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    if ($('#qCh')) $('#qCh').addEventListener('change', (e) => { st.ch = e.target.value; renderQuests(); });
    if ($('#lfQ')) $('#lfQ').addEventListener('input', (e) => { st.lifeQ = e.target.value; keepFocus('#lfQ', renderQuests); });
    if ($('#lfMinLv')) $('#lfMinLv').addEventListener('input', (e) => { st.lifeMinLv = e.target.value; keepFocus('#lfMinLv', renderQuests); });
    if ($('#lfMaxLv')) $('#lfMaxLv').addEventListener('input', (e) => { st.lifeMaxLv = e.target.value; keepFocus('#lfMaxLv', renderQuests); });
    if ($('#lfMinP')) $('#lfMinP').addEventListener('input', (e) => { st.lifeMinPrice = e.target.value; keepFocus('#lfMinP', renderQuests); });
    if ($('#lfMaxP')) $('#lfMaxP').addEventListener('input', (e) => { st.lifeMaxPrice = e.target.value; keepFocus('#lfMaxP', renderQuests); });
    if ($('#lfWhen')) $('#lfWhen').addEventListener('change', (e) => { st.lifeWhen = e.target.value; renderQuests(); });
    if ($('#lfSort')) $('#lfSort').addEventListener('change', (e) => { st.lifeSort = e.target.value; renderQuests(); });
    if ($('#lfDir')) $('#lfDir').addEventListener('click', () => { st.lifeDir = -st.lifeDir; renderQuests(); });
  }

  // ------------------------------------------------------------------ VIEW 10: SEASON 2, LORE & EXPORT
  function renderSeason2() {
    const st = state.s2;
    const patch = S2.patch || {};
    const posts = S2.posts || [];
    const mounts = (S2.mounts && S2.mounts.list) || [];
    const wings = (S2.wings && S2.wings.list) || [];
    const loreFam = Object.entries((S2.lore && S2.lore.fam) || {});
    const loreBoss = Object.entries((S2.lore && S2.lore.boss) || {});
    const monSk = Object.entries((S2.monSkills && S2.monSkills.sk) || {});
    const checkin = S2.checkin || [];
    const gacha = S2.gacha || {};

    const dbFiles = [
      'metadata.json', 'items.json', 'sets.json', 'boss_sets.json', 'monsters.json',
      'maps.json', 'regions.json', 'jobs.json', 'skills.json', 'materials.json',
      'cards.json', 'drops.json', 'quests.json', 'runes_relics_keystones.json',
      'monster_skills_lore.json', 'life_smelt.json', 'mounts_wings_gacha.json', 'systems_season2.json'
    ];
    const csvFiles = [
      'items.csv', 'monsters.csv', 'maps.csv', 'jobs.csv', 'skills.csv',
      'materials.csv', 'cards.csv', 'drops.csv', 'quests.csv', 'runes.csv'
    ];

    let body = '';
    if (st.tab === 'patch') {
      const bm = S2.bloodMoon || {};
      body = `
        <div class="grid-2">
          <section class="panel">
            <h2 class="panel__title"><span>🌕 ${L('Blood Moon Night & กิจกรรมแผนที่', 'Blood Moon Night & Map Events')}</span></h2>
            <p style="color:var(--gold);font-weight:700">${esc(tr(bm.when || ''))}</p>
            <div class="kv-grid">
              ${Object.entries(bm.r || {}).map(([k, v]) => `<div class="kv-box"><div class="kv-box__k">${esc(k)}</div><div class="kv-box__v">${esc(String(v))}</div></div>`).join('')}
            </div>
          </section>
          <section class="panel">
            <h2 class="panel__title"><span>🎰 ${L('Gacha & เช็คอิน 28 วัน', 'Gacha & 28-Day Check-In')}</span></h2>
            <div class="kv-grid" style="margin-bottom:12px">
              <div class="kv-box"><div class="kv-box__k">Pity</div><div class="kv-box__v">${gacha.pity || '–'}</div></div>
              <div class="kv-box"><div class="kv-box__k">1 Pull / 10 Pull</div><div class="kv-box__v">${gacha.one || '–'} / ${gacha.ten || '–'}</div></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${checkin.slice(0, 14).map((c) => `<span class="stat-chip">D${c.day}: ${esc(tr(c.n))} ×${c.q}</span>`).join('')}
            </div>
          </section>
        </div>

        <div class="panel" style="margin-bottom:16px">
          <h2 class="panel__title"><span>📝 ${L('Patch Notes', 'Patch Notes')} · ${esc(patch.version || '')} (${esc(patch.date || '')})</span></h2>
          <div class="grid-2">
            ${Object.entries(patch.sections || {}).map(([sec, lines]) => `
              <div class="kv-box" style="padding:12px">
                <strong style="color:var(--gold)">${esc(tr(sec))}</strong>
                <ul style="margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--text-1)">
                  ${lines.slice(0, 10).map((ln) => `<li style="margin-bottom:4px">${esc(tr(ln).replace(/\*\*/g, ''))}</li>`).join('')}
                </ul>
              </div>`).join('')}
          </div>
        </div>

        <div class="card-grid">
          ${posts.map((p) => `
            <article class="panel">
              <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px">
                ${pill(tr(p.tag || 'POST'), '#f5b942')}
                <span class="muted">${esc(p.date || '')}</span>
              </div>
              <h3 style="margin:0 0 8px">${esc(tr(p.title))}</h3>
              <div style="font-size:12.5px;color:var(--text-1)">
                ${(p.body || []).slice(0, 3).map((b) => b.p ? `<p style="margin:4px 0">${esc(tr(b.p).replace(/\*\*/g, ''))}</p>` : '').join('')}
              </div>
            </article>`).join('')}
        </div>`;
    } else if (st.tab === 'lore') {
      body = `
        <div class="panel" style="margin-bottom:16px">
          <h2 class="panel__title"><span>📖 ${L('สกิลมอนสเตอร์ (15 แบบ) & ท่าพิเศษ', 'Monster Skills (15) & Lore Arts (22)')}</span></h2>
          <div class="card-grid">
            ${monSk.map(([id, ms]) => `
              <div class="kv-box" style="padding:10px">
                <strong>${esc(tr(ms.n))}</strong> <span class="muted">(${esc(id)})</span>
                <div class="muted" style="font-size:12px;margin-top:4px">CD ${ms.cd}s · Range ${ms.range} · Wind ${ms.wind}s</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <h2 class="panel__title"><span>✨ ${L('Lore Arts (22 สาย)', 'Lore Arts (22 Families)')}</span></h2>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${loreFam.map(([id, fm]) => `
                <div class="kv-box" style="padding:10px">
                  <div style="display:flex;justify-content:space-between"><strong>${esc(tr(fm.n))}</strong><span class="num muted">CD ${fm.cd}s</span></div>
                  ${fm.ex ? `<div style="font-size:12px;color:var(--text-1);margin-top:4px">${esc(tr(fm.ex.d))}</div>` : ''}
                </div>`).join('')}
            </div>
          </div>
          <div class="panel">
            <h2 class="panel__title"><span>👑 ${L('Lore Boss Perks & สัตว์ขี่/ปีก', 'Boss Lore, Mounts & Wings')}</span></h2>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
              ${loreBoss.map(([id, lb]) => `
                <div class="kv-box" style="padding:10px">
                  <div style="display:flex;justify-content:space-between"><strong>${esc(tr(lb.n))}</strong>${elPill(lb.el)}</div>
                  <div style="font-size:12px;color:var(--text-1);margin-top:4px">${esc(tr(lb.d))}</div>
                </div>`).join('')}
            </div>
            <h3 style="margin:10px 0 6px;color:var(--gold)">🐎 Mounts (${mounts.length}) & 🪽 Wings (${wings.length})</h3>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${mounts.map((mt) => pill(tr(mt.n), RAR_COLOR[mt.t === 'legendary' ? 'legend' : mt.t] || '#8a8499')).join('')}
              ${wings.slice(0, 14).map((wg) => pill(tr(wg.n), RAR_COLOR[wg.tier === 'legendary' ? 'legend' : wg.tier] || '#8a8499')).join('')}
            </div>
          </div>
        </div>`;
    } else {
      body = `
        <div class="grid-2">
          <section class="panel">
            <h2 class="panel__title"><span>📦 ${L('ไฟล์ JSON (data/db/)', 'Normalized JSON Datasets (data/db/)')}</span></h2>
            <div style="display:flex;flex-direction:column;gap:7px">
              ${dbFiles.map((f) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border)">
                  <code style="font-size:12.5px">data/db/${esc(f)}</code>
                  <a class="btn" href="data/db/${esc(f)}" download="${esc(f)}">⬇ Download</a>
                </div>`).join('')}
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__title"><span>📊 ${L('ไฟล์ CSV สำหรับ Excel (data/csv/)', 'Excel-Ready CSV Exports (data/csv/)')}</span></h2>
            <div style="display:flex;flex-direction:column;gap:7px">
              ${csvFiles.map((f) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-2);border-radius:8px;border:1px solid var(--border)">
                  <code style="font-size:12.5px">data/csv/${esc(f)}</code>
                  <a class="btn btn--gold" href="data/csv/${esc(f)}" download="${esc(f)}">⬇ CSV</a>
                </div>`).join('')}
            </div>

            <div class="kv-box" style="margin-top:16px;padding:12px">
              <strong style="color:var(--gold)">🔄 ${L('อัปเดตข้อมูลล่าสุดจากเว็บต้นทาง', 'Refresh Database from Live Wiki')}</strong>
              <p class="muted" style="font-size:12.5px;margin:6px 0">Run the Python scraper in repo root (no pip packages required):</p>
              <code>python scraper/scrape_nightcamp.py</code>
            </div>
          </section>
        </div>`;
    }

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🌙 ${L('Season 2, Lore Book & ดาวน์โหลดข้อมูล', 'Season 2, Lore & Data Export')}</h1>
          <p>${L('ข้อมูลอัปเดตเวอร์ชัน 0.2 กิจกรรม Blood Moon หนังสือ Lore และจุดดาวน์โหลดไฟล์ JSON/CSV ทั้งหมด', 'Season 2 patch notes, Blood Moon, Lore Book, mounts/wings, and downloadable JSON/CSV exports')}</p>
        </div>
      </div>
      <div class="tabs">
        <button type="button" class="tab-btn ${st.tab === 'patch' ? 'is-on' : ''}" data-s2tab="patch">${L('Patch Notes & กิจกรรม', 'Patch Notes & Events')}</button>
        <button type="button" class="tab-btn ${st.tab === 'lore' ? 'is-on' : ''}" data-s2tab="lore">${L('Lore Book, สัตว์ขี่ & ปีก', 'Lore, Mounts & Wings')}</button>
        <button type="button" class="tab-btn ${st.tab === 'export' ? 'is-on' : ''}" data-s2tab="export">📦 ${L('ดาวน์โหลด JSON / CSV', 'Data Export Hub')}</button>
      </div>
      ${body}
    `;

    $('#mainView').querySelectorAll('[data-s2tab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.s2tab; renderSeason2(); }));
  }

  // ------------------------------------------------------------------ DETAIL MODAL
  function renderRuneMapGroups(runeId, sortMode = 'density', filterText = '') {
    const container = $('#runeMapGroups');
    if (!container) return;
    const droppers = RUNE_DROPPERS[runeId] || [];
    const groups = groupRuneDroppersByMap(droppers, sortMode);
    const q = norm(filterText);

    const visibleGroups = groups
      .map((g) => {
        if (!q) return { ...g, filteredMons: g.monsters };
        const mapHay = biText(g.mapId, g.mp ? g.mp.n : L('บอสพิเศษ', 'Special Boss'), g.mp ? g.mp.lv : '');
        if (matchesQuery(mapHay, q)) return { ...g, filteredMons: g.monsters };
        const filteredMons = g.monsters.filter((d) => {
          const monHay = d.mon._q || biText(d.mon.id, d.mon.n, d.mon.el, W.elements && W.elements[d.mon.el], d.lvInfo.label);
          return matchesQuery(monHay, q);
        });
        return { ...g, filteredMons };
      })
      .filter((g) => g.filteredMons.length > 0);

    if (!visibleGroups.length) {
      container.innerHTML = `<div class="muted" style="padding:14px;text-align:center">${L('ไม่พบแผนที่หรือมอนสเตอร์ที่ตรงคำค้น', 'No maps or monsters match your filter')}</div>`;
      return;
    }

    container.innerHTML = `<div class="map-group-list">${visibleGroups.map((g) => {
      const mons = g.filteredMons;
      const maxRate = mons.reduce((mx, d) => Math.max(mx, d.ratePct), 0);
      const countColor = mons.length >= 2 ? '#3aa6c4' : '#3f95ff';
      const titleHtml = g.mp
        ? `<button type="button" class="map-group__title" data-open="map" data-id="${esc(g.mapId)}">
            <span>🗺️ ${esc(tr(g.mp.n))}</span>
            ${state.lang === 'th' && tr(g.mp.n) !== g.mp.n ? `<span class="map-group__sub">(${esc(g.mp.n)})</span>` : ''}
          </button>`
        : `<span class="map-group__title" style="cursor:default">🌐 ${esc(L('บอสพิเศษ / ไม่มีแผนที่เกิดประจำ', 'Special Boss / No Fixed Spawn Map'))}</span>`;
      return `
        <div class="map-group">
          <div class="map-group__head">
            ${titleHtml}
            <div class="map-group__meta">
              ${g.mp && g.mp.lv ? pill(g.mp.lv, '#f5b942') : ''}
              ${g.mp && g.mp.secret ? pill('SECRET', '#f25c69') : ''}
              ${pill(`${mons.length} ${L('ตัวในแมพนี้', 'in map')}`, countColor)}
              ${pill(`${L('สูงสุด', 'Max')} ${fmtPct(maxRate)}`, '#9a5cf0')}
            </div>
          </div>
          <div class="map-group__mons">
            ${mons.map(({ mon, ratePct, lvInfo }) => `
              <button type="button" class="chip-link" data-open="monster" data-id="${esc(mon.id)}">
                ${monSprite(mon, 24)}
                <span>${esc(tr(mon.n))}</span>
                ${mon.boss ? '<span title="Boss">👑</span>' : (mon.eliteOf ? '<span title="Elite">⚡</span>' : '')}
                ${elIcon(mon.el, 14)}
                <small class="muted">${esc(lvInfo.label)}</small>
                <strong style="color:var(--purple)">${fmtPct(ratePct)}</strong>
              </button>`).join('')}
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function openModal(kind, id) {
    let html = '';
    if (kind === 'monster') {
      const m = MON[id];
      if (!m) return;
      const bm = S2.bossMoves && S2.bossMoves[m.id];
      const spawnMaps = (m.maps || []).filter(Boolean);
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${monSprite(m, 72)}</span>
          <div style="flex:1">
            <h2>${esc(tr(m.n))}</h2>
            <div class="muted">${esc(m.n)} · <code>${esc(m.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(`Lv ${m._lvLabel}`, '#f5b942')}
              ${m.boss ? pill('BOSS', '#f25c69') : ''}
              ${elPill(m.el)}
              ${pill(tr((W.races && W.races[m.race]) || m.race), '#6e6a86')}
              ${m.arm ? pill(m.arm.toUpperCase(), ARM_COLOR[m.arm] || '#8a94a6') : ''}
            </div>
          </div>
        </div>

        <div class="kv-grid">
          <div class="kv-box"><div class="kv-box__k">HP</div><div class="kv-box__v" style="color:var(--red)">${fmt(m.hp)}</div></div>
          <div class="kv-box"><div class="kv-box__k">ATK</div><div class="kv-box__v">${Array.isArray(m.atk) ? `${fmt(m.atk[0])}–${fmt(m.atk[1])}` : '–'}</div></div>
          <div class="kv-box"><div class="kv-box__k">DEF / MDEF</div><div class="kv-box__v">${m.def ?? '–'} / ${m.mdef ?? '–'}</div></div>
          <div class="kv-box"><div class="kv-box__k">HIT / FLEE</div><div class="kv-box__v">${fmt(m.hit)} / ${fmt(m.flee)}</div></div>
          <div class="kv-box"><div class="kv-box__k">EXP</div><div class="kv-box__v" style="color:var(--gold)">${fmt(m.exp)}</div></div>
          <div class="kv-box"><div class="kv-box__k">Job EXP</div><div class="kv-box__v">${fmt(m.jexp)}</div></div>
        </div>

        <div class="modal-section">
          <h3>🗺️ ${L('แผนที่ที่พบ', 'Spawn Maps')} (${m._mapLvs.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${m._mapLvs.map((entry) => `<button type="button" class="chip-link" data-open="map" data-id="${esc(entry.mapId)}">📍 ${esc(tr(entry.mp ? entry.mp.n : entry.mapId))} <strong style="color:var(--gold)">${esc(entry.label)}</strong></button>`).join('') || '<span class="muted">–</span>'}
          </div>
        </div>

        ${bm ? `<div class="modal-section">
          <h3>👑 ${L('ท่าโจมตีของบอส', 'Boss Moves')}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(bm.moves || []).map((mv) => pill(mv, '#f25c69')).join('')}
            ${bm.minion ? pill(`Minion: ${bm.minion[0]} ×${bm.minion[1]}`, '#ff8f3f') : ''}
          </div>
        </div>` : ''}

        <div class="modal-section">
          <h3>⚔️ ${L('ไอเทมดรอป', 'Item Drops')} (${(m.drops || []).length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(m.drops || []).map(([tid, pct]) => {
              const it = IT[tid];
              return `<button type="button" class="chip-link" data-open="item" data-id="${esc(tid)}">${itemSprite(it, 24)}<span>${esc(tr(it ? it.n : tid))}</span><strong style="color:var(--gold)">${fmtPct(pct)}</strong></button>`;
            }).join('') || '<span class="muted">–</span>'}
          </div>
        </div>

        <div class="modal-section">
          <h3>🧱 ${L('วัตถุดิบ & รูน', 'Materials & Rune Drops')}</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(m.mats || []).map(([tid, frac]) => {
              const mat = MAT[tid];
              return `<button type="button" class="chip-link" data-open="mat" data-id="${esc(tid)}">${atlasImg('mats', tid, 24)}<span>${esc(tr(mat ? mat.n : tid))}</span><strong style="color:var(--green)">${fmtPct(frac * 100)}</strong></button>`;
            }).join('')}
            ${(() => {
              const chips = [];
              const gunDrops = GUN_DROP_BY_MON[m.id];
              if (gunDrops && gunDrops.length) {
                for (const gd of gunDrops) {
                  const rObj = RUNES[gd.rid];
                  chips.push(`<button type="button" class="chip-link" data-open="rune" data-id="${esc(gd.rid)}">${atlasImg('mats', `bl_rune_${gd.rid}_1`, 24)}<span>${esc(tr(rObj ? rObj.n : gd.rid))}</span><strong style="color:var(--purple)">${fmtPct(gd.ratePct)}</strong></button>`);
                }
              } else if (m.rune) {
                const [rid, frac] = m.rune;
                const rObj = RUNES[rid];
                chips.push(`<button type="button" class="chip-link" data-open="rune" data-id="${esc(rid)}">${atlasImg('mats', `bl_rune_${rid}_1`, 24)}<span>${esc(tr(rObj ? rObj.n : rid))}</span><strong style="color:var(--purple)">${fmtPct(frac * 100)}</strong></button>`);
              }
              if (SPELL_CFG && SPELL_CFG.of) {
                const spellMinLv = Number(SPELL_CFG.lv || 70);
                const spellRatePct = Number(SPELL_CFG.rate || 0.00002) * 100;
                const spellRids = SPELL_CFG.of[m.el] || [];
                const mMaps = (m.maps || []).filter(Boolean);
                const hasLv70Map = mMaps.length === 0 ? Number(m.lv || 0) >= spellMinLv : mMaps.some((mpId) => getMonLvOnMap(MAP[mpId], m).max >= spellMinLv);
                if (spellRids.length && hasLv70Map) {
                  for (const srid of spellRids) {
                    const srObj = RUNES[srid];
                    chips.push(`<button type="button" class="chip-link" data-open="rune" data-id="${esc(srid)}">${atlasImg('mats', `bl_rune_${srid}_1`, 24)}<span>${esc(tr(srObj ? srObj.n : srid))}</span><strong style="color:var(--purple)">Lv ${spellMinLv}+ · ${fmtPct(spellRatePct)}</strong></button>`);
                  }
                }
              }
              return chips.join('');
            })()}
          </div>
        </div>
        ${CARD_BY_MON[m.id] ? (() => {
          const c = CARD_BY_MON[m.id];
          return `<div class="modal-section">
            <h3>🃏 ${L('การ์ดมอนสเตอร์ (Art Card)', 'Monster Art Card')}</h3>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <button type="button" class="chip-link" data-open="card" data-id="${esc(c.id)}">${atlasImg('mats', c.cardId, 28)}<span>${esc(tr(c.cardName))}</span><strong style="color:var(--gold)">${fmtPct(c.ratePct)} · ${fmtCoin(c.stallPrice)}</strong></button>
              ${c.passives.map((p) => `<span class="stat-chip">${esc(tr(p))}</span>`).join('')}
            </div>
          </div>`;
        })() : ''}`;
    } else if (kind === 'card') {
      const c = CARD_BY_MON[id];
      if (!c) return;
      const fam = c.fam && LORE_CFG.fam && LORE_CFG.fam[c.fam];
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${atlasImg('mats', c.cardId, 68)}</span>
          <div style="flex:1">
            <h2>🃏 ${esc(tr(c.cardName))}</h2>
            <div class="muted">${esc(c.cardName)} · <code>${esc(c.cardId)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(`Lv ${c.lv}`, '#f5b942')}
              ${c.boss ? pill('BOSS CARD', '#f25c69') : pill('NORMAL CARD', '#3f95ff')}
              ${elPill(c.el)}
            </div>
          </div>
        </div>
        <div class="kv-grid">
          <div class="kv-box"><div class="kv-box__k">${L('ราคาตั้งร้านแนะนำ', 'Suggested Stall Price')}</div><div class="kv-box__v" style="color:var(--gold)">${fmtCoin(c.stallPrice)}</div></div>
          <div class="kv-box"><div class="kv-box__k">${L('ราคาพื้นฐาน', 'Base Price')}</div><div class="kv-box__v">${fmtCoin(c.basePrice)}</div></div>
          <div class="kv-box"><div class="kv-box__k">${L('โอกาสดรอป', 'Drop Rate')}</div><div class="kv-box__v">${fmtPct(c.ratePct)}</div></div>
          <div class="kv-box"><div class="kv-box__k">CD</div><div class="kv-box__v">${c.cd}s</div></div>
        </div>
        <div class="modal-section">
          <h3>✨ ${L('ท่า Lore Art:', 'Lore Art:')} ${esc(tr(c.artName))}</h3>
          <p style="margin:0 0 8px">${esc(tr(c.artDesc))}</p>
          <div class="stat-chips">${c.passives.map((p) => `<span class="stat-chip">${esc(tr(p))}</span>`).join('')}</div>
          ${fam && fam.perks ? `<div style="margin-top:10px;font-size:12.5px;color:var(--text-1)"><strong>${esc(tr(fam.n))} Perks:</strong> ${fam.perks.map((pk) => esc(tr(pk))).join(' · ')}</div>` : ''}
        </div>
        <div class="modal-section">
          <h3>👾 ${L('ดรอปจากมอนสเตอร์ & แมพ', 'Monster & Spawn Maps')}</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${c.mon ? `<button type="button" class="chip-link" data-open="monster" data-id="${esc(c.mon.id)}">${monSprite(c.mon, 24)}<span>${esc(tr(c.monName))} (Lv ${c.lv})</span></button>` : ''}
            ${(c.maps || []).map((mpid) => `<button type="button" class="chip-link" data-open="map" data-id="${esc(mpid)}">📍 ${esc(tr(MAP[mpid] ? MAP[mpid].n : mpid))}</button>`).join('')}
          </div>
        </div>`;
    } else if (kind === 'item') {
      const it = IT[id];
      if (!it) return;
      const stats = itemStatsList(it);
      const setObj = ITEM_TO_SET[it.id];
      const droppers = ITEM_DROPPERS[it.id] || [];
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${itemSprite(it, 68)}</span>
          <div style="flex:1">
            <h2>${esc(tr(it.n))}</h2>
            <div class="muted">${esc(it.n)} · <code>${esc(it.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(tr(it.r), RAR_COLOR[it.r] || '#8a8499')}
              ${pill(`Lv ${it.lv ?? 1}`, '#f5b942')}
              ${pill(tr(it.s), '#6e6a86')}
              ${it.wt ? pill(tr((W.wtypes && W.wtypes[it.wt]) || it.wt), '#3f95ff') : ''}
              ${it.el && it.el !== 'neutral' ? elPill(it.el) : ''}
            </div>
          </div>
        </div>
        ${it.d ? `<p style="color:var(--text-1)">${esc(tr(it.d))}</p>` : ''}
        ${it.ab ? `<p style="color:var(--gold);margin-top:4px">✨ ${esc(tr(it.ab))}</p>` : ''}
        <div class="modal-section">
          <h3>📊 ${L('ค่าสเตตัส', 'Stats')}</h3>
          <div class="stat-chips">${stats.map((s) => `<span class="stat-chip">${esc(s)}</span>`).join('') || '<span class="muted">–</span>'}</div>
        </div>
        ${setObj ? `<div class="modal-section">
          <h3>🛡️ ${L('อยู่ในเซ็ต:', 'Part of Set:')} ${esc(tr(setObj.n))}</h3>
          <div style="font-size:13px;margin-bottom:8px">
            <div><strong style="color:var(--gold)">2pc:</strong> ${esc(tr(setObj.b2))} · <strong style="color:var(--gold)">3pc:</strong> ${esc(tr(setObj.b3))}</div>
            ${setObj.pas ? `<div style="margin-top:4px">✨ ${esc(tr(setObj.pas))}</div>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(setObj.pcs || []).map((pid) => {
              const p = IT[pid];
              return `<button type="button" class="chip-link" data-open="item" data-id="${esc(pid)}">${itemSprite(p, 24)}<span>${esc(tr(p ? p.n : pid))}</span></button>`;
            }).join('')}
          </div>
        </div>` : ''}
        ${(it.wsk || []).length ? `<div class="modal-section">
          <h3>✨ ${L('เสริมสกิล', 'Skill Boosts')}</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${it.wsk.map((b) => {
              const sk = SKILL_MAP[b[0]];
              return `<button type="button" class="chip-link" data-open="skill" data-id="${esc(b[0])}"><span>${esc(tr(sk ? sk.n : b[0]))}</span><strong style="color:var(--gold)">+${b[2]}%</strong></button>`;
            }).join('')}
          </div>
        </div>` : ''}
        <div class="modal-section">
          <h3>👾 ${L('ดรอปจากมอนสเตอร์', 'Dropped By')} (${droppers.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${droppers.map(({ mon, ratePct }) => `<button type="button" class="chip-link" data-open="monster" data-id="${esc(mon.id)}">${monSprite(mon, 24)}<span>${esc(tr(mon.n))} (Lv ${mon.lv ?? '?'})</span><strong style="color:var(--gold)">${fmtPct(ratePct)}</strong></button>`).join('') || `<span class="muted">${L('ไม่มีข้อมูลดรอปจากมอนสเตอร์ (อาจมาจากร้านค้า/เควสต์/กาชา)', 'No monster drop sources (shop/quest/gacha)')}</span>`}
          </div>
        </div>`;
    } else if (kind === 'set') {
      const s = SET[id];
      if (!s) return;
      html = `
        <div class="modal-hero">
          <div style="flex:1">
            <h2>🛡️ ${esc(tr(s.n))}</h2>
            <div class="muted">${esc(s.n)} · <code>${esc(s.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(`Grade ${s.g}`, GRADE_COLOR[s.g] || '#8a8499')}
              ${pill(`Lv ${s.lv}`, '#f5b942')}
              ${pill(s.line || 'set', '#3f95ff')}
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h3>✨ ${L('โบนัสเซ็ต', 'Set Bonuses')}</h3>
          <div style="font-size:13.5px;display:flex;flex-direction:column;gap:6px">
            <div><strong style="color:var(--gold)">2pc:</strong> ${esc(tr(s.b2))}</div>
            <div><strong style="color:var(--gold)">3pc:</strong> ${esc(tr(s.b3))}</div>
            ${s.pas ? `<div style="color:var(--text-0)">✨ ${esc(tr(s.pas))}</div>` : ''}
          </div>
        </div>
        <div class="modal-section">
          <h3>⚔️ ${L('ชิ้นส่วนในเซ็ต', 'Set Pieces')} (${(s.pcs || []).length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(s.pcs || []).map((pid) => {
              const p = IT[pid];
              return `<button type="button" class="chip-link" data-open="item" data-id="${esc(pid)}">${itemSprite(p, 28)}<span>${esc(tr(p ? p.n : pid))}</span></button>`;
            }).join('')}
          </div>
        </div>`;
    } else if (kind === 'quest') {
      const qObj = (W.quests || []).find((x) => x.id === id);
      if (!qObj) return;
      html = `
        <div class="modal-hero">
          <div style="flex:1">
            <h2>📜 ${esc(tr(qObj.t))}</h2>
            <div class="muted">${esc(qObj.t)} · <code>${esc(qObj.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(`Lv ${qObj.lv ?? 1}`, '#f5b942')}
              ${qObj.map ? pill(tr(qObj.map), '#38c97a') : ''}
              ${qObj.coins ? pill(`${fmt(qObj.coins)}c`, '#ff8f3f') : ''}
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h3>📖 ${esc(tr(qObj.ch))}</h3>
          <ul style="margin:0;padding-left:18px;font-size:13px">${(qObj.obj || []).map((o) => `<li>${esc(tr(o))}</li>`).join('')}</ul>
        </div>`;
    } else if (kind === 'job') {
      const j = JOB[id];
      if (!j) return;
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${atlasImg('jobs', j.id, 72)}</span>
          <div style="flex:1">
            <h2>${esc(tr(j.n))}</h2>
            <div class="muted">${esc(j.n)} · <code>${esc(j.id)}</code> · Tier ${j.tier}</div>
          </div>
        </div>
        <p>${esc(tr(j.d))}</p>
        <div class="kv-grid">
          <div class="kv-box"><div class="kv-box__k">Max Job Lv</div><div class="kv-box__v">${j.maxJob}</div></div>
          <div class="kv-box"><div class="kv-box__k">HP / Lv</div><div class="kv-box__v">+${j.hp}</div></div>
          <div class="kv-box"><div class="kv-box__k">SP / Lv</div><div class="kv-box__v">+${j.sp}</div></div>
          <div class="kv-box"><div class="kv-box__k">${L('อาวุธที่ใช้ได้', 'Weapons')}</div><div class="kv-box__v" style="font-size:12px">${(j.wt || []).map((w) => tr((W.wtypes && W.wtypes[w]) || w)).join(', ')}</div></div>
        </div>
        <div class="modal-section">
          <h3>✨ ${L('สกิลประจำอาชีพ', 'Job Skills')} (${(j.sk || []).length})</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${(j.sk || []).map((s) => `
              <button type="button" class="chip-link" style="justify-content:space-between;width:100%;padding:8px 12px" data-open="skill" data-id="${esc(s.id)}">
                <span style="display:flex;align-items:center;gap:10px">${atlasImg('skills', s.icon, 32)}<span style="text-align:left"><strong>${esc(tr(s.n))}</strong><br><span class="muted" style="font-size:11.5px">${esc(tr(s.d))}</span></span></span>
                <span class="num muted">Max ${s.max}</span>
              </button>`).join('')}
          </div>
        </div>`;
    } else if (kind === 'skill') {
      const s = SKILL_MAP[id];
      if (!s) return;
      const boosters = SKILL_BOOSTERS[s.id] || [];
      const lvs = s.lvs || [];
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${atlasImg('skills', s.icon, 68)}</span>
          <div style="flex:1">
            <h2>${esc(tr(s.n))}</h2>
            <div class="muted">${esc(s.n)} · <code>${esc(s.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              <button type="button" class="chip-link" data-open="job" data-id="${esc(s.jobId)}">🧙 ${esc(tr(s.jobName))}</button>
              ${s.el ? elPill(s.el) : ''}
              ${s.rg ? pill(`Range ${s.rg}`, '#3f95ff') : ''}
            </div>
          </div>
        </div>
        <p>${esc(tr(s.d))}</p>
        ${lvs.length ? `<div class="modal-section">
          <h3>📈 ${L('ค่าพลังตามเลเวล (Lv 1–' + lvs.length + ')', 'Scaling by Level')}</h3>
          <div class="table-wrap"><table class="data-table">
            <thead><tr><th>Lv</th><th>${L('ความแรง (%)', 'Power (%)')}</th><th>SP</th><th>CD (s)</th></tr></thead>
            <tbody>
              ${lvs.map((row, idx) => `<tr><td class="num">Lv ${idx + 1}</td><td class="num" style="color:var(--gold)">${row[0] ?? '–'}%</td><td class="num">${row[1] ?? '–'}</td><td class="num">${row[2] ?? '–'}</td></tr>`).join('')}
            </tbody>
          </table></div>
        </div>` : ''}
        ${boosters.length ? `<div class="modal-section">
          <h3>⚔️ ${L('อาวุธที่เสริมสกิลนี้', 'Weapons Boosting This Skill')} (${boosters.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${boosters.slice(0, 12).map(({ item, boost }) => `<button type="button" class="chip-link" data-open="item" data-id="${esc(item.id)}">${itemSprite(item, 24)}<span>${esc(tr(item.n))}</span><strong style="color:var(--gold)">+${boost[2]}%</strong></button>`).join('')}
          </div>
        </div>` : ''}`;
    } else if (kind === 'map') {
      const mp = MAP[id];
      if (!mp) return;
      const children = (W.maps || []).filter((x) => x.parent === mp.id);
      const fit = S2.mapFit && S2.mapFit[mp.id];
      html = `
        <div class="modal-hero">
          <div style="flex:1">
            <h2>🗺️ ${esc(tr(mp.n))}</h2>
            <div class="muted">${esc(mp.n)} · <code>${esc(mp.id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(mp.lv || '–', '#f5b942')}
              ${pill(mp.kind || 'field', '#38c97a')}
              ${mp.secret ? pill('SECRET', '#f25c69') : ''}
            </div>
          </div>
        </div>
        ${(mp.zones || []).length ? `<div class="modal-section"><h3>📌 ${L('โซนย่อย', 'Zones')}</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${mp.zones.map((z) => pill(tr(z), '#3f95ff')).join('')}</div></div>` : ''}
        ${fit ? `<div class="modal-section"><h3>🧭 Map Fit</h3><pre style="margin:0;font-size:12px;color:var(--text-1);white-space:pre-wrap">${esc(JSON.stringify(fit))}</pre></div>` : ''}
        <div class="modal-section">
          <h3>👾 ${L('มอนสเตอร์ในแผนที่', 'Spawning Monsters')} (${(mp.mons || []).length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(mp.mons || []).map((mid) => {
              const m = MON[mid];
              const mlv = mp.mlv && mp.mlv[mid];
              const lvTxt = Array.isArray(mlv) ? `${mlv[0]}–${mlv[1]}` : (mlv || (m ? m.lv : '?'));
              return `<button type="button" class="chip-link" data-open="monster" data-id="${esc(mid)}">${m ? monSprite(m, 26) : ''}<span>${esc(tr(m ? m.n : mid))}</span><strong style="color:var(--gold)">Lv ${lvTxt}</strong></button>`;
            }).join('') || '<span class="muted">Safe zone</span>'}
          </div>
        </div>
        ${children.length ? `<div class="modal-section"><h3>🪜 ${L('ดันเจี้ยน / ชั้นเชื่อมต่อ', 'Linked Sub-Maps')}</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${children.map((c) => `<button type="button" class="chip-link" data-open="map" data-id="${esc(c.id)}">🗺️ ${esc(tr(c.n))}</button>`).join('')}</div></div>` : ''}`;
    } else if (kind === 'mat') {
      const mat = MAT[id];
      if (!mat) return;
      const droppers = MAT_DROPPERS[mat.id] || [];
      html = `
        <div class="modal-hero">
          <span class="sprite-box">${atlasImg('mats', mat.id, 64)}</span>
          <div style="flex:1">
            <h2>${esc(tr(mat.n))}</h2>
            <div class="muted">${esc(mat.n)} · <code>${esc(mat.id)}</code></div>
            <div style="display:flex;gap:6px;margin-top:8px">
              ${pill(`Price: ${fmt(mat.p)}`, '#f5b942')}
              ${mat.rare ? pill('RARE', '#ff8f3f') : ''}
              ${mat.life ? pill('LIFE', '#38c97a') : ''}
            </div>
          </div>
        </div>
        <p>${esc(tr(mat.d || ''))}</p>
        <div class="modal-section">
          <h3>👾 ${L('ดรอปจากมอนสเตอร์', 'Dropped By')} (${droppers.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${droppers.map(({ mon, ratePct }) => `<button type="button" class="chip-link" data-open="monster" data-id="${esc(mon.id)}">${monSprite(mon, 24)}<span>${esc(tr(mon.n))}</span><strong style="color:var(--green)">${fmtPct(ratePct)}</strong></button>`).join('') || `<span class="muted">${esc(tr(mat.from || '–'))}</span>`}
          </div>
        </div>`;
    } else if (kind === 'rune') {
      const r = RUNES[id];
      if (!r) return;
      const droppers = RUNE_DROPPERS[id] || [];
      const allGroups = groupRuneDroppersByMap(droppers, 'density');
      const realMapCount = allGroups.filter((g) => g.mapId !== '__none__').length;
      const spellEls = SPELL_ELS_BY_RUNE[id] || [];
      const isGun = !!GUN_DROP[id];
      const spellMinLv = Number((SPELL_CFG && SPELL_CFG.lv) || 70);
      const spellRatePct = Number((SPELL_CFG && SPELL_CFG.rate) || 0.00002) * 100;
      const spellElLabels = spellEls.map((el) => tr((W.elements && W.elements[el]) || el)).join(' / ');
      const ruleNote = spellEls.length
        ? L(
            `📖 กติการูนร่ายเวท: ดรอปเสริมจากมอนสเตอร์ Lv ${spellMinLv}+ ธาตุ ${spellElLabels} ทุกตัว โอกาส ${fmtPct(spellRatePct)} ต่อตัว (นอกเหนือจากรูนประจำตัว) — ด้านล่างคัดเฉพาะแมพที่มอนเลเวลถึง ${spellMinLv}+ เท่านั้น`,
            `📖 Spell Rune Rule: Drops as an extra ${fmtPct(spellRatePct)} chance from any Lv ${spellMinLv}+ ${spellElLabels} monster alongside its own rune — only maps reaching Lv ${spellMinLv}+ are shown below.`
          )
        : isGun
          ? L(
              `📖 กติการูนปืน: ดรอปจากตระกูลแมงป่อง (แมงป่องแดง / แมงป่องยิงพิษ) แทนรูนเจาะ (อัตรารวม 0.01% ต่อตัว แบ่งสุ่มตามแต่ละรูนปืน)`,
              `📖 Gun Rune Rule: Drops from Red Scorpion / Venom-Shot Scorpion in place of pierce runes (0.01% combined gun-rune roll split across eligible gun runes).`
            )
          : L(
              `📖 กติการูนทั่วไป: ดรอปขั้น I จากมอนสเตอร์ในแผนที่ด้านล่าง (รวม ${RUNE_CFG.merge || 3} ชิ้นเป็นขั้นถัดไปฟรี I → II → III ที่แท็บรูนของป๋าหมูหริ่ง)`,
              `📖 Standard Drop Rule: Drops at Tier I from the monsters grouped below (merge ${RUNE_CFG.merge || 3} of a tier into the next for free at Papa Moo's Runes tab).`
            );
      html = `
        <div class="modal-hero">
          <div class="rune-tier-icons">
            ${[1, 2, 3].map((tier) => atlasImg('mats', `bl_rune_${id}_${tier}`, tier === 3 ? 60 : tier === 2 ? 52 : 44)).join('')}
          </div>
          <div style="flex:1">
            <h2>${esc(tr(r.n))}</h2>
            <div class="muted">${esc(r.n)} · <code>${esc(id)}</code></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
              ${pill(r.kind || 'rune', '#9a5cf0')}
              ${r.on ? pill(r.on, '#3f95ff') : ''}
              ${r.el ? elPill(r.el) : ''}
              ${spellEls.length ? pill(`Lv ${spellMinLv}+`, '#ff8f3f') : ''}
            </div>
          </div>
        </div>
        <div class="modal-section">
          <h3>✨ ${L('ความสามารถแต่ละระดับ', 'Effects by Tier')}</h3>
          ${(r.t || []).map((txt, idx) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">${atlasImg('mats', `bl_rune_${id}_${idx + 1}`, 26)}<div><strong style="color:var(--gold)">Tier ${idx + 1}:</strong> ${esc(tr(txt))} <span class="muted">(${fmtCoin((r.price || [])[idx])})</span></div></div>`).join('')}
          <div class="rune-rule-note">${esc(ruleNote)}</div>
        </div>
        <div class="modal-section">
          <h3>🗺️ ${L('แผนที่ & มอนสเตอร์ที่ดรอป (จัดกลุ่มตามแมพ)', 'Drop Maps & Monsters (Grouped by Map)')} — ${droppers.length} ${L('มอน', 'monsters')} · ${realMapCount} ${L('แมพ', 'maps')}</h3>
          <div class="rune-modal-controls">
            <input class="input" id="runeModalFilter" type="search" placeholder="${L('กรองชื่อแมพ หรือ ชื่อมอนสเตอร์ในรูนนี้...', 'Filter map or monster name...')}">
            <button type="button" class="btn is-on" data-rmsort="density">${L('จัดกลุ่มแมพมอนเยอะ / เรตสูง', 'Best Rate & Density')}</button>
            <button type="button" class="btn" data-rmsort="level">${L('เรียงตามเลเวลแมพ', 'Sort by Map Lv')}</button>
          </div>
          <div id="runeMapGroups"></div>
        </div>`;
    }

    if (!html) return;
    $('#modalBody').innerHTML = html;
    if (kind === 'rune') {
      let modalSort = 'density';
      let modalFilter = '';
      renderRuneMapGroups(id, modalSort, modalFilter);
      const filterInput = $('#runeModalFilter');
      if (filterInput) {
        filterInput.addEventListener('input', (e) => {
          modalFilter = e.target.value;
          renderRuneMapGroups(id, modalSort, modalFilter);
        });
      }
      $('#modalBody').querySelectorAll('[data-rmsort]').forEach((btn) => {
        btn.addEventListener('click', () => {
          modalSort = btn.dataset.rmsort;
          $('#modalBody').querySelectorAll('[data-rmsort]').forEach((b) => b.classList.toggle('is-on', b === btn));
          renderRuneMapGroups(id, modalSort, modalFilter);
        });
      });
    }
    $('#modalBackdrop').hidden = false;
  }

  function closeModal() {
    $('#modalBackdrop').hidden = true;
  }

  // ------------------------------------------------------------------ GLOBAL SEARCH
  function runGlobalSearch(rawQuery) {
    const box = $('#globalSearchResults');
    const q = norm(rawQuery);
    if (!q || q.length < 1) {
      box.hidden = true;
      return;
    }

    const hits = [];
    const pushHits = (arr, kind, label, spriteFn, getSub, maxCat = 5) => {
      let catCount = 0;
      for (const x of arr) {
        if (catCount >= maxCat || hits.length >= 40) break;
        const n = x.n || x.t || x.cardName || x.name || '';
        const hay = x._q || biText(x.id, n);
        if (matchesQuery(hay, q)) {
          hits.push({ kind, id: x.id, label, title: tr(n), sub: getSub(x), icon: spriteFn(x) });
          catCount++;
        }
      }
    };

    pushHits(W.monsters || [], 'monster', L('มอนสเตอร์', 'Monster'), (m) => monSprite(m, 28), (m) => `${m.n} · Lv ${m._lvLabel}`);
    pushHits(W.items || [], 'item', L('ไอเทม', 'Item'), (it) => itemSprite(it, 28), (it) => `${it.n} · ${it.s}`);
    pushHits(W.sets || [], 'set', L('เซ็ต', 'Set'), () => '🛡️', (s) => `${tr(s.b2)} · ${tr(s.b3)}`);
    pushHits(W.jobs || [], 'job', L('อาชีพ', 'Job'), (j) => atlasImg('jobs', j.id, 28), (j) => `${j.n} · Tier ${j.tier}`);
    pushHits(ALL_SKILLS, 'skill', L('สกิล', 'Skill'), (s) => atlasImg('skills', s.icon, 28), (s) => `${s.n} · ${tr(s.jobName)}`);
    pushHits(W.maps || [], 'map', L('แผนที่', 'Map'), () => '🗺️', (mp) => `${mp.n} · ${mp.lv || ''}`);
    pushHits(W.materials || [], 'mat', L('วัตถุดิบ', 'Material'), (m) => atlasImg('mats', m.id, 28), (m) => `${m.n} · ${fmtCoin(m.p)}`);
    pushHits(CARDS_LIST.map((c) => ({ id: c.id, n: c.cardName, ...c })), 'card', L('การ์ด', 'Card'), (c) => atlasImg('mats', c.cardId, 28), (c) => `${tr(c.monName)} · ${fmtCoin(c.stallPrice)}`);
    pushHits(RUNES_LIST, 'rune', L('รูน', 'Rune'), (r) => atlasImg('mats', `bl_rune_${r.id}_1`, 28), (r) => `${r.n} · ${(RUNE_DROPPERS[r.id] || []).length} ${L('มอน', 'mons')} / ${RUNE_MAP_COUNTS[r.id] || 0} ${L('แมพ', 'maps')}`);
    pushHits(W.quests || [], 'quest', L('เควสต์', 'Quest'), () => '📜', (x) => `${tr(x.ch)} · Lv ${x.lv ?? 1}`);

    if (!hits.length) {
      box.innerHTML = `<div class="muted" style="padding:12px;text-align:center">${L('ไม่พบข้อมูลที่ค้นหา', 'No matches found')}</div>`;
      box.hidden = false;
      return;
    }

    box.innerHTML = hits.map((h) => `
      <button type="button" class="search-hit" data-open="${h.kind}" data-id="${esc(h.id)}">
        <span>${h.icon}</span>
        <div class="search-hit__text">
          <div class="search-hit__title">${esc(h.title)}</div>
          <div class="search-hit__sub">${esc(h.label)} · ${esc(h.sub)}</div>
        </div>
      </button>`).join('');
    box.hidden = false;
  }

  // ------------------------------------------------------------------ VIEW DISPATCH & EVENTS
  function renderCurrentView() {
    switch (state.view) {
      case 'overview': renderOverview(); break;
      case 'market': renderMarket(); break;
      case 'monsters': renderMonsters(); break;
      case 'items': renderItems(); break;
      case 'sets': renderSets(); break;
      case 'jobs': renderJobs(); break;
      case 'maps': renderMaps(); break;
      case 'drops': renderDrops(); break;
      case 'cards': renderCards(); break;
      case 'runes': renderRunes(); break;
      case 'quests': renderQuests(); break;
      case 'season2': renderSeason2(); break;
      default: renderOverview();
    }
  }

  function closeMobileSidebar() {
    $('#sidebar').classList.remove('is-open');
    $('#sidebarBackdrop').classList.remove('is-open');
  }

  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) {
      setView(navBtn.dataset.view);
      return;
    }
    const openEl = e.target.closest('[data-open]');
    if (openEl) {
      $('#globalSearchResults').hidden = true;
      openModal(openEl.dataset.open, openEl.dataset.id);
      return;
    }
    if (!e.target.closest('#globalSearchWrap')) {
      $('#globalSearchResults').hidden = true;
    }
  });

  $('#langToggle').addEventListener('click', () => {
    state.lang = state.lang === 'th' ? 'en' : 'th';
    renderNav();
    renderCurrentView();
  });

  $('#globalSearchInput').addEventListener('input', (e) => runGlobalSearch(e.target.value));
  $('#globalSearchInput').addEventListener('focus', (e) => runGlobalSearch(e.target.value));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#globalSearchInput').focus();
    }
    if (e.key === 'Escape') {
      closeModal();
      $('#globalSearchResults').hidden = true;
    }
  });

  $('#modalClose').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target === $('#modalBackdrop')) closeModal();
  });

  $('#mobileMenuBtn').addEventListener('click', () => {
    $('#sidebar').classList.add('is-open');
    $('#sidebarBackdrop').classList.add('is-open');
  });
  $('#sidebarBackdrop').addEventListener('click', closeMobileSidebar);

  window.addEventListener('hashchange', () => {
    const h = location.hash.replace(/^#/, '');
    if (h && NAV_ITEMS.some((x) => x.id === h)) {
      state.view = h;
      renderNav();
      renderCurrentView();
    }
  });

  // Boot
  const initHash = location.hash.replace(/^#/, '');
  if (initHash && NAV_ITEMS.some((x) => x.id === initHash)) {
    state.view = initHash;
  }
  renderNav();
  renderCurrentView();
})();
