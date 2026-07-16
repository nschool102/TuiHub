// =========================================================================
// MODULE: MÁY TÍNH LƯỜI — calculator.js
// Gộp từ repo myIOSCalculator (monolithic script trong index.html gốc).
// Bọc IIFE riêng + expose window.Calc để các thuộc tính onclick/oninput/onchange
// inline trong HTML (kiểu Calc.calcBasic()) vẫn gọi được dù đã đóng scope.
// =========================================================================
(function() {
'use strict';


// [HUB] Chuyển tab giờ do shell.js đảm nhiệm qua HubModules.calculator.switchTab().
// today-date được set trong calculatorModuleInit().

// ===== UNIT CHIPS =====
// multipliers: ty=1e9, trieu=1e6, k=1000, dong=1
const unitMultipliers = { ty: 1e9, trieu: 1e6, k: 1000, dong: 1 };
const unitStates = { 1:'ty', 3:'dong', 4:'dong', 6:'dong', 7:'k', 8:'k' };

document.querySelectorAll('.chips[id^="unit-chips"]').forEach(chips => {
  const idx = chips.id.replace('unit-chips','');
  chips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      unitStates[idx] = chip.dataset.unit;
      const calcMap = { 1:calcPct, 3:calcInterest, 6:calcHouse, 7:calcSplit, 8:() => { calcShop(); calcUnit(); } };
      if (calcMap[idx]) calcMap[idx]();
      if (idx === '4') { calcLottFrom('win'); }
    });
  });
});

function getMultiplier(idx) { return unitMultipliers[unitStates[idx] || 'dong']; }

// ===== MONEY FORMAT =====
function fmtMoney(val) {
  let v = Math.round(val);
  if (v === 0) return '0đ';
  const neg = v < 0;
  const av = Math.abs(v);
  const ty  = Math.floor(av / 1e9);
  const tr  = Math.floor((av % 1e9) / 1e6);
  const k   = Math.floor((av % 1e6) / 1000);
  const d   = av % 1000;
  let kAdj = k + (d >= 500 ? 1 : 0);
  let trAdj = tr, tyAdj = ty;
  if (kAdj >= 1000) { trAdj += Math.floor(kAdj/1000); kAdj = kAdj % 1000; }
  if (trAdj >= 1000) { tyAdj += Math.floor(trAdj/1000); trAdj = trAdj % 1000; }
  let parts = [];
  if (tyAdj > 0) parts.push(tyAdj + ' tỉ');
  if (trAdj > 0) parts.push(trAdj + ' triệu');
  if (kAdj > 0) parts.push(kAdj + 'k');
  let result = parts.length ? parts.join(' ') : '0đ';
  return (neg ? '-' : '') + result;
}

// ===== GCD =====
function gcd(a, b) { a=Math.abs(Math.round(a)); b=Math.abs(Math.round(b)); while(b){[a,b]=[b,a%b];} return a; }

function divResult(num, den) {
  if (den===0) return { val:'Lỗi ÷0', frac:'' };
  const r = num/den;
  if (Number.isInteger(r)) return { val: r.toLocaleString('en-US'), frac:'' };
  const dec = r.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  let fracStr = '';
  if (Number.isInteger(num) && Number.isInteger(den)) {
    const g = gcd(Math.abs(num),Math.abs(den));
    const fn=num/g, fd=den/g;
    const sign = fd<0 ? -1 : 1;
    fracStr = (sign*fn)+'/'+ Math.abs(fd);
  }
  return { val:dec, frac:fracStr };
}

