# ADR-0001: Offscreen Document API для обхода CSP ограничений ML

**Дата:** 2024-11-24
**Статус:** Принято ✓
**Контекст:** V2.0 Phase 3 - Интеграция Machine Learning (TensorFlow.js)

## Контекст и проблема

Козёл Помощник V2.0 требует интеграции TensorFlow.js 4.11.0 для ML предсказаний лучших ходов.

### Попытка 1: Content Script (FAILED)

**Идея:** Загрузить TensorFlow.js в content script (content.js)

**Проблема:**
```
Refused to load the script 'https://cdn.jsdelivr.net/.../tf.min.js'
because it violates the following Content Security Policy directive:
"script-src 'self' 'unsafe-inline'"
```

**Причина:** Страница kozel-online.com имеет строгий CSP, запрещающий загрузку внешних скриптов.

**Результат:** ❌ Content script CSP блокирует TensorFlow.js

---

### Попытка 2: Background Service Worker (FAILED)

**Идея:** Переместить TensorFlow.js в background service worker через `importScripts('lib/tf.min.js')`

**Реализация:**
- Скачали tf.min.js локально в `kozel-assistant/lib/`
- Использовали `importScripts()` для загрузки
- Модифицировали content.js для ML запросов через `chrome.runtime.sendMessage`

**Проблема:**
```
[Background ML] ⚠️ ML недоступен: Evaluating a string as JavaScript
violates the following Content Security Policy directive because
'unsafe-eval' is not an allowed source of script in the following
Content Security Policy directive: "script-src 'self'"
```

**Причина:**
- TensorFlow.js использует `eval()` или `new Function()` внутри
- Chrome Extension Manifest V3 Service Workers запрещают `'unsafe-eval'` по CSP
- Это ограничение безопасности, которое нельзя обойти в Service Worker

**Результат:** ❌ Service Worker CSP блокирует eval() в TensorFlow.js

---

### Попытка 3: Offscreen Document API (SUCCESS ✓)

**Идея:** Использовать Offscreen Document API - специальный изолированный контекст для Chrome Extensions.

**Что такое Offscreen Document:**
- Manifest V3 API для создания "невидимого" HTML документа
- Работает в отдельном контексте от Service Worker
- **НЕ имеет CSP ограничений Service Worker**
- Может выполнять код, требующий DOM или eval()
- Justification: `'WORKERS'` (ML computations)

**Архитектура:**
```
content.js (веб-страница)
    ↓ chrome.runtime.sendMessage({ action: 'mlPredict', ... })
background.js (service worker - координатор)
    ↓ forwardToOffscreen(request)
    ↓ chrome.runtime.sendMessage (пересылка)
offscreen.js (offscreen document - TensorFlow.js)
    ↓ tf.model.predict(...)
    ↓ response
background.js
    ↓ sendResponse(response)
content.js
```

**Реализация:**

1. **offscreen.html** - документ-контейнер:
```html
<script src="lib/tf.min.js"></script>
<script src="ai/ml-encoder.js"></script>
<script src="ai/ml-model.js"></script>
<script src="offscreen.js"></script>
```

2. **offscreen.js** - ML логика:
```javascript
// Инициализация TensorFlow.js
initializeML();

// Обработка запросов
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'mlPredict') {
        handlePredict(request.data).then(sendResponse);
        return true;
    }
    // mlTrain, mlStatus...
});
```

3. **background.js** - координатор:
```javascript
// Создание offscreen document
async function setupOffscreenDocument() {
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'TensorFlow.js для ML предсказаний требует выполнения кода (обход CSP Service Worker)'
    });
}

// Перенаправление запросов
async function forwardToOffscreen(request) {
    const response = await chrome.runtime.sendMessage(request);
    return response;
}
```

4. **manifest.json** - разрешение:
```json
"permissions": [
    "offscreen"
]
```

**Результат:** ✅ TensorFlow.js работает без CSP ограничений!

---

## Решение

**Принято решение:** Использовать **Offscreen Document API** для всех ML операций.

### Преимущества:

1. **Обход CSP ограничений** - offscreen document не имеет Service Worker CSP
2. **Полная поддержка TensorFlow.js** - работает eval(), WebGL, WebAssembly
3. **Официальный API** - Chrome Manifest V3 native solution
4. **Изоляция** - ML код изолирован от основной логики расширения
5. **Масштабируемость** - можно добавлять другие библиотеки с eval()

### Недостатки:

1. **Дополнительный контекст** - offscreen document потребляет память
2. **Overhead коммуникации** - два уровня message passing (content → background → offscreen)
3. **Lifecycle management** - нужно следить за существованием offscreen document
4. **Совместимость** - требует Chrome 109+ (Manifest V3)

### Альтернативы (почему не выбрали):

#### A. TensorFlow.js Lite / WASM-only версия
- **Проблема:** Нет готовой lite версии без eval()
- **Сложность:** Пришлось бы форкать и патчить TensorFlow.js
- **Поддержка:** Ручная поддержка обновлений TensorFlow.js

