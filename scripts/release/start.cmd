@echo off
setlocal
cd /d "%~dp0"

if not exist config.json copy /Y config-vanilla.json config.json >nul

node.exe publicExportUpdater.mjs --auto
node.exe --enable-source-maps build\src\index.js %*