// ===== TAB 0 =====
function numFmt(v) {
  if (!isFinite(v)) return v.toString();
  if (Number.isInteger(v)) {
    // #,### with comma separator
    return v.toLocaleString('en-US');
  }
  // #,###.00 — always 2 decimal places, comma separator
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// [HUB] calcBasic được viết lại để nhận 2-10 số động (thay vì cố định A/B).
// Danh sách phép tính rút gọn lại thành các phép tổng quát cho N số (Tổng, Tích,
// Trung bình, Lớn nhất/Nhỏ nhất, Hiệu tuần tự, Thương tuần tự theo đúng thứ tự nhập).
function getBasicValues() {
  const inputs = Array.from(document.querySelectorAll('#b0-inputs-list .basic-input-el'));
  return inputs.map(el => parseFloat(el.value)).filter(v => !isNaN(v));
}

function addBasicInput() {
  const list = document.getElementById('b0-inputs-list');
  const currentCount = list.querySelectorAll('.basic-input-row').length;
  if (currentCount >= 10) return;

  const newIdx = currentCount + 1;
  const row = document.createElement('div');
  row.className = 'basic-input-row';
  row.dataset.idx = newIdx;
  row.innerHTML = `
    <label>Số ${newIdx}</label>
    <div class="basic-input-row-inner">
      <input type="number" class="basic-input-el" placeholder="0">
      <button type="button" class="basic-remove-btn" aria-label="Xóa số này">✕</button>
    </div>`;
  list.appendChild(row);

  row.querySelector('.basic-input-el').addEventListener('input', calcBasic);
  row.querySelector('.basic-remove-btn').addEventListener('click', () => {
    row.remove();
    renumberBasicInputs();
    updateBasicAddBtnState();
    calcBasic();
  });

  updateBasicAddBtnState();
  calcBasic();
}

function renumberBasicInputs() {
  const rows = document.querySelectorAll('#b0-inputs-list .basic-input-row');
  rows.forEach((row, i) => {
    row.dataset.idx = i + 1;
    row.querySelector('label').textContent = 'Số ' + (i + 1);
  });
}

function updateBasicAddBtnState() {
  const btn = document.getElementById('b0-add-btn');
  if (!btn) return;
  const count = document.querySelectorAll('#b0-inputs-list .basic-input-row').length;
  btn.disabled = count >= 10;
  btn.textContent = count >= 10 ? 'Đã đạt tối đa 10 số' : `+ Thêm số (${count}/10)`;
}

// [HUB] Gắn copy-to-clipboard khi chạm/click vào 1 kết quả (.copyable)
function attachCopyableHandlers(container) {
  container.querySelectorAll('.copyable').forEach(el => {
    el.title = 'Chạm để copy';
    el.onclick = () => {
      const text = el.textContent.trim();
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(() => {
        const original = el.textContent;
        el.textContent = '✓ Đã copy';
        setTimeout(() => { el.textContent = original; }, 800);
      }).catch(() => {});
    };
  });
}

function calcBasic() {
  const values = getBasicValues();
  const container = document.getElementById('b0-results');

  if (values.length < 2) {
    container.innerHTML = '<div class="op-row"><span class="op-name" style="color:var(--text3);font-size:12px">Nhập ít nhất 2 số để xem kết quả...</span></div>';
    return;
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const product = values.reduce((a, b) => a * b, 1);
  const avg = sum / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const seqSub = values.reduce((a, b) => a - b);
  const hasZeroAfterFirst = values.slice(1).some(v => v === 0);
  const seqDiv = hasZeroAfterFirst ? null : values.reduce((a, b) => a / b);

  function rowVal(val) {
    const isNeg = val < 0;
    const color = isNeg ? 'var(--accent2)' : 'var(--text)';
    return `<span class="op-val copyable" style="color:${color}">${numFmt(val)}</span>`;
  }

  function row(expr, valHtml) {
    return `<div class="op-row"><span class="op-name">${expr}</span><div style="text-align:right">${valHtml}</div></div>`;
  }

  const n = values.length;
  container.innerHTML = [
    row(`Tổng (${n} số) =`, rowVal(sum)),
    row(`Tích (${n} số) =`, rowVal(product)),
    row(`Trung bình cộng =`, rowVal(avg)),
    row(`Lớn nhất =`, rowVal(max)),
    row(`Nhỏ nhất =`, rowVal(min)),
    row(`Hiệu tuần tự (Số1−Số2−...) =`, rowVal(seqSub)),
    row(`Thương tuần tự (Số1÷Số2÷...) =`,
        hasZeroAfterFirst ? '<span class="op-val" style="color:var(--accent2)">Lỗi ÷0</span>' : rowVal(seqDiv)),
  ].join('');

  attachCopyableHandlers(container);
}

// ===== TAB 1 =====
function calcPct() {
  const unit = unitStates['1'] || 'ty';
  const mult = unitMultipliers[unit];
  const aRaw = parseFloat(document.getElementById('b1-a').value);
  const b    = parseFloat(document.getElementById('b1-b').value);
  const container = document.getElementById('pct-results');

  // Build display label for the amount
  const unitLabel = unit === 'ty' ? 'tỉ' : unit === 'trieu' ? 'triệu' : 'K';
  const textSoTien = isNaN(aRaw) ? '?' : (numFmt(aRaw) + ' ' + unitLabel);

  if (isNaN(aRaw) || isNaN(b)) {
    container.innerHTML = '<div class="result-row"><span class="result-label" style="color:var(--text3);font-size:12px">Nhập số tiền và % để xem kết quả...</span></div>';
    return;
  }

  const a = aRaw * mult;
  const inc  = fmtMoney(a * (1 + b / 100));
  const dec  = fmtMoney(a * (1 - b / 100));
  const ofA  = fmtMoney(a * b / 100);
  const bS   = numFmt(b);

  function row(label, val, cls) {
    return `<div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <span class="result-label" style="font-size:12px">${label}</span>
      <span class="result-val ${cls||''}" style="font-size:17px">${val}</span>
    </div>`;
  }

  container.innerHTML = [
    row(`${textSoTien} tăng ${bS}% =`, inc, ''),
    row(`${textSoTien} giảm ${bS}% =`, dec, ''),
    row(`${bS}% của ${textSoTien} =`, ofA, 'accent'),
  ].join('');
}

// ===== TAB 2 =====
function calcRatio() {
  const a = parseFloat(document.getElementById('b2-a').value);
  const b = parseFloat(document.getElementById('b2-b').value);
  const container = document.getElementById('ratio-results');

  if (isNaN(a) || isNaN(b)) {
    container.innerHTML = '<div class="result-row"><span class="result-label" style="color:var(--text3);font-size:12px">Nhập A và B để xem kết quả...</span></div>';
    return;
  }

  const aS = numFmt(a), bS = numFmt(b);

  function pct(num, den) {
    if (den === 0) return '∞';
    return numFmt(parseFloat((num/den*100).toFixed(2))) + '%';
  }

  const diffPct = (a !== 0 && b !== 0)
    ? numFmt(parseFloat(Math.abs((b-a)/a*100).toFixed(2))) + '%'
    : '—';

  function row(label, val, cls) {
    return `<div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <span class="result-label" style="font-size:12px">${label}</span>
      <span class="result-val ${cls||''}" style="font-size:17px">${val}</span>
    </div>`;
  }

  container.innerHTML = [
    row(`${aS} là bao nhiêu % của ${bS}?`, pct(a,b), ''),
    row(`${bS} là bao nhiêu % của ${aS}?`, pct(b,a), ''),
    row(`Chênh lệch giữa ${aS} và ${bS} là`, diffPct, 'accent'),
  ].join('');
}

// ===== TAB 3 =====
function calcInterest() {
  const mult = getMultiplier('3');
  const von = parseFloat(document.getElementById('ls-von').value)*mult;
  const rate = parseFloat(document.getElementById('ls-rate').value);
  const months = parseFloat(document.getElementById('ls-months').value);
  if (isNaN(von)||isNaN(rate)||isNaN(months)) { ['ls-monthly','ls-total-int','ls-grand'].forEach(id=>document.getElementById(id).textContent='—'); return; }
  const monthly = von*rate/100/12;
  const totalInt = monthly*months;
  document.getElementById('ls-monthly').textContent = fmtMoney(monthly);
  document.getElementById('ls-total-int').textContent = fmtMoney(totalInt);
  document.getElementById('ls-grand').textContent = fmtMoney(von+totalInt);
}

// ===== TAB 4 =====
let lottLock = false;
function calcLottFrom(src) {
  if (lottLock) return;
  lottLock = true;
  const mult = getMultiplier('4');
  if (src==='win') {
    const win = parseFloat(document.getElementById('lott-win').value)*mult;
    if (!isNaN(win)) {
      const tax=win*0.1, net=win*0.9;
      document.getElementById('lott-tax').value = parseFloat((tax/mult).toFixed(4));
      document.getElementById('lott-net').value = parseFloat((net/mult).toFixed(4));
      document.getElementById('lott-sum-win').textContent = fmtMoney(win);
      document.getElementById('lott-sum-tax').textContent = fmtMoney(tax);
      document.getElementById('lott-sum-net').textContent = fmtMoney(net);
    } else clearLott();
  } else {
    const net = parseFloat(document.getElementById('lott-net').value)*mult;
    if (!isNaN(net)) {
      const win=net/0.9, tax=win*0.1;
      document.getElementById('lott-win').value = parseFloat((win/mult).toFixed(4));
      document.getElementById('lott-tax').value = parseFloat((tax/mult).toFixed(4));
      document.getElementById('lott-sum-win').textContent = fmtMoney(win);
      document.getElementById('lott-sum-tax').textContent = fmtMoney(tax);
      document.getElementById('lott-sum-net').textContent = fmtMoney(net);
    } else clearLott();
  }
  lottLock = false;
}
function clearLott() { ['lott-sum-win','lott-sum-tax','lott-sum-net'].forEach(id=>document.getElementById(id).textContent='—'); }

// ===== TAB 5 =====
function calcDate() {
  const startVal = document.getElementById('date-start').value;
  const endVal   = document.getElementById('date-end').value;
  const today = new Date(); today.setHours(0,0,0,0);
  const fmtDate = d => d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });

  const drEl = document.getElementById('date-result');
  const dsEl = document.getElementById('date-sentence');

  if (!startVal && !endVal) {
    drEl.style.display = 'block';
    dsEl.style.display = 'none';
    return;
  }

  let start = startVal ? new Date(startVal) : null;
  let end   = endVal   ? new Date(endVal)   : null;

  const textStart = start ? 'ngày ' + fmtDate(start) : 'hôm nay';
  const textEnd   = end   ? 'ngày ' + fmtDate(end)   : 'hôm nay';

  const from = start || today;
  const to   = end   || today;

  const diffDays   = Math.round((to - from) / 86400000);
  const absDays    = Math.abs(diffDays);
  const absWeeks   = (absDays / 7).toFixed(1);
  const absMonths  = (absDays / 30.44).toFixed(1);

  let sentence;
  if (diffDays === 0) {
    sentence = `<b>${textStart}</b> và <b>${textEnd}</b> là cùng một ngày.`;
  } else {
    const dir = diffDays > 0 ? 'là' : 'là (ngược chiều)';
    sentence = `Từ <b>${textStart}</b> đến <b>${textEnd}</b> ${dir}<br>
      <span style="color:var(--accent3);font-size:22px;font-weight:800">${absDays.toLocaleString('en-US')} ngày</span><br>
      <span style="color:var(--text2);font-size:13px">~ ${absWeeks} tuần &nbsp;·&nbsp; ~ ${absMonths} tháng</span>`;
  }

  drEl.style.display = 'none';
  dsEl.style.display = 'block';
  dsEl.innerHTML = sentence;
}
function clearDates() { document.getElementById('date-start').value=''; document.getElementById('date-end').value=''; calcDate(); }

