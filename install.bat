@echo off
chcp 65001 > nul
title Установка InTruth Islamic

echo ===================================================
echo           InTruth Islamic Extension Installer
echo ===================================================
echo.

set "TARGET_DIR=%localappdata%\InTruthIslamic"

echo [1/3] Создание стабильной рабочей директории...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [2/3] Копирование файлов расширения во избежание удаления...
copy /y "manifest.json" "%TARGET_DIR%\" > nul
copy /y "background.js" "%TARGET_DIR%\" > nul
copy /y "content.js" "%TARGET_DIR%\" > nul
copy /y "popup.html" "%TARGET_DIR%\" > nul
copy /y "popup.js" "%TARGET_DIR%\" > nul
copy /y "popup.css" "%TARGET_DIR%\" > nul
copy /y "options.html" "%TARGET_DIR%\" > nul
copy /y "options.js" "%TARGET_DIR%\" > nul
copy /y "icon16.png" "%TARGET_DIR%\" > nul
copy /y "icon48.png" "%TARGET_DIR%\" > nul
copy /y "icon128.png" "%TARGET_DIR%\" > nul
copy /y "icon.png" "%TARGET_DIR%\" > nul
copy /y "README.md" "%TARGET_DIR%\" > nul

echo [3/3] Открытие страниц расширений в браузерах...
start chrome://extensions/
start edge://extensions/
explorer "%TARGET_DIR%"

echo.
echo ===================================================
echo                УСТАНОВКА ПОЧТИ ЗАВЕРШЕНА!
echo ===================================================
echo.
echo Что нужно сделать в открывшемся окне браузера:
echo.
echo 1. Включите "Режим разработчика" (переключатель вверху справа).
echo 2. Нажмите кнопку "Загрузить распакованное расширение" (слева вверху).
echo 3. Вставьте следующий путь к папке и нажмите Выбор папки:
echo    %TARGET_DIR%
echo.
echo (Путь автоматически скопирован в буфер обмена!)
echo.
echo ===================================================
echo %TARGET_DIR%| clip
pause
