#!/usr/bin/env python3
"""
Скрипт для создания иконок расширения
Использует PIL/Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Создать иконку заданного размера"""

    # Создаём изображение с градиентом
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)

    # Рисуем фон с градиентом (упрощённо)
    for y in range(size):
        color = (
            int(102 + (118 - 102) * y / size),  # R
            int(126 + (75 - 126) * y / size),   # G
            int(234 + (162 - 234) * y / size)   # B
        )
        draw.line([(0, y), (size, y)], fill=color)

    # Рисуем круг в центре
    circle_size = size * 0.7
    padding = (size - circle_size) / 2
    draw.ellipse(
        [padding, padding, size - padding, size - padding],
        fill='#764ba2'
    )

    # Рисуем текст
    try:
        # Пытаемся использовать системный шрифт
        font_size = int(size * 0.5)
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', font_size)
        except:
            font = ImageFont.load_default()

        text = "🤖"

        # Центрируем текст
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        position = (
            (size - text_width) / 2 - bbox[0],
            (size - text_height) / 2 - bbox[1]
        )

        draw.text(position, text, fill='white', font=font)
    except:
        # Если не получилось - просто буква К
        text = "K"
        font_size = int(size * 0.6)
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', font_size)
        except:
            font = ImageFont.load_default()

        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        position = (
            (size - text_width) / 2 - bbox[0],
            (size - text_height) / 2 - bbox[1]
        )

        draw.text(position, text, fill='white', font=font)

    # Сохраняем
    img.save(filename, 'PNG')
    print(f"✓ Создана {filename} ({size}x{size})")

def main():
    print("🎨 Создание иконок для Козёл Помощник...")
    print()

    # Создаём папку для иконок
    os.makedirs('icons', exist_ok=True)

    # Создаём иконки разных размеров
    create_icon(128, 'icons/icon128.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(16, 'icons/icon16.png')

    print()
    print("✅ Иконки созданы успешно!")
    print()
    print("Теперь можно загрузить расширение в Chrome:")
    print("1. Откройте chrome://extensions/")
    print("2. Включите 'Режим разработчика'")
    print("3. Нажмите 'Загрузить распакованное'")
    print("4. Выберите папку kozel-assistant/")

if __name__ == '__main__':
    try:
        main()
    except ImportError:
        print("❌ Pillow не установлен")
        print("Установите: pip install Pillow")
        print()
        print("Или создайте иконки вручную:")
        print("  - icon16.png (16x16)")
        print("  - icon48.png (48x48)")
        print("  - icon128.png (128x128)")