// ===== TAB 6 =====
function calcHouse() {
  const mult = getMultiplier('6');
  const dai  = parseFloat(document.getElementById('nh-dai').value);
  const rong = parseFloat(document.getElementById('nh-rong').value);
  const gia  = parseFloat(document.getElementById('nh-gia').value)*mult;
  if (isNaN(dai)||isNaN(rong)) { document.getElementById('house-results').style.display='none'; return; }
  const area = dai*rong;
  const grid = document.getElementById('house-grid');
  let html = `<div class="result-row"><span class="result-label">Diện tích</span><span class="result-val accent">${area.toFixed(1)} m²</span></div>`;
  if (!isNaN(gia)&&gia>0) {
    const ppm2=gia/area, tile=area*1.1, paint=2*(dai+rong)*3;
    html += `<div class="result-row"><span class="result-label">Giá tiền 1m²</span><span class="result-val">${fmtMoney(ppm2)}</span></div>`;
    html += `<div class="result-row"><span class="result-label">Diện tích lát gạch (+10%)</span><span class="result-val">${tile.toFixed(1)} m²</span></div>`;
    html += `<div class="result-row"><span class="result-label">Diện tích sơn tường</span><span class="result-val">${paint.toFixed(1)} m²</span></div>`;
  }
  grid.innerHTML = html;
  document.getElementById('house-results').style.display='block';
}

