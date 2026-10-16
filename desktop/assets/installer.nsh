; Maintenance installer and uninstaller: check whether Maintenance is running WITHOUT PowerShell.
;
; electron-builder's default check starts powershell.exe (Get-CimInstance Win32_Process). Business
; antivirus such as eScan blocks PowerShell started by an installer and shows "PowerShell Blocked".
; For a per-user install, tasklist and taskkill do the same job (electron-builder's own fallback).
; electron-builder picks this file up as assets/installer.nsh (directories.buildResources).

!macro MX_FIND_APP _RETURN
  nsExec::Exec `"$CmdPath" /C tasklist /FI "USERNAME eq %USERNAME%" /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop ${_RETURN}
!macroend

!macro customCheckAppRunning
  !insertmacro MX_FIND_APP $R0
  ${if} $R0 == 0
    ${if} ${isUpdated}
      ; An update: the app is already closing by itself.
      Sleep 1000
      Goto mx_stop
    ${endIf}
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK mx_stop
    Quit

    mx_stop:
    DetailPrint "$(appClosing)"
    nsExec::Exec `"$CmdPath" /C taskkill /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    Pop $R0
    Sleep 300
    StrCpy $R1 0

    mx_wait:
      IntOp $R1 $R1 + 1
      !insertmacro MX_FIND_APP $R0
      ${if} $R0 == 0
        Sleep 1000
        ${if} $R1 == 3
          nsExec::Exec `"$CmdPath" /C taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
          Pop $R0
        ${endIf}
        ${if} $R1 > 6
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY mx_wait
          Quit
        ${endIf}
        Goto mx_wait
      ${endIf}
  ${endIf}
!macroend
