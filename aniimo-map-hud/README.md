# 伊莫搶蛋地圖 HUD（Windows）

這個獨立小視窗會顯示網站選定的搶蛋地圖，半透明置頂供遊戲中對照。它只載入 `https://ubereats6.github.io/egg-map/maps/編號.jpg`，不讀取遊戲程序，也不擷取遊戲畫面。

## 建置並使用

1. 將此 `aniimo-map-hud/` 資料夾與 `.github/workflows/build-aniimo-map-hud.yml` 上傳至 `ubereats6.github.io` 儲存庫根目錄。
2. 到 GitHub **Actions** 手動執行 **Build Aniimo Egg Map HUD (Windows)**。完成後下載 `AniimoEggMapHUD-Windows-Setup` artifact，解壓後執行其中的安裝檔。使用者不必安裝 Node.js。
3. 首次啟動 HUD，讓 Windows 註冊 `aniimo-egg-map://` 連結。將 `egg-map/index.html`、`style.css`、`matcher.js` 更新到網站。
4. 在網站比對後點一張候選地圖，再按 **浮在遊戲上**。瀏覽器會詢問是否開啟 HUD；允許後地圖就會出現在浮窗。也可先開 HUD 再從網頁送地圖。
5. 拖曳上方標題移動，拖曳右下角調整視窗尺寸，滑桿調透明度；按 **完成・鎖定** 後滑鼠會穿透 HUD。`F8` 調整／鎖定，`F9` 隱藏／顯示。若按鍵與其他軟體衝突，仍可用 `Ctrl+Shift+M`、`Ctrl+Shift+J`，系統匣圖示雙擊也能解除鎖定。

網站新增 `maps/32.jpg` 等編號時，HUD 會直接從網站讀取新地圖，不需要重建程式。瀏覽器連結只傳數字編號，HUD 不接受其他網址。

部分遊戲在「獨佔全螢幕」模式會蓋過桌面置頂視窗；可改用無邊框視窗或一般視窗模式。此建置流程尚未在 Windows 實機驗證，請先在自己的電腦測試視窗疊加、快捷鍵與瀏覽器連結，再提供其他玩家下載。
