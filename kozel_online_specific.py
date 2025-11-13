"""
ПЕРЕХВАТ ANGULAR SCOPE - KOZEL-ONLINE.COM
Получение данных карт напрямую из Angular
"""

# ============================================================================
# КОНСОЛЬНЫЕ КОМАНДЫ ДЛЯ CHROME DEVTOOLS
# ============================================================================

ANGULAR_INTERCEPTOR = """
// ============================================================================
// ПЕРЕХВАТ ANGULAR SCOPE - ВСТАВЬ В КОНСОЛЬ
// ============================================================================

(function() {
    console.log('%c[KOZEL] Angular Interceptor активирован', 'color: green; font-size: 16px; font-weight: bold');
    
    // Находим game-table элемент
    const gameTable = document.querySelector('game-table');
    
    if (!gameTable) {
        console.error('game-table не найден!');
        return;
    }
    
    // Получаем Angular scope
    const scope = angular.element(gameTable).scope();
    
    if (!scope) {
        console.error('Angular scope не найден!');
        return;
    }
    
    console.log('%c[KOZEL] Scope получен!', 'color: green');
    
    // Функция получения состояния игры
    window.getGameState = function() {
        const state = {
            // Карты на руке
            myCards: scope.bottomCards || [],
            
            // Карты на столе
            tableCards: scope.centreCards || [],
            
            // Карты других игроков (количество)
            topCards: scope.topCards?.length || 0,
            leftCards: scope.leftCards?.length || 0,
            rightCards: scope.rightCards?.length || 0,
            
            // Игроки
            players: {
                top: scope.topPlayerName || '',
                left: scope.leftPlayerName || '',
                right: scope.rightPlayerName || '',
                me: 'Дамир_Магжанов' // Ты
            },
            
            // Счёт
            score: scope.scoreWindow?.gameScore || [0, 0],
            
            // Окна
            resultWindow: scope.resultWindow || {},
            messageWindow: scope.messageWindow || {},
            pauseWindow: scope.pauseWindow || {},
            
            // Полный scope (для дебага)
            _fullScope: scope
        };
        
        return state;
    };
    
    // Функция мониторинга изменений
    window.startMonitoring = function() {
        console.log('%c[KOZEL] Мониторинг запущен', 'color: blue');
        
        setInterval(() => {
            const state = window.getGameState();
            
            console.log('%c[GAME STATE]', 'color: orange; font-weight: bold');
            console.log('Мои карты:', state.myCards);
            console.log('Стол:', state.tableCards);
            console.log('Счёт:', state.score);
            console.log('---');
        }, 2000);
    };
    
    // Функция вывода карт в читаемом виде
    window.printMyCards = function() {
        const state = window.getGameState();
        
        console.log('%c=== МОИ КАРТЫ ===', 'color: yellow; font-size: 14px');
        
        state.myCards.forEach((c, i) => {
            console.log(`${i + 1}. ${JSON.stringify(c.card)}`);
            console.log(`   Позиция: x=${c.x}, y=${c.y}, angle=${c.angle}`);
        });
    };
    
    // Тест
    console.log('%cТестовый вызов getGameState():', 'color: cyan');
    const testState = window.getGameState();
    console.log(testState);
    
    console.log('%c\\nДОСТУПНЫЕ КОМАНДЫ:', 'color: green; font-size: 14px');
    console.log('  window.getGameState() - получить состояние игры');
    console.log('  window.printMyCards() - вывести мои карты');
    console.log('  window.startMonitoring() - мониторинг в реальном времени');
    
})();
"""


# ============================================================================
# АНАЛИЗ СТРУКТУРЫ КАРТ
# ============================================================================

