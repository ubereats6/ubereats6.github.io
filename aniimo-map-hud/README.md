# 伊莫搶蛋地圖 HUD（Windows）

這個獨立小視窗可以自行擷取單張遊戲地圖畫面、框選地圖路徑、比對四張候選地圖，選定後半透明置頂供遊戲中對照；也能接收網站選定的地圖。它不讀取遊戲程序，也不持續擷取畫面。候選比對使用內附的 31 張地圖輪廓資料；完整標記地圖從 `https://ubereats6.github.io/egg-map/maps/編號.jpg` 載入，因此顯示完整地圖時需要網路。

## 建置並使用

1. 將此 `aniimo-map-hud/` 資料夾與 `.github/workflows/build-aniimo-map-hud.yml` 上傳至 `ubereats6.github.io` 儲存庫根目錄。
2. 到 GitHub **Actions** 手動執行 **Build Aniimo Egg Map HUD (Windows)**。完成後下載 `AniimoEggMapHUD-Windows-Setup` artifact，解壓後執行其中的安裝檔。使用者不必安裝 Node.js。
3. 首次啟動 HUD，讓 Windows 註冊 `aniimo-egg-map://` 連結。按 **擷取辨識**，選遊戲視窗或螢幕，再框選地圖路徑；放開滑鼠後等待四個候選結果，點選其中一張即可顯示在 HUD。也可以開啟既有截圖檔。系統匣選單亦可打開辨識視窗。
4. 原本的網頁操作保留：在網站比對後點候選地圖，再按 **浮在遊戲上**，允許瀏覽器開啟 HUD。
5. 拖曳上方標題移動，拖曳右下角調整視窗尺寸，滑桿調透明度；按 **鎖定 F8** 後滑鼠會穿透 HUD。`F8` 調整／鎖定，`F9` 隱藏／顯示。若按鍵與其他軟體衝突，仍可用 `Ctrl+Shift+M`、`Ctrl+Shift+J`，系統匣圖示雙擊也能解除鎖定。

網站新增 `maps/32.jpg` 等編號時，HUD 可以從網頁連結直接顯示新地圖；若要讓 HUD 本身的辨識也能找出新地圖，必須更新 `features.json` 與內嵌於 `matcher-worker.js` 的輪廓資料後重新建置。瀏覽器連結只傳數字編號，HUD 不接受其他網址。

部分遊戲在「獨佔全螢幕」模式會蓋過桌面置頂視窗，或無法由桌面擷取取得畫面；可改用無邊框視窗或一般視窗模式。新加入的辨識視窗尚未在 Windows 遊戲環境實機驗證，請先測試擷取、候選比對與視窗疊加，再提供其他玩家下載。