#### B. Web Workers
- **Проблема:** В Chrome Extensions Web Workers работают в Service Worker контексте
- **CSP:** Те же ограничения на eval()

#### C. Удаленный ML сервер
- **Проблема:** Требует backend инфраструктуры
- **Приватность:** Отправка игровых данных на сервер
- **Задержка:** Network latency для каждого предсказания
- **Стоимость:** Hosting, API ключи, масштабирование

#### D. Native Messaging (C++ host)
- **Проблема:** Требует установки нативного приложения
- **Сложность:** Пользователь должен устанавливать дополнительный компонент
- **Платформы:** Нужно поддерживать Windows/Mac/Linux

---

## Последствия

### Положительные:

1. **ML работает** - TensorFlow.js полностью функционален
2. **Простота установки** - пользователь просто скачивает tf.min.js
3. **Offline работа** - нет зависимости от сервера
4. **Приватность** - все данные локальны
5. **Производительность** - WebGL acceleration работает

### Отрицательные:

1. **Потребление памяти** - +30-50 MB для offscreen document + TensorFlow.js
2. **Усложнение архитектуры** - 3 контекста вместо 2
3. **Debugging сложнее** - нужно отладживать offscreen document отдельно

### Технические требования:

1. **Chrome версия:** 109+ (Offscreen Document API)
2. **Ручная установка:** Пользователь скачивает tf.min.js (1.8 MB)
3. **Lifecycle управление:** background.js следит за существованием offscreen document
4. **Error handling:** Обработка ошибок создания/коммуникации с offscreen document

---

## Риски и митигация

### Риск 1: Offscreen Document уничтожен браузером

**Вероятность:** Средняя (Chrome может убивать неактивные контексты)

**Последствия:** ML запросы будут падать с ошибкой

**Митигация:**
```javascript
async function forwardToOffscreen(request) {
    // Проверяем существование перед каждым запросом
    if (!offscreenReady) {
        await setupOffscreenDocument();
    }
    // ...
}
```

### Риск 2: API Offscreen Document изменится

**Вероятность:** Низкая (stable API с Chrome 109)

**Последствия:** Нужно адаптировать код

**Митигация:** Следить за Chrome Extension API changelog

### Риск 3: Quota limit IndexedDB

**Вероятность:** Средняя (модель + история игр)

**Последствия:** Сохранение модели падает

**Митигация:**
- Ограничение истории: максимум 100 игр
- Периодическая очистка старых данных
- Graceful degradation при quota exceeded

---

## Реализованные файлы

- `kozel-assistant/offscreen.html` - контейнер для TensorFlow.js
- `kozel-assistant/offscreen.js` - ML операции (predict, train, status)
- `kozel-assistant/background.js` - setupOffscreenDocument(), forwardToOffscreen()
- `kozel-assistant/manifest.json` - добавлен permission "offscreen"
- `kozel-assistant/content.js` - ML запросы через messaging API

**Коммиты:**
- `f50ed39` ML через Offscreen Document API для обхода CSP ограничений
- `1fd16b2` Исправлена критическая ошибка V2.0: ML не обучалась после игр
- `c652222` Локальный TensorFlow.js для ML без CSP ограничений

---

## Проверка решения

### Definition of Done:

✅ TensorFlow.js загружается без CSP ошибок
✅ ML предсказания работают после обучения
✅ Обучение выполняется после каждой игры
✅ Модель сохраняется и загружается из IndexedDB
✅ Fallback на эвристики если ML недоступен
✅ Логи подтверждают работу ML

### Тестовые логи (успешные):

```
[Background] ✓ Offscreen document создан для ML
[ML Offscreen] ✓ TensorFlow.js загружен: 4.11.0
[ML Offscreen] ✓ Готов к обработке ML запросов
[Козёл Помощник ML] ✓ ML доступен, начнем обучение после игр
[ML Offscreen] Начинаем обучение на 5 играх...
[ML Offscreen] ✓ Обучение завершено успешно
[Козёл ML] ✓ Обучение завершено успешно
[AI ML] 🧠 ML рекомендует: ♠A (уверенность: 85%)
```

---

## Связанные документы

- [Architecture: Offscreen Document](../architecture.md#3-offscreen-document-offscreenjs--offscreenhtml)
- [AI Coding Rules: Offscreen Document](../ai-coding.md#offscreen-document-offscreenjs)
- [INSTALL_TENSORFLOW.md](../../kozel-assistant/INSTALL_TENSORFLOW.md) - инструкции установки

---

## История изменений

| Дата       | Версия | Изменение                           |
|------------|--------|-------------------------------------|
| 2024-11-24 | 1.0    | Первая версия ADR (решение принято) |

---

**Автор:** AI Dev Agent (Claude)
**Ревьюер:** Пользователь (утверждено через тестирование)