// ===== TAB 7 =====
function calcSplit() {
  const unit = unitStates['7'] || 'k';
  const mult = unitMultipliers[unit];
  const totalRaw = parseFloat(document.getElementById('sp-total').value);
  const people   = parseFloat(document.getElementById('sp-people').value);
  const container = document.getElementById('split-results');

  if (isNaN(totalRaw) || isNaN(people) || people <= 0) {
    container.innerHTML = '<div class="result-row"><span class="result-label" style="color:var(--text3);font-size:12px">Nhập tổng tiền và số người...</span></div>';
    return;
  }

  const total = totalRaw * mult;
  const each  = total / people;
  const unitLabel = unit === 'ty' ? 'tỉ' : unit === 'trieu' ? 'triệu' : 'K';
  const totalFmt  = numFmt(totalRaw) + ' ' + unitLabel;
  const eachFmt   = fmtMoney(each);
  const peopleFmt = numFmt(people);

  container.innerHTML = `<div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
    <span class="result-label" style="font-size:12px">${totalFmt} ÷ ${peopleFmt} người</span>
    <span style="font-size:13px;color:var(--text2)">Mỗi người trả:</span>
    <span class="result-val" style="font-size:26px;color:var(--accent3)">${eachFmt}<span style="font-size:14px;color:var(--text2);font-weight:400"> / người</span></span>
  </div>`;
}

