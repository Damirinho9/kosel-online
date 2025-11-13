"""
БРАУЗЕРНОЕ РАСШИРЕНИЕ - ИИ ПОМОЩНИК ДЛЯ КОЗЛА
Безопасный вариант: подсказки в реальном времени
"""

# ============================================================================
# BROWSER EXTENSION ARCHITECTURE
# ============================================================================

"""
СТРУКТУРА РАСШИРЕНИЯ:

kozel-assistant/
├── manifest.json           # Конфигурация расширения
├── background.js           # Фоновый скрипт
├── content.js             # Скрипт на странице игры
├── popup.html             # UI расширения
├── popup.js               # Логика UI
├── ai/
│   ├── game_parser.js     # Парсинг состояния игры
│   ├── rules.js           # Правила козла
│   └── strategy.js        # ИИ логика
└── styles/
    └── extension.css      # Стили
"""


# ============================================================================
# 1. MANIFEST.JSON
# ============================================================================

MANIFEST = """
{
  "manifest_version": 3,
  "name": "Козёл Помощник",
  "version": "1.0",
  "description": "ИИ помощник для игры в козла онлайн",
  
  "permissions": [
    "activeTab",
    "storage"
  ],
  
  "host_permissions": [
    "https://kozel-online.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["https://kozel-online.com/*"],
      "js": ["content.js"],
      "css": ["styles/extension.css"],
      "run_at": "document_end"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
"""


# ============================================================================
# 2. CONTENT.JS - ГЛАВНЫЙ СКРИПТ НА СТРАНИЦЕ ИГРЫ
# ============================================================================

