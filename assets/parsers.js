/* =====================================================================
   MASARU Lazada Portal — ตัวอ่านไฟล์ Excel (ใช้เฉพาะหน้านำเข้าข้อมูล)
   ===================================================================== */
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();

/* รหัสประจำแถว สร้างจากเนื้อหาของแถวเอง — อัปไฟล์เดิมซ้ำจึงได้ id เดิมและเขียนทับ */
function hashKey(s){
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0; h2 = Math.imul(h2, 2246822519) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

const YEAR_MIN = 2015, YEAR_MAX = 2100;
function normYMD(y, m, d){
  if (y > 2400) y -= 543;                       // พ.ศ. -> ค.ศ.
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < YEAR_MIN || y > YEAR_MAX) return null;
  return y + '-' + String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
}
function toISO(v){
  if (v == null || v === '') return null;

  /* ตัวเลข = serial ของ Excel — แปลงด้วย SSF ซึ่งให้ผลเท่ากันทุกโซนเวลา */
  if (typeof v === 'number' && isFinite(v)){
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d && d.y) return normYMD(d.y, d.m, d.d);
    } catch (e) { /* ตกไปใช้วิธีสำรองด้านล่าง */ }
    const d2 = new Date(Math.round((v - 25569) * 86400000));
    if (isNaN(d2)) return null;
    return normYMD(d2.getUTCFullYear(), d2.getUTCMonth() + 1, d2.getUTCDate());
  }

  /* ถ้าไฟล์ถูกอ่านมาเป็น Date ให้ใช้ค่า UTC เสมอ ห้ามใช้เวลาท้องถิ่น
     ไม่งั้นเครื่องที่ตั้งเวลาไทย (UTC+7) จะได้วันที่เลื่อนไป 1 วัน */
  if (v instanceof Date && !isNaN(v))
    return normYMD(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());

  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return normYMD(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return normYMD(+m[3], +m[2], +m[1]);
  const d = new Date(s);
  if (!isNaN(d)) return normYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return null;
}
const toNum = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[,\s฿]/g, ''));
  return isFinite(n) ? n : 0;
};

/* สถานะที่ไม่นับเป็นยอดขาย
   หมายเหตุ: "ผิดปกติ" นับเป็นยอดขาย (ตรงกับที่ทีมสรุปในไฟล์ Master) */
const BAD_STATUS = ['ยกเลิก', 'ยกเลิกแล้ว', 'คืนสินค้า', 'คืนเงิน', 'ตีกลับ'];

/* ผู้ดูแลที่ไม่นับเข้าระบบนี้ — ข้ามทั้งยอดขายและค่าใช้จ่าย */
const EXCLUDE_OWNERS = ['แป้งแป้ง', 'ฝ้าย', 'จอน'];

/* ชื่อผู้ดูแลที่สะกดต่างกันระหว่างไฟล์ยอดขายกับไฟล์ค่าแอด */
const OWNER_ALIAS = { 'กีต้าร์':'กีตาร์', 'เบนจามิน':'เบน', 'เบนจา':'เบน' };
const normOwner = v => {
  const s = clean(v);
  return OWNER_ALIAS[s] || s;
};
const isExcludedOwner = v => EXCLUDE_OWNERS.includes(normOwner(v));

/* ชื่อร้านในไฟล์ค่าแอดมีต่อท้ายประเภทแอด เช่น
   "MASARU_STORE TH - Sponsored Max" -> "MASARU_STORE TH"
   ตัดเฉพาะรูปแบบ " - " (เว้นวรรค-ขีด-เว้นวรรค) เพื่อไม่ไปโดนชื่อร้านที่มีขีดติดกัน */
function normStore(v){
  let s = clean(v);
  if (!s) return s;
  s = s.split(/\s+[-–—]\s+/)[0];
  return s.replace(/\s*\((sponsored|discovery|affiliate|search|max)[^)]*\)\s*$/i, '').trim();
}

/* ชื่อคอลัมน์ที่ยอมรับ (เผื่อไฟล์เดือนใหม่พิมพ์ต่างไปเล็กน้อย) */
const COL_SALES = {
  plat:  ['แพลตฟอร์ม', 'platform'],
  status:['สถานะ'],
  order: ['เลขออเดอร์ออนไลน์', 'เลขออเดอร์', 'order id'],
  date:  ['เวลาสั่งซื้อ', 'วันที่สั่งซื้อ', 'วันที่'],
  storeF:['ชื่อร้าน'],
  store: ['ชื่อ'],
  skuRaw:['sku สินค้า', 'sku'],
  skuCut:['sku ตัด'],
  qty:   ['จํานวน', 'จำนวน'],
  net:   ['จํานวนเงินจํากัด (ตัดส่วนลด)', 'จำนวนเงินจำกัด (ตัดส่วนลด)', 'จํานวนเงิน', 'จำนวนเงิน'],
  owner: ['ผู้ดูแล']
};

