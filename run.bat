@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoLogo -NoExit -File "%~dp0run.ps1"
