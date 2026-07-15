# UberEats⁶ Twitch 個人網站

## 本機預覽
直接雙擊 `index.html` 即可開啟。

## 放到 GitHub Pages
1. 在 GitHub 建立新的 repository。
2. 將這個資料夾內的所有檔案上傳到 repository 根目錄。
3. 進入 Settings → Pages。
4. Source 選擇 Deploy from a branch。
5. Branch 選擇 main，資料夾選 /root。
6. 儲存並等待 GitHub 產生網址。

## 修改內容
- 主要文字與網址：`index.html`
- 顏色、排版與動畫：`style.css`
- 尖峰 SR-光固定展示效果：`style.css`
- 圖片：`assets/`

注意：目前採用固定車輛展示，不會隨著捲動旋轉；保留輕微懸浮與藍色光影效果。

## 這一版更新
- 首頁改用新的尖峰 SR-光封面圖。
- CONNECTIONS 區塊採 4/3/2/1 欄響應式排版。
- 每張人物卡片加入可自行修改的簡介文字。
- Bucky 不顯示任何空白按鈕。

- 修正首頁 Hero 區塊對齊，避免網站名稱與車輛封面互相重疊。

- 修正 UberEats⁶ 上標 6 的位置，避免壓到字尾。
- 放大首頁車圖，重新調整左 40% / 右 60% 的視覺比例。

- UberEats⁶ 改為單一 SVG 字標，避免上標 6 與字尾重疊。
- 右側車圖區改為與左側內容同高，底部對齊 TikTok 按鈕，並放大車輛顯示。

- 修正 UberEats⁶ 的 6 與字標距離。
- 把右側車圖區往上收，讓底部更接近左側 TikTok 按鈕高度。
- 把 FEATURED KART 資訊框往下拉近圖片，縮小上方空白。

- 再次修正 SVG 上標 6 的位置，避免壓到 UberEats 字樣。
- 將尖峰 SR-光資訊框與車輛圖片分離，資訊框固定在圖片上方並保留間距。
- 調整車圖高度，使底部更接近左側 TikTok 按鈕高度。

- 將四個社群按鈕的文字符號改成 Twitch、Discord、YouTube、TikTok 的本機 SVG 圖示。

- 縮短首頁底部與滾動提示周圍的留白。
- Discord 區塊往上靠近首頁。
- CONNECTIONS 區塊往上靠近 Discord，縮短區塊間距。

- 最上方導覽列改成與下方主內容相同的寬度基準，左右對齊。
- SCROLL TO EXPLORE 往下移，避免太靠近上方圖片。

- 新增 CONNECTIONS 成員 Nick。
- 人物順序改為 Alefeae、Lia、Bucky、Nick。
- SCROLL TO EXPLORE 再往下移一點。

- Nick 新增 Website 按鈕：https://portfolio.niku-aws.com/

- FEATURED KART 改成自動輪播：尖峰 SR-光 → 舒適 SRX-9。
- 預設每 5 秒切換，可在 `script.js` 修改 `KART_INTERVAL_MS`。
- 滑鼠移到車圖或鍵盤聚焦時會暫停輪播。
- 人物頭像建議使用 512×512 px 正方形圖片，至少 256×256 px；人物主體置中並保留邊距。

- 人物卡片底部改為統一資訊列樣式。
- 外部連結箭頭改成分享圖示。
- Bucky 新增 No public link 狀態列，避免卡片底部留白。

- 外部連結圖示改為鏈結（chain link）風格。

- 底部外部連結按鈕文字統一改為 Link。
- 放大按鈕文字與鏈結圖示。

- 縮小人物卡片底部 Link 按鈕寬度。
- 放大 Link 文字與鏈結圖示。

- Alefeae 的 Link 按鈕改為與其他卡片一致的藍色。

- 新增 Twitch 狀態區塊（目前為靜態版本，預留 Twitch API 串接）。
- 新增 Current Games：跑跑卡丁車、SpiritVale。
- 新增 Latest Highlights：YouTube、TikTok 入口卡片。
- 車輛詳細資料頁保留為日後獨立頁面。


## Current Games 更新方式
`Current Games` 現在會自動讀取根目錄的 `games.json`。日後換遊戲時，只要修改這個檔案，不需要改 `index.html`。

每筆資料格式：
```json
{
  "name": "遊戲名稱",
  "tag": "小標題",
  "description": "簡短介紹",
  "image": "assets/圖片檔名.jpg",
  "accent": "kart"
}
```

注意：瀏覽器直接雙擊 `index.html` 時，可能會阻擋 `fetch()` 讀取 JSON。上傳 GitHub Pages 後會正常運作；本機預覽可使用 VS Code Live Server。

- TikTok 連結更新為 @taxi_kartrider。
- Twitch Status 使用新的 Twitch 橫幅背景。
- SCROLL TO EXPLORE 與 Twitch Status 增加間距。

- 導覽列左側改為 Twitch Logo + UberEats⁶ + SPEED · FOCUS · WIN 組合。
- Twitch Status 區塊再往下移，增加與 SCROLL TO EXPLORE 的間距。


## FEATURED KART 圖片清單
首頁車輛輪播現在由 `karts.json` 自動產生，圖片放在 `assets/karts/`。

新增車輛時：
1. 把圖片放進 `assets/karts/`。
2. 在 `karts.json` 新增一筆資料。

範例：
```json
{
  "name": "新車名稱",
  "image": "assets/karts/new-kart.jpg",
  "alt": "新車名稱封面圖"
}
```

刪除車輛時，只要移除 `karts.json` 對應項目即可。輪播順序就是 JSON 內的排列順序。
`KART_INTERVAL_MS` 位於 `script.js`，目前為 5000 毫秒。

由於網站使用 `fetch()` 讀取 JSON，請透過 GitHub Pages 或 VS Code Live Server 預覽；部分瀏覽器直接雙擊 `index.html` 會阻擋 JSON 載入。