CARD_MAPPING = """
// ============================================================================
// MAPPING КАРТ ПО BACKGROUND-POSITION
// ============================================================================

// Из HTML видно, что карты определяются по background-position
// Например: background-position: -157px -2px

// Нужно создать маппинг позиций на карты
// Это можно сделать двумя способами:

// СПОСОБ 1: Ручной анализ sprite
// Открой: kozel-online.com/css/game-table.css
// Найди .game-card-image-atlas
// Посмотри размеры карт и создай маппинг

// СПОСОБ 2: Автоматический перехват
// Играй партию и записывай background-position + какая карта была

const CARD_POSITIONS = {
    // Формат: 'x,y': {rank: 'A', suit: 'hearts'}
    
    // Пример (нужно заполнить реальными данными):
    '-157,-2': {rank: '10', suit: 'clubs'},  // Из HTML
    '-312,-2': {rank: 'K', suit: 'spades'},
    '-235,-125': {rank: 'Q', suit: 'diamonds'},
    // ... всего 32 карты
};

// Функция парсинга карты
function parseCard(element) {
    const bgPosition = element.style.backgroundPosition;
    const [x, y] = bgPosition.split(' ').map(v => parseInt(v));
    
    const key = `${x},${y}`;
    const card = CARD_POSITIONS[key];
    
    if (!card) {
        console.warn('Неизвестная позиция карты:', bgPosition);
        return null;
    }
    
    return card;
}

// АВТОМАТИЧЕСКИЙ СБОР МАППИНГА
// Во время игры записывай позиции:

window.collectCardMapping = function() {
    const cards = document.querySelectorAll('.game-card-image-atlas');
    const positions = new Set();
    
    cards.forEach(card => {
        const bgPos = card.style.backgroundPosition;
        if (bgPos) {
            positions.add(bgPos);
        }
    });
    
    console.log('Уникальные позиции карт:', Array.from(positions));
    console.log('Всего:', positions.size);
};
"""


# ============================================================================
# СПОСОБ 2: WEBSOCKET ПЕРЕХВАТ (ЛУЧШИЙ!)
# ============================================================================

WEBSOCKET_INTERCEPTOR = """
// ============================================================================
// WEBSOCKET ПЕРЕХВАТ - ПОЛУЧАЕМ ДАННЫЕ КАРТ НАПРЯМУЮ
// ============================================================================

(function() {
    console.log('%c[WEBSOCKET] Перехватчик установлен', 'color: green; font-size: 16px; font-weight: bold');
    
    const OriginalWebSocket = window.WebSocket;
    const OriginalReconnectingWebSocket = window.ReconnectingWebSocket || OriginalWebSocket;
    
    // Перехватываем оба типа WebSocket
    function wrapWebSocket(WS) {
        return function(...args) {
            console.log('%c[WS] Новое соединение:', 'color: green; font-weight: bold', args[0]);
            
            const socket = new WS(...args);
            
            // Перехват получения сообщений
            socket.addEventListener('message', (event) => {
                console.log('%c[WS] ⬇ Получено:', 'color: blue', event.data);
                
                try {
                    const data = JSON.parse(event.data);
                    console.log('Parsed:', data);
                    
                    // Ищем данные о картах
                    if (data.cards || data.hand || data.myCards) {
                        console.log('%c[КАРТЫ НАЙДЕНЫ!]', 'color: orange; font-size: 14px');
                        console.log(data);
                    }
                    
                    // Ищем ходы
                    if (data.move || data.play || data.turn) {
                        console.log('%c[ХОД!]', 'color: yellow; font-size: 14px');
                        console.log(data);
                    }
                    
                    // Сохраняем в глобальную переменную
                    if (!window.__wsData) window.__wsData = [];
                    window.__wsData.push({
                        direction: 'in',
                        data: data,
                        time: Date.now()
                    });
                    
                } catch(e) {
                    console.log('Not JSON or parse error:', e);
                }
            });
            
            // Перехват отправки
            const originalSend = socket.send;
            socket.send = function(data) {
                console.log('%c[WS] ⬆ Отправлено:', 'color: orange', data);
                
                try {
                    const parsed = JSON.parse(data);
                    console.log('Parsed:', parsed);
                    
                    if (!window.__wsData) window.__wsData = [];
                    window.__wsData.push({
                        direction: 'out',
                        data: parsed,
                        time: Date.now()
                    });
                } catch(e) {}
                
                return originalSend.apply(this, arguments);
            };
            
            socket.addEventListener('open', () => {
                console.log('%c[WS] ✓ Соединение открыто', 'color: green');
            });
            
            socket.addEventListener('close', () => {
                console.log('%c[WS] ✗ Соединение закрыто', 'color: red');
            });
            
            socket.addEventListener('error', (err) => {
                console.error('[WS] Ошибка:', err);
            });
            
            window.__wsSocket = socket;
            return socket;
        };
    }
    
    // Заменяем оба конструктора
    window.WebSocket = wrapWebSocket(OriginalWebSocket);
    window.ReconnectingWebSocket = wrapWebSocket(OriginalReconnectingWebSocket);
    
    console.log('%c✓ Перезагрузи страницу (F5) для перехвата WebSocket', 'color: yellow; font-size: 14px');
    console.log('Все сообщения будут в window.__wsData');
    
})();
"""


