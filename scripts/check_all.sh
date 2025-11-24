#!/usr/bin/env bash
# Скрипт проверки Chrome Extension "Козёл Помощник"
# AI Dev 2025 Protocol: check-команда для feedback loop

set -e  # Остановка при первой ошибке

EXTENSION_DIR="kozel-assistant"
MANIFEST_FILE="$EXTENSION_DIR/manifest.json"

echo "================================================"
echo "  Козёл Помощник - Проверка расширения"
echo "================================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Счетчики
CHECKS_PASSED=0
CHECKS_FAILED=0

# Функция проверки с выводом
check() {
    local name="$1"
    local command="$2"

    echo -n "[$name] "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OK${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((CHECKS_FAILED++))
        return 1
    fi
}

# Функция проверки с детальным выводом
check_verbose() {
    local name="$1"
    local command="$2"

    echo -n "[$name] "

    local output
    output=$(eval "$command" 2>&1)
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ OK${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "$output" | sed 's/^/  /'
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo "=== 1. Структура проекта ==="
echo ""

check "Extension directory exists" "test -d $EXTENSION_DIR"
check "Manifest exists" "test -f $MANIFEST_FILE"
check "Background script exists" "test -f $EXTENSION_DIR/background.js"
check "Content script exists" "test -f $EXTENSION_DIR/content.js"
check "Offscreen HTML exists" "test -f $EXTENSION_DIR/offscreen.html"
check "Offscreen script exists" "test -f $EXTENSION_DIR/offscreen.js"
check "Popup HTML exists" "test -f $EXTENSION_DIR/popup.html"
check "Popup script exists" "test -f $EXTENSION_DIR/popup.js"

echo ""
echo "=== 2. AI модули ==="
echo ""

check "Card module exists" "test -f $EXTENSION_DIR/ai/card.js"
check "Rules module exists" "test -f $EXTENSION_DIR/ai/rules.js"
check "Strategy module exists" "test -f $EXTENSION_DIR/ai/strategy.js"
check "ML encoder exists" "test -f $EXTENSION_DIR/ai/ml-encoder.js"
check "ML model exists" "test -f $EXTENSION_DIR/ai/ml-model.js"
check "Move history exists" "test -f $EXTENSION_DIR/ai/move-history.js"
check "Profiler exists" "test -f $EXTENSION_DIR/ai/profiler.js"

echo ""
echo "=== 3. Валидация manifest.json ==="
echo ""

# Проверка синтаксиса JSON
check_verbose "manifest.json syntax" "python3 -m json.tool $MANIFEST_FILE"

# Проверка обязательных полей
check "manifest_version = 3" "grep -q '\"manifest_version\": 3' $MANIFEST_FILE"
check "name field exists" "grep -q '\"name\"' $MANIFEST_FILE"
check "version field exists" "grep -q '\"version\"' $MANIFEST_FILE"
check "permissions field exists" "grep -q '\"permissions\"' $MANIFEST_FILE"
check "background service_worker" "grep -q '\"service_worker\"' $MANIFEST_FILE"
check "offscreen permission" "grep -q '\"offscreen\"' $MANIFEST_FILE"

echo ""
echo "=== 4. Проверка ключевых файлов ==="
echo ""

# Проверка наличия критичных функций в background.js
check "setupOffscreenDocument() exists" "grep -q 'setupOffscreenDocument' $EXTENSION_DIR/background.js"
check "forwardToOffscreen() exists" "grep -q 'forwardToOffscreen' $EXTENSION_DIR/background.js"

# Проверка offscreen.js
check "initializeML() exists" "grep -q 'initializeML' $EXTENSION_DIR/offscreen.js"
check "handlePredict() exists" "grep -q 'handlePredict' $EXTENSION_DIR/offscreen.js"
check "handleTrain() exists" "grep -q 'handleTrain' $EXTENSION_DIR/offscreen.js"

# Проверка content.js
check "checkMLStatus() exists" "grep -q 'checkMLStatus' $EXTENSION_DIR/content.js"
check "getMLPrediction() exists" "grep -q 'getMLPrediction' $EXTENSION_DIR/content.js"
check "trainMLModel() exists" "grep -q 'trainMLModel' $EXTENSION_DIR/content.js"

echo ""
echo "=== 5. Базовая проверка синтаксиса JavaScript ==="
echo ""

# Проверка синтаксиса основных JS файлов через Node.js (если доступен)
if command -v node > /dev/null 2>&1; then
    for js_file in background.js content.js offscreen.js popup.js; do
        if [ -f "$EXTENSION_DIR/$js_file" ]; then
            check_verbose "Syntax: $js_file" "node -c $EXTENSION_DIR/$js_file"
        fi
    done

    # Проверка AI модулей
    for ai_file in ai/card.js ai/rules.js ai/strategy.js ai/ml-encoder.js ai/ml-model.js; do
        if [ -f "$EXTENSION_DIR/$ai_file" ]; then
            check_verbose "Syntax: $ai_file" "node -c $EXTENSION_DIR/$ai_file"
        fi
    done
else
    echo -e "${YELLOW}⚠ Node.js не найден, пропускаем проверку синтаксиса JS${NC}"
fi

echo ""
echo "=== 6. Документация ==="
echo ""

check "README exists" "test -f README.md"
check "QUICK_START exists" "test -f QUICK_START.md"
check "INSTALL_TENSORFLOW exists" "test -f $EXTENSION_DIR/INSTALL_TENSORFLOW.md"
check "docs/architecture.md exists" "test -f docs/architecture.md"
check "docs/ai-coding.md exists" "test -f docs/ai-coding.md"
check "CLAUDE.MD exists" "test -f CLAUDE.MD"

echo ""
echo "=== 7. TensorFlow.js ==="
echo ""

if [ -f "$EXTENSION_DIR/lib/tf.min.js" ]; then
    TF_SIZE=$(stat -f%z "$EXTENSION_DIR/lib/tf.min.js" 2>/dev/null || stat -c%s "$EXTENSION_DIR/lib/tf.min.js" 2>/dev/null || echo "0")

    # TensorFlow.js должен быть ~1.4-1.8 MB
    if [ "$TF_SIZE" -gt 1000000 ]; then
        echo -e "[tf.min.js exists] ${GREEN}✓ OK${NC} ($(numfmt --to=iec-i --suffix=B $TF_SIZE 2>/dev/null || echo "$TF_SIZE bytes"))"
        ((CHECKS_PASSED++))
    else
        echo -e "[tf.min.js size check] ${RED}✗ FAILED${NC} (файл слишком мал: $TF_SIZE bytes)"
        echo -e "  ${YELLOW}Скачайте TensorFlow.js согласно kozel-assistant/INSTALL_TENSORFLOW.md${NC}"
        ((CHECKS_FAILED++))
    fi
else
    echo -e "[tf.min.js exists] ${YELLOW}⚠ NOT FOUND${NC}"
    echo -e "  ${YELLOW}ML не будет работать. Скачайте TensorFlow.js согласно:${NC}"
    echo -e "  ${YELLOW}kozel-assistant/INSTALL_TENSORFLOW.md${NC}"
    ((CHECKS_FAILED++))
fi

echo ""
echo "================================================"
echo "  Результаты проверки"
echo "================================================"
echo ""
echo -e "Успешно: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Ошибок:  ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Все проверки пройдены!${NC}"
    echo ""
    echo "Следующие шаги:"
    echo "  1. Откройте chrome://extensions/"
    echo "  2. Включите 'Режим разработчика'"
    echo "  3. Нажмите 'Загрузить распакованное расширение'"
    echo "  4. Выберите папку: $(pwd)/$EXTENSION_DIR"
    echo "  5. Перейдите на https://kozel-online.com"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Обнаружены ошибки. Исправьте их перед установкой расширения.${NC}"
    echo ""
    exit 1
fi