// ===== TAB 8 =====
function calcShop() {
  const unit = unitStates['8'] || 'k';
  const mult = unitMultipliers[unit];
  const priceRaw = parseFloat(document.getElementById('sh-price').value);
  const disc     = parseFloat(document.getElementById('sh-disc').value);
  const container = document.getElementById('shop-results');
  const unitLabel = unit === 'ty' ? 'tỉ' : unit === 'trieu' ? 'triệu' : 'K';

  if (isNaN(priceRaw) || isNaN(disc)) {
    container.innerHTML = '<div class="result-row"><span class="result-label" style="color:var(--text3);font-size:12px">Nhập giá gốc và % giảm...</span></div>';
    return;
  }

  const price = priceRaw * mult;
  const after = price * (1 - disc / 100);
  const save  = price - after;
  const priceFmt = numFmt(priceRaw) + ' ' + unitLabel;
  const discFmt  = numFmt(disc);

  container.innerHTML = `
    <div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <span class="result-label" style="font-size:12px">${priceFmt} giảm ${discFmt}% còn:</span>
      <span class="result-val" style="font-size:22px">${fmtMoney(after)}</span>
    </div>
    <div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
      <span class="result-label" style="font-size:12px">Tiết kiệm được:</span>
      <span class="result-val accent" style="font-size:22px">${fmtMoney(save)}</span>
    </div>`;
}