function sheetAoa(wb, name){
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header:1, raw:true, defval:null, blankrows:false });
}
function pickCol(headerRow, names){
  const H = headerRow.map(v => clean(v).toLowerCase());
  for (const n of names){
    const t = n.toLowerCase();
    let i = H.indexOf(t);
    if (i >= 0) return i;
    i = H.findIndex(h => h && h.startsWith(t));
    if (i >= 0) return i;
  }
  return -1;
}
function findHeaderRow(aoa, groups, maxScan = 12){
  for (let i = 0; i < Math.min(maxScan, aoa.length); i++){
    const row = (aoa[i] || []).map(v => clean(v));
    if (!row.some(Boolean)) continue;
    let hit = 0;
    for (const g of groups) if (pickCol(row, g) >= 0) hit++;
    if (hit >= Math.min(3, groups.length)) return i;
  }
  return -1;
}

/* แตกเซ็ต 'A*1/B*2' -> [['A',1],['B',2]] */
function splitBundle(s){
  if (!s) return [];
  return String(s).split('/').map(p => p.trim()).filter(Boolean).map(p => {
    const m = p.match(/^(.*?)\*(\d+)$/);
    return m ? [m[1].trim(), +m[2]] : [p, 1];
  });
}

/* ---- 1) ยอดขาย : ชีท "Data" ของไฟล์ report_YYYY_-_M.xlsx ---- */
function parseSales(wb, sheetNames){
  const sales = [], skus = [], warn = [];
  let skipped = 0, nonLazada = 0, dropped = 0;

  for (const sn of sheetNames){
    const seen = new Map();
    const aoa = sheetAoa(wb, sn);
    const hr = findHeaderRow(aoa, [COL_SALES.order, COL_SALES.date, COL_SALES.skuRaw, COL_SALES.net, COL_SALES.owner]);
    if (hr < 0){ warn.push(`ชีท "${sn}" หาแถวหัวตารางไม่เจอ`); continue; }
    const H = (aoa[hr] || []).map(v => clean(v));
    const ix = {};
    for (const k in COL_SALES) ix[k] = pickCol(H, COL_SALES[k]);
    if (ix.date < 0 || ix.net < 0){ warn.push(`ชีท "${sn}" ขาดคอลัมน์วันที่หรือยอดเงิน`); continue; }

    for (let r = hr + 1; r < aoa.length; r++){
      const row = aoa[r] || [];
      const plat = ix.plat >= 0 ? clean(row[ix.plat]) : 'Lazada';
      if (plat && !/lazada/i.test(plat)){ nonLazada++; continue; }

      const iso = toISO(row[ix.date]);
      if (!iso){
        if (clean(row[ix.order]) || toNum(row[ix.net])) skipped++;
        continue;
      }
      let order = clean(row[ix.order]);
      if (order.endsWith('.0')) order = order.slice(0, -2);
      const skuRaw = clean(row[ix.skuRaw]);
      const net = toNum(row[ix.net]);
      const qty = ix.qty >= 0 ? (toNum(row[ix.qty]) || 1) : 1;
      if (!order && !skuRaw && !net) continue;

      const status = ix.status >= 0 ? clean(row[ix.status]) : '';
      const valid = !BAD_STATUS.includes(status);
      const y = +iso.slice(0,4), mo = +iso.slice(5,7), da = +iso.slice(8,10);

      const base = ['L', order, iso, skuRaw, qty, net].join('|');
      const c = (seen.get(base) || 0) + 1; seen.set(base, c);
      const id = hashKey(base + '#' + c);

      const store = clean(row[ix.store]) || 'ไม่ระบุ';
      const owner = normOwner(row[ix.owner]) || 'ไม่ระบุ';
      if (isExcludedOwner(owner)){ dropped++; continue; }

      sales.push({
        id, order_no: order, order_date: iso,
        store, store_full: clean(row[ix.storeF]),
        owner,
        sku: (ix.skuCut >= 0 ? clean(row[ix.skuCut]) : '') || skuRaw.split('/')[0].split('*')[0].trim(),
        sku_raw: skuRaw, qty, net_amount: net,
        status, is_valid: valid, is_campaign: (da === mo)
      });

      let n = 0;
      for (const [sk, mult] of splitBundle(skuRaw)){
        n++;
        skus.push({ id: hashKey(id + '@' + n), order_no: order, order_date: iso,
          owner, store, sku: sk, qty: mult * qty, is_valid: valid });
      }
    }
  }
  if (nonLazada) warn.push(`ข้าม ${nonLazada} แถวที่ไม่ใช่ Lazada`);
  if (dropped)   warn.push(`ข้าม ${dropped} แถวของผู้ดูแลที่ไม่นับ (${EXCLUDE_OWNERS.join(', ')})`);
  if (skipped)   warn.push(`ข้าม ${skipped} แถวที่วันที่ไม่ถูกต้อง`);
  return { rows: sales, skus, warn };
}

