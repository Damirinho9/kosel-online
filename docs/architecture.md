# Architecture

## Назначение

**Козёл Помощник** - Chrome Extension (Manifest V3) с искусственным интеллектом для игры в Козла на https://kozel-online.com. Предоставляет игроку рекомендации по ходам на основе эвристических стратегий V2.0 (профилирование, паттерны) и Machine Learning (TensorFlow.js).

## Стек

- **Язык:** JavaScript (ES6+)
- **Платформа:** Chrome Extensions Manifest V3
- **ML библиотека:** TensorFlow.js 4.11.0
- **API:** Chrome Extension APIs (offscreen, storage, runtime, scripting)
- **Хранилище:** IndexedDB (для ML модели), chrome.storage.local (для настроек)

## Структура проекта

```
kozel-assistant/
├── manifest.json           # Манифест расширения (V3)
├── background.js          # Service Worker (координация ML запросов)
├── content.js             # Content script (анализ игры + UI)
├── offscreen.html         # Offscreen document для TensorFlow.js
├── offscreen.js           # ML операции (обход CSP ограничений)
├── popup.html/popup.js    # Popup интерфейс
├── inject.js              # Injected script для доступа к window
│
├── ai/                    # ИИ компоненты
│   ├── card.js           # Модель карты (масть, ранг)
│   ├── rules.js          # Правила игры в Козла
│   ├── scoring.js        # Подсчет очков
│   ├── statistics.js     # Статистика игры
│   ├── profiler.js       # Профилирование игроков (V2.0)
│   ├── move-history.js   # История ходов для обучения ML
│   ├── strategy.js       # Стратегии выбора карт
│   ├── ml-encoder.js     # Энкодер состояния игры → вектор
│   └── ml-model.js       # TensorFlow.js модель
│
├── lib/
│   └── tf.min.js         # TensorFlow.js (устанавливается вручную)
│
└── styles/
    └── extension.css     # Стили UI помощника
```

## Ключевые модули

### 1. Content Script (`content.js`)

**Роль:** Анализ DOM страницы игры, извлечение состояния игры, отображение рекомендаций.

**Ответственность:**
- Парсинг состояния игры из DOM
- Вызов AI стратегий через `strategy.js`
- Коммуникация с background.js для ML запросов
- Отображение UI панели с рекомендациями
- Сбор истории ходов для обучения ML

