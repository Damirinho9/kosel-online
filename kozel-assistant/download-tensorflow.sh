#!/bin/bash
# Скрипт для загрузки TensorFlow.js

echo "📥 Загрузка TensorFlow.js 4.11.0..."

# URL TensorFlow.js
TFJS_URL="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js"

# Путь для сохранения
TFJS_PATH="lib/tf.min.js"

# Создаем директорию lib если не существует
mkdir -p lib

# Скачиваем файл
if command -v curl &> /dev/null; then
    echo "Используем curl..."
    curl -L -o "$TFJS_PATH" "$TFJS_URL"
elif command -v wget &> /dev/null; then
    echo "Используем wget..."
    wget -O "$TFJS_PATH" "$TFJS_URL"
else
    echo "❌ Ошибка: curl и wget не найдены"
    echo "Скачайте файл вручную:"
    echo "  1. Откройте: $TFJS_URL"
    echo "  2. Сохраните как: $TFJS_PATH"
    exit 1
fi

# Проверяем размер файла
if [ -f "$TFJS_PATH" ]; then
    SIZE=$(stat -f%z "$TFJS_PATH" 2>/dev/null || stat -c%s "$TFJS_PATH" 2>/dev/null)
    SIZE_MB=$(echo "scale=2; $SIZE/1024/1024" | bc)

    if [ "$SIZE" -gt 1000000 ]; then
        echo "✓ Успешно загружено: $SIZE_MB MB"
        echo "✓ Файл: $TFJS_PATH"
        echo ""
        echo "Следующий шаг:"
        echo "  1. Перезагрузите расширение в Chrome (chrome://extensions/)"
        echo "  2. Откройте консоль (F12) и проверьте сообщение:"
        echo "     [Background ML] ✓ TensorFlow.js загружен: 4.11.0"
    else
        echo "⚠️ Предупреждение: файл слишком мал ($SIZE_MB MB)"
        echo "Ожидаемый размер: ~1.4-1.8 MB"
        echo "Возможно, загрузка не удалась"
    fi
else
    echo "❌ Ошибка: файл не создан"
fi
