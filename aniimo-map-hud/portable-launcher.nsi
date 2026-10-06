Unicode true
!include "FileFunc.nsh"
!ifndef APP_DIR
 !error "Provide APP_DIR containing the complete Electron Windows app"
!endif
!ifndef OUTPUT_EXE
 !define OUTPUT_EXE "AniimoEggMapHUD-v21-admin-test.exe"
!endif
Name "Aniimo Egg Map HUD"
OutFile "${OUTPUT_EXE}"
Icon "${ICON_FILE}"
RequestExecutionLevel admin
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow
Caption "正在啟動搶蛋地圖輔助"
Page instfiles
SetCompressor zlib
SetOverwrite on
Var AppPath
Var Args
Function .onInit
 SetShellVarContext current
 StrCpy $AppPath "$LOCALAPPDATA\AniimoEggMapHUD\app-v21-admin-test"
 IfFileExists "$AppPath\ready.txt" initialized
 SetSilent normal
initialized:
 ${GetParameters} $Args
 System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\AniimoEggMapHUD-v21-admin-test-Prepare") p .r0 ?e'
 Pop $1
 StrCmp $1 183 0 +2
 Quit
FunctionEnd
Section
 IfFileExists "$AppPath\ready.txt" ready
 SetOutPath "$AppPath"
 ClearErrors
 DetailPrint "首次啟動：正在準備程式，完成後會自動開啟。"
 File /r "${APP_DIR}/*"
 IfErrors failed
 FileOpen $0 "$AppPath\ready.txt" w
 FileWrite $0 "v21-admin-test"
 FileClose $0
ready:
 SetOutPath "$AppPath"
 Exec '"$AppPath\Aniimo Egg Map HUD.exe" $Args'
 IfErrors failed finished
failed:
 MessageBox MB_ICONSTOP "Unable to start Aniimo Egg Map HUD. Please download the EXE again."
finished:
SectionEnd