function calcUnit() {
  const unit = unitStates['8'] || 'k';
  const mult = unitMultipliers[unit];
  const totalRaw = parseFloat(document.getElementById('sh-total').value);
  const qty      = parseFloat(document.getElementById('sh-qty').value);
  const container = document.getElementById('unit-results');
  const unitLabel = unit === 'ty' ? 'tỉ' : unit === 'trieu' ? 'triệu' : 'K';

  if (isNaN(totalRaw) || isNaN(qty) || qty <= 0) {
    container.innerHTML = '<div class="result-row"><span class="result-label" style="color:var(--text3);font-size:12px">Nhập giá bán và số lượng...</span></div>';
    return;
  }

  const total = totalRaw * mult;
  const unitPrice = total / qty;
  const totalFmt = numFmt(totalRaw) + ' ' + unitLabel;
  const qtyFmt   = numFmt(qty);

  container.innerHTML = `<div class="result-row" style="flex-direction:column;align-items:flex-start;gap:4px">
    <span class="result-label" style="font-size:12px">${totalFmt} ÷ ${qtyFmt} = giá mỗi cái:</span>
    <span class="result-val" style="font-size:22px">${fmtMoney(unitPrice)}</span>
  </div>`;
}

// ===== TAB 9: ĐỔI ĐƠN VỊ =====

// --- Chiều dài (to meters) ---
const lenToM = { in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344, mm:0.001, cm:0.01, m:1, km:1000 };
function cvLen(src) {
  const enU = document.getElementById('len-en-u').value;
  const siU = document.getElementById('len-si-u').value;
  if (src==='en') {
    const v = parseFloat(document.getElementById('len-en').value);
    if (isNaN(v)) { document.getElementById('len-si').value=''; return; }
    document.getElementById('len-si').value = fmtCv(v*lenToM[enU]/lenToM[siU]);
  } else {
    const v = parseFloat(document.getElementById('len-si').value);
    if (isNaN(v)) { document.getElementById('len-en').value=''; return; }
    document.getElementById('len-en').value = fmtCv(v*lenToM[siU]/lenToM[enU]);
  }
}

// --- Khối lượng (to kg) ---
const wtToKg = { oz:0.0283495, lb:0.453592, g:0.001, kg:1, t:1000 };
function cvWt(src) {
  const enU = document.getElementById('wt-en-u').value;
  const siU = document.getElementById('wt-si-u').value;
  if (src==='en') {
    const v = parseFloat(document.getElementById('wt-en').value);
    if (isNaN(v)) { document.getElementById('wt-si').value=''; return; }
    document.getElementById('wt-si').value = fmtCv(v*wtToKg[enU]/wtToKg[siU]);
  } else {
    const v = parseFloat(document.getElementById('wt-si').value);
    if (isNaN(v)) { document.getElementById('wt-en').value=''; return; }
    document.getElementById('wt-en').value = fmtCv(v*wtToKg[siU]/wtToKg[enU]);
  }
}

// --- Thể tích (to liters) ---
const volToL = { floz:0.0295735, pt:0.473176, qt:0.946353, gal:3.78541, ml:0.001, lit:1, m3:1000 };
function cvVol(src) {
  const enU = document.getElementById('vol-en-u').value;
  const siU = document.getElementById('vol-si-u').value;
  if (src==='en') {
    const v = parseFloat(document.getElementById('vol-en').value);
    if (isNaN(v)) { document.getElementById('vol-si').value=''; return; }
    document.getElementById('vol-si').value = fmtCv(v*volToL[enU]/volToL[siU]);
  } else {
    const v = parseFloat(document.getElementById('vol-si').value);
    if (isNaN(v)) { document.getElementById('vol-en').value=''; return; }
    document.getElementById('vol-en').value = fmtCv(v*volToL[siU]/volToL[enU]);
  }
}

// --- Nhiệt độ ---
function cvTemp(src) {
  if (src==='f') {
    const f = parseFloat(document.getElementById('temp-f').value);
    if (isNaN(f)) { document.getElementById('temp-c').value=''; return; }
    document.getElementById('temp-c').value = fmtCv((f-32)*5/9);
  } else {
    const c = parseFloat(document.getElementById('temp-c').value);
    if (isNaN(c)) { document.getElementById('temp-f').value=''; return; }
    document.getElementById('temp-f').value = fmtCv(c*9/5+32);
  }
}

