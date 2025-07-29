set FOLDER=%1
set FILE=%2
echo export const presets=`>%FILE%
dir /b %FOLDER% >> %FILE%
echo `; >> %FILE%
