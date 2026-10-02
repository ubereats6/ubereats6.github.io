# v20 打包

`npm ci` 後執行 `npx electron-builder --win --dir --x64`，產生 `dist/win-unpacked`。

用 NSIS 3 的 makensis 打包保留解壓內容的單檔啟動器（將 APP_DIR、ICON_FILE、OUTPUT_EXE 改為絕對路徑）：

```powershell
makensis /DAPP_DIR="C:\project\aniimo-map-hud\dist\win-unpacked" /DICON_FILE="C:\project\aniimo-map-hud\icon.ico" /DOUTPUT_EXE="C:\project\AniimoEggMapHUD-v20.exe" portable-launcher.nsi
```

這個啟動器僅首次解壓到使用者 LocalAppData 的 AniimoEggMapHUD/app-v20。之後沿用該資料夾。一般 electron-builder portable 目標仍可用，但不會沿用此快取啟動器。

本版 EXE 的啟動時間尚待 Windows 實機確認。不要把 NSIS installer 或一般 portable 產物重新命名後當作本啟動器。
