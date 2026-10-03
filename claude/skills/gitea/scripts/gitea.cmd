@echo off
rem Launcher for gitea.py from PowerShell and cmd.exe, which cannot run the sh
rem launcher beside it. Same probe: a Python 3.8+ that actually runs, since on
rem Windows `python3` is often the Microsoft Store stub.
setlocal
set "PY="
for %%P in (python3 python py) do if not defined PY %%P -c "import sys; sys.exit(sys.version_info < (3, 8))" >nul 2>&1 && set "PY=%%P"
if not defined PY (
  echo gitea: no working Python 3.8+ on PATH ^(tried python3, python, py^) >&2
  exit /b 127
)
%PY% "%~dp0gitea.py" %*
exit /b %ERRORLEVEL%
