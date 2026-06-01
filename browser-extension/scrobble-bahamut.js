/* 動畫瘋即時觀看 scrobbler（content script，跑在 animeVideo.php）
   刻意只靠三個穩定訊號,不碰任何易碎的站內 selector:
     1) URL 的 ?sn=  → video_sn（後台用它反查 anime_history 補正規標題/封面/tmdb_id）
     2) <video> 的 paused / currentTime / duration → 播放狀態與進度
     3) document.title → 標題後備（只有 video_sn 還沒進 history 時才用得到）
   播放中每 30 秒送一次 heartbeat;結束/離開頁面送一次「停止」。 */
(() => {
  const HEARTBEAT_MS = 30000;
  let timer = null;

  const getVideoSn = () => new URLSearchParams(location.search).get('sn');

  const titleFallback = () => {
    const t = (document.title || '').replace(/\s*線上看\s*-\s*巴哈姆特動畫瘋\s*$/, '').trim();
    const ep = t.match(/\[([^\]]+)\]\s*$/);
    return { title: t.replace(/\s*\[[^\]]+\]\s*$/, '').trim() || t, episode: ep ? ep[1] : null };
  };

  // 取主影片：濾掉沒長度的（廣告/未載入）,優先正在播、再取時長最長的
  const pickVideo = () => {
    const vids = [...document.querySelectorAll('video')].filter((v) => v.duration > 0);
    if (!vids.length) return null;
    const playing = vids.filter((v) => !v.paused && !v.ended);
    return (playing.length ? playing : vids).sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
  };

  const send = (playing) => {
    const v = pickVideo();
    const { title, episode } = titleFallback();
    const progressPct = playing && v && v.duration > 0 ? (v.currentTime / v.duration) * 100 : null;
    try {
      chrome.runtime.sendMessage({
        type: 'bahamut-scrobble',
        payload: { playing, videoSn: getVideoSn(), title, episode, progressPct },
      });
    } catch {
      /* service worker 還沒起來,等下個 heartbeat */
    }
  };

  const ensureTimer = () => {
    if (timer) return;
    timer = setInterval(() => {
      const v = pickVideo();
      if (v && !v.paused && !v.ended) send(true); // 暫停時不送 → 後台 TTL 自然清
    }, HEARTBEAT_MS);
  };

  const stop = () => {
    if (timer) { clearInterval(timer); timer = null; }
    send(false);
  };

  // 用捕獲式事件代理:video 可能晚出現或被重建
  document.addEventListener('play', (e) => {
    if (e.target.tagName === 'VIDEO') { ensureTimer(); send(true); }
  }, true);
  document.addEventListener('ended', (e) => {
    if (e.target.tagName === 'VIDEO') stop();
  }, true);
  window.addEventListener('pagehide', stop);

  // 進頁面時已在播的情況（事件已錯過）
  setTimeout(() => {
    const v = pickVideo();
    if (v && !v.paused && !v.ended) { ensureTimer(); send(true); }
  }, 3000);
})();
