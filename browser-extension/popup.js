/* Bahamut (動畫瘋) Cookie Pusher — popup 邏輯
   - host 權限走 optional + 執行期請求：按「抓取」時跳權限視窗，授權後 chrome.cookies 才給 HttpOnly 的 BAHARUNE。
   - collectJar 跨所有 cookie store（含無痕）、多種查法。
   - 另含「手動貼 cookie 字串」備援（POST {cookie}）。 */

const DEFAULTS = {
  baseUrl: '',
  pushPath: '/api/admin/bahamut/cookie',
  statusPath: '/api/admin/bahamut/status',
  headerName: 'X-Bahamut-Token',
  token: '',
};
const SETTING_KEYS = Object.keys(DEFAULTS);
const GAMER_URLS = [
  'https://ani.gamer.com.tw/',
  'https://api.gamer.com.tw/',
  'https://www.gamer.com.tw/',
];
const GAMER_ORIGINS = ['https://*.gamer.com.tw/*', 'https://gamer.com.tw/*'];

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const setStatus = (msg, kind = '') => {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
};

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTING_KEYS);
  const s = { ...DEFAULTS, ...stored };
  for (const k of SETTING_KEYS) if ($(k)) $(k).value = s[k];
  return s;
}
function normalizeSettings() {
  return {
    baseUrl: ($('baseUrl').value || '').trim().replace(/\/+$/, ''),
    pushPath: ($('pushPath').value || DEFAULTS.pushPath).trim(),
    statusPath: ($('statusPath').value || DEFAULTS.statusPath).trim(),
    headerName: ($('headerName').value || DEFAULTS.headerName).trim(),
    token: $('token').value.trim(),
  };
}
function originPattern(url) {
  try {
    return `${new URL(url).origin}/*`;
  } catch {
    return null;
  }
}

// 直接 request：已授權的話會立刻 resolve(true) 不跳窗、也不需 gesture；
// 未授權則跳窗（必須在 user gesture 的同步段呼叫，所以別在它前面 await）。
async function requestOrigins(origins) {
  return chrome.permissions.request({ origins });
}

async function ensureBackendPermission(baseUrl) {
  const origin = originPattern(baseUrl);
  if (!origin) throw new Error('後台網址格式不對（需含 https://）');
  const granted = await requestOrigins([origin]);
  if (!granted) throw new Error('未授權存取後台網域');
}

async function saveSettings() {
  const s = normalizeSettings();
  if (!s.baseUrl) return setStatus('請先填後台網址。', 'err');
  try {
    await ensureBackendPermission(s.baseUrl);
  } catch (e) {
    return setStatus(e.message, 'err');
  }
  await chrome.storage.local.set(s);
  setStatus('設定已儲存。', 'ok');
}

async function collectJar() {
  const jar = {};
  let stores = [{ id: undefined }];
  try {
    const all = await chrome.cookies.getAllCookieStores();
    if (all?.length) stores = all;
  } catch {
    /* 取不到就用預設 store */
  }
  const queries = [{ domain: 'gamer.com.tw' }, ...GAMER_URLS.map((url) => ({ url }))];
  for (const store of stores) {
    for (const q of queries) {
      const params = store.id ? { ...q, storeId: store.id } : { ...q };
      try {
        const cookies = await chrome.cookies.getAll(params);
        for (const c of cookies) jar[c.name] = c.value;
      } catch {
        /* 某個 store/query 沒權限就跳過 */
      }
    }
  }
  return jar;
}

function requireConfigured(s) {
  if (!s.baseUrl) { setStatus('還沒設定後台網址（展開「設定」）。', 'err'); return false; }
  if (!s.token) { setStatus('還沒設定 token（展開「設定」）。', 'err'); return false; }
  return true;
}

async function postPayload(s, payload) {
  await ensureBackendPermission(s.baseUrl);
  setStatus('推送到後台並重跑同步…');
  const res = await fetch(s.baseUrl + s.pushPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [s.headerName]: s.token },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const missing = data.missing ? `（缺 ${data.missing.join(', ')}）` : '';
    return setStatus(`失敗：${data.message || res.status} ${missing}`, 'err');
  }
  const days = data.daysLeft != null ? `，cookie 剩 ${data.daysLeft} 天` : '';
  const sync = data.sync || {};
  let syncMsg;
  if (sync.deadSession) syncMsg = '⚠️ 但同步仍回 NO_LOGIN，cookie 可能無效';
  else if (sync.ok) syncMsg = `同步成功，新增 ${sync.newEntries ?? 0} 筆`;
  else syncMsg = '已套用（同步未回報成功）';
  setStatus(`✅ cookie 已更新${days}\n${syncMsg}`, sync.deadSession ? 'err' : 'ok');
}

async function push() {
  // 第一個 await 必須是權限請求（保住 user gesture），否則讀不到 HttpOnly 的 BAHARUNE
  let granted;
  try {
    granted = await requestOrigins(GAMER_ORIGINS);
  } catch (e) {
    return setStatus('權限請求失敗：' + e.message, 'err');
  }
  if (!granted) {
    return setStatus('未授權讀取 gamer.com.tw cookie。請在彈出的權限視窗按「允許」後再試。', 'err');
  }

  const s = await loadSettings();
  if (!requireConfigured(s)) return;

  setStatus('讀取 cookie…');
  const jar = await collectJar();
  if (!jar.BAHARUNE || !String(jar.BAHARUNE).includes('.')) {
    const names = Object.keys(jar);
    const diag =
      names.length === 0
        ? '讀到 0 個 cookie → 權限沒生效（剛剛的權限視窗請按「允許」）。'
        : `讀到 ${names.length} 個 cookie，但沒 HttpOnly 的 BAHARUNE。→ 改用下方「進階：手動貼 cookie」最保險。`;
    return setStatus(`沒抓到有效的 BAHARUNE。\n${diag}`, 'err');
  }

  try {
    await postPayload(s, { jar });
  } catch (e) {
    setStatus(`連線失敗：${e.message}`, 'err');
  }
}

async function pushManual() {
  const s = await loadSettings();
  if (!requireConfigured(s)) return;
  const raw = $('manualCookie').value.trim();
  if (!raw || !/BAHARUNE=[^;]+\.[^;]+/.test(raw)) {
    return setStatus('貼上的字串裡找不到有效的 BAHARUNE=…（JWT 形式）。', 'err');
  }
  try {
    await postPayload(s, { cookie: raw });
  } catch (e) {
    setStatus(`連線失敗：${e.message}`, 'err');
  }
}

async function checkStatus() {
  const s = await loadSettings();
  if (!requireConfigured(s)) return;
  try {
    await ensureBackendPermission(s.baseUrl);
    setStatus('查詢後台目前 cookie 狀態…');
    const res = await fetch(s.baseUrl + s.statusPath, { headers: { [s.headerName]: s.token } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setStatus(`查詢失敗：${data.message || res.status}`, 'err');
    if (!data.ok) return setStatus(`後台 cookie 不完整（缺 ${(data.missing || []).join(', ')}）`, 'err');
    const days = data.daysLeft != null ? `剩 ${data.daysLeft} 天到期` : '無 JWT 資訊';
    setStatus(`後台目前 cookie：有效，${days}。`, 'ok');
  } catch (e) {
    setStatus(`連線失敗：${e.message}`, 'err');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const s = await loadSettings();
  if (!s.baseUrl || !s.token) $('settings').open = true;
});
$('push').addEventListener('click', push);
$('check').addEventListener('click', checkStatus);
$('save').addEventListener('click', saveSettings);
$('pushManual').addEventListener('click', pushManual);