# ============================================================================
# PYTHON BOT ДЛЯ KOZEL-ONLINE.COM
# ============================================================================

PYTHON_BOT_SPECIFIC = """
#!/usr/bin/env python3
\"\"\"
Специализированный бот для kozel-online.com
Использует перехват Angular scope и WebSocket
\"\"\"

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import json


class KozelOnlineBot:
    
    def __init__(self):
        self.driver = self._setup_driver()
        self._inject_interceptors()
        
    def _setup_driver(self):
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        
        driver = webdriver.Chrome(options=options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        return driver
    
    def _inject_interceptors(self):
        \"\"\"Внедряем JavaScript перехватчики\"\"\"
        
        # Angular scope interceptor
        angular_script = '''
        window.getGameState = function() {
            const gameTable = document.querySelector('game-table');
            if (!gameTable) return null;
            
            const scope = angular.element(gameTable).scope();
            if (!scope) return null;
            
            return {
                myCards: scope.bottomCards || [],
                tableCards: scope.centreCards || [],
                topCards: (scope.topCards || []).length,
                leftCards: (scope.leftCards || []).length,
                rightCards: (scope.rightCards || []).length,
                players: {
                    top: scope.topPlayerName || '',
                    left: scope.leftPlayerName || '',
                    right: scope.rightPlayerName || ''
                },
                score: scope.scoreWindow?.gameScore || [0, 0],
                allowClick: scope.bottomCards?.[0]?.allowClick || false
            };
        };
        '''
        
        self.driver.execute_script(angular_script)
        print("[+] Angular interceptor установлен")
    
    def get_game_state(self):
        \"\"\"Получить текущее состояние игры из Angular scope\"\"\"
        
        state = self.driver.execute_script('return window.getGameState();')
        return state
    
    def parse_my_cards(self):
        \"\"\"Парсинг карт на руке\"\"\"
        
        state = self.get_game_state()
        if not state:
            return []
        
        my_cards = state.get('myCards', [])
        
        # Карты в Angular scope имеют структуру:
        # {card: {...}, angle: X, x: Y, y: Z, allowClick: true}
        
        parsed_cards = []
        for card_data in my_cards:
            card = card_data.get('card', {})
            
            # ВАЖНО: структура 'card' нужна из реального WebSocket сообщения
            # Скорее всего там есть rank и suit
            
            parsed_cards.append({
                'rank': card.get('rank'),
                'suit': card.get('suit'),
                'position': {
                    'x': card_data.get('x'),
                    'y': card_data.get('y'),
                    'angle': card_data.get('angle')
                },
                'clickable': card_data.get('allowClick', False)
            })
        
        return parsed_cards
    
    def is_my_turn(self):
        \"\"\"Проверка, мой ли ход\"\"\"
        
        state = self.get_game_state()
        if not state:
            return False
        
        # Если карты кликабельны - мой ход
        return state.get('allowClick', False)
    
    def play_card(self, card_index):
        \"\"\"Сыграть карту по индексу (0-7)\"\"\"
        
        # Находим карту по индексу
        cards = self.driver.find_elements(By.CSS_SELECTOR, 
            'game-card[allow-click="true"] .game-card')
        
        if card_index < len(cards):
            card = cards[card_index]
            
            # Человекоподобный клик
            time.sleep(random.uniform(0.5, 1.5))
            
            from selenium.webdriver.common.action_chains import ActionChains
            actions = ActionChains(self.driver)
            actions.move_to_element(card)
            actions.pause(random.uniform(0.1, 0.3))
            actions.click()
            actions.perform()
            
            print(f"[+] Сыграна карта #{card_index}")
            return True
        
        return False
    
    def login(self, username, password):
        \"\"\"Вход в игру\"\"\"
        
        self.driver.get("https://kozel-online.com/")
        
        # Ждём загрузки
        time.sleep(3)
        
        # Заполняем форму логина (если не залогинен)
        try:
            username_field = self.driver.find_element(By.CSS_SELECTOR, 'input[ng-model="username"]')
            password_field = self.driver.find_element(By.CSS_SELECTOR, 'input[ng-model="password"]')
            login_btn = self.driver.find_element(By.CSS_SELECTOR, 'button[ng-click="login()"]')
            
            username_field.send_keys(username)
            password_field.send_keys(password)
            login_btn.click()
            
            time.sleep(2)
            print("[+] Вход выполнен")
            
        except:
            print("[*] Уже залогинен или форма не найдена")
    
    def join_game(self):
        \"\"\"Присоединиться к игре\"\"\"
        
        # Находим игру и заходим
        # (зависит от интерфейса списка игр)
        pass
    
    def play_game_loop(self):
        \"\"\"Главный игровой цикл\"\"\"
        
        print("[*] Игровой цикл запущен")
        
        while True:
            try:
                # Получаем состояние
                state = self.get_game_state()
                
                if not state:
                    time.sleep(1)
                    continue
                
                # Проверяем, наш ли ход
                if not self.is_my_turn():
                    time.sleep(1)
                    continue
                
                # Получаем карты
                my_cards = self.parse_my_cards()
                
                if not my_cards:
                    print("[!] Нет карт на руке")
                    time.sleep(1)
                    continue
                
                print(f"[*] Мой ход! Карт: {len(my_cards)}")
                print(f"[*] Счёт: {state['score']}")
                
                # ЗДЕСЬ ВЫЗОВ ИИ ЛОГИКИ
                card_to_play = self._choose_card(state, my_cards)
                
                # Играем карту
                self.play_card(card_to_play)
                
                # Ждём следующий ход
                time.sleep(2)
                
            except KeyboardInterrupt:
                print("\\n[*] Остановка бота")
                break
            except Exception as e:
                print(f"[!] Ошибка: {e}")
                time.sleep(2)
    
    def _choose_card(self, state, my_cards):
        \"\"\"Выбор карты (упрощённая логика)\"\"\"
        
        # TODO: Интегрировать полную логику из правил
        
        # Пока просто играем первую кликабельную карту
        for i, card in enumerate(my_cards):
            if card['clickable']:
                return i
        
        return 0


# ИСПОЛЬЗОВАНИЕ
if __name__ == "__main__":
    bot = KozelOnlineBot()
    
    # Логин
    bot.login("username", "password")
    
    # Присоединиться к игре
    bot.join_game()
    
    # Запустить игру
    bot.play_game_loop()
\"\"\"


if __name__ == "__main__":
    print(__doc__)
    print("\\nФайл создан: kozel_online_specific.py")
