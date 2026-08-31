/* =====================================================================
   MASARU Lazada Portal — โค้ดที่ทุกหน้าใช้ร่วมกัน
   ===================================================================== */

const SB_URL  = 'https://hgmxnaxtxafflefjkwtv.supabase.co';
const SB_ANON = 'sb_publishable_-pYegrgD-o2f-Eovoa3AOw_kiXKcJKA';

/* รหัสเชิญ — ตัวจริงตรวจที่ฐานข้อมูล (ฟังก์ชัน claim_profile)
   ที่ใส่ตรงนี้แค่ช่วยเตือนผู้ใช้ก่อนส่ง */
const INVITE_HINT = 'LZD-MASARU-2026';

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TH_MONTH = ['', 'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MON_S = ['', 'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const nf0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money  = n => '฿' + nf0.format(Math.round(+n || 0));
const money2 = n => '฿' + nf2.format(+n || 0);
const num    = n => nf0.format(Math.round(+n || 0));
const esc    = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const beYear = y => +y + 543;
const yOf = iso => iso ? +String(iso).slice(0,4) : 0;
const mOf = iso => iso ? +String(iso).slice(5,7) : 0;
const dOf = iso => iso ? +String(iso).slice(8,10) : 0;
const thDate = iso => iso ? `${dOf(iso)} ${TH_MON_S[mOf(iso)]} ${String(beYear(yOf(iso))).slice(2)}` : '—';
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const pad2 = n => String(n).padStart(2, '0');

/* เปอร์เซ็นต์เปลี่ยนแปลง คืน null เมื่อไม่มีฐานให้เทียบ */
function growth(now, before){
  const b = +before || 0;
  if (!b) return null;
  return ((+now || 0) - b) / b * 100;
}
function growthChip(g){
  if (g === null || g === undefined || !isFinite(g)) return '<span style="color:var(--muted)">—</span>';
  return `<span class="${g >= 0 ? 'up' : 'down'}">${g >= 0 ? '▲' : '▼'} ${Math.abs(g).toFixed(2)}%</span>`;
}

function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}
const lsGet = k => { try { return JSON.parse(localStorage.getItem('mlz_' + k)); } catch (e) { return null; } };
const lsSet = (k, v) => localStorage.setItem('mlz_' + k, JSON.stringify(v));
const lsDel = k => localStorage.removeItem('mlz_' + k);

/* ---------- แคชระยะสั้น: สลับแท็บไม่ต้องยิงซ้ำ ---------- */
const CACHE_TTL = 10 * 60 * 1000;
const CACHE_MAX = 2_000_000;
function cacheGet(k){
  try {
    const v = JSON.parse(sessionStorage.getItem('mlc_' + k));
    if (!v) return null;
    if (Date.now() - v.t > CACHE_TTL){ sessionStorage.removeItem('mlc_' + k); return null; }
    return v.d;
  } catch (e) { return null; }
}
function cacheSet(k, d){
  try {
    const s = JSON.stringify({ t: Date.now(), d });
    if (s.length > CACHE_MAX) return;
    sessionStorage.setItem('mlc_' + k, s);
  } catch (e) { /* เต็มก็ข้ามไป */ }
}
function cacheClear(){
  try { Object.keys(sessionStorage).filter(k => k.startsWith('mlc_')).forEach(k => sessionStorage.removeItem(k)); }
  catch (e) {}
}