/* ---- 2) ค่าใช้จ่าย : ชีท ADS / รีวิว ของ Lazada_ค่าใช้จ่าย_YYYY.xlsx ---- */
const COL_EXP = {
  date:  ['วันที่', 'วันที่ชำระ', 'วันที่ชำระเงิน'],
  store: ['ร้านค้า', 'ร้าน / รายละเอียด', 'รายละเอียด'],
  owner: ['ผู้ดูแล'],
  base:  ['ยอดเงิน'],
  vat:   ['ภาษี7%', 'ภาษี 7%', 'ภาษี'],
  total: ['รวม', 'ยอดเบิกเงิน', 'จำนวนเงิน'],
  adSale:['ยอดขาย'],
  status:['สถานะ'],
  cat:   ['ประเภท', 'ค่าใช้จ่าย'],
  order: ['เลขออเดอร์ออนไลน์']
};
function parseExpense(wb, sheetNames){
  const rows = [], warn = [];
  let dropped = 0;
  for (const sn of sheetNames){
    const aoa = sheetAoa(wb, sn);
    const hr = findHeaderRow(aoa, [COL_EXP.date, COL_EXP.total, COL_EXP.owner, COL_EXP.store]);
    if (hr < 0){ warn.push(`ชีท "${sn}" หาแถวหัวตารางไม่เจอ`); continue; }
    const H = (aoa[hr] || []).map(v => clean(v));
    const ix = {};
    for (const k in COL_EXP) ix[k] = pickCol(H, COL_EXP[k]);
    if (ix.date < 0 || ix.total < 0){ warn.push(`ชีท "${sn}" ขาดคอลัมน์วันที่หรือยอดเงิน`); continue; }

    const fallbackCat = /ads/i.test(sn) ? 'ค่า Ads Lazada'
                      : /รีวิว/.test(sn) ? 'ค่ารีวิว Lazada'
                      : /ครีเอเตอร์/.test(sn) ? 'ค่าจ้างครีเอเตอร์'
                      : /อุปกรณ์/.test(sn) ? 'ค่าอุปกรณ์'
                      : 'ค่าใช้จ่ายอื่นๆ';
    const seen = new Map();
    for (let r = hr + 1; r < aoa.length; r++){
      const row = aoa[r] || [];
      const iso = toISO(row[ix.date]);
      const amt = toNum(row[ix.total]);
      if (!iso || !amt) continue;
      const cat = (ix.cat >= 0 ? clean(row[ix.cat]) : '') || fallbackCat;
      /* กรองเฉพาะรายการที่เกี่ยวกับ Lazada เมื่อชีทรวมหลายแพลตฟอร์ม */
      if (/shopee|tiktok/i.test(cat)) continue;
      const owner = normOwner(row[ix.owner]);
      if (isExcludedOwner(owner)){ dropped++; continue; }
      const store = normStore(row[ix.store]) || (ix.order >= 0 ? clean(row[ix.order]) : '');
      const base = ['E', iso, cat, store, amt, r].join('|');
      const c = (seen.get(base) || 0) + 1; seen.set(base, c);
      rows.push({
        id: hashKey(base + '#' + c), pay_date: iso, category: cat,
        store, owner, detail: sn, amount: amt,
        base_amount: ix.base >= 0 ? toNum(row[ix.base]) : null,
        vat:         ix.vat  >= 0 ? toNum(row[ix.vat])  : null,
        ad_sales:    ix.adSale >= 0 ? (toNum(row[ix.adSale]) || null) : null,
        status:      ix.status >= 0 ? clean(row[ix.status]) : null
      });
    }
  }
  if (dropped) warn.push(`ข้าม ${dropped} แถวของผู้ดูแลที่ไม่นับ (${EXCLUDE_OWNERS.join(', ')})`);
  return { rows, warn };
}

/* เดาชนิดไฟล์จากชื่อชีท */
function guessKind(wb){
  const names = wb.SheetNames.map(s => s.toLowerCase());
  if (names.includes('data')) return 'sales';
  if (names.some(n => /ads|รีวิว|ครีเอเตอร์|อุปกรณ์/.test(n))) return 'expense';
  return 'sales';
}
function suggestSheets(wb, kind){
  if (kind === 'sales') return wb.SheetNames.filter(s => /^data$/i.test(s));
  return wb.SheetNames.filter(s => /lazada/i.test(s) && !/tiktok|shopee/i.test(s));
}
