/* おかん、ファイティング！ — フロントエンド */

/* ▼▼ GAS をデプロイして発行された Web App URL をここに貼る ▼▼ */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbx6JyFkScT1j4QY13L2Sf21cIiAw5dsrzfieURiH_10D1sxpVjIoK4Hnx_T6gzPy9a5/exec';
/* ▲▲ 例: https://script.google.com/macros/s/XXXXXXXX/exec ▲▲ */

const AUTH_KEY = 'okan_ganbare_auth';
const AUTH_DAYS = 30;

const PLACEHOLDER_URL = 'PASTE_YOUR_GAS_WEB_APP_URL_HERE';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', onLogin);
  document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') onLogin();
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // GAS 未接続ならサンプルデータでプレビュー表示
  if (GAS_URL === PLACEHOLDER_URL && window.SAMPLE_DATA) {
    showPreview(window.SAMPLE_DATA);
    return;
  }

  const saved = getSavedAuth();
  if (saved) loadData(saved);
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
  location.reload();
}

function onLogin() {
  const pw = document.getElementById('password').value.trim();
  if (!pw) return;
  loadData(pw, true);
}

/* ===== データ取得 ===== */
async function loadData(password, fromLogin) {
  const errEl = document.getElementById('loginError');
  if (fromLogin) errEl.textContent = '読み込み中...';
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getData', password }),
    });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'auth') {
        errEl.textContent = '合言葉が違うようです。';
        localStorage.removeItem(AUTH_KEY);
      } else {
        errEl.textContent = 'エラー: ' + (data.error || '不明');
      }
      return;
    }
    saveAuth(password);
    render(data);
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
  } catch (e) {
    errEl.textContent = '接続できませんでした。通信環境を確認してください。';
  }
}

/* ===== 描画 ===== */
function render(data) {
  renderStatus(data.status || []);
  renderSchedule(data.schedule || []);
  renderLab(data.labResults || []);
  renderRules(data.rules || []);
  renderLog(data.log || []);
  renderLastUpdated(data.log || []);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function renderStatus(rows) {
  const box = document.getElementById('statusBody');
  if (!rows.length) { box.innerHTML = '<p class="empty">まだ情報がありません。</p>'; return; }
  box.innerHTML = rows.map(r =>
    `<div class="kv"><div class="kv-key">${esc(r['項目'])}</div><div class="kv-val">${esc(r['内容'])}</div></div>`
  ).join('');
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
    '<table><thead><tr><th>採血日</th><th>白血球数（WBC）</th><th>好中球（NEUT）</th><th>血小板数（PLT）</th><th>ヘモグロビン（Hb）</th><th>炎症反応（CRP）</th></tr></thead><tbody>' +
    recent.map(r =>
      `<tr><td>${esc(formatDate(r['採血日']))}</td><td>${esc(r['白血球数（WBC）'])}</td><td>${esc(r['好中球（NEUT）'] ?? '—')}</td><td>${esc(r['血小板数（PLT）'])}</td><td>${esc(r['ヘモグロビン（Hb / HGB）'])}</td><td>${esc(r['炎症反応（CRP）'] ?? '—')}</td></tr>`
    ).join('') +
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

function renderLog(rows) {
  const box = document.getElementById('logBody');
  if (!rows.length) { box.innerHTML = '<p class="empty">記録はまだありません。</p>'; return; }
  const sorted = [...rows].sort((a, b) => String(b['日時']).localeCompare(String(a['日時'])));
  const recent = sorted.slice(0, 30);
  box.innerHTML = recent.map(r =>
    `<div class="log-item"><span class="log-date">${esc(formatDateTime(r['日時']))}</span>　${esc(r['内容'])}</div>`
  ).join('');
}

function renderLastUpdated(log) {
  if (!log.length) return;
  const last = log[log.length - 1];
  document.getElementById('lastUpdated').textContent = '最終更新：' + formatDateTime(last['日時']);
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
