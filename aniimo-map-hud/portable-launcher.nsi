Unicode true
!include "FileFunc.nsh"
!ifndef APP_DIR
 !error "Provide APP_DIR containing the complete Electron Windows app"
!endif
!ifndef OUTPUT_EXE
 !define OUTPUT_EXE "AniimoEggMapHUD-v16.exe"
!endif
Name "Aniimo Egg Map HUD"
OutFile "${OUTPUT_EXE}"
Icon "${APP_DIR}/resources/app/icon.ico"
RequestExecutionLevel user
SilentInstall silent
SetCompressor /SOLID lzma
SetCompressorDictSize 32
SetOverwrite on
Var AppPath
Var Args
Function .onInit
 SetShellVarContext current
 StrCpy $AppPath "$LOCALAPPDATA\AniimoEggMapHUD\app-v16-layout2"
 ${GetParameters} $Args
 System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\AniimoEggMapHUD-v16-layout2-Prepare") p .r0 ?e'
 Pop $1
 StrCmp $1 183 0 +2
 Quit
FunctionEnd
Section
 IfFileExists "$AppPath\ready.txt" ready
 SetOutPath "$AppPath"
 File /r "${APP_DIR}/*"
 FileOpen $0 "$AppPath\ready.txt" w
 FileWrite $0 "v16-layout2"
 FileClose $0
ready:
 SetOutPath "$AppPath"
 Exec '"$AppPath\AniimoEggMapHUD-Egg.exe" $Args'
 IfErrors failed finished
failed:
 MessageBox MB_ICONSTOP "Unable to start Aniimo Egg Map HUD. Please download the EXE again."
finished:
SectionEnd
