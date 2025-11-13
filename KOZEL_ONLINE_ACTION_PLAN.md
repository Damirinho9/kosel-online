# 🎯 КОНКРЕТНЫЙ ПЛАН ДЛЯ KOZEL-ONLINE.COM

## На основе скриншота и HTML кода

---

## ✅ ЧТО УЖЕ ИЗВЕСТНО

### Структура сайта:
- **Фреймворк:** Angular.js 1.x
- **Карты:** CSS Sprites (background-position)
- **WebSocket:** Есть (ReconnectingWebSocket)
- **Рендеринг:** DOM элементы (НЕ canvas!)

### Селекторы:

```javascript
// Мои карты (внизу)
'.game-card[allow-click="true"]'  // Кликабельные карты

// Все карты на руке
'game-card[ng-repeat="c in bottomCards"]'

// Карты на столе
'game-card[ng-repeat="c in centreCards"]'

// Игроки
'.game-player-name-top .game-player-name-text'     // Петрович
'.game-player-name-left .game-player-name-text'    // Софья Петровна  
'.game-player-name-right .game-player-name-text'   // Сергеич2

// Счёт (в HTML)
scope.scoreWindow.gameScore[0]  // Противники
scope.scoreWindow.gameScore[1]  // Мы

// Кнопки
'.game-exit-button'        // Выйти
'.game-pause-button'       // Пауза
'.game-chat-send-button'   // Отправить сообщение
```

---

## 🚀 БЫСТРЫЙ СТАРТ (СЕЙЧАС!)

### ШАГ 1: Перехват Angular Scope (5 минут)

1. **Открой игру:** https://kozel-online.com
2. **F12** → Console
3. **Скопируй и выполни:**

```javascript
(function() {
    console.log('%c[KOZEL] Interceptor активирован', 'color: green; font-size: 16px');
    
    window.getGameState = function() {
        const gameTable = document.querySelector('game-table');
        if (!gameTable) return null;
        
        const scope = angular.element(gameTable).scope();
        if (!scope) return null;
        
        return {
            myCards: scope.bottomCards || [],
            tableCards: scope.centreCards || [],
            topCardsCount: (scope.topCards || []).length,
            leftCardsCount: (scope.leftCards || []).length,
            rightCardsCount: (scope.rightCards || []).length,
            
            players: {
                top: scope.topPlayerName || '',
                left: scope.leftPlayerName || '',
                right: scope.rightPlayerName || ''
            },
            
            score: scope.scoreWindow?.gameScore || [0, 0],
            
            // Чей ход?
            myTurn: scope.bottomCards?.some(c => c.allowClick) || false,
            
            // Полный scope
            _scope: scope
        };
    };
    
    console.log('Тест:', window.getGameState());
    console.log('Используй: window.getGameState()');
})();
```

4. **Начни игру** (или дождись своего хода)
5. **Выполни:** `window.getGameState()`
6. **Смотри результат!**

**Результат:** Ты увидишь структуру данных с картами!

---

### ШАГ 2: Перехват WebSocket (10 минут)

1. **Вставь в консоль:**

```javascript
(function() {
    const OriginalWS = window.ReconnectingWebSocket || window.WebSocket;
    
    window.ReconnectingWebSocket = function(...args) {
        console.log('%c[WS] Создано соединение', 'color: green', args[0]);
        const socket = new OriginalWS(...args);
        
        socket.addEventListener('message', (e) => {
            console.log('%c[WS] ⬇', 'color: blue', e.data);
            try {
                const data = JSON.parse(e.data);
                if (data.cards || data.hand || data.myCards) {
                    console.log('%c[КАРТЫ!]', 'color: orange; font-size: 14px', data);
                }
            } catch(err) {}
        });
        
        const originalSend = socket.send;
        socket.send = function(data) {
            console.log('%c[WS] ⬆', 'color: orange', data);
            return originalSend.apply(this, arguments);
        };
        
        return socket;
    };
    
    console.log('✓ WebSocket перехватчик установлен');
    console.log('ПЕРЕЗАГРУЗИ СТРАНИЦУ (F5)');
})();
```

2. **F5** (перезагрузи страницу)
3. **Начни игру**
4. **Смотри логи WebSocket в консоли**

**Результат:** Увидишь протокол игры с картами в JSON!

---

### ШАГ 3: Анализ данных карт (15 минут)

После шага 1 и 2, у тебя есть:

**Из Angular Scope:**
```javascript
{
  myCards: [
    {
      card: {...},      // Данные карты
      x: 192.079,
      y: 422.832,
      angle: -70,
      allowClick: true
    },
    // ... ещё 7 карт
  ]
}
```

**Задача:** Понять структуру `card: {...}`

Выполни в консоли:
```javascript
const state = window.getGameState();
console.log('Первая карта:', state.myCards[0].card);
```

**Ожидаемая структура:**
```javascript
{
  rank: "10",      // или "A", "K", "Q", "J", "7", "8", "9"
  suit: "clubs"    // или "spades", "hearts", "diamonds"
}
```

**Если данных нет:** Смотри WebSocket сообщения!

---

## 📋 ЧЕКЛИСТ - ЗАПОЛНИ ПОСЛЕ АНАЛИЗА