// --- Vận tốc ---
function cvSpd(src) {
  if (src==='kmh') {
    const v = parseFloat(document.getElementById('spd-kmh').value);
    if (isNaN(v)) { document.getElementById('spd-ms').value=''; return; }
    document.getElementById('spd-ms').value = fmtCv(v/3.6);
  } else {
    const v = parseFloat(document.getElementById('spd-ms').value);
    if (isNaN(v)) { document.getElementById('spd-kmh').value=''; return; }
    document.getElementById('spd-kmh').value = fmtCv(v*3.6);
  }
}

// --- VN ↔ UTC ---
// Vietnam is UTC+7, no daylight saving
// Note: some regions that Vietnam app users may compare to DO have DST — we use Intl.DateTimeFormat for those
function cvTzVnUtc(src) {
  if (src==='vn') {
    const v = document.getElementById('tz-vn').value;
    if (!v) { document.getElementById('tz-utc').value=''; document.getElementById('tz-utc-note').textContent=''; return; }
    const [h,m] = v.split(':').map(Number);
    let utcH = (h - 7 + 24) % 24;
    document.getElementById('tz-utc').value = String(utcH).padStart(2,'0')+':'+String(m).padStart(2,'0');
    const diff = h < 7 ? -1 : 0;
    document.getElementById('tz-utc-note').textContent = diff ? `⚠️ UTC là ngày hôm trước` : `Cùng ngày`;
  } else {
    const v = document.getElementById('tz-utc').value;
    if (!v) { document.getElementById('tz-vn').value=''; document.getElementById('tz-utc-note').textContent=''; return; }
    const [h,m] = v.split(':').map(Number);
    let vnH = (h + 7) % 24;
    document.getElementById('tz-vn').value = String(vnH).padStart(2,'0')+':'+String(m).padStart(2,'0');
    const diff = h + 7 >= 24 ? 1 : 0;
    document.getElementById('tz-utc-note').textContent = diff ? `⚠️ Giờ VN là ngày hôm sau` : `Cùng ngày`;
  }
}

function tzNow() {
  const n = new Date();
  const h = String(n.getHours()).padStart(2,'0');
  const m = String(n.getMinutes()).padStart(2,'0');
  document.getElementById('tz-vn').value = h+':'+m;
  cvTzVnUtc('vn');
}

// --- VN → Thế giới ---
// [HUB] Đã nhóm theo 4 vùng: Châu Á, Châu Âu, Mĩ, Úc — mỗi vùng hiển thị 2 cột.
const worldZoneGroups = [
  {
    region: 'Châu Á',
    zones: [
      { city: 'Tokyo, Nhật Bản - Seoul, Hàn Quốc', tz: 'Asia/Tokyo' },
      { city: 'Singapore - Bắc Kinh, Trung Quốc', tz: 'Asia/Singapore' },
      { city: 'Bangkok, Thái Lan', tz: 'Asia/Bangkok' },
      { city: 'Dubai, UAE', tz: 'Asia/Dubai' },
    ]
  },
  {
    region: 'Châu Âu',
    zones: [
      { city: 'Moscow, Nga', tz: 'Europe/Moscow' },
      { city: 'EU', tz: 'Europe/Paris' },
      { city: 'UTC - London, Anh', tz: 'Europe/London' },
    ]
  },
  {
    region: 'Mĩ',
    zones: [
      { city: 'New York, Mĩ', tz: 'America/New_York' },
      { city: 'Los Angeles, Mĩ', tz: 'America/Los_Angeles' },
    ]
  },
  {
    region: 'Úc',
    zones: [
      { city: 'Sydney, Úc', tz: 'Australia/Sydney' },
    ]
  },
];

function initTzWorld() {
  cvTzWorld();
}

