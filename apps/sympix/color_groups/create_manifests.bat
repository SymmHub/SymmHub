@echo off
setlocal enableextensions
cd /d "%~dp0"
set SRC=..\gap\sub
echo Copying generated subgroups from GAP...
rem xcopy /y /s /i "%SRC%\klm\*" .\klm\
rem xcopy /y /s /i "%SRC%\sklm\*" .\sklm\
rem 
xcopy /y /s /i "%SRC%\wallpaper\*" .\wallpaper\

echo Generating manifests...
node generate_manifests.js

pause