CONTENT_JS = """
// ============================================================================
// CONTENT SCRIPT - работает на странице kozel-online.com
// ============================================================================

class KozelAssistant {
    constructor() {
        this.gameState = null;
        this.overlayElement = null;
        this.init();
    }
    
    init() {
        console.log('[Козёл Помощник] Инициализация...');
        
        // Создаём overlay для подсказок
        this.createOverlay();
        
        // Запускаем мониторинг игры
        this.startMonitoring();
        
        // Слушаем сообщения от popup
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'getGameState') {
                sendResponse({ gameState: this.gameState });
            }
        });
    }
    
    createOverlay() {
        // Создаём div для подсказок
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'kozel-assistant-overlay';
        this.overlayElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(this.overlayElement);
        this.updateOverlay('Загрузка...');
    }
    
    updateOverlay(html) {
        if (this.overlayElement) {
            this.overlayElement.innerHTML = html;
        }
    }
    
    startMonitoring() {
        // Проверяем состояние игры каждую секунду
        setInterval(() => {
            this.parseGameState();
            this.updateRecommendations();
        }, 1000);
    }
    
    parseGameState() {
        // ВАЖНО: Адаптируй селекторы под реальную структуру сайта!
        
        try {
            // Парсим карты на руке
            const myCards = this.parseMyCards();
            
            // Парсим стол
            const tableCards = this.parseTableCards();
            
            // Парсим счёт
            const scores = this.parseScores();
            
            // Чей ход?
            const isMyTurn = this.checkIfMyTurn();
            
            this.gameState = {
                myCards: myCards,
                tableCards: tableCards,
                myScore: scores.my,
                opponentScore: scores.opponent,
                isMyTurn: isMyTurn,
                konNumber: this.guessKonNumber()
            };
            
        } catch (error) {
            console.error('[Козёл Помощник] Ошибка парсинга:', error);
            this.gameState = null;
        }
    }
    
    parseMyCards() {
        // Пример парсинга - АДАПТИРУЙ!
        const cardElements = document.querySelectorAll('.my-cards .card');
        
        return Array.from(cardElements).map(elem => {
            return {
                rank: elem.getAttribute('data-rank'),
                suit: elem.getAttribute('data-suit'),
                element: elem  // Сохраняем ссылку для подсветки
            };
        });
    }
    
    parseTableCards() {
        const tableElements = document.querySelectorAll('.table .card');
        
        return Array.from(tableElements).map(elem => {
            return {
                rank: elem.getAttribute('data-rank'),
                suit: elem.getAttribute('data-suit'),
                player: elem.getAttribute('data-player')
            };
        });
    }
    
    parseScores() {
        // Пример - адаптируй селекторы!
        const myScoreText = document.querySelector('.my-score')?.textContent || '0';
        const oppScoreText = document.querySelector('.opponent-score')?.textContent || '0';
        
        return {
            my: parseInt(myScoreText),
            opponent: parseInt(oppScoreText)
        };
    }
    
    checkIfMyTurn() {
        // Проверка, мой ли ход
        // Вариант 1: есть класс 'my-turn' на элементе
        return document.querySelector('.my-turn') !== null;
        
        // Вариант 2: карты кликабельны
        // return document.querySelector('.my-cards .card:not(.disabled)') !== null;
    }
    
    guessKonNumber() {
        // Попытка определить номер кона по счёту взяток
        // Это примерная логика
        const tricksPlayed = document.querySelectorAll('.trick-history .trick').length;
        return Math.floor(tricksPlayed / 8) + 1;
    }
    
    updateRecommendations() {
        if (!this.gameState || !this.gameState.isMyTurn) {
            this.updateOverlay(`
                <div style="text-align: center;">
                    <div style="font-size: 18px; margin-bottom: 10px;">🤖 Козёл Помощник</div>
                    <div style="color: #888;">Ожидание хода...</div>
                </div>
            `);
            return;
        }
        
        // Получаем рекомендацию от ИИ
        const recommendation = this.getAIRecommendation();
        
        // Подсвечиваем рекомендованную карту
        this.highlightRecommendedCard(recommendation.card);
        
        // Показываем рекомендацию
        this.updateOverlay(this.formatRecommendation(recommendation));
    }
    
    getAIRecommendation() {
        // ЗДЕСЬ ЛОГИКА ИИ
        // Можно вызывать локальный JS или API к Python backend
        
        const ai = new KozelAI();
        return ai.recommendCard(this.gameState);
    }
    
    highlightRecommendedCard(card) {
        // Убираем старую подсветку
        document.querySelectorAll('.ai-recommended').forEach(elem => {
            elem.classList.remove('ai-recommended');
        });
        
        // Подсвечиваем рекомендованную карту
        if (card && card.element) {
            card.element.classList.add('ai-recommended');
        }
    }
    
    formatRecommendation(rec) {
        const cardName = this.getCardName(rec.card);
        const reasoning = rec.reasoning;
        const situation = rec.situation;
        
        return `
            <div style="text-align: center;">
                <div style="font-size: 18px; margin-bottom: 10px;">🤖 Козёл Помощник</div>
            </div>
            
            <div style="margin: 10px 0; padding: 10px; background: rgba(0,255,0,0.2); border-radius: 5px;">
                <strong>Рекомендация:</strong><br/>
                <span style="font-size: 18px; color: #0f0;">${cardName}</span>
            </div>
            
            <div style="margin: 10px 0; font-size: 12px;">
                <strong>Ситуация:</strong> ${situation}
            </div>
            
            <div style="margin: 10px 0; font-size: 12px; color: #aaa;">
                ${reasoning}
            </div>
            
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; font-size: 11px; color: #888;">
                Счёт: Мы ${this.gameState.myScore} - ${this.gameState.opponentScore} Они
            </div>
        `;
    }
    
    getCardName(card) {
        const ranks = {
            '7': '7', '8': '8', '9': '9', '10': '10',
            'J': 'Валет', 'Q': 'Дама', 'K': 'Король', 'A': 'Туз'
        };
        
        const suits = {
            'clubs': '♣', 'spades': '♠',
            'hearts': '♥', 'diamonds': '♦'
        };
        
        return `${ranks[card.rank]} ${suits[card.suit]}`;
    }
}


// ============================================================================
// ИИ ЛОГИКА (упрощённая версия для браузера)
// ============================================================================

class KozelAI {
    recommendCard(gameState) {
        const legalCards = this.getLegalCards(gameState);
        
        if (legalCards.length === 1) {
            return {
                card: legalCards[0],
                situation: 'Только один легальный ход',
                reasoning: 'Нет выбора - это единственная карта, которой можно ходить.'
            };
        }
        
        // Анализируем ситуацию
        const situation = this.analyzeSituation(gameState);
        
        // Выбираем стратегию
        if (situation.trapQueen) {
            return this.strategyTrapQueen(gameState, legalCards);
        }
        
        if (situation.need90) {
            return this.strategyGoFor90(gameState, legalCards);
        }
        
        if (situation.protect60) {
            return this.strategyProtect60(gameState, legalCards);
        }
        
        return this.strategyDefault(gameState, legalCards);
    }
    
    getLegalCards(gameState) {
        const myCards = gameState.myCards;
        const tableCards = gameState.tableCards;
        
        // Если стол пустой
        if (tableCards.length === 0) {
            // Проверяем ограничения на козырь
            if (gameState.konNumber === 1) {
                // В первом кону нельзя козырять
                return myCards.filter(c => !this.isTrump(c));
            }
            return myCards;  // Упрощено - на самом деле нужна проверка кто открывал
        }
        
        // Определяем масть захода
        const leadCard = tableCards[0];
        const leadSuit = this.getSimpleSuit(leadCard);
        
        if (leadSuit === null) {
            // Зашли козырем - можно любую карту
            return myCards;
        }
        
        // Есть ли простая карта масти?
        const simpleSuit = myCards.filter(c => this.getSimpleSuit(c) === leadSuit);
        
        if (simpleSuit.length > 0) {
            return simpleSuit;
        }
        
        return myCards;
    }
    
    isTrump(card) {
        return card.rank === 'J' || card.rank === 'Q' || card.suit === 'clubs';
    }
    
    getSimpleSuit(card) {
        if (this.isTrump(card)) return null;
        return card.suit;
    }
    
    analyzeSituation(gameState) {
        // Упрощённый анализ
        return {
            need90: false,  // TODO: оценка по подсчёту очков
            protect60: false,
            trapQueen: this.hasSevenClubs(gameState) && !this.queenClubsPlayed(gameState)
        };
    }
    
    hasSevenClubs(gameState) {
        return gameState.myCards.some(c => c.rank === '7' && c.suit === 'clubs');
    }
    
    queenClubsPlayed(gameState) {
        // Проверка, играла ли уже дама треф
        return gameState.tableCards.some(c => c.rank === 'Q' && c.suit === 'clubs');
    }
    
    strategyTrapQueen(gameState, legalCards) {
        // Если дама на столе - кладём 7
        const queenOnTable = gameState.tableCards.find(c => c.rank === 'Q' && c.suit === 'clubs');
        
        if (queenOnTable) {
            const sevenClubs = legalCards.find(c => c.rank === '7' && c.suit === 'clubs');
            if (sevenClubs) {
                return {
                    card: sevenClubs,
                    situation: 'ПОИМКА ДАМЫ! 🎯',
                    reasoning: 'Дама треф на столе - ловим её семёркой! +4 очка и конец кона.'
                };
            }
        }
        
        // Провоцируем
        return {
            card: legalCards[0],  // Упрощённо
            situation: 'Провокация дамы',
            reasoning: 'Пытаемся спровоцировать соперника на подкладку дамы треф.'
        };
    }
    
    strategyGoFor90(gameState, legalCards) {
        // Играем на максимум
        const strongest = this.getStrongestCard(legalCards);
        
        return {
            card: strongest,
            situation: 'Идём на >90 очков',
            reasoning: 'Берём взятку сильной картой, чтобы набрать максимум очков.'
        };
    }
    
    strategyProtect60(gameState, legalCards) {
        // Защищаем минимум
        const weakest = this.getWeakestCard(legalCards);
        
        return {
            card: weakest,
            situation: 'Защита >60',
            reasoning: 'Не рискуем, сбрасываем слабую карту.'
        };
    }
    
    strategyDefault(gameState, legalCards) {
        // Разумная игра
        const reasonable = this.getReasonableCard(legalCards);
        
        return {
            card: reasonable,
            situation: 'Обычная игра',
            reasoning: 'Играем средней картой, сохраняя баланс.'
        };
    }
    
    getStrongestCard(cards) {
        return cards.reduce((strongest, card) => {
            return this.compareCards(card, strongest) > 0 ? card : strongest;
        });
    }
    
    getWeakestCard(cards) {
        return cards.reduce((weakest, card) => {
            return this.compareCards(card, weakest) < 0 ? card : weakest;
        });
    }
    
    getReasonableCard(cards) {
        // Средняя по силе
        const sorted = cards.sort((a, b) => this.compareCards(b, a));
        return sorted[Math.floor(sorted.length / 2)];
    }
    
    compareCards(card1, card2) {
        // Упрощённое сравнение - TODO: учесть козырность
        const points1 = this.getCardPoints(card1);
        const points2 = this.getCardPoints(card2);
        return points1 - points2;
    }
    
    getCardPoints(card) {
        const points = {
            '7': 0, '8': 0, '9': 0,
            'J': 2, 'Q': 3, 'K': 4,
            '10': 10, 'A': 11
        };
        return points[card.rank];
    }
}


// Запуск при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new KozelAssistant();
    });
} else {
    new KozelAssistant();
}
"""


