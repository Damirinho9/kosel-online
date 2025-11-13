"""
ИИ-ПОМОЩНИК ДЛЯ КОЗЛА ОНЛАЙН
Полный гайд по созданию бота для https://kozel-online.com/
"""

# ============================================================================
# ЭТАП 1: РАЗВЕДКА - ЧТО НУЖНО СДЕЛАТЬ НА СВОЕЙ МАШИНЕ
# ============================================================================

"""
1. ИНСТРУМЕНТЫ ДЛЯ АНАЛИЗА DOM:

A) Browser DevTools:
   - F12 в Chrome
   - Вкладка Elements - смотри структуру DOM
   - Вкладка Network - отслеживай WebSocket/API запросы
   - Вкладка Console - проверяй глобальные JS объекты

B) Что искать:
   ✓ Контейнер с картами: div/canvas с id/class типа 'hand', 'cards', 'player-cards'
   ✓ Стол (текущая взятка): элемент с id/class 'table', 'trick', 'center'
   ✓ Счёт: элементы со счётом партии
   ✓ WebSocket URL: смотри вкладку Network -> WS

2. СНИФИНГ WEBSOCKET:

В консоли браузера выполни:
```javascript
// Перехват WebSocket
const originalWS = WebSocket;
window.WebSocket = function(...args) {
    const socket = new originalWS(...args);
    console.log('WS URL:', args[0]);
    
    socket.addEventListener('message', (event) => {
        console.log('WS Message:', event.data);
    });
    
    return socket;
};
```

Это покажет все сообщения игрового протокола!

3. ПРОВЕРКА CANVAS:

Если игра на canvas (без DOM карт):
```javascript
// В консоли
document.querySelectorAll('canvas').forEach((c, i) => {
    console.log(`Canvas ${i}:`, c.width, 'x', c.height);
});
```

4. ПОИСК ИГРОВОГО СОСТОЯНИЯ:

```javascript
// Глобальные объекты игры
console.log(Object.keys(window));
// Ищи: game, gameState, player, cards и т.д.
```
"""

# ============================================================================
# ЭТАП 2: АРХИТЕКТУРА БОТА
# ============================================================================

"""
ВАРИАНТЫ ИНТЕГРАЦИИ:

┌─────────────────────────────────────────────────────────────┐
│ ВАРИАНТ 1: SELENIUM BOT (Полная автоматизация)             │
├─────────────────────────────────────────────────────────────┤
│ Плюсы:  Полный контроль, автоматические ходы               │
│ Минусы: Риск бана, сложная разработка                      │
│ Подходит: Для тестов, анализа, локальной игры              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ВАРИАНТ 2: BROWSER EXTENSION (Помощник)                    │
├─────────────────────────────────────────────────────────────┤
│ Плюсы:  Легально, удобно, подсказки в реальном времени     │
│ Минусы: Ты ходишь вручную (но с подсказками)               │
│ Подходит: Для реальной игры, обучения                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ВАРИАНТ 3: WEBSOCKET PROXY                                  │
├─────────────────────────────────────────────────────────────┤
│ Плюсы:  Полный доступ к протоколу                          │
│ Минусы: Сложная настройка, нужны сертификаты               │
│ Подходит: Для глубокого анализа протокола                  │
└─────────────────────────────────────────────────────────────┘

РЕКОМЕНДАЦИЯ: Начни с варианта 2 (Extension) - безопасно и эффективно!
"""

# ============================================================================
# ВАРИАНТ 1: SELENIUM BOT - ПОЛНАЯ АРХИТЕКТУРА
# ============================================================================

