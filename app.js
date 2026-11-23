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
    monsters: { q: '', kind: 'all', el: '', race: '', arm: '', minLv: '', maxLv: '', sort: 'lv', dir: 1, page: 0 },
    items: { tab: 'all', q: '', r: '', wt: '', el: '', minLv: '', maxLv: '', sort: 'lv', dir: 1, page: 0 },
    sets: { tab: 'regular', q: '', g: '' },
    jobs: { tab: 'jobs', tier: 'all', q: '', skJob: '', skType: '', skEl: '', skQ: '', skSort: 'n', skDir: 1, skPage: 0 },
    maps: { region: '', kind: '', secret: 'all', q: '' },
    drops: { tab: 'drops', q: '', dtype: 'all', bossOnly: false, sort: 'rate', dir: -1, page: 0, matFilter: 'all', matQ: '', matPage: 0 },
    runes: { tab: 'runes', kind: '', on: '', q: '' },
    quests: { tab: 'quests', ch: '', q: '', lifeTab: 'crops' },
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
  const fmtPct = (v) => {
    const n = Number(v || 0);
    if (n >= 10) return n.toFixed(1).replace(/\.0$/, '') + '%';
    if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, '') + '%';
    if (n >= 0.01) return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '%';
    return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '%';
  };
  const norm = (s) => String(s || '').toLowerCase().trim();

  function tr(text) {
    if (text == null) return '';
    const s = String(text);
    if (!s || state.lang === 'en') return s;
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
  const RUNES = (S2.runes && S2.runes.list) || {};

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
        maps
      });
    }
    for (const mt of (m.mats || [])) {
      const [tid, frac] = [mt[0], Number(mt[1])];
      const ratePct = frac * 100;
      (MAT_DROPPERS[tid] = MAT_DROPPERS[tid] || []).push({ mon: m, ratePct });
      const mat = MAT[tid];
      FLAT_DROPS.push({
        mon: m,
        dtype: 'material',
        targetId: tid,
        targetName: mat ? mat.n : tid,
        ratePct,
        maps
      });
    }
    if (m.rune) {
      const [rid, frac] = [m.rune[0], Number(m.rune[1])];
      const ratePct = frac * 100;
      (RUNE_DROPPERS[rid] = RUNE_DROPPERS[rid] || []).push({ mon: m, ratePct });
      const rObj = RUNES[rid];
      FLAT_DROPS.push({
        mon: m,
        dtype: 'rune',
        targetId: rid,
        targetName: rObj ? rObj.n : rid,
        ratePct,
        maps
      });
    }
  }

  for (const dict of [ITEM_DROPPERS, MAT_DROPPERS, RUNE_DROPPERS]) {
    for (const k of Object.keys(dict)) {
      dict[k].sort((a, b) => b.ratePct - a.ratePct || (a.mon.lv || 0) - (b.mon.lv || 0));
    }
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

  // ------------------------------------------------------------------ Navigation Config
  const NAV_ITEMS = [
    { id: 'overview', icon: '📊', th: 'ภาพรวม & สถิติ', en: 'Overview & Stats', count: null },
    { id: 'monsters', icon: '👾', th: 'มอนสเตอร์ & บอส', en: 'Monsters & Bosses', count: (W.monsters || []).length },
    { id: 'items', icon: '⚔️', th: 'อาวุธ & อุปกรณ์', en: 'Items & Gear', count: (W.items || []).length },
    { id: 'sets', icon: '🛡️', th: 'เซ็ตอุปกรณ์', en: 'Equipment Sets', count: (W.sets || []).length + (W.bossSets || []).length },
    { id: 'jobs', icon: '🧙', th: 'อาชีพ & สกิล', en: 'Jobs & Skills', count: (W.jobs || []).length },
    { id: 'maps', icon: '🗺️', th: 'แผนที่ & โลก', en: 'Maps & World', count: (W.maps || []).length },
    { id: 'drops', icon: '💎', th: 'ค้นหาดรอป & วัตถุดิบ', en: 'Drops & Materials', count: FLAT_DROPS.length },
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
      if (minLv != null && (m.lv || 0) < minLv) return false;
      if (maxLv != null && (m.lv || 0) > maxLv) return false;
      if (q) {
        const hay = norm(`${m.id} ${m.n} ${tr(m.n)}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const getVal = (m) => {
      if (st.sort === 'lv') return m.lv || 0;
      if (st.sort === 'hp') return m.hp || 0;
      if (st.sort === 'exp') return m.exp || 0;
      if (st.sort === 'jexp') return m.jexp || 0;
      if (st.sort === 'atk') return Array.isArray(m.atk) ? m.atk[1] || m.atk[0] || 0 : 0;
      if (st.sort === 'ratio') return m.hp ? (m.exp || 0) / m.hp : 0;
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
          <th style="text-align:right">${L('ดรอป', 'Drops')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((m) => `
            <tr data-open="monster" data-id="${esc(m.id)}">
              <td><div class="name-cell">${monSprite(m, 40)}<div>${nameHtml(m.n)}${m.boss ? pill('BOSS', '#f25c69') : ''}${m.story ? pill('STORY', '#3f95ff') : ''}</div></div></td>
              <td class="num">${m.lv ?? '–'}</td>
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
              <td class="num" style="text-align:right">${(m.drops || []).length} ${L('ชิ้น', 'it')} · ${(m.mats || []).length} ${L('แร่', 'mt')}</td>
            </tr>`).join('') || `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">${L('ไม่พบมอนสเตอร์ที่ตรงเงื่อนไข', 'No matching monsters')}</td></tr>`}
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
      if (q) {
        const hay = norm(`${it.id} ${it.n} ${tr(it.n)} ${it.d || ''} ${tr(it.d || '')}`);
        if (!hay.includes(q)) return false;
      }
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
              <td><div class="stat-chips">${stats.slice(0, 4).map((s) => `<span class="stat-chip">${esc(s)}</span>`).join('') || '<span class="muted">–</span>'}</div></td>
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
      if (q && !norm(`${s.id} ${s.n} ${tr(s.n)} ${s.pas || ''} ${tr(s.pas || '')}`).includes(q)) return false;
      return true;
    });
    const bossSets = (W.bossSets || []).filter((bs) => {
      if (q && !norm(`${bs.boss} ${bs.n} ${tr(bs.n)} ${bs.text || ''}`).includes(q)) return false;
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
        <input class="input input--search" id="setQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อเซ็ต / เอฟเฟกต์...', 'Search set name or effect...')}">
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
      if (q && !norm(`${j.id} ${j.n} ${tr(j.n)} ${j.d || ''} ${tr(j.d || '')}`).includes(q)) return false;
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
      if (q && !norm(`${s.id} ${s.n} ${tr(s.n)} ${s.d} ${tr(s.d)} ${s.jobName} ${tr(s.jobName)}`).includes(q)) return false;
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
      if (q && !norm(`${mp.id} ${mp.n} ${tr(mp.n)} ${(mp.zones || []).join(' ')}`).includes(q)) return false;
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
    let list = FLAT_DROPS.filter((d) => {
      if (st.dtype !== 'all' && d.dtype !== st.dtype) return false;
      if (st.bossOnly && !d.mon.boss) return false;
      if (q) {
        const hay = norm(`${d.targetId} ${d.targetName} ${tr(d.targetName)} ${d.mon.id} ${d.mon.n} ${tr(d.mon.n)}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (st.sort === 'rate') return (a.ratePct - b.ratePct) * st.dir;
      if (st.sort === 'lv') return ((a.mon.lv || 0) - (b.mon.lv || 0)) * st.dir;
      return tr(a.targetName).localeCompare(tr(b.targetName)) * st.dir;
    });

    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.page = Math.min(st.page, pages - 1);
    const slice = list.slice(st.page * PER, st.page * PER + PER);

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>💎 ${L('ค้นหาดรอป & สารบัญวัตถุดิบ', 'Drop Finder & Materials')}</h1>
          <p>${L('ค้นหาว่าไอเทม วัตถุดิบ หรือรูนชิ้นไหนดรอปจากมอนสเตอร์ตัวใด (อัตราดรอป % คำนวณถูกต้องตามจริง)', 'Search across 4,069 item, material, and rune drop sources with exact drop rates')}</p>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab-btn is-on" data-dtab="drops">${L('ตารางดรอปทั้งหมด', 'Drop Finder')} (${fmt(FLAT_DROPS.length)})</button>
        <button type="button" class="tab-btn" data-dtab="materials">${L('สารบัญวัตถุดิบ', 'Materials')} (${fmt((W.materials || []).length)})</button>
      </div>

      <div class="filter-bar">
        <input class="input input--search" id="dropQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหาชื่อไอเทม / วัตถุดิบ / รูน / ชื่อมอนสเตอร์...', 'Search target item/mat/rune or monster...')}">
        <select class="select" id="dropType">
          <option value="all" ${st.dtype === 'all' ? 'selected' : ''}>${L('ทุกประเภทดรอป', 'All Drop Types')}</option>
          <option value="item" ${st.dtype === 'item' ? 'selected' : ''}>${L('ไอเทมสวมใส่/อาวุธ', 'Items / Gear')}</option>
          <option value="material" ${st.dtype === 'material' ? 'selected' : ''}>${L('วัตถุดิบ', 'Materials')}</option>
          <option value="rune" ${st.dtype === 'rune' ? 'selected' : ''}>${L('รูน', 'Runes')}</option>
        </select>
        <label class="chip-link"><input type="checkbox" id="dropBoss" ${st.bossOnly ? 'checked' : ''}> ${L('เฉพาะบอส', 'Bosses only')}</label>
        <select class="select" id="dropSort">
          <option value="rate" ${st.sort === 'rate' ? 'selected' : ''}>Sort: Rate %</option>
          <option value="lv" ${st.sort === 'lv' ? 'selected' : ''}>Sort: Monster Lv</option>
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
          <th style="text-align:right">${L('โอกาสดรอป', 'Drop Rate')}</th>
        </tr></thead>
        <tbody>
          ${slice.map((d) => {
            const icon = d.dtype === 'item' ? itemSprite(IT[d.targetId], 32)
              : d.dtype === 'material' ? atlasImg('mats', d.targetId, 32)
              : `<span class="pill" style="--c:#9a5cf0">🔮</span>`;
            const openKind = d.dtype === 'item' ? 'item' : d.dtype === 'material' ? 'mat' : 'rune';
            return `<tr>
              <td><div class="name-cell" style="cursor:pointer" data-open="${openKind}" data-id="${esc(d.targetId)}">${icon}<div>${nameHtml(d.targetName)}</div></div></td>
              <td>${pill(d.dtype.toUpperCase(), d.dtype === 'item' ? '#3f95ff' : d.dtype === 'material' ? '#38c97a' : '#9a5cf0')}</td>
              <td><div class="name-cell" style="cursor:pointer" data-open="monster" data-id="${esc(d.mon.id)}">${monSprite(d.mon, 32)}<div>${nameHtml(d.mon.n)}${d.mon.boss ? pill('BOSS', '#f25c69') : ''}</div></div></td>
              <td class="num">${d.mon.lv ?? '–'}</td>
              <td class="num" style="text-align:right;color:var(--gold);font-weight:700">${fmtPct(d.ratePct)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.page, 'data-dpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-dtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.dtab; renderDrops(); }));
    $('#dropQ').addEventListener('input', (e) => {
      st.q = e.target.value; st.page = 0;
      const pos = e.target.selectionStart;
      renderDrops();
      const inp = $('#dropQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#dropType').addEventListener('change', (e) => { st.dtype = e.target.value; st.page = 0; renderDrops(); });
    $('#dropBoss').addEventListener('change', (e) => { st.bossOnly = e.target.checked; st.page = 0; renderDrops(); });
    $('#dropSort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; renderDrops(); });
    $('#dropDir').addEventListener('click', () => { st.dir = -st.dir; renderDrops(); });
    $('#mainView').querySelectorAll('[data-dpage]').forEach((b) => b.addEventListener('click', () => { st.page = Number(b.dataset.page); renderDrops(); }));
  }

  function renderMaterialsSubtab() {
    const st = state.drops;
    const q = norm(st.matQ);
    let list = (W.materials || []).filter((mat) => {
      if (st.matFilter === 'rare' && !mat.rare) return false;
      if (st.matFilter === 'life' && !mat.life) return false;
      if (q && !norm(`${mat.id} ${mat.n} ${tr(mat.n)} ${mat.d || ''} ${tr(mat.d || '')}`).includes(q)) return false;
      return true;
    });
    const PER = 60;
    const pages = Math.max(1, Math.ceil(list.length / PER));
    st.matPage = Math.min(st.matPage, pages - 1);
    const slice = list.slice(st.matPage * PER, st.matPage * PER + PER);

    $('#mainView').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🧱 ${L('สารบัญวัตถุดิบทั้งหมด', 'Materials Directory')}</h1>
          <p>${L('1,530 วัตถุดิบและของคราฟต์ คลิกเพื่อดูมอนสเตอร์ที่ดรอป', '1,530 materials — click any material to see monster drop sources')}</p>
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
            <td class="num" style="text-align:right">${fmt(m.p)}</td>
            <td class="muted">${esc(tr(m.from || '–'))}</td>
            <td class="num" style="text-align:right">${(MAT_DROPPERS[m.id] || []).length || '–'}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      ${renderPager(list.length, PER, st.matPage, 'data-mtpage="1"')}
    `;

    $('#mainView').querySelectorAll('[data-dtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.dtab; renderDrops(); }));
    $('#matQ').addEventListener('input', (e) => {
      st.matQ = e.target.value; st.matPage = 0;
      const pos = e.target.selectionStart;
      renderMaterialsSubtab();
      const inp = $('#matQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
    $('#matFilter').addEventListener('change', (e) => { st.matFilter = e.target.value; st.matPage = 0; renderMaterialsSubtab(); });
    $('#mainView').querySelectorAll('[data-mtpage]').forEach((b) => b.addEventListener('click', () => { st.matPage = Number(b.dataset.page); renderMaterialsSubtab(); }));
  }

  // ------------------------------------------------------------------ VIEW 8: RUNES, RELICS, KEYSTONES
  function renderRunes() {
    const st = state.runes;
    const q = norm(st.q);
    const runeEntries = Object.entries(RUNES).filter(([id, r]) => {
      if (st.kind && r.kind !== st.kind) return false;
      if (st.on && r.on !== st.on) return false;
      if (q && !norm(`${id} ${r.n} ${tr(r.n)} ${(r.t || []).join(' ')}`).includes(q)) return false;
      return true;
    });
    const relics = Object.entries((S2.relics && S2.relics.list) || {});
    const keystones = Object.entries((S2.keystone && S2.keystone.branches) || {});
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
        <button type="button" class="tab-btn ${st.tab === 'runes' ? 'is-on' : ''}" data-rtab="runes">${L('รูน', 'Runes')} (${Object.keys(RUNES).length})</button>
        <button type="button" class="tab-btn ${st.tab === 'relics' ? 'is-on' : ''}" data-rtab="relics">${L('เรลิก', 'Relics')} (${relics.length})</button>
        <button type="button" class="tab-btn ${st.tab === 'keystones' ? 'is-on' : ''}" data-rtab="keystones">${L('คีย์สโตน', 'Keystones')} (${keystones.length})</button>
      </div>

      ${st.tab === 'runes' ? `
        <div class="filter-bar">
          <input class="input input--search" id="runeQ" type="search" value="${esc(st.q)}" placeholder="${L('ค้นหารูน / เอฟเฟกต์...', 'Search rune or effect...')}">
          <select class="select" id="runeKind"><option value="">${L('ทุกหมวด', 'All Kinds')}</option>${kindSet.map((k) => `<option value="${esc(k)}" ${st.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
          <select class="select" id="runeOn"><option value="">${L('ทุกเงื่อนไข (On)', 'All Triggers')}</option>${onSet.map((k) => `<option value="${esc(k)}" ${st.on === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
        </div>
        <div class="card-grid">
          ${runeEntries.map(([id, r]) => {
            const droppers = RUNE_DROPPERS[id] || [];
            return `<article class="entity-card" data-open="rune" data-id="${esc(id)}">
              <div class="entity-card__head">
                <div style="flex:1">${nameHtml(r.n)}</div>
                <div style="display:flex;gap:4px">${pill(r.kind || 'rune', '#9a5cf0')}${r.on ? pill(r.on, '#3f95ff') : ''}</div>
              </div>
              <div style="font-size:12.5px;display:flex;flex-direction:column;gap:4px">
                ${(r.t || []).map((txt, idx) => `<div><strong style="color:var(--gold)">Lv ${idx + 1}:</strong> ${esc(tr(txt))}</div>`).join('')}
              </div>
              <div class="muted" style="font-size:12px">
                💰 ${(r.price || []).join(' / ')} · 👾 ${droppers.length} ${L('มอนสเตอร์ดรอป', 'droppers')}
              </div>
            </article>`;
          }).join('')}
        </div>` : st.tab === 'relics' ? `
        <div class="card-grid">
          ${relics.map(([id, rel]) => `
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
            </article>`).join('')}
        </div>` : `
        <div class="card-grid">
          ${keystones.map(([id, ks]) => `
            <article class="entity-card" style="cursor:default">
              <div class="entity-card__head">
                <div style="flex:1">${nameHtml(ks.n)}</div>
                ${pill(id.toUpperCase(), '#f5b942')}
              </div>
              <div style="font-size:12.5px;display:flex;flex-direction:column;gap:6px">
                <div><strong style="color:var(--text-2)">${L('โหนดย่อย:', 'Small Node:')}</strong> ${esc(tr(ks.small))}</div>
                <div style="color:var(--green)">▲ <strong>${L('คีย์สโตน:', 'Gain:')}</strong> ${esc(tr(ks.gain))}</div>
                <div style="color:var(--red)">▼ <strong>${L('ข้อแลกเปลี่ยน:', 'Price:')}</strong> ${esc(tr(ks.price))}</div>
              </div>
            </article>`).join('')}
        </div>`}
    `;

    $('#mainView').querySelectorAll('[data-rtab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.rtab; renderRunes(); }));
    if ($('#runeQ')) $('#runeQ').addEventListener('input', (e) => {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderRunes();
      const inp = $('#runeQ'); if (inp) { inp.focus(); if (pos != null) inp.setSelectionRange(pos, pos); }
    });
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
        if (q && !norm(`${x.id} ${x.t} ${tr(x.t)} ${x.ch} ${tr(x.ch)} ${(x.obj || []).join(' ')}`).includes(q)) return false;
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
      const curRows = tables[st.lifeTab] || [];
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
            <span>📋 ${L('ตารางสกิลชีวิต', 'Life Skill Tables')}</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${tKeys.map((k) => `<button type="button" class="tab-btn ${st.lifeTab === k ? 'is-on' : ''}" data-ltab="${esc(k)}">${esc(k.toUpperCase())} (${tables[k].length})</button>`).join('')}
            </div>
          </div>
          <div class="table-wrap"><table class="data-table">
            <thead><tr>
              <th>${L('ชื่อ', 'Name')}</th>
              <th>Lv</th>
              <th>EXP</th>
              <th>${L('ราคา', 'Price')}</th>
              <th>${L('รายละเอียด', 'Details')}</th>
            </tr></thead>
            <tbody>
              ${curRows.map((r) => `<tr>
                <td><div class="name-cell">${r.mat ? atlasImg('mats', r.mat, 28) : ''}<div>${nameHtml(r.n || r.id)}</div></div></td>
                <td class="num">${r.lv ?? '–'}</td>
                <td class="num">${r.xp ?? '–'}</td>
                <td class="num" style="color:var(--gold)">${fmt(r.price)}</td>
                <td class="muted" style="font-size:12px">${r.mins ? `${r.mins} min` : ''}${r.waters ? r.waters.join(', ') : ''}${r.where ? tr(r.where) : ''}</td>
              </tr>`).join('')}
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
      'drops.json', 'quests.json', 'runes_relics_keystones.json',
      'monster_skills_lore.json', 'life_smelt.json', 'mounts_wings_gacha.json', 'systems_season2.json'
    ];
    const csvFiles = [
      'items.csv', 'monsters.csv', 'maps.csv', 'jobs.csv', 'skills.csv',
      'materials.csv', 'drops.csv', 'quests.csv', 'runes.csv'
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
              ${pill(`Lv ${m.lv ?? '?'}`, '#f5b942')}
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
          <h3>🗺️ ${L('แผนที่ที่พบ', 'Spawn Maps')} (${spawnMaps.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${spawnMaps.map((mpid) => {
              const mp = MAP[mpid];
              return `<button type="button" class="chip-link" data-open="map" data-id="${esc(mpid)}">📍 ${esc(tr(mp ? mp.n : mpid))}</button>`;
            }).join('') || '<span class="muted">–</span>'}
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
            ${m.rune ? (() => {
              const [rid, frac] = m.rune;
              const rObj = RUNES[rid];
              return `<button type="button" class="chip-link" data-open="rune" data-id="${esc(rid)}">🔮 <span>${esc(tr(rObj ? rObj.n : rid))}</span><strong style="color:var(--purple)">${fmtPct(frac * 100)}</strong></button>`;
            })() : ''}
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
      html = `
        <div class="modal-hero">
          <div style="flex:1">
            <h2>🔮 ${esc(tr(r.n))}</h2>
            <div class="muted">${esc(r.n)} · <code>${esc(id)}</code></div>
            <div style="display:flex;gap:6px;margin-top:8px">${pill(r.kind || 'rune', '#9a5cf0')}${r.on ? pill(r.on, '#3f95ff') : ''}</div>
          </div>
        </div>
        <div class="modal-section">
          <h3>✨ ${L('ความสามารถแต่ละระดับ', 'Effects by Tier')}</h3>
          ${(r.t || []).map((txt, idx) => `<div style="margin-bottom:6px"><strong style="color:var(--gold)">Tier ${idx + 1}:</strong> ${esc(tr(txt))} <span class="muted">(${(r.price || [])[idx] ?? '–'})</span></div>`).join('')}
        </div>
        <div class="modal-section">
          <h3>👾 ${L('มอนสเตอร์ที่ดรอปรูนนี้', 'Dropped By')} (${droppers.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${droppers.map(({ mon, ratePct }) => `<button type="button" class="chip-link" data-open="monster" data-id="${esc(mon.id)}">${monSprite(mon, 24)}<span>${esc(tr(mon.n))}</span><strong style="color:var(--purple)">${fmtPct(ratePct)}</strong></button>`).join('') || '<span class="muted">–</span>'}
          </div>
        </div>`;
    }

    if (!html) return;
    $('#modalBody').innerHTML = html;
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
    const pushHits = (arr, kind, label, spriteFn, getSub) => {
      for (const x of arr) {
        if (hits.length >= 24) break;
        const n = x.n || x.t || '';
        const hay = norm(`${x.id} ${n} ${tr(n)}`);
        if (hay.includes(q)) {
          hits.push({ kind, id: x.id, label, title: tr(n), sub: getSub(x), icon: spriteFn(x) });
        }
      }
    };

    pushHits(W.monsters || [], 'monster', L('มอนสเตอร์', 'Monster'), (m) => monSprite(m, 28), (m) => `${m.n} · Lv ${m.lv ?? '?'}`);
    pushHits(W.items || [], 'item', L('ไอเทม', 'Item'), (it) => itemSprite(it, 28), (it) => `${it.n} · ${it.s}`);
    pushHits(W.jobs || [], 'job', L('อาชีพ', 'Job'), (j) => atlasImg('jobs', j.id, 28), (j) => `${j.n} · Tier ${j.tier}`);
    pushHits(ALL_SKILLS, 'skill', L('สกิล', 'Skill'), (s) => atlasImg('skills', s.icon, 28), (s) => `${s.n} · ${tr(s.jobName)}`);
    pushHits(W.maps || [], 'map', L('แผนที่', 'Map'), () => '🗺️', (mp) => `${mp.n} · ${mp.lv || ''}`);
    pushHits(W.materials || [], 'mat', L('วัตถุดิบ', 'Material'), (m) => atlasImg('mats', m.id, 28), (m) => m.n);
    pushHits(Object.entries(RUNES).map(([id, r]) => ({ id, ...r })), 'rune', L('รูน', 'Rune'), () => '🔮', (r) => r.n);

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
      case 'monsters': renderMonsters(); break;
      case 'items': renderItems(); break;
      case 'sets': renderSets(); break;
      case 'jobs': renderJobs(); break;
      case 'maps': renderMaps(); break;
      case 'drops': renderDrops(); break;
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