# ============================================================================
# 3. POPUP.HTML - UI РАСШИРЕНИЯ
# ============================================================================

POPUP_HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            width: 300px;
            padding: 15px;
            font-family: Arial, sans-serif;
            background: #1a1a1a;
            color: white;
        }
        
        h2 {
            margin: 0 0 15px 0;
            font-size: 18px;
            text-align: center;
        }
        
        .status {
            padding: 10px;
            background: #333;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        
        .button {
            width: 100%;
            padding: 10px;
            margin: 5px 0;
            background: #4CAF50;
            border: none;
            border-radius: 5px;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }
        
        .button:hover {
            background: #45a049;
        }
        
        .stats {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #555;
            font-size: 12px;
        }
        
        .stat-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <h2>🤖 Козёл Помощник</h2>
    
    <div class="status" id="status">
        <div id="statusText">Загрузка...</div>
    </div>
    
    <button class="button" id="toggleBtn">Включить/Выключить</button>
    <button class="button" id="settingsBtn">Настройки</button>
    
    <div class="stats">
        <div class="stat-row">
            <span>Игр сыграно:</span>
            <span id="gamesPlayed">0</span>
        </div>
        <div class="stat-row">
            <span>Побед:</span>
            <span id="gamesWon">0</span>
        </div>
        <div class="stat-row">
            <span>Винрейт:</span>
            <span id="winrate">0%</span>
        </div>
    </div>
    
    <script src="popup.js"></script>
</body>
</html>
"""


# ============================================================================
# 4. ИНСТРУКЦИЯ ПО УСТАНОВКЕ
# ============================================================================

INSTALLATION_GUIDE = """
КАК УСТАНОВИТЬ РАСШИРЕНИЕ:

1. Создай папку kozel-assistant/
2. Положи туда файлы:
   - manifest.json
   - content.js
   - popup.html
   - popup.js

3. Открой Chrome и перейди в chrome://extensions/
4. Включи "Режим разработчика" (Developer mode)
5. Нажми "Загрузить распакованное расширение"
6. Выбери папку kozel-assistant/

ГОТОВО! Расширение установлено.

ИСПОЛЬЗОВАНИЕ:

1. Зайди на kozel-online.com
2. Начни игру
3. В правом верхнем углу появится окно с подсказками
4. Рекомендованная карта будет подсвечиваться

ВАЖНО:
- Адаптируй селекторы в content.js под реальную структуру сайта!
- Проверь консоль браузера (F12) на ошибки
- Расширение не делает ходы автоматически - только подсказывает
"""


# ============================================================================
# 5. PYTHON BACKEND (опционально)
# ============================================================================

"""
Если хочешь более мощный ИИ - можно сделать Python backend:

1. Запусти локальный Flask сервер
2. Расширение шлёт запросы на localhost:5000/recommend
3. Python возвращает рекомендацию

Плюсы:
- Можно использовать Claude API для сложных решений
- Полный Python код логики игры
- История игр, статистика, обучение

Минусы:
- Нужно держать сервер запущенным
- Чуть сложнее в настройке
"""

PYTHON_BACKEND = '''
from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для расширения

# Твой API ключ Claude
ANTHROPIC_API_KEY = "..."

@app.route('/recommend', methods=['POST'])
def recommend():
    """
    Получить рекомендацию от ИИ
    
    Вход: { gameState: {...} }
    Выход: { card: {...}, reasoning: "..." }
    """
    game_state = request.json['gameState']
    
    # Вариант 1: Локальная логика (быстро)
    recommendation = local_ai_logic(game_state)
    
    # Вариант 2: Через Claude API (мощно, но медленнее)
    # recommendation = claude_api_logic(game_state)
    
    return jsonify(recommendation)


def local_ai_logic(game_state):
    """Быстрая локальная логика"""
    # ... твой код из KozelAI ...
    pass


def claude_api_logic(game_state):
    """Используем Claude для сложных решений"""
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    prompt = f"""
Ты эксперт в игре "Козёл". Проанализируй ситуацию и дай рекомендацию.

Правила игры:
{open('правила_козла.txt').read()}

Текущее состояние:
Мои карты: {game_state['myCards']}
Стол: {game_state['tableCards']}
Счёт: {game_state['myScore']} - {game_state['opponentScore']}

Какой картой лучше ходить и почему?
Ответь в формате JSON: {{"card": ..., "reasoning": "..."}}
"""
    
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    import json
    return json.loads(message.content[0].text)


if __name__ == '__main__':
    app.run(port=5000)
'''


if __name__ == "__main__":
    print(__doc__)
    print("\\n" + "="*70)
    print("Файл с кодом создан: kozel_bot_architecture.py")
    print("Документация по Browser Extension готова!")
    print("="*70)
