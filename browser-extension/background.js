/* service worker：把 content script 的 scrobble 轉發到後台 /api/admin/watch/now
   設定沿用 popup 存在 chrome.storage 的那組（baseUrl / headerName / token）。 */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'bahamut-scrobble') forwardScrobble(msg.payload);
  return false; // 不保持 channel，避免 "message channel closed" 警告
});

async function forwardScrobble(payload) {
  const { baseUrl, headerName, token } = await chrome.storage.local.get(['baseUrl', 'headerName', 'token']);
  if (!baseUrl || !token) return; // 還沒設定 → 略過
  try {
    await fetch(baseUrl.replace(/\/+$/, '') + '/api/admin/watch/now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName || 'X-Bahamut-Token']: token },
      body: JSON.stringify(payload),
    });
  } catch {
    /* 離線 / 後台網域權限未授 → 略過,下個 heartbeat 再試 */
  }
}
