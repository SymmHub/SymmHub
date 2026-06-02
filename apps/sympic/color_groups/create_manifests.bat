@echo off
setlocal enableextensions
cd /d "%~dp0"

echo Copying generated subgroups from GAP...
rem 
xcopy /y /s /i "..\gap\sub\*" ".\"

echo Generating manifests...
node generate_manifests.js

pause