class KozelBot:
    """
    Полный бот для игры в козла
    
    Компоненты:
    1. Vision - парсинг игрового состояния
    2. Brain - логика принятия решений
    3. Action - выполнение ходов
    """
    
    def __init__(self):
        self.driver = self._setup_selenium()
        self.game_state = GameState()
        self.ai = KozelAI()
        
    def _setup_selenium(self):
        """
        Selenium с антидетектом
        """
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        
        # АНТИДЕТЕКТ НАСТРОЙКИ
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # User agent
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        driver = webdriver.Chrome(options=options)
        
        # Убираем webdriver flag
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # Эмуляция человеческого поведения
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {
            "userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': '''
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
            '''
        })
        
        return driver


class GameState:
    """
    Модель игрового состояния
    """
    def __init__(self):
        self.my_cards = []          # Мои карты
        self.table_cards = []       # Карты на столе (текущая взятка)
        self.my_team_score = 0      # Счёт моей команды
        self.opponent_score = 0     # Счёт соперника
        self.current_player = None  # Чей ход
        self.kon_number = 1         # Номер кона
        self.last_kon_opener = None # Кто открывал прошлый кон
        self.tricks_taken = 0       # Взяток взято в коне
        self.points_in_kon = 0      # Очков набрано в текущем коне


class VisionModule:
    """
    МОДУЛЬ РАСПОЗНАВАНИЯ - адаптируй под реальную структуру!
    """
    
    def __init__(self, driver):
        self.driver = driver
        
    def parse_my_cards(self):
        """
        ВАРИАНТ A: Если карты в DOM как элементы
        """
        cards = []
        
        # Пример селектора - замени на реальный!
        card_elements = self.driver.find_elements(By.CSS_SELECTOR, '.my-cards .card')
        
        for elem in card_elements:
            # Парсинг атрибутов карты
            card_id = elem.get_attribute('data-card-id')
            card_suit = elem.get_attribute('data-suit')
            card_rank = elem.get_attribute('data-rank')
            
            cards.append(Card(rank, suit))
        
        return cards
    
    def parse_my_cards_ocr(self):
        """
        ВАРИАНТ B: Если карты на canvas - OCR через скриншот
        """
        import cv2
        import numpy as np
        from PIL import Image
        
        # Скриншот области с картами
        canvas = self.driver.find_element(By.TAG_NAME, 'canvas')
        location = canvas.location
        size = canvas.size
        
        screenshot = self.driver.get_screenshot_as_png()
        image = Image.open(io.BytesIO(screenshot))
        
        # Вырезаем область карт
        left = location['x']
        top = location['y']
        right = left + size['width']
        bottom = top + size['height']
        
        cards_area = image.crop((left, top, right, bottom))
        
        # Распознавание карт (нужен template matching или ML)
        cards = self._recognize_cards(cards_area)
        
        return cards
    
    def parse_table_state(self):
        """
        Парсинг текущей взятки на столе
        """
        table_cards = []
        
        # Селектор стола - замени на реальный!
        table_elements = self.driver.find_elements(By.CSS_SELECTOR, '.table .card')
        
        for elem in table_elements:
            player_position = elem.get_attribute('data-player')  # 'top', 'right', 'bottom', 'left'
            card = self._parse_card_element(elem)
            table_cards.append((player_position, card))
        
        return table_cards
    
    def get_scores(self):
        """
        Парсинг счёта партии
        """
        # Пример - адаптируй!
        my_score_elem = self.driver.find_element(By.CSS_SELECTOR, '.my-team-score')
        opponent_score_elem = self.driver.element(By.CSS_SELECTOR, '.opponent-score')
        
        return {
            'my': int(my_score_elem.text),
            'opponent': int(opponent_score_elem.text)
        }
    
    def _recognize_cards(self, image):
        """
        Распознавание карт на изображении
        
        TODO: Реализовать template matching или CNN
        """
        # Вариант 1: Template Matching
        # - Сохрани эталоны всех 32 карт
        # - Используй cv2.matchTemplate()
        
        # Вариант 2: YOLO/CNN
        # - Обучи модель на скриншотах карт
        pass


class KozelAI:
    """
    МОЗГ БОТА - логика принятия решений
    """
    
    def __init__(self):
        self.rules = self._load_rules()
        
    def choose_card(self, game_state):
        """
        Главный метод - выбор карты для хода
        
        Алгоритм:
        1. Проверить обязательства (подкинуть масть)
        2. Оценить силу карт
        3. Применить стратегию
        4. Выбрать оптимальную карту
        """
        
        # 1. Фильтруем легальные ходы
        legal_cards = self._get_legal_cards(game_state)
        
        if len(legal_cards) == 1:
            return legal_cards[0]
        
        # 2. Оцениваем ситуацию
        situation = self._analyze_situation(game_state)
        
        # 3. Выбираем стратегию
        if situation['need_90']:
            return self._strategy_go_for_90(game_state, legal_cards)
        elif situation['protect_60']:
            return self._strategy_protect_60(game_state, legal_cards)
        elif situation['trap_queen']:
            return self._strategy_trap_queen(game_state, legal_cards)
        else:
            return self._strategy_default(game_state, legal_cards)
    
    def _get_legal_cards(self, game_state):
        """
        Получить карты, которыми можно ходить
        
        Правила:
        - Если есть простая масть захода - ОБЯЗАТЕЛЬНО подкинуть
        - Валеты, дамы, трефы НЕ считаются простой
        - Нет простой - любая карта
        """
        my_cards = game_state.my_cards
        table_cards = game_state.table_cards
        
        # Если стол пустой - любая карта (но проверяем запрет на козырь!)
        if not table_cards:
            return self._filter_first_move_restrictions(my_cards, game_state)
        
        # Определяем масть захода
        lead_card = table_cards[0][1]
        lead_suit = self._get_simple_suit(lead_card)
        
        if lead_suit is None:  # Зашли козырем
            # Можно любую карту
            return my_cards
        
        # Есть ли у нас простая карта этой масти?
        simple_cards_of_suit = [
            card for card in my_cards
            if self._get_simple_suit(card) == lead_suit
        ]
        
        if simple_cards_of_suit:
            return simple_cards_of_suit
        else:
            return my_cards  # Нет простой - любая
    
    def _filter_first_move_restrictions(self, cards, game_state):
        """
        Ограничения на первый ход кона
        
        - В 1-м кону: НЕЛЬЗЯ козырять вообще
        - В остальных: команда открывавшая прошлый кон не может козырять
        """
        if game_state.kon_number == 1:
            # Запрет на козыри
            return [c for c in cards if not self._is_trump(c)]
        
        # Проверка ограничения для команды
        if game_state.my_team_opened_last_kon and game_state.tricks_taken == 0:
            # Это наш первый ход в коне - нельзя козырять
            return [c for c in cards if not self._is_trump(c)]
        
        return cards
    
    def _is_trump(self, card):
        """Проверка козырности"""
        # Все валеты, дамы и все трефы - козыри
        if card.rank in ['J', 'Q']:
            return True
        if card.suit == 'clubs':
            return True
        return False
    
    def _get_simple_suit(self, card):
        """
        Получить простую масть (или None если козырь)
        """
        if self._is_trump(card):
            return None
        return card.suit
    
    def _analyze_situation(self, game_state):
        """
        Анализ игровой ситуации
        
        Возвращает словарь с флагами стратегии
        """
        points_collected = game_state.points_in_kon
        
        return {
            'need_90': points_collected >= 70 and self._has_strong_hand(game_state),
            'protect_60': points_collected >= 55 and points_collected < 70,
            'trap_queen': self._has_seven_clubs(game_state) and self._queen_clubs_not_played(game_state),
            'partner_has_lead': self._is_partner_winning_trick(game_state)
        }
    
    def _strategy_go_for_90(self, game_state, legal_cards):
        """
        Стратегия: идём на >90 очков
        
        Логика:
        - Берём взятку сильными картами
        - Защищаем десятки и тузы
        - Выносим козыри если у партнёра длина
        """
        # Если мы берём взятку - играем на максимум очков
        if self._are_we_winning(game_state):
            # Берём взятку самой сильной картой
            return self._get_strongest_card(legal_cards)
        else:
            # Даём партнёру взять или сбрасываем мусор
            if self._is_partner_winning_trick(game_state):
                return self._get_weakest_card(legal_cards)
            else:
                # Пытаемся перебить
                return self._get_card_to_win_trick(game_state, legal_cards)
    
    def _strategy_protect_60(self, game_state, legal_cards):
        """
        Стратегия: защищаем >60, не рискуем
        
        Логика:
        - Не отдаём лишних очков
        - Берём взятки безопасно
        - Экономим козыри
        """
        # Если партнёр берёт - сбрасываем мусор
        if self._is_partner_winning_trick(game_state):
            return self._get_weakest_card(legal_cards)
        
        # Если соперник берёт - не добавляем очков
        if self._is_opponent_winning_trick(game_state):
            return self._get_cheapest_card(legal_cards)
        
        # Наша взятка - берём экономно
        return self._get_minimum_card_to_win(game_state, legal_cards)
    
    def _strategy_trap_queen(self, game_state, legal_cards):
        """
        Стратегия: поимка дамы треф
        
        Логика:
        - Провоцируем соперника на подкладку дамы треф
        - Кладём 7 треф в нужный момент
        """
        # Если дама треф уже на столе от соперника - кладём 7!
        if self._is_queen_clubs_on_table_from_opponent(game_state):
            seven_clubs = [c for c in legal_cards if c.rank == '7' and c.suit == 'clubs']
            if seven_clubs:
                return seven_clubs[0]
        
        # Провоцируем: заходим мастью где у соперника мало карт
        return self._get_provocative_card(game_state, legal_cards)
    
    def _strategy_default(self, game_state, legal_cards):
        """
        Стратегия по умолчанию
        
        Логика:
        - Поддерживаем партнёра
        - Берём ценные взятки
        - Не отдаём очков попусту
        """
        if self._is_partner_winning_trick(game_state):
            # Партнёр берёт - помогаем ему (высокая карта масти или мусор)
            return self._support_partner(game_state, legal_cards)
        
        if self._are_we_winning(game_state):
            # Мы берём - играем разумно
            return self._get_reasonable_card(legal_cards)
        
        # Соперник берёт - минимизируем урон
        return self._get_cheapest_card(legal_cards)


class ActionModule:
    """
    МОДУЛЬ ДЕЙСТВИЙ - выполнение ходов
    """
    
    def __init__(self, driver):
        self.driver = driver
        
    def play_card(self, card):
        """
        Сыграть карту
        
        ВАРИАНТ A: Клик по DOM элементу
        """
        # Находим элемент карты
        card_selector = f"[data-rank='{card.rank}'][data-suit='{card.suit}']"
        card_element = self.driver.find_element(By.CSS_SELECTOR, card_selector)
        
        # Эмуляция человеческого клика
        self._human_like_click(card_element)
        
    def _human_like_click(self, element):
        """
        Клик с эмуляцией человеческого поведения
        """
        from selenium.webdriver.common.action_chains import ActionChains
        import time
        import random
        
        # Случайная задержка перед кликом
        time.sleep(random.uniform(0.5, 2.0))
        
        # Движение мыши к элементу
        actions = ActionChains(self.driver)
        actions.move_to_element(element)
        time.sleep(random.uniform(0.1, 0.3))
        
        # Клик
        actions.click()
        actions.perform()
        
        # Небольшая задержка после клика
        time.sleep(random.uniform(0.2, 0.5))


class Card:
    """Модель карты"""
    
    def __init__(self, rank, suit):
        self.rank = rank  # '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
        self.suit = suit  # 'clubs', 'spades', 'hearts', 'diamonds'
        
    def get_points(self):
        """Очки карты"""
        points = {
            '7': 0, '8': 0, '9': 0,
            'J': 2, 'Q': 3, 'K': 4,
            '10': 10, 'A': 11
        }
        return points[self.rank]
    
    def is_trump(self):
        """Козырь ли?"""
        return self.rank in ['J', 'Q'] or self.suit == 'clubs'
    
    def get_trump_order(self):
        """
        Порядок козыря (для сравнения силы)
        Чем больше - тем старше
        """
        if not self.is_trump():
            return -1
        
        order = {
            ('7', 'clubs'): 0,
            ('Q', 'clubs'): 1,
            ('Q', 'spades'): 2,
            ('Q', 'hearts'): 3,
            ('Q', 'diamonds'): 4,
            ('J', 'clubs'): 5,
            ('J', 'spades'): 6,
            ('J', 'hearts'): 7,
            ('J', 'diamonds'): 8,
            ('A', 'clubs'): 9,
            ('10', 'clubs'): 10,
            ('K', 'clubs'): 11,
            ('9', 'clubs'): 12,
            ('8', 'clubs'): 13,
        }
        
        return order.get((self.rank, self.suit), -1)
    
    def __repr__(self):
        return f"{self.rank}{self.suit[0].upper()}"


# ============================================================================
# ПРИМЕР ИСПОЛЬЗОВАНИЯ
# ============================================================================

def main_loop():
    """
    Главный цикл бота
    """
    bot = KozelBot()
    vision = VisionModule(bot.driver)
    ai = bot.ai
    action = ActionModule(bot.driver)
    
    # Заходим на сайт
    bot.driver.get("https://kozel-online.com/")
    
    # Логинимся, ждём старта игры и т.д.
    # ...
    
    while True:
        # 1. Парсим состояние
        game_state = GameState()
        game_state.my_cards = vision.parse_my_cards()
        game_state.table_cards = vision.parse_table_state()
        scores = vision.get_scores()
        game_state.my_team_score = scores['my']
        game_state.opponent_score = scores['opponent']
        
        # 2. Проверяем, наш ли ход
        if not vision.is_my_turn():
            time.sleep(1)
            continue
        
        # 3. Выбираем карту
        card_to_play = ai.choose_card(game_state)
        
        # 4. Играем карту
        action.play_card(card_to_play)
        
        # 5. Ждём следующий ход
        time.sleep(2)


if __name__ == "__main__":
    main_loop()
