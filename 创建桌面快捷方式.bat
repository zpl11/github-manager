@echo off
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $lnk = $ws.CreateShortcut((Join-Path $d 'GitHub仓库管理器.lnk')); $lnk.TargetPath = '%~dp0启动GitHub管理器.bat'; $lnk.WorkingDirectory = '%~dp0'; $lnk.Description = 'GitHub 仓库桌面管理器'; $lnk.IconLocation = 'shell32.dll,13'; $lnk.Save(); Write-Host '>>> 桌面快捷方式已成功创建：[GitHub仓库管理器.lnk]' -ForegroundColor Green"
timeout /t 3