function cvTzWorld() {
  // Get VN time input or system time
  const inp = document.getElementById('tz-vn2').value;
  let baseDate;
  if (inp) {
    const [h,m] = inp.split(':').map(Number);
    baseDate = new Date();
    baseDate.setHours(h, m, 0, 0);
  } else {
    baseDate = new Date();
  }
  
  // Show current VN time reference
  const vnTime = baseDate.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Ho_Chi_Minh' });
  const vnDate = baseDate.toLocaleDateString('vi-VN', { weekday:'short', day:'2-digit', month:'2-digit', timeZone:'Asia/Ho_Chi_Minh' });
  document.getElementById('tz-world-now').textContent = `🇻🇳 VN: ${vnTime} — ${vnDate}`;

  function renderZone(z) {
    let timeStr = '—', dateStr = '';
    try {
      timeStr = baseDate.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit', timeZone: z.tz });
      dateStr = baseDate.toLocaleDateString('vi-VN', { weekday:'short', day:'2-digit', month:'2-digit', timeZone: z.tz });
    } catch(e) {}
    return `<div class="tz-result">
      <div class="tz-city">${z.city}</div>
      <div class="tz-time">${timeStr}</div>
      <div class="tz-date">${dateStr}</div>
    </div>`;
  }

  const groupsWrap = document.getElementById('tz-world-groups');
  groupsWrap.innerHTML = worldZoneGroups.map(g => `
    <div class="tz-region-group">
      <div class="tz-region-title">${g.region}</div>
      <div class="tz-grid-2col">
        ${g.zones.map(renderZone).join('')}
      </div>
    </div>
  `).join('');
}

// Auto refresh world time every 60s when on tab 9
setInterval(() => {
  const panel9 = document.getElementById('panel-9');
  if (panel9.classList.contains('active')) {
    const inp = document.getElementById('tz-vn2').value;
    if (!inp) cvTzWorld(); // only auto-refresh if using system time
  }
}, 60000);

// Helper: format converted number nicely
function fmtCv(v) {
  if (isNaN(v)) return '';
  if (Math.abs(v) >= 1000) return parseFloat(v.toFixed(4));
  if (Math.abs(v) >= 1)    return parseFloat(v.toFixed(6));
  return parseFloat(v.toFixed(8));
}


// =========================================================================
// [HUB] Khởi tạo module + chuyển tab — expose cho shell.js gọi
// =========================================================================
function calculatorModuleInit() {
    const now = new Date();
    const todayEl = document.getElementById('today-date');
    if (todayEl) todayEl.textContent = now.toLocaleDateString('vi-VN');
    updateBasicAddBtnState();
}

function calculatorSwitchTab(tabKey) {
    document.querySelectorAll('#module-calculator .panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + tabKey);
    if (panel) panel.classList.add('active');
    if (tabKey === '9') initTzWorld();
}


// [HUB] Expose cho HTML inline handlers (onclick="Calc.xxx()") và cho shell.js
window.Calc = {
    addBasicInput: addBasicInput,
    attachCopyableHandlers: attachCopyableHandlers,
    calcBasic: calcBasic,
    calcDate: calcDate,
    calcHouse: calcHouse,
    calcInterest: calcInterest,
    calcLottFrom: calcLottFrom,
    calcPct: calcPct,
    calcRatio: calcRatio,
    calcShop: calcShop,
    calcSplit: calcSplit,
    calcUnit: calcUnit,
    calculatorModuleInit: calculatorModuleInit,
    calculatorSwitchTab: calculatorSwitchTab,
    clearDates: clearDates,
    clearLott: clearLott,
    cvLen: cvLen,
    cvSpd: cvSpd,
    cvTemp: cvTemp,
    cvTzVnUtc: cvTzVnUtc,
    cvTzWorld: cvTzWorld,
    cvVol: cvVol,
    cvWt: cvWt,
    divResult: divResult,
    fmtCv: fmtCv,
    fmtMoney: fmtMoney,
    gcd: gcd,
    getBasicValues: getBasicValues,
    getMultiplier: getMultiplier,
    initTzWorld: initTzWorld,
    numFmt: numFmt,
    renumberBasicInputs: renumberBasicInputs,
    tzNow: tzNow,
    updateBasicAddBtnState: updateBasicAddBtnState
};

window.HubModules.calculator = {
    init: calculatorModuleInit,
    switchTab: calculatorSwitchTab
};

})();
