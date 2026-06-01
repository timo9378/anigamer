/* Bahamut (動畫瘋) Cookie Pusher — popup 邏輯
   backend-agnostic：後台網址 / 路徑 / header 名 / token 全部可在設定裡改，不綁任何特定站。
   1. 讀目前瀏覽器對 *.gamer.com.tw 的 cookie（含 HttpOnly，靠 cookies 權限）
   2. 組成 jar 後 POST 到設定的後台（帶設定的授權 header）
   3. 後台熱套用 + 立刻重跑同步，回傳剩餘天數與新增筆數 */

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
  const s = {
    baseUrl: ($('baseUrl').value || '').trim().replace(/\/+$/, ''),
    pushPath: ($('pushPath').value || DEFAULTS.pushPath).trim(),
    statusPath: ($('statusPath').value || DEFAULTS.statusPath).trim(),
    headerName: ($('headerName').value || DEFAULTS.headerName).trim(),
    token: $('token').value.trim(),
  };
  return s;
}

/** Ask for host permission for the configured backend origin (MV3 optional perms). */
async function ensureHostPermission(baseUrl) {
  let origin;
  try {
    origin = `${new URL(baseUrl).origin}/*`;
  } catch {
    throw new Error('後台網址格式不對（需含 https://）');
  }
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (has) return;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error('未授權存取後台網域，無法推送');
}

async function saveSettings() {
  const s = normalizeSettings();
  if (!s.baseUrl) return setStatus('請先填後台網址。', 'err');
  try {
    await ensureHostPermission(s.baseUrl); // 需在 user gesture 內（save click）
  } catch (e) {
    return setStatus(e.message, 'err');
  }
  await chrome.storage.local.set(s);
  setStatus('設定已儲存。', 'ok');
}

async function collectJar() {
  const jar = {};
  // 跨所有 cookie store（含無痕，前提是擴充被允許在 InPrivate 執行）
  let stores = [{ id: undefined }];
  try {
    const all = await chrome.cookies.getAllCookieStores();
    if (all?.length) stores = all;
  } catch {
    /* 取不到就用預設 store */
  }
  // 用多種查法兜：domain 一次撈整個 gamer.com.tw（含子網域），url 再補
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

async function push() {
  const s = await loadSettings();
  if (!requireConfigured(s)) return;

  setStatus('讀取 cookie…');
  const jar = await collectJar();
  if (!jar.BAHARUNE || !String(jar.BAHARUNE).includes('.')) {
    const names = Object.keys(jar);
    const diag =
      names.length === 0
        ? '讀到 0 個 gamer cookie → 擴充沒拿到網站 cookie 權限（去 edge://extensions → 此擴充「詳細資料」→ 網站存取權設成「在所有網站上」，再重新載入擴充）。'
        : `讀到 ${names.length} 個 cookie：${names.join(', ')} → 有 cookie 但沒 BAHARUNE，代表這個 cookie store 沒登入（換成「有登入動畫瘋」的那個一般視窗再試）。`;
    return setStatus(`沒抓到有效的 BAHARUNE。\n${diag}`, 'err');
  }

  try {
    await ensureHostPermission(s.baseUrl);
    setStatus('推送到後台並重跑同步…');
    const res = await fetch(s.baseUrl + s.pushPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [s.headerName]: s.token },
      body: JSON.stringify({ jar }),
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
  } catch (e) {
    setStatus(`連線失敗：${e.message}`, 'err');
  }
}

async function checkStatus() {
  const s = await loadSettings();
  if (!requireConfigured(s)) return;
  try {
    await ensureHostPermission(s.baseUrl);
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
