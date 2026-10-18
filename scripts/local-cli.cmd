@echo off
rem Local launcher only. Use npm run cli:enable to prepare .local-bin on this terminal's PATH.
node "%~dp0..\dist\cli\index.js" %*
