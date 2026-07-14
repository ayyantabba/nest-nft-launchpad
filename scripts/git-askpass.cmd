@echo off
echo %~1 | findstr /I "Username" >nul
if %errorlevel%==0 (
  echo ayyantabba
) else (
  echo %NEST_GITHUB_TOKEN%
)
