/* Bahamut (動畫瘋) Cookie Pusher — popup 邏輯
   讀 cookie 兩段式：
     1) chrome.cookies（無聲、無提示列）— 部分環境可直接拿到。
     2) 拿不到 HttpOnly 的 BAHARUNE 時，自動改用偵錯介面 (CDP Storage.getCookies)，
        這條不受 host 權限那套限制，一定讀得到 HttpOnly cookie（會閃一下偵錯提示列）。
   組成 jar 後 POST 到設定的後台（帶授權 header）。另含手動貼 cookie 備援。 */

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
const hasBaharune = (jar) => !!jar.BAHARUNE && String(jar.BAHARUNE).includes('.');
const isGamerDomain = (domain) => {
  const d = (domain || '').replace(/^\./, '');
  return d === 'gamer.com.tw' || d.endsWith('.gamer.com.tw');
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
async function ensureBackendPermission(baseUrl) {
  const origin = originPattern(baseUrl);
  if (!origin) throw new Error('後台網址格式不對（需含 https://）');
  // 已授權 → resolve(true) 不跳窗；未授權 → 跳窗（須在 user gesture 內，故 saveSettings 會先要）
  const granted = await chrome.permissions.request({ origins: [origin] });
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

// ── 讀 cookie：方法 1，chrome.cookies（無聲）──────────────────────
async function collectViaCookiesApi() {
  const jar = {};
  let stores = [{ id: undefined }];
  try {
    const all = await chrome.cookies.getAllCookieStores();
    if (all?.length) stores = all;
  } catch {
    /* ignore */
  }
  const queries = [{ domain: 'gamer.com.tw' }, ...GAMER_URLS.map((url) => ({ url }))];
  for (const store of stores) {
    for (const q of queries) {
      const params = store.id ? { ...q, storeId: store.id } : { ...q };
      try {
        const cookies = await chrome.cookies.getAll(params);
        for (const c of cookies) jar[c.name] = c.value;
      } catch {
        /* ignore */
      }
    }
  }
  return jar;
}

// ── 讀 cookie：方法 2，偵錯介面 CDP（一定拿得到 HttpOnly）──────────
async function collectViaDebugger() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('找不到作用中分頁');
  const target = { tabId: tab.id };
  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (e) {
    const msg = String(e?.message || e);
    if (/already attached|Another debugger/i.test(msg)) {
      throw new Error('該分頁已開著 DevTools(F12)。請先關閉 DevTools 再按一次。');
    }
    throw new Error('無法附加偵錯介面：' + msg);
  }
  try {
    let cookies = [];
    try {
      cookies = (await chrome.debugger.sendCommand(target, 'Storage.getCookies', {}))?.cookies || [];
    } catch {
      cookies = (await chrome.debugger.sendCommand(target, 'Network.getAllCookies', {}))?.cookies || [];
    }
    const jar = {};
    for (const c of cookies) if (isGamerDomain(c.domain)) jar[c.name] = c.value;
    return jar;
  } finally {
    try {
      await chrome.debugger.detach(target);
    } catch {
      /* ignore */
    }
  }
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
  const s = await loadSettings();
  if (!requireConfigured(s)) return;

  setStatus('讀取 cookie…');
  let jar = await collectViaCookiesApi(); // 先試無聲的
  if (!hasBaharune(jar)) {
    setStatus('改用偵錯介面讀取（會閃一下偵錯提示列，正常）…');
    try {
      jar = await collectViaDebugger();
    } catch (e) {
      return setStatus(`讀取失敗：${e.message}`, 'err');
    }
  }
  if (!hasBaharune(jar)) {
    return setStatus('還是沒抓到 BAHARUNE — 請確認此瀏覽器（一般視窗）已登入動畫瘋。', 'err');
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
