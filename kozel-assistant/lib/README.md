# Библиотеки TensorFlow.js

## ⚠️ ВАЖНО: Известная проблема с Manifest V3

**TensorFlow.js (стандартная версия) несовместим с Chrome Extension Manifest V3 из-за использования `eval()`.**

### Проблема:

TensorFlow.js использует динамическую генерацию кода (`eval()`, `new Function()`), что **запрещено** Content Security Policy в Manifest V3, даже с `'wasm-unsafe-eval'`.

**Ошибка при загрузке:**
```
Uncaught EvalError: Evaluating a string as JavaScript violates
the following Content Security Policy directive because
'unsafe-eval' is not an allowed source of script
```

Это **известная проблема** TensorFlow.js: [Issue #5429](https://github.com/tensorflow/tfjs/issues/5429)

### Статус:

- ❌ Стандартный TensorFlow.js не работает в Manifest V3
- ⏳ Команда TensorFlow.js работает над решением
- ✅ Расширение **полностью работает без TensorFlow.js**

### Что работает без TensorFlow.js:

✅ **Все основные функции:**
- Адаптивные стратегии (AI V2.0)
- Профилирование игроков
- Анализ ситуации
- Рекомендации карт
- Статистика

❌ **Не работает:**
- Нейронная сеть (ML предсказания на основе обученной модели)

### Альтернативные решения (будущее):

1. **Модульная версия TensorFlow.js** (@tensorflow/tfjs-core + WASM backend без eval)
   - Требует переписывания загрузки
   - Планируется в будущих версиях

2. **Серверный ML**
   - ML модель на сервере
   - Расширение отправляет запросы

3. **Простая нейронная сеть без библиотек**
   - Реализация с нуля на JS
   - Ограниченные возможности

### Если вы хотите попробовать (не рекомендуется):

Файл `tf.min.js` в этой папке - заглушка с инструкциями.

**Шаги установки:**

1. Скачайте TensorFlow.js:
   ```
   https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js
   ```

2. Замените файл `lib/tf.min.js` (размер ~1.8 MB)

3. Перезагрузите расширение

**Результат:** Вы увидите ошибку CSP, расширение продолжит работать без ML.

---

**Вывод:** На данный момент ML функции недоступны в Manifest V3. Расширение полностью функционально без них.
