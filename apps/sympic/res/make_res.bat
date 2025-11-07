set FOLDER=%1
set FILE=%2
echo export const resources=`>%FILE%
dir /b %FOLDER% >> %FILE%
echo `; >> %FILE%
