@echo off
REM Скрипт установки TensorFlow.js для Козёл Помощник ML (Windows)

echo 🧠 Установка TensorFlow.js для ML функций...
echo.

cd /d "%~dp0lib"

set TFJS_URL=https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js
set TFJS_FILE=tf.min.js

REM Проверяем наличие файла
if exist "%TFJS_FILE%" (
    echo ⚠️  Файл %TFJS_FILE% уже существует
    set /p OVERWRITE="Перезаписать? (y/n): "
    if /i not "%OVERWRITE%"=="y" (
        echo ❌ Установка отменена
        exit /b 0
    )
)

echo 📥 Скачивание TensorFlow.js...

REM Используем PowerShell для скачивания
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%TFJS_URL%' -OutFile '%TFJS_FILE%'}"

if errorlevel 1 (
    echo ❌ Ошибка скачивания
    echo.
    echo Установите вручную:
    echo 1. Откройте: %TFJS_URL%
    echo 2. Сохраните как: lib\%TFJS_FILE%
    pause
    exit /b 1
)

REM Проверяем размер файла
for %%A in ("%TFJS_FILE%") do set FILE_SIZE=%%~zA

if %FILE_SIZE% LSS 1000000 (
    echo ❌ Ошибка: файл слишком маленький (%FILE_SIZE% байт)
    echo Возможно проблема с загрузкой
    del "%TFJS_FILE%"
    pause
    exit /b 1
)

echo.
echo ✅ TensorFlow.js успешно установлен!
for %%A in ("%TFJS_FILE%") do echo 📊 Размер файла: %%~zA байт
echo.
echo Следующие шаги:
echo 1. Перезагрузите расширение в Chrome (chrome://extensions/)
echo 2. Откройте kozel-online.com
echo 3. Проверьте консоль (F12) - должно быть:
echo    [ML Loader] ✓ TensorFlow.js загружен: 4.11.0
echo.
echo 🎉 Готово!
pause