**Зависимости:** ai/*, background.js (через chrome.runtime.sendMessage)

### 2. Background Service Worker (`background.js`)

**Роль:** Координатор ML операций, обработчик сообщений между content.js и offscreen.js.

**Ответственность:**
- Создание offscreen document при старте
- Перенаправление ML запросов (mlPredict, mlTrain, mlStatus) в offscreen.js
- Управление жизненным циклом offscreen document
- Хранение статистики расширения

**Критичная особенность:** Service Worker не может напрямую использовать TensorFlow.js из-за CSP ограничения `'unsafe-eval'`.

### 3. Offscreen Document (`offscreen.js` + `offscreen.html`)

**Роль:** Изолированный контекст для выполнения TensorFlow.js без CSP ограничений.

**Ответственность:**
- Загрузка TensorFlow.js и ML модулей
- Инициализация нейронной сети (159→128→64→32→36)
- Обработка предсказаний (mlPredict)
- Обучение модели (mlTrain)
- Сохранение/загрузка модели в IndexedDB

**Архитектурное решение:** [ADR-0001](decisions/0001-offscreen-document-for-ml.md)

### 4. AI Strategy System (`ai/strategy.js`)

**Роль:** Выбор лучшей карты на основе эвристик V2.0 и ML предсказаний.

**Эвристики:**
- Профилирование игроков (стиль игры, агрессивность)
- Паттерн-матчинг (частые комбинации ходов)
- Контроль козырей
- Максимизация взяток

**Fallback:** Если ML недоступен или уверенность < 0.6, используются эвристики.

### 5. ML Components (`ai/ml-*.js`)

**`ml-encoder.js`:**
- Кодирует состояние игры (36 карт, козырь, взятки) → вектор 159 элементов
- Кодирует действие (карту) → вектор 36 элементов (one-hot)

**`ml-model.js`:**
- Нейронная сеть: Dense(128) → Dropout(0.3) → Dense(64) → Dropout(0.2) → Dense(32) → Dense(36)
- Функция потерь: categoricalCrossentropy
- Оптимизатор: adam (learning_rate=0.001)
- Обучение с подкреплением: reward = (выигрыш ? +1 : -1) * 10

### 6. Move History (`ai/move-history.js`)

**Роль:** Сбор и хранение истории игр для обучения ML.

**Структура данных:**
```javascript
{
  gameId: "uuid",
  moves: [
    {
      state: { myCards, tableCards, trumpSuit, ... },
      action: Card,
      timestamp: Date
    }
  ],
  outcome: { won: boolean, score: number }
}
```

**Хранение:** IndexedDB (база "KozelGames", таблица "games")

## Потоки данных

### Поток: Получение рекомендации с ML

```
1. Пользователь открывает kozel-online.com
2. content.js парсит DOM → извлекает gameState
3. content.js → strategy.chooseCard(gameState)
4. strategy.js проверяет: нужен ли ML?
5. content.js → chrome.runtime.sendMessage({ action: 'mlPredict', data: { gameState, legalCards } })
6. background.js → получает сообщение → forwardToOffscreen(request)
7. background.js → chrome.runtime.sendMessage (то же сообщение) → offscreen.js
8. offscreen.js → handlePredict() → mlModel.predict(gameState, legalCards)
9. TensorFlow.js → предсказание карты + уверенность
10. offscreen.js → response → background.js → content.js
11. strategy.js: if (confidence > 0.8) использует ML, else эвристики
12. content.js отображает рекомендацию в UI панели
```

### Поток: Обучение ML после игры

```
1. content.js обнаруживает окончание игры (DOM selector)
2. content.js → moveHistory.saveGame(moves, outcome)
3. content.js → chrome.runtime.sendMessage({ action: 'mlTrain', data: { trainingData } })
4. background.js → forwardToOffscreen({ action: 'mlTrain', ... })
5. offscreen.js → handleTrain()
6. mlModel.train(trainingData) → epochs=20
7. mlModel.save() → IndexedDB
8. offscreen.js → response { success: true, stats }
9. content.js → логирует результат
```

### Поток: Первичная инициализация ML

```
1. Пользователь устанавливает расширение
2. chrome.runtime.onInstalled → background.js
3. background.js → setupOffscreenDocument()
4. chrome.offscreen.createDocument({ url: 'offscreen.html', ... })
5. offscreen.html загружается → скрипты: tf.min.js, ai/ml-*.js, offscreen.js
6. offscreen.js → initializeML()
7. mlModel.load() → пытается загрузить из IndexedDB
8. Если модель не найдена: mlInitialized = false (будет обучаться после первых игр)
9. Если модель найдена: mlInitialized = true (готов к предсказаниям)
```

## Критические ограничения

### 1. Content Security Policy (CSP)

**Проблема:**
- Страница kozel-online.com имеет строгий CSP → нельзя загружать TensorFlow.js в content script
- Service Worker (background.js) запрещает `eval()` → нельзя загружать TensorFlow.js

**Решение:** Offscreen Document API - изолированный контекст без CSP ограничений.

### 2. TensorFlow.js установка

**Проблема:** tf.min.js (~1.8 MB) нельзя загрузить через fetch() из-за CSP.

**Решение:** Пользователь вручную скачивает файл (инструкции в `INSTALL_TENSORFLOW.md`).

### 3. Асинхронность Chrome APIs

**Все ML операции асинхронные:**
- chrome.runtime.sendMessage → Promise
- IndexedDB операции → Promise
- TensorFlow.js train/predict → Promise

**Требование:** Всегда использовать `return true` в message listeners для async responses.

## Особо осторожные зоны

### 1. Offscreen Document Lifecycle

**Файлы:** `background.js` (setupOffscreenDocument, forwardToOffscreen)

**Почему критично:**
- Offscreen document может быть уничтожен браузером
- Нужна проверка существования перед каждым запросом
- Нельзя создавать дубликаты (chrome.runtime.getContexts для проверки)

**Правила:**
- Не менять логику создания/проверки offscreen document без тестирования
- Всегда обрабатывать ошибки создания

### 2. ML Model Serialization

**Файлы:** `ai/ml-model.js` (save/load методы)

**Почему критично:**
- TensorFlow.js модель сериализуется в IndexedDB
- Несовместимые версии TensorFlow.js могут сломать загрузку
- Коррупция данных приведет к потере обученной модели

**Правила:**
- Не менять версию TensorFlow.js без миграции модели
- Не менять архитектуру сети без версионирования

### 3. Game State Parsing

**Файлы:** `content.js` (методы парсинга DOM)

**Почему критично:**
- Структура DOM kozel-online.com может измениться
- Неправильный парсинг → неверные рекомендации → плохое обучение ML

**Правила:**
- Изменения селекторов требуют тщательного тестирования
- Всегда проверять существование элементов перед парсингом
- Логировать ошибки парсинга

## Ключевые ADR

- [ADR-0001: Offscreen Document для обхода CSP ограничений ML](decisions/0001-offscreen-document-for-ml.md)

## Roadmap

### V2.0 (текущая версия) ✓
- Адаптивные стратегии с профилированием игроков
- Паттерн-детекция частых комбинаций
- ML через TensorFlow.js + Offscreen Document API

### V2.1 (планируется)
- Автоматическая переобучение ML каждые N игр
- Экспорт/импорт обученных моделей
- A/B тестирование стратегий (эвристики vs ML)

### V3.0 (идеи)
- Мультиплеерный анализ (профили игроков в облаке)
- Reinforcement Learning с online обучением
- Поддержка других карточных игр