```markdown
## СТРУКТУРА ДАННЫХ КАРТ

### Angular Scope:
- [ ] Мои карты: scope.bottomCards
- [ ] Структура карты: 
  ```javascript
  {
    rank: "___",  // Заполни
    suit: "___"   // Заполни
  }
  ```

### WebSocket:
- [ ] URL: ws://____________
- [ ] Формат: JSON / Binary / Другое
- [ ] Пример сообщения с картами:
  ```json
  {
    // Вставь реальное сообщение
  }
  ```

### Ходы:
- [ ] Как определить мой ход: allowClick=true / другое
- [ ] Как отправить ход: клик на карту / WebSocket / другое
```

---

## 💻 КОД ДЛЯ BROWSER EXTENSION

После заполнения чеклиста, используй этот код:

```javascript
// content.js для kozel-online.com

class KozelAssistant {
    constructor() {
        this.init();
    }
    
    init() {
        // Ждём загрузки Angular
        setTimeout(() => {
            this.injectHelpers();
            this.startMonitoring();
        }, 2000);
    }
    
    injectHelpers() {
        // Внедряем хелперы
        const script = document.createElement('script');
        script.textContent = `
            window.getGameState = function() {
                const gameTable = document.querySelector('game-table');
                if (!gameTable) return null;
                
                const scope = angular.element(gameTable).scope();
                if (!scope) return null;
                
                return {
                    myCards: scope.bottomCards || [],
                    tableCards: scope.centreCards || [],
                    score: scope.scoreWindow?.gameScore || [0, 0],
                    myTurn: scope.bottomCards?.some(c => c.allowClick) || false
                };
            };
        `;
        document.head.appendChild(script);
    }
    
    startMonitoring() {
        setInterval(() => {
            this.checkGameState();
        }, 1000);
    }
    
    checkGameState() {
        // Получаем состояние через window.getGameState()
        const state = this.getState();
        
        if (!state || !state.myTurn) {
            return;
        }
        
        // МОЙ ХОД!
        console.log('[Козёл Помощник] Твой ход!');
        
        // Получаем рекомендацию
        const recommendation = this.getAIRecommendation(state);
        
        // Показываем подсказку
        this.showRecommendation(recommendation);
        
        // Подсвечиваем карту
        this.highlightCard(recommendation.cardIndex);
    }
    
    getState() {
        // Вызываем window.getGameState через execute
        return window.getGameState?.() || null;
    }
    
    getAIRecommendation(state) {
        // ЗДЕСЬ ЛОГИКА ИИ
        // Используй правила из документа
        
        const myCards = state.myCards;
        
        // Пример: играем первую кликабельную карту
        for (let i = 0; i < myCards.length; i++) {
            if (myCards[i].allowClick) {
                return {
                    cardIndex: i,
                    card: myCards[i].card,
                    reasoning: 'Единственная кликабельная карта'
                };
            }
        }
        
        return null;
    }
    
    highlightCard(index) {
        // Подсветка карты
        const cards = document.querySelectorAll('game-card[allow-click="true"]');
        
        if (cards[index]) {
            cards[index].style.border = '3px solid gold';
            cards[index].style.boxShadow = '0 0 20px gold';
        }
    }
    
    showRecommendation(rec) {
        // Показываем подсказку в UI
        // Можно создать overlay или использовать alert
        console.log('[Рекомендация]', rec);
    }
}

// Запуск
new KozelAssistant();
```

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### Сегодня (вечер):
1. ✅ Выполни ШАГ 1 - перехват scope
2. ✅ Выполни ШАГ 2 - перехват WebSocket  
3. ✅ Заполни ЧЕКЛИСТ
4. ✅ Пришли сюда:
   - Результат `window.getGameState()`
   - Пример WebSocket сообщения
   - Заполненный чеклист

### Завтра:
1. Создам extension с реальными селекторами
2. Интегрируем ИИ логику из правил
3. Тестируем в реальной игре!

---

## 🔧 TROUBLESHOOTING

### Проблема: `angular is not defined`
**Решение:** Подожди 2-3 секунды после загрузки страницы

### Проблема: `scope is null`
**Решение:** Убедись, что игра запущена и game-table виден

### Проблема: `myCards пустой`
**Решение:** Дождись раздачи карт в игре

### Проблема: Не вижу WebSocket сообщения
**Решение:** 
1. Установи перехватчик
2. Перезагрузи страницу (F5)
3. Начни игру заново

---

## 📞 ЧТО ПРИСЫЛАТЬ

После выполнения шагов 1-3, пришли:

1. **Скриншот консоли** с результатом `window.getGameState()`
2. **Копию WebSocket сообщения** (если видно JSON с картами)
3. **Заполненный чеклист** выше

Я на основе этих данных сделаю:
- Готовый browser extension
- Полную интеграцию ИИ
- Автоматизацию (если нужно)

---

## 💡 ВАЖНО

**Angular Scope** - это самый простой способ для этого сайта!

Не нужен:
- ❌ OCR
- ❌ Template matching
- ❌ Парсинг background-position

Достаточно:
- ✅ Прочитать данные из scope
- ✅ Или перехватить WebSocket
- ✅ Интегрировать логику из правил

**Это займёт 1-2 часа вместо 2-3 дней!**

---

🚀 **НАЧИНАЙ С ШАГА 1 ПРЯМО СЕЙЧАС!**

Скопируй код из "ШАГ 1" в консоль браузера на странице игры!
