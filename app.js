/* おかん、ガンバレ！ — フロントエンド */

/* ▼▼ GAS をデプロイして発行された Web App URL をここに貼る ▼▼ */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbx6JyFkScT1j4QY13L2Sf21cIiAw5dsrzfieURiH_10D1sxpVjIoK4Hnx_T6gzPy9a5/exec';
/* ▲▲ 例: https://script.google.com/macros/s/XXXXXXXX/exec ▲▲ */

const AUTH_KEY = 'okan_ganbare_auth';
const AUTH_DAYS = 30;
/* 前回取得したデータの保存先。再訪時はこれを即表示し、裏で最新に差し替える（体感を速く）。 */
const DATA_CACHE_KEY = 'okan_ganbare_data';

/* 毎日の様子（ログ）の表示件数。
   初期表示も「もっと見る」で増える件数も、両方この数字。ここを変えるだけでOK。 */
const LOG_PAGE_SIZE = 7;

const PLACEHOLDER_URL = 'PASTE_YOUR_GAS_WEB_APP_URL_HERE';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', onLogin);
  document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') onLogin();
  });
  setupPasswordField();
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // GAS 未接続ならサンプルデータでプレビュー表示
  if (GAS_URL === PLACEHOLDER_URL && window.SAMPLE_DATA) {
    showPreview(window.SAMPLE_DATA);
    return;
  }

  const saved = getSavedAuth();
  if (saved) {
    // 前回データがあれば即表示（待たせない）→ そのうえで裏で最新を取りに行く
    const cached = getCachedData();
    if (cached) {
      render(cached);
      document.getElementById('login').hidden = true;
      document.getElementById('app').hidden = false;
    }
    loadData(saved, { silent: !!cached });
  }
});

function showPreview(data) {
  render(data);
  document.getElementById('login').hidden = true;
  const app = document.getElementById('app');
  app.hidden = false;
  const banner = document.createElement('div');
  banner.className = 'preview-banner';
  banner.textContent = '📋 サンプル表示（GAS未接続）— app.js に GAS_URL を設定すると本番データになります';
  app.prepend(banner);
}

/* ===== 認証（30日記憶） ===== */
function getSavedAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const { password, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(AUTH_KEY); return null; }
    return password;
  } catch { return null; }
}

function saveAuth(password) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    password,
    expires: Date.now() + AUTH_DAYS * 86400000,
  }));
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(DATA_CACHE_KEY);
  location.reload();
}

/* 前回取得データのキャッシュ（再訪時の即時表示用） */
function getCachedData() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setCachedData(data) {
  try { localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data)); } catch {}
}

function onLogin() {
  const el = document.getElementById('password');
  const pw = (el.__getReal ? el.__getReal() : el.value).trim();
  if (!pw) return;
  loadData(pw, { fromLogin: true });
}

/* 合言葉入力：実値はJSで保持し、表示は「●…●＋最後に打った1文字（約1秒）」。
   目アイコンで全表示トグル。実値は onLogin が input.__getReal() で読む。
   ※ラテン文字の合言葉を想定。日本語IME変換中の逐次伏字は対象外（軽微な既知制約）。 */
function setupPasswordField() {
  const input = document.getElementById('password');
  const toggle = document.getElementById('pwToggle');
  if (!input || !toggle) return;

  let real = '';            // 実際の入力値
  let reveal = false;       // 目トグル（全表示）
  let peekIndex = -1;       // 一時的に実文字を見せる位置（最後に打った文字）
  let peekTimer = null;

  input.__getReal = () => real;

  function paint(caret) {
    if (reveal) {
      input.value = real;
    } else {
      let s = '';
      for (let i = 0; i < real.length; i++) s += (i === peekIndex ? real[i] : '●');
      input.value = s;
    }
    if (caret != null) input.setSelectionRange(caret, caret);
  }

  function schedulePeekClear() {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      peekIndex = -1;
      if (!reveal) paint(input.selectionStart);
    }, 1000);
  }

  input.addEventListener('beforeinput', (e) => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const t = e.inputType;

    if (t === 'insertText' || t === 'insertFromPaste' || t === 'insertReplacementText' ||
        t === 'insertFromDrop' || t === 'insertCompositionText') {
      const data = e.data != null ? e.data : '';
      real = real.slice(0, start) + data + real.slice(end);
      const caret = start + data.length;
      peekIndex = caret - 1;            // 最後に入った1文字だけ見せる
      e.preventDefault();
      paint(caret);
      schedulePeekClear();
    } else if (t === 'deleteContentBackward') {
      const from = (start === end) ? Math.max(0, start - 1) : start;
      real = real.slice(0, from) + real.slice(end);
      peekIndex = -1;
      e.preventDefault();
      paint(from);
    } else if (t === 'deleteContentForward') {
      const to = (start === end) ? start + 1 : end;
      real = real.slice(0, start) + real.slice(to);
      peekIndex = -1;
      e.preventDefault();
      paint(start);
    } else if (t === 'deleteByCut' || t === 'deleteByDrag' || t === 'deleteContent') {
      real = real.slice(0, start) + real.slice(end);
      peekIndex = -1;
      e.preventDefault();
      paint(start);
    }
    // それ以外の inputType は既定にまかせない（伏字とズレないよう上記で網羅）
  });

  toggle.addEventListener('click', () => {
    reveal = !reveal;
    toggle.textContent = reveal ? '🙈' : '👁';
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.setAttribute('aria-label', reveal ? '合言葉を隠す' : '合言葉を表示');
    clearTimeout(peekTimer);
    peekIndex = -1;
    paint(real.length);
    input.focus();
  });
}

