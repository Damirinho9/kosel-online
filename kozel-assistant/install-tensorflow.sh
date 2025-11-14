#!/bin/bash

# Скрипт установки TensorFlow.js для Козёл Помощник ML

set -e

echo "🧠 Установка TensorFlow.js для ML функций..."
echo ""

# Переходим в директорию lib
cd "$(dirname "$0")/lib"

# URL TensorFlow.js
TFJS_URL="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js"
TFJS_FILE="tf.min.js"

# Проверяем наличие файла
if [ -f "$TFJS_FILE" ]; then
    echo "⚠️  Файл $TFJS_FILE уже существует"
    read -p "Перезаписать? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Установка отменена"
        exit 0
    fi
fi

# Скачиваем TensorFlow.js
echo "📥 Скачивание TensorFlow.js..."

if command -v wget &> /dev/null; then
    wget -q --show-progress "$TFJS_URL" -O "$TFJS_FILE"
elif command -v curl &> /dev/null; then
    curl -# -L "$TFJS_URL" -o "$TFJS_FILE"
else
    echo "❌ Ошибка: wget или curl не найдены"
    echo ""
    echo "Установите вручную:"
    echo "1. Откройте: $TFJS_URL"
    echo "2. Сохраните как: lib/$TFJS_FILE"
    exit 1
fi

# Проверяем размер файла
FILE_SIZE=$(stat -f%z "$TFJS_FILE" 2>/dev/null || stat -c%s "$TFJS_FILE" 2>/dev/null)

if [ "$FILE_SIZE" -lt 1000000 ]; then
    echo "❌ Ошибка: файл слишком маленький ($FILE_SIZE байт)"
    echo "Возможно проблема с загрузкой"
    rm "$TFJS_FILE"
    exit 1
fi

echo ""
echo "✅ TensorFlow.js успешно установлен!"
echo "📊 Размер файла: $(du -h "$TFJS_FILE" | cut -f1)"
echo ""
echo "Следующие шаги:"
echo "1. Перезагрузите расширение в Chrome (chrome://extensions/)"
echo "2. Откройте kozel-online.com"
echo "3. Проверьте консоль (F12) - должно быть:"
echo "   [ML Loader] ✓ TensorFlow.js загружен: 4.11.0"
echo ""
echo "🎉 Готово!"
