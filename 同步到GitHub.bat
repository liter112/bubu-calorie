@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo    同步到 GitHub
echo ==========================================
echo.

where python >nul 2>nul
if errorlevel 1 goto :nobuild
echo [1/4] 重新打包 index.html ...
python build.py
if errorlevel 1 goto :err
goto :stage

:nobuild
echo [1/4] 没找到 python，跳过重新打包（只同步现有文件）

:stage
echo.
echo [2/4] 检查有没有文件改动 ...
git add -A
git diff --cached --quiet
if errorlevel 1 goto :commit
echo       没有文件改动，直接尝试推送
goto :pull

:commit
set "msg="
set /p msg=       请输入本次更新说明（直接回车用默认）: 
if not defined msg set "msg=更新 %date% %time%"
git commit -m "%msg%"
if errorlevel 1 goto :err

:pull
echo.
echo [3/4] 拉取远端最新，避免冲突 ...
git pull --rebase
if errorlevel 1 goto :err

echo.
echo [4/4] 推送到 GitHub ...
git push
if errorlevel 1 goto :err

echo.
echo ===== 完成！GitHub 上的文件已更新 =====
echo 打开 https://github.com/liter112/bubu-calorie 刷新即可看到。
echo 如果开了 GitHub Pages，1 分钟后网页也会自动更新。
echo.
pause
exit /b 0

:err
echo.
echo ===== 出错了 =====
echo 把上面的提示截图发给我，我帮你看看。
echo 常见原因：1) 需要先拉取，脚本已自动尝试；2) 登录凭据过期；3) 网络不通。
echo.
pause
exit /b 1
