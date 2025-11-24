#!/bin/bash

# Скрипт для создания иконок расширения
# Требует: ImageMagick (apt install imagemagick)

echo "🎨 Создание иконок для Козёл Помощник..."

# Создаём папку для иконок
mkdir -p icons

# Проверка наличия ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick не установлен"
    echo "Установите: sudo apt install imagemagick"
    echo ""
    echo "Или создайте иконки вручную:"
    echo "  - icon16.png (16x16)"
    echo "  - icon48.png (48x48)"
    echo "  - icon128.png (128x128)"
    exit 1
fi

# Создаём иконку 128x128
echo "Создание icon128.png..."
convert -size 128x128 \
    -background "#667eea" \
    -fill white \
    -gravity center \
    -pointsize 80 \
    -font "DejaVu-Sans" \
    label:"🤖" \
    icons/icon128.png

# Создаём уменьшенные версии
echo "Создание icon48.png..."
convert icons/icon128.png -resize 48x48 icons/icon48.png

echo "Создание icon16.png..."
convert icons/icon128.png -resize 16x16 icons/icon16.png

echo "✅ Иконки созданы успешно!"
echo ""
echo "Файлы:"
ls -lh icons/

echo ""
echo "Теперь можно загрузить расширение в Chrome:"
echo "1. Откройте chrome://extensions/"
echo "2. Включите 'Режим разработчика'"
echo "3. Нажмите 'Загрузить распакованное'"
echo "4. Выберите папку kozel-assistant/"