/* ---------- Supabase ---------- */
const SB = {
  session(){ return lsGet('session'); },
  token(){ const s = SB.session(); return s && s.access_token; },
  email(){ const s = SB.session(); return s && s.email; },
  headers(extra){
    return Object.assign({
      apikey: SB_ANON,
      Authorization: 'Bearer ' + (SB.token() || SB_ANON),
      'Content-Type': 'application/json'
    }, extra || {});
  },
  async auth(path, body){
    const r = await fetch(`${SB_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || j.error || 'ทำรายการไม่สำเร็จ');
    return j;
  },
  async signIn(email, password){
    const j = await SB.auth('token?grant_type=password', { email, password });
    lsSet('session', { access_token: j.access_token, refresh_token: j.refresh_token, email });
    return j;
  },
  async signUp(email, password){ return SB.auth('signup', { email, password }); },
  async refresh(){
    const s = SB.session();
    if (!s || !s.refresh_token) return false;
    try {
      const j = await SB.auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
      lsSet('session', { access_token: j.access_token, refresh_token: j.refresh_token, email: s.email });
      return true;
    } catch (e) { return false; }
  },
  signOut(){ lsDel('session'); lsDel('member'); cacheClear(); location.href = 'index.html'; },
  isMember(){ return !!lsGet('member'); },
  uid(){
    const t = SB.token(); if (!t) return null;
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub; }
    catch (e) { return null; }
  },
  /* ตรวจว่าบัญชีนี้ผ่านรหัสเชิญแล้วหรือยัง */
  async loadMember(){
    const id = SB.uid();
    if (!id) return false;
    const r = await SB.req(`${SB_URL}/rest/v1/lz_profiles?select=id&id=eq.${id}`, { headers: SB.headers() });
    if (!r.ok) return false;
    const j = await r.json();
    const ok = j.length > 0;
    if (ok) lsSet('member', true); else lsDel('member');
    return ok;
  },

  async req(url, opt, retry){
    const r = await fetch(url, opt);
    if (r.status === 401 && !retry && await SB.refresh()){
      opt.headers = SB.headers(opt.headers && opt.headers.Prefer ? { Prefer: opt.headers.Prefer } : null);
      return SB.req(url, opt, true);
    }
    return r;
  },
  async rpc(fn, args){
    const r = await SB.req(`${SB_URL}/rest/v1/rpc/${fn}`,
      { method: 'POST', headers: SB.headers(), body: JSON.stringify(args || {}) });
    if (!r.ok) throw new Error(`${fn}: ${await r.text()}`);
    return r.json();
  },
  async select(table, query, onProgress){
    const out = [], CH = 1000;
    for (let from = 0; ; from += CH){
      const r = await SB.req(`${SB_URL}/rest/v1/${table}?${query}&limit=${CH}&offset=${from}`,
        { headers: SB.headers() });
      if (!r.ok) throw new Error(`${table}: ${await r.text()}`);
      const j = await r.json();
      out.push(...j);
      if (onProgress) onProgress(out.length);
      if (j.length < CH) break;
      if (from > 400000) break;
    }
    return out;
  },
  /* เขียนทับด้วย id เดิม — อัปไฟล์ซ้ำจึงไม่บวกยอดซ้ำ */
  async upsert(table, rows, onProgress){
    const CH = 1000;
    for (let i = 0; i < rows.length; i += CH){
      const r = await SB.req(`${SB_URL}/rest/v1/${table}?on_conflict=id`, {
        method: 'POST',
        headers: SB.headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows.slice(i, i + CH))
      });
      if (!r.ok) throw new Error(`${table}: ${await r.text()}`);
      if (onProgress) onProgress(Math.min(i + CH, rows.length), rows.length);
    }
  },
  async rpcCached(fn, args){
    const k = fn + '|' + JSON.stringify(args || {});
    const hit = cacheGet(k);
    if (hit) return hit;
    const d = await SB.rpc(fn, args);
    cacheSet(k, d);
    return d;
  },
  async selectCached(table, query){
    const k = 'sel|' + table + '|' + query;
    const hit = cacheGet(k);
    if (hit) return hit;
    const d = await SB.select(table, query);
    cacheSet(k, d);
    return d;
  },
  async delAll(table){
    const r = await SB.req(`${SB_URL}/rest/v1/${table}?id=neq.__none__`,
      { method: 'DELETE', headers: SB.headers({ Prefer: 'return=minimal' }) });
    if (!r.ok) throw new Error(await r.text());
  }
};

/* ---------- โครงหน้า: แท็บด้านบน ---------- */
const MODULES = [
  { id:'index',    file:'index.html',    ic:'◎', t:'ภาพรวม',        d:'ยอดเดือนนี้ ยอดแคมเปญ และเป้าหมายทั้งปี' },
  { id:'sales',    file:'sales.html',    ic:'▤', t:'ยอดขาย',        d:'รายวัน รายสัปดาห์ รายเดือน เทียบเดือนก่อนและปีก่อน' },
  { id:'sku',      file:'sku.html',      ic:'⬢', t:'SKU ขายดี',     d:'Top SKU ของทีมและแยกรายคน' },
  { id:'team',     file:'team.html',     ic:'◍', t:'ทีม / รายคน',   d:'ยอดขายรายบุคคล รายร้าน' },
  { id:'campaign', file:'campaign.html', ic:'★', t:'เลขเบิ้ล',      d:'1.1 2.2 3.3 … เทียบปีที่แล้ว' },
  { id:'expense',  file:'expense.html',  ic:'▣', t:'ค่าใช้จ่าย',    d:'ค่าโฆษณาและค่าใช้จ่ายอื่นของทีม' },
  { id:'import',   file:'import.html',   ic:'↥', t:'นำเข้าข้อมูล',  d:'อัปโหลดไฟล์ Excel เพื่ออัปเดตข้อมูล' },
  { id:'help',     file:'help.html',     ic:'?', t:'วิธีใช้งาน',     d:'ขั้นตอนใช้งานและวิธีอ่านตัวเลข' }
];

function shell(active, title, crumb){
  const nav = MODULES.map(m =>
    `<a class="navlink ${m.id === active ? 'on' : ''}" href="${m.file}"><span class="ic">${m.ic}</span>${esc(m.t)}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app">
      <div class="topnav">
        <div class="row1">
          <div class="brand">
            <div class="logo">LZ</div>
            <div>
              <div class="mark">MASARU<span>·</span>Lazada</div>
              <div class="sub">ระบบข้อมูลทีม Lazada</div>
            </div>
          </div>
          <div class="spacer"></div>
          <div class="who" id="who">—</div>
          <button class="btn gh sm" onclick="SB.signOut()">ออกจากระบบ</button>
        </div>
        <nav class="tabbar">${nav}</nav>
      </div>
      <div class="subbar">
        <div><h1 id="pgTitle">${esc(title)}</h1><div class="crumb" id="pgCrumb">${esc(crumb || '')}</div></div>
        <div class="spacer"></div>
        <div class="filters" id="filters"></div>
        <button class="btn sm" id="refreshBtn" title="ล้างแคชแล้วดึงข้อมูลใหม่" onclick="hardRefresh()">↻ รีเฟรช</button>
      </div>
      <main class="content" id="view"></main>
    </div>`);
  const w = $('#who'); if (w) w.textContent = SB.email() || '—';
  MODULES.filter(m => m.id !== active).forEach(m => {
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = m.file;
    document.head.appendChild(l);
  });
}

async function hardRefresh(){
  const b = $('#refreshBtn');
  if (b){ b.disabled = true; b.textContent = 'กำลังดึง…'; }
  cacheClear();
  try {
    await loadDims(true);
    if (typeof onFilterChange === 'function') onFilterChange();
    else location.reload();
    toast('ดึงข้อมูลใหม่แล้ว', 'ok');
  } catch (e) { toast(e.message, 'err'); }
  if (b){ b.disabled = false; b.textContent = '↻ รีเฟรช'; }
}
function requireAuth(){
  if (!SB.token()){ location.href = 'index.html'; return false; }
  return true;
}
function loading(msg){
  return `<div class="panel"><div class="empty"><div class="spin"></div>
    <div style="margin-top:12px">${esc(msg || 'กำลังโหลดข้อมูล…')}</div></div></div>`;
}
function emptyState(title, msg, btn){
  return `<div class="panel"><div class="empty"><div class="big">${esc(title)}</div>
    <div>${esc(msg)}</div>${btn ? `<br><a class="btn o" href="import.html">${esc(btn)}</a>` : ''}</div></div>`;
}
function errBox(e){
  return `<div class="panel"><div class="panel-b"><div class="err"><b>โหลดข้อมูลไม่สำเร็จ</b><br>${esc(e.message || e)}</div></div></div>`;
}

/* ---------- ตัวกรอง ---------- */
const FILTER = Object.assign({ year: 'all', month: 'all', owner: 'all', store: 'all' }, lsGet('filter') || {});
let DIMS = { owners: [], stores: [] };
let RANGE = {};

function filterRange(){
  const y = FILTER.year === 'all' ? null : +FILTER.year;
  if (!y){
    const lo = RANGE.sales && RANGE.sales.dmin, hi = RANGE.sales && RANGE.sales.dmax;
    return { from: lo || '2000-01-01', to: hi || '2100-12-31' };
  }
  if (FILTER.month === 'all') return { from: `${y}-01-01`, to: `${y}-12-31` };
  const m = +FILTER.month;
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(daysInMonth(y, m))}` };
}
/* ช่วงเดียวกันของปีที่แล้ว — ใช้เทียบ YoY */
function prevYearRange(){
  const r = filterRange();
  return { from: (yOf(r.from) - 1) + r.from.slice(4), to: (yOf(r.to) - 1) + r.to.slice(4) };
}
function curYear(){
  if (FILTER.year !== 'all') return +FILTER.year;
  return RANGE.sales && RANGE.sales.dmax ? yOf(RANGE.sales.dmax) : new Date().getFullYear();
}
function filterCrumb(){
  const p = [FILTER.month === 'all' ? 'ทั้งปี' : TH_MONTH[+FILTER.month]];
  p.push(FILTER.year === 'all' ? 'ทุกปี' : 'พ.ศ. ' + beYear(+FILTER.year));
  if (FILTER.owner !== 'all') p.push('ผู้ดูแล: ' + FILTER.owner);
  if (FILTER.store !== 'all') p.push('ร้าน: ' + FILTER.store);
  return p.join(' · ');
}
function renderFilters(opts){
  opts = opts || {};
  const years = [];
  for (const k in RANGE){
    const r = RANGE[k];
    if (!r || !r.dmin) continue;
    for (let y = yOf(r.dmin); y <= yOf(r.dmax); y++) if (!years.includes(y)) years.push(y);
  }
  years.sort((a, b) => b - a);
  const sel = (id, label, list, val) =>
    `<div class="f"><label>${label}</label><select id="f_${id}" onchange="setFilter('${id}',this.value)">${
      list.map(o => `<option value="${esc(o[0])}" ${String(val) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')
    }</select></div>`;
  let h = '';
  if (opts.year !== false)
    h += sel('year', 'ปี', [['all','ทุกปี'], ...years.map(y => [y, beYear(y) + ' (' + y + ')'])], FILTER.year);
  if (opts.month !== false)
    h += sel('month', 'เดือน', [['all','ทั้งปี'], ...Array.from({length:12}, (_, i) => [i+1, TH_MONTH[i+1]])], FILTER.month);
  if (opts.owner !== false)
    h += sel('owner', 'ผู้ดูแล', [['all','ทุกคน'], ...DIMS.owners.map(o => [o, o])], FILTER.owner);
  if (opts.store !== false)
    h += sel('store', 'ร้านค้า', [['all','ทุกร้าน'], ...DIMS.stores.map(o => [o, o])], FILTER.store);
  $('#filters').innerHTML = h;
  const c = $('#pgCrumb'); if (c) c.textContent = filterCrumb();
}
function setFilter(k, v){
  FILTER[k] = v;
  lsSet('filter', FILTER);
  if (typeof onFilterChange === 'function') onFilterChange();
}
async function loadDims(force){
  if (force) cacheClear();
  const [dims, range] = await Promise.all([
    SB.rpcCached('f_sales_dims'), SB.rpcCached('f_data_range')]);
  DIMS.owners = dims.filter(d => d.kind === 'owner').map(d => d.name).sort((a,b) => a.localeCompare(b,'th'));
  DIMS.stores = dims.filter(d => d.kind === 'store').map(d => d.name).sort((a,b) => a.localeCompare(b,'th'));
  RANGE = {}; range.forEach(r => RANGE[r.kind] = r);
  if (FILTER.year === 'all' && RANGE.sales && RANGE.sales.dmax) FILTER.year = yOf(RANGE.sales.dmax);
}
/* พารามิเตอร์มาตรฐานที่ส่งให้ RPC ทุกตัว */
function rpcArgs(range){
  const r = range || filterRange();
  return { p_from: r.from, p_to: r.to,
           p_owner: FILTER.owner === 'all' ? null : FILTER.owner,
           p_store: FILTER.store === 'all' ? null : FILTER.store };
}

/* ---------- กราฟ ---------- */
const C = {
  navy:'#0F146D', blue:'#2E75B6', orange:'#FF6A00', gold:'#C9A84C',
  red:'#C00000', green:'#1E7145', grey:'#9AA6BC',
  pal: ['#0F146D','#FF6A00','#C9A84C','#1E7145','#2E75B6','#C00000','#7B5EA7','#4B9CD3','#B07C2E','#3C8D6B']
};
const CHARTS = {};
function chart(id, cfg){
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  if (CHARTS[id]) CHARTS[id].destroy();
  Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif";
  Chart.defaults.color = '#6B7A90';
  CHARTS[id] = new Chart(el.getContext('2d'), cfg);
}
function destroyCharts(){ for (const k in CHARTS){ CHARTS[k].destroy(); delete CHARTS[k]; } }
const axisTick = v => {
  const n = Math.abs(v);
  if (n >= 1e6) return (v/1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (v/1000).toFixed(0) + 'K';
  return nf0.format(v);
};
function barCfg(labels, datasets, o = {}){
  return { type:'bar', data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
      plugins:{ legend:{ display: datasets.length > 1, position:'bottom', labels:{ boxWidth:12, padding:12 } },
        tooltip:{ callbacks:{ label: c => ` ${c.dataset.label||''}: ${o.money !== false ? money(c.parsed.y) : num(c.parsed.y)}` } } },
      scales:{ x:{ grid:{ display:false }, stacked: !!o.stacked },
        y:{ beginAtZero:true, stacked: !!o.stacked, grid:{ color:'#EEF2F7' }, ticks:{ callback: axisTick } } } } };
}
function lineCfg(labels, datasets, o = {}){
  const cfg = barCfg(labels, datasets, o);
  cfg.type = 'line';
  datasets.forEach(d => { d.tension = .32; d.fill = d.fill ?? false; d.pointRadius = d.pointRadius ?? 2.5; d.borderWidth = 2.4; });
  return cfg;
}
function hbarCfg(labels, data, color, o = {}){
  return { type:'bar', data:{ labels, datasets:[{ label:o.label || '', data, backgroundColor:color, borderRadius:4, maxBarThickness:26 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:{ duration:400 },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: c => ` ${o.money !== false ? money(c.parsed.x) : num(c.parsed.x)}` } } },
      scales:{ x:{ beginAtZero:true, grid:{ color:'#EEF2F7' }, ticks:{ callback: axisTick } }, y:{ grid:{ display:false } } } } };
}
function doughnutCfg(labels, values, colors){
  return { type:'doughnut', data:{ labels, datasets:[{ data:values, backgroundColor: colors || C.pal, borderWidth:2, borderColor:'#fff' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%', animation:{ duration:400 },
      plugins:{ legend:{ position:'right', labels:{ boxWidth:11, padding:9, font:{ size:11.5 } } },
        tooltip:{ callbacks:{ label: c => { const t = c.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${c.label}: ${money(c.parsed)} (${t ? (c.parsed/t*100).toFixed(1) : 0}%)`; } } } } } };
}