/* ===== データ取得 ===== */
async function loadData(password, opts) {
  // opts: { fromLogin?:bool, silent?:bool }。silent=裏での再取得（既にキャッシュ表示済み）。
  const o = opts || {};
  const errEl = document.getElementById('loginError');
  if (o.fromLogin) errEl.textContent = '読み込み中...';
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getData', password }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'auth') {
        // 合言葉が変わった等。キャッシュ表示中でもログイン画面に戻す。
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(DATA_CACHE_KEY);
        document.getElementById('app').hidden = true;
        document.getElementById('login').hidden = false;
        errEl.textContent = '合言葉が違うようです。';
      } else if (!o.silent) {
        errEl.textContent = 'エラー: ' + (data.error || '不明');
      }
      return;
    }
    saveAuth(password);
    setCachedData(data);          // 次回の即時表示用に保存
    render(data);
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
  } catch (e) {
    // 裏での再取得中の通信エラーは、表示中のキャッシュをそのまま残して黙る
    if (!o.silent) errEl.textContent = '接続できませんでした。通信環境を確認してください。';
  }
}

/* ===== 描画 ===== */
function render(data) {
  renderStatus(data.status || []);
  renderSchedule(data.schedule || []);
  renderLab(data.labResults || []);
  renderRules(data.rules || []);
  renderLog(data.log || [], data.photos || []);
  renderLastUpdated(data);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/* カテゴリの表示順（固定）。ここに無いカテゴリは後ろにまとめる */
const STATUS_CATEGORY_ORDER = ['サマリー', '治療', '症状', '生活'];
/* このカテゴリは、一定日数 言及がなければ自動で「いまの状態」から隠す（落ち着いたとみなす） */
const STATUS_AGING_CATEGORIES = ['症状', '生活'];
const STATUS_FRESH_DAYS = 7;
/* カテゴリ内の項目の並び順（大事な順）。ここに無い項目は後ろに回す */
const STATUS_ITEM_ORDER = {
  '治療': ['抗がん剤内服', '点滴', 'ステロイド内服', '輸血', '眠剤'],
};

function parseYmd(v) {
  const m = String(v ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function renderStatus(rows) {
  const box = document.getElementById('statusBody');
  // 基準日＝状態の最新更新日。今日ではなくこれを使うので、更新が途絶えても全部は消えない
  const refDate = rows.reduce((mx, r) => {
    const d = parseYmd(r['更新日時']);
    return d && (!mx || d > mx) ? d : mx;
  }, null);

  const active = rows.filter(r => {
    // ① 明示的に「解決」したものは隠す（シートには履歴として残る）
    if (String(r['状態'] ?? '') === '解決') return false;
    // ② 症状・生活は、基準日から一定日数 言及がなければ自動で隠す（誰も宣言しなくてOK）
    if (refDate && STATUS_AGING_CATEGORIES.includes(r['カテゴリ'])) {
      const d = parseYmd(r['更新日時']);
      if (d && (refDate - d) / 86400000 > STATUS_FRESH_DAYS) return false;
    }
    return true;
  });
  if (!active.length) { box.innerHTML = '<p class="empty">まだ情報がありません。</p>'; return; }

  // カテゴリでグループ化（カテゴリ未設定は「その他」）
  const groups = {};
  active.forEach(r => {
    const cat = r['カテゴリ'] || 'その他';
    (groups[cat] = groups[cat] || []).push(r);
  });
  const cats = [
    ...STATUS_CATEGORY_ORDER,
    ...Object.keys(groups).filter(c => !STATUS_CATEGORY_ORDER.includes(c)),
  ].filter(c => groups[c]);

  box.innerHTML = cats.map(cat => {
    // カテゴリ内を「大事な順」に並べ替え（指定が無い項目は後ろ）
    const pri = STATUS_ITEM_ORDER[cat];
    if (pri) {
      groups[cat].sort((a, b) => {
        const ia = pri.indexOf(a['項目']); const ib = pri.indexOf(b['項目']);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
    const items = groups[cat].map(r => {
      const upd = r['更新日時']
        ? `<span class="kv-upd">（${esc(formatDate(r['更新日時']))}更新）</span>`
        : '';
      return `<div class="kv"><div class="kv-key">${esc(r['項目'])}${upd}</div><div class="kv-val">${esc(r['内容'])}</div></div>`;
    }).join('');
    return `<div class="status-group"><h3 class="status-cat">${esc(cat)}</h3>${items}</div>`;
  }).join('');
}

function renderSchedule(rows) {
  const box = document.getElementById('scheduleBody');
  if (!rows.length) { box.innerHTML = '<p class="empty">予定はまだありません。</p>'; return; }
  const sorted = [...rows].sort((a, b) => String(b['日付']).localeCompare(String(a['日付'])));
  box.innerHTML = sorted.map(r =>
    `<div class="event">
      <div class="event-date">${esc(formatDate(r['日付']))}</div>
      <div class="event-body">
        <div class="event-title">${esc(r['タイトル'])}${r['種別'] ? `<span class="event-kind">${esc(r['種別'])}</span>` : ''}</div>
        ${r['詳細'] ? `<div class="event-detail">${esc(r['詳細'])}</div>` : ''}
      </div>
    </div>`
  ).join('');
}

function renderLab(rows) {
  const box = document.getElementById('labTable');
  if (!rows.length) { box.innerHTML = '<p class="empty">採血結果はまだありません。</p>'; return; }
  const sorted = [...rows].sort((a, b) => String(a['採血日']).localeCompare(String(b['採血日'])));
  const recent = [...sorted].reverse();
  box.innerHTML =
    '<table><thead><tr><th>採血日</th><th>白血球数（WBC）</th><th>好中球（NEUT）</th><th>血小板数（PLT）</th><th>ヘモグロビン（Hb）</th><th>炎症反応（CRP）</th><th>芽球（%）</th></tr></thead><tbody>' +
    recent.map(r => {
      // 芽球は測った日だけ。未測定は「—」（0と区別する）。
      // 列名に空白や全角/半角のゆれがあっても拾えるよう「芽球」を含む列を探す
      const blastKey = Object.keys(r).find(k => k.includes('芽球'));
      const blast = blastKey ? r[blastKey] : '';
      const blastCell = (blast === '' || blast == null) ? '—' : esc(blast);
      return `<tr><td>${esc(formatDate(r['採血日']))}</td><td>${esc(r['白血球数（WBC）'])}</td><td>${esc(r['好中球（NEUT）'] ?? '—')}</td><td>${esc(r['血小板数（PLT）'])}</td><td>${esc(r['ヘモグロビン（Hb / HGB）'])}</td><td>${esc(r['炎症反応（CRP）'] ?? '—')}</td><td>${blastCell}</td></tr>`;
    }).join('') +
    '</tbody></table>';
  drawChart(sorted);
}

let chartInstance = null;
function drawChart(sorted) {
  const ctx = document.getElementById('labChart');
  if (!ctx || typeof Chart === 'undefined') return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(r => formatDate(r['採血日'])),
      datasets: [
        { label: '白血球数（WBC）', data: sorted.map(r => num(r['白血球数（WBC）'])), borderColor: '#7caa6e', backgroundColor: '#7caa6e', tension: 0.3 },
        { label: 'ヘモグロビン（Hb）', data: sorted.map(r => num(r['ヘモグロビン（Hb / HGB）'])), borderColor: '#d9914a', backgroundColor: '#d9914a', tension: 0.3 },
        { label: '血小板数（PLT）', data: sorted.map(r => num(r['血小板数（PLT）'])), borderColor: '#5b8fb0', backgroundColor: '#5b8fb0', tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { font: { size: 11 } } } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderRules(rows) {
  const box = document.getElementById('rulesBody');
  if (!rows.length) { box.innerHTML = '<p class="empty">ルールはまだありません。</p>'; return; }
  box.innerHTML = rows.map(r => {
    const val = String(r['内容'] ?? '');
    const content = val.startsWith('http')
      ? `<a href="${esc(val)}" target="_blank" rel="noopener">${esc(val)}</a>`
      : esc(val);
    return `<div class="rule"><div class="rule-cat">${esc(r['カテゴリ'])}</div><div>${content}</div></div>`;
  }).join('');
}

/* 日付文字列 → "YYYY-MM-DD"（ログと写真の日付照合用） */
function ymdKey(v) {
  const m = String(v ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}` : '';
}

/* ログ用の状態（もっと見るで増やす現在の表示日数を保持） */
let logGroups = [];
let logPhotos = [];
let logShownCount = 0;

/* 同じ日の複数行を1日ぶんにまとめる。日グループは新しい日が先頭、
   日内は古い順（朝→夜）で上から読めるようにする。
   ※rows は新しい行が先（シートは新規を一番上に積む＝append/insertRowAfter(1)）。
     よって日内は reverse で古い順になる。ログ書き込みは必ず append を使うこと。 */
function groupLogByDay(rows) {
  const groups = [];
  const indexByKey = {};
  rows.forEach(r => {
    const key = ymdKey(r['日時']);
    if (indexByKey[key] == null) {
      indexByKey[key] = groups.length;
      groups.push({ key, date: r['日時'], entries: [] });
    }
    groups[indexByKey[key]].entries.push(r['内容']);
  });
  groups.forEach(g => g.entries.reverse());  // 日内を古い順（朝→夜）に
  return groups;
}

/* 1日ぶん（日付見出し＋複数の本文＋その日の写真1セット）を描画 */
function dayGroupHtml(group) {
  // その日の写真を番号順に並べて、その日の最後にまとめて1回だけ表示
  const dayPhotos = (logPhotos || [])
    .filter(p => ymdKey(p.date) === group.key)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const photoHtml = dayPhotos.length
    ? `<div class="log-photos">` + dayPhotos.map(p =>
        `<figure class="log-photo">` +
        `<img src="${esc(p.thumb)}" alt="${esc(p.caption || '')}" loading="lazy" data-full="${esc(p.full)}" data-caption="${esc(p.caption || '')}">` +
        (p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : '') +
        `</figure>`
      ).join('') + `</div>`
    : '';
  const entriesHtml = group.entries
    .map(c => `<p class="log-entry">${esc(c)}</p>`).join('');
  return `<div class="log-item"><span class="log-date">${esc(formatDateTime(group.date))}</span>${entriesHtml}${photoHtml}</div>`;
}

function renderLog(rows, photos) {
  const box = document.getElementById('logBody');
  if (!rows.length) { box.innerHTML = '<p class="empty">記録はまだありません。</p>'; return; }
  const sorted = [...rows].sort((a, b) => String(b['日時']).localeCompare(String(a['日時'])));
  logPhotos = photos || [];
  logGroups = groupLogByDay(sorted);  // 同じ日をまとめる
  logShownCount = LOG_PAGE_SIZE;       // 初期表示（日数）
  paintLog();
}

/* 現在の表示日数ぶんを描画し、続きがあれば「もっと見る」ボタンを出す */
function paintLog() {
  const box = document.getElementById('logBody');
  const shown = logGroups.slice(0, logShownCount);
  let html = shown.map(dayGroupHtml).join('');

  const remaining = logGroups.length - shown.length;
  if (remaining > 0) {
    html += `<button type="button" class="log-more" id="logMoreBtn">もっと見る（あと${remaining}日分）</button>`;
  }
  box.innerHTML = html;

  const moreBtn = document.getElementById('logMoreBtn');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      logShownCount += LOG_PAGE_SIZE;   // 次のぶんを追加
      paintLog();
    });
  }
  attachPhotoLightbox(box);
}

/* 写真サムネイルをタップ → 拡大表示（オーバーレイ） */
function attachPhotoLightbox(container) {
  container.querySelectorAll('.log-photo img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.dataset.full, img.dataset.caption));
  });
}

function openLightbox(src, caption) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.hidden = true;
    lb.addEventListener('click', () => { lb.hidden = true; });
    document.body.appendChild(lb);
  }
  lb.innerHTML =
    `<div class="lightbox-inner">` +
    `<img src="${esc(src)}" alt="${esc(caption || '')}">` +
    (caption ? `<p class="lightbox-cap">${esc(caption)}</p>` : '') +
    `</div>`;
  lb.hidden = false;
}

function renderLastUpdated(data) {
  // 全シートの「日時」「更新日時」から一番新しいものを探す。
  // → ログ・状態・採血・スケジュール・ルールのどこを更新しても自動で最終更新に反映される。
  const stamps = [];
  (data.log || []).forEach(r => stamps.push(r['日時']));
  ['status', 'schedule', 'labResults', 'rules'].forEach(key =>
    (data[key] || []).forEach(r => stamps.push(r['更新日時']))
  );
  let best = null;
  stamps.forEach(v => {
    const m = String(v ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!m) return;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    if (!best || d > best.d) best = { d, v };
  });
  if (best) {
    document.getElementById('lastUpdated').textContent = '最終更新：' + formatDateTime(best.v);
  }
}

/* ===== 補助 ===== */
function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

function formatDate(v) {
  if (!v) return '';
  const m = String(v).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${parseInt(m[2])}/${parseInt(m[3])}` : String(v);
}

function formatDateTime(v) {
  if (!v) return '';
  const m = String(v).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日` : String(v);
}
