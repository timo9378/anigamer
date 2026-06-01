# Bahamut (動畫瘋) Cookie Pusher

一鍵把目前登入動畫瘋的 cookie 推到**你自己的 [anigamer](https://github.com/timo9378/anigamer)-based 後台**,熱更新觀看歷史同步——不用碰 env、不用重 build、不用重啟。

後台網址 / 路徑 / 授權 header 全部可在擴充設定裡改,**不綁任何特定站**,任何用 anigamer 做同步的人都能直接用。

## 為什麼需要擴充（而不是網頁按鈕 / bookmarklet）

動畫瘋的 `BAHARUNE` 是 **HttpOnly**,網頁 JS / bookmarklet 讀不到;只有瀏覽器擴充(`cookies` 權限)能讀。
擴充讀 `*.gamer.com.tw` 的 cookie → 組成 jar → POST 到你設定的後台(帶授權 header)→ 後端驗證、寫檔、熱抽換 SDK、立刻重跑同步。

## 後端需求

任何提供以下兩個 endpoint 的後台都能搭配——在你用 anigamer 做的 sync 服務加上這兩個 route 即可:

| 方法   | 路徑(可設定)                    | 授權                       | 行為 |
|--------|--------------------------------|----------------------------|------|
| `POST` | `/api/admin/bahamut/cookie`    | header `X-Bahamut-Token`   | body `{ jar: {name:value,…} }`,熱套用 + 觸發同步,回 `{ ok, daysLeft, sync }` |
| `GET`  | `/api/admin/bahamut/status`    | 同上                       | 回 `{ ok, daysLeft, missing }` |

> 後端用一次性 env `BAHAMUT_PUSH_TOKEN` 當授權(沒設則 fallback 需 admin JWT)。
> header 名與路徑都可在擴充設定改,對應你後端的實作即可。

## 安裝（Chrome / Edge）

1. `chrome://extensions` → 開「開發人員模式」。
2. 「載入未封裝項目」→ 選這個資料夾。
3. 釘選圖示。

## 設定（一次性）

點圖示 → 展開「設定」:
- **後台網址**:如 `https://your-host.example`(含 `https://`、不含路徑)。儲存時會跳一次權限請求,授權存取這個網域(透過 `optional_host_permissions`,所以 manifest 不寫死任何站)。
- **推送/狀態路徑**:預設 `/api/admin/bahamut/cookie`、`/api/admin/bahamut/status`,依後端調整。
- **授權 header 名稱**:預設 `X-Bahamut-Token`。
- **Token**:= 後端的 `BAHAMUT_PUSH_TOKEN`。
- 按「儲存設定」。

## 日常使用

1. 收到 Discord 告警(session 死)或想手動更新時:
2. 在**無痕視窗**登入 `ani.gamer.com.tw`(勾「保持登入狀態」)。
3. 在該分頁點擴充圖示 → 「**抓取並推送 cookie**」。
4. 看到 `✅ cookie 已更新,剩 N 天;同步成功,新增 X 筆` 即完成。

「檢查後台目前狀態」可不推送、只看後台這份 cookie 還剩幾天。

## 安全

- Token 等同後台寫入權限,只存在你瀏覽器的 `chrome.storage.local` 與後端 env,別外流。
- 擴充只把 cookie 送到你設定的後台網址,不送第三方;`host_permissions` 僅 `*.gamer.com.tw`(讀 cookie 用),後端網域走執行期授權。
- ⚠️ 共用帳號 + 自動化存取本身有(極低但非零的)動畫瘋封號風險,自行斟酌。

## 授權

MIT — 與 [anigamer](https://github.com/timo9378/anigamer) 一致。