/* ---------- KPI ---------- */
function kpi(k, v, s, cls){
  return `<div class="kpi ${cls||''}"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${s||''}</div></div>`;
}

/* ---------- ตาราง ---------- */
let TBL_SEQ = 0;
const TBLS = {};
function renderTable(cols, rows, opt = {}){
  const id = 'tbl' + (++TBL_SEQ);
  TBLS[id] = { cols, rows, sort: opt.sort ?? null, dir: opt.dir ?? 'desc', q: '', opt };
  const search = opt.search ? `<input class="srch" placeholder="ค้นหา…" oninput="tblSearch('${id}',this.value)">` : '';
  const dl = opt.download ? `<button class="btn" onclick="tblExport('${id}','${esc(opt.download)}')">⬇ Excel</button>` : '';
  return `<div class="panel">
    <div class="panel-h"><h3>${esc(opt.title || '')}</h3>
      ${opt.hint ? `<span class="hint">${esc(opt.hint)}</span>` : ''}
      <div class="tbl-tools">${search}${dl}</div></div>
    <div class="tw" id="${id}"></div></div>`;
}
function tblRows(T){
  let rows = T.rows;
  if (T.q){
    const q = T.q.toLowerCase();
    rows = rows.filter(r => T.cols.some(c => String(c.raw ? c.raw(r) : r[c.k] ?? '').toLowerCase().includes(q)));
  }
  if (T.sort != null){
    const c = T.cols[T.sort], sgn = T.dir === 'asc' ? 1 : -1;
    /* sortRaw = ค่าที่ใช้เรียงอย่างเดียว (เช่น "1.1" ต้องเรียงตามเลขเดือน ไม่ใช่ตามตัวอักษร) */
    const key = c.sortRaw || c.raw;
    rows = [...rows].sort((a, b) => {
      const va = key ? key(a) : a[c.k], vb = key ? key(b) : b[c.k];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sgn;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'th', { numeric: true }) * sgn;
    });
  }
  return rows;
}
function tblPaint(id){
  const T = TBLS[id]; if (!T) return;
  const el = document.getElementById(id); if (!el) return;
  const rows = tblRows(T);
  const maxBar = {};
  T.cols.forEach((c, i) => { if (c.bar) maxBar[i] = Math.max(1, ...rows.map(r => Math.abs(c.raw ? c.raw(r) : r[c.k]) || 0)); });
  const head = T.cols.map((c, i) => {
    const ar = T.sort === i ? (T.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="${c.num ? 'num' : ''}" onclick="tblSort('${id}',${i})">${esc(c.t)}${ar}</th>`;
  }).join('');
  const body = rows.length ? rows.map((r, ri) => '<tr>' + T.cols.map((c, i) => {
    const v = c.fmt ? c.fmt(r, ri) : esc(r[c.k] ?? '');
    if (c.bar){
      const raw = Math.abs(c.raw ? c.raw(r) : r[c.k]) || 0;
      return `<td class="num bar-cell"><i class="bg" style="width:${(raw / maxBar[i] * 100).toFixed(1)}%"></i><span>${v}</span></td>`;
    }
    return `<td class="${c.num ? 'num' : ''}">${v}</td>`;
  }).join('') + '</tr>').join('')
    : `<tr><td colspan="${T.cols.length}" style="text-align:center;color:var(--muted);padding:26px">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>`;
  let foot = '';
  if (T.opt.total && rows.length){
    foot = '<tfoot><tr>' + T.cols.map((c, i) => {
      if (i === 0) return `<td>รวม ${nf0.format(rows.length)} รายการ</td>`;
      if (!c.sum) return '<td></td>';
      const s = rows.reduce((a, r) => a + (+(c.raw ? c.raw(r) : r[c.k]) || 0), 0);
      return `<td class="num">${c.sumFmt ? c.sumFmt(s) : money(s)}</td>`;
    }).join('') + '</tr></tfoot>';
  }
  el.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}
function tblSort(id, i){
  const T = TBLS[id]; if (!T) return;
  if (T.sort === i) T.dir = T.dir === 'asc' ? 'desc' : 'asc';
  else { T.sort = i; T.dir = 'desc'; }
  tblPaint(id);
}
function tblSearch(id, q){ const T = TBLS[id]; if (!T) return; T.q = q; tblPaint(id); }
function paintTables(){ Object.keys(TBLS).forEach(tblPaint); }
function tblExport(id, name){
  const T = TBLS[id]; if (!T || typeof XLSX === 'undefined') return;
  const rows = tblRows(T);
  const aoa = [T.cols.map(c => c.t)];
  rows.forEach(r => aoa.push(T.cols.map(c => {
    const v = c.raw ? c.raw(r) : r[c.k];
    if (typeof v === 'number') return v;
    return String(c.fmt ? String(c.fmt(r)).replace(/<[^>]*>/g, '') : (v ?? ''));
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ข้อมูล');
  XLSX.writeFile(wb, `${name}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

/* ---------- โครงหน้ามาตรฐานของทุกแท็บ ---------- */
async function bootPage(active, title, filterOpts, renderFn){
  if (!requireAuth()) return;
  shell(active, title, '');
  $('#view').innerHTML = loading();
  try {
    const ok = await SB.loadMember();
    if (!ok){ location.href = 'index.html'; return; }
    await loadDims();
    renderFilters(filterOpts || {});
    window.onFilterChange = async () => {
      renderFilters(filterOpts || {});
      $('#view').innerHTML = loading();
      destroyCharts();
      try { await renderFn(); } catch (e) { $('#view').innerHTML = errBox(e); }
    };
    await renderFn();
  } catch (e) { $('#view').innerHTML = errBox(e); }
}
