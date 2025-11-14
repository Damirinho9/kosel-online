/**
 * Content Script для Козёл Помощник
 * Работает на странице kozel-online.com
 */

class KozelAssistant {
    constructor() {
        this.gameState = null;
        this.overlayElement = null;
        this.enabled = true;
        this.highlightedCard = null;
        this.stats = null;
        this.lastGameScore = null; // Для отслеживания конца игры

        // V2.0: Профилирование и история
        this.profiler = null;
        this.moveHistory = null;
        this.playerProfiles = null;
        this.lastPlayedCard = null;  // Для отслеживания последнего хода

        // V2.0 Phase 3: Machine Learning
        this.mlModel = null;
        this.mlEnabled = false;
        this.mlStats = null;

        console.log('[Козёл Помощник] Инициализация...');
        this.init();
        this.initStatistics();
        this.initAdaptiveAI();  // V2.0
        this.initMachineLearning();  // V2.0 Phase 3
    }

    init() {
        // Ждем загрузки Angular
        setTimeout(() => {
            this.injectAngularHelpers();
            this.createOverlay();
            this.startMonitoring();
            console.log('[Козёл Помощник] ✓ Готов к работе!');
        }, 2000);

        // Слушаем сообщения от popup
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (msg.action === 'getGameState') {
                sendResponse({
                    gameState: this.gameState,
                    enabled: this.enabled,
                    stats: this.stats,
                    playerProfiles: this.playerProfiles,  // V2.0
                    mlEnabled: this.mlEnabled,             // V2.0 Phase 3
                    mlStats: this.mlStats                  // V2.0 Phase 3
                });
            } else if (msg.action === 'toggle') {
                this.enabled = !this.enabled;
                this.updateOverlay();
                sendResponse({ enabled: this.enabled });
            } else if (msg.action === 'getStats') {
                sendResponse({ stats: this.stats });
            } else if (msg.action === 'trainML') {
                // Обучить ML модель
                this.trainMLModel().then(result => {
                    sendResponse({ success: result });
                });
                return true;  // Async response
            }
        });
    }

    /**
     * Инициализация системы статистики
     */
    async initStatistics() {
        if (typeof GameStatistics !== 'undefined') {
            this.statsManager = new GameStatistics();
            this.stats = await this.statsManager.getStats();
        }
    }

    /**
     * V2.0: Инициализация адаптивного AI
     */
    async initAdaptiveAI() {
        // Инициализация профайлера
        if (typeof PlayerProfiler !== 'undefined') {
            this.profiler = new PlayerProfiler();
            await this.profiler.loadProfiles();
            console.log('[Козёл Помощник V2.0] Профайлер загружен');
        }

        // Инициализация истории ходов
        if (typeof MoveHistory !== 'undefined') {
            this.moveHistory = new MoveHistory();
            console.log('[Козёл Помощник V2.0] История ходов активирована');
        }
    }

    /**
     * V2.0 Phase 3: Инициализация Machine Learning
     */
    async initMachineLearning() {
        console.log('[Козёл Помощник ML] Загрузка TensorFlow.js...');

        try {
            // Загружаем TensorFlow.js
            await mlLoader.loadTensorFlow();

            // Создаём ML модель
            if (typeof KozelML !== 'undefined') {
                this.mlModel = new KozelML();

                // Пытаемся загрузить сохранённую модель
                const loaded = await this.mlModel.loadModel();

                if (loaded) {
                    this.mlEnabled = true;
                    this.mlStats = this.mlModel.getStats();
                    console.log('[Козёл Помощник ML] ✓ ML модель загружена');
                    console.log('[Козёл Помощник ML] Статистика:', this.mlStats);
                } else {
                    console.warn('[Козёл Помощник ML] ML модель не загружена');
                }
            }
        } catch (error) {
            console.error('[Козёл Помощник ML] Ошибка инициализации ML:', error);
            this.mlEnabled = false;
        }
    }

    /**
     * Внедряем хелперы для доступа к Angular scope
     */
    injectAngularHelpers() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement).appendChild(script);
        script.onload = () => {
            script.remove();
            console.log('[Козёл Помощник] Inject script загружен');
        };
    }

    /**
     * Получить состояние игры из Angular scope
     */
    getGameStateFromAngular() {
        return new Promise((resolve) => {
            const handler = (event) => {
                if (event.data.type === 'GAME_STATE_RESPONSE') {
                    window.removeEventListener('message', handler);
                    resolve(event.data.state);
                }
            };

            window.addEventListener('message', handler);
            window.postMessage({ type: 'GET_GAME_STATE' }, '*');

            // Таймаут на случай если не получим ответ
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(null);
            }, 1000);
        });
    }

    /**
     * Создать overlay для подсказок
     */
    createOverlay() {
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'kozel-assistant-overlay';
        this.overlayElement.innerHTML = `
            <div class="ka-header">
                <span>🤖 Козёл Помощник</span>
                <button class="ka-close" id="ka-toggle">—</button>
            </div>
            <div class="ka-content" id="ka-content">
                Загрузка...
            </div>
        `;

        document.body.appendChild(this.overlayElement);

        // Обработчик кнопки сворачивания
        document.getElementById('ka-toggle').addEventListener('click', () => {
            this.enabled = !this.enabled;
            this.updateOverlay();
        });
    }

    /**
     * Обновить overlay
     */
    updateOverlay(html = null) {
        const content = document.getElementById('ka-content');
        if (!content) return;

        if (!this.enabled) {
            content.innerHTML = '<div class="ka-disabled">Помощник выключен</div>';
            return;
        }

        if (html) {
            content.innerHTML = html;
        } else if (this.gameState) {
            this.renderGameState();
        } else {
            content.innerHTML = '<div class="ka-waiting">Ожидание игры...</div>';
        }
    }

    /**
     * Отрисовать состояние игры
     */
    renderGameState() {
        const content = document.getElementById('ka-content');
        if (!content) return;

        const { myCards, tableCards, myTurn, teams, partner, scoreWindow, recommendation } = this.gameState;

        let html = '';

        // Отображаем счёт партий и раунда
        if (scoreWindow) {
            html += `
                <div class="ka-score">
                    <div style="font-weight: bold; margin-bottom: 5px;">
                        Партии: ${teams.myGames} : ${teams.opponentGames}
                    </div>
                    <div style="font-size: 12px;">
                        Раунд: ${teams.myScore} : ${teams.opponentScore}
                    </div>
                </div>
            `;
        }

        // Партнёр
        if (partner) {
            html += `
                <div class="ka-partner" style="font-size: 11px; color: #888; margin: 5px 0;">
                    Партнёр: ${partner}
                </div>
            `;
        }

        // V2.0: Профили игроков
        if (this.playerProfiles && this.playerProfiles.top) {
            const partnerProfile = this.playerProfiles.top;
            if (partnerProfile.analysis && partnerProfile.analysis.confidence > 0.3) {
                const style = partnerProfile.analysis.style;
                const styleEmoji = {
                    'aggressive': '⚔️',
                    'defensive': '🛡️',
                    'risky': '🎲',
                    'assertive': '💪',
                    'balanced': '⚖️'
                };
                html += `
                    <div style="font-size: 10px; color: #aaa; margin: 3px 0;">
                        Стиль: ${styleEmoji[style] || '⚖️'} ${partnerProfile.analysis.description}
                    </div>
                `;
            }
        }

        if (!myTurn) {
            html += '<div class="ka-waiting">⏳ Ожидание вашего хода...</div>';
        } else if (recommendation) {
            html += `
                <div class="ka-recommendation">
                    <div class="ka-rec-card">${recommendation.card.toString()}</div>
                    <div class="ka-rec-reason">${recommendation.reasoning}</div>
                </div>
            `;

            // Статистика
            html += `
                <div class="ka-stats">
                    <div>Карт на руке: ${myCards.length}</div>
                    <div>Карт на столе: ${tableCards.length}</div>
                </div>
            `;
        }

        content.innerHTML = html;
    }

    /**
     * Запустить мониторинг игры
     */
    startMonitoring() {
        setInterval(async () => {
            if (!this.enabled) return;

            const previousState = this.gameState;
            await this.parseGameState();

            // V2.0: Детекция ходов и запись в историю
            await this.detectAndRecordMoves(previousState);

            this.updateRecommendations();
        }, 1000);
    }

    /**
     * Парсинг состояния игры
     */
    async parseGameState() {
        try {
            const angularState = await this.getGameStateFromAngular();

            if (!angularState) {
                this.gameState = null;
                return;
            }

            // Парсим карты
            const myCards = this.parseCards(angularState.myCards);
            const tableCards = this.parseTableCards(angularState.tableCards);

            this.gameState = {
                myCards: myCards,
                tableCards: tableCards,
                myTurn: angularState.myTurn,

                // Счёт и команды
                scoreWindow: angularState.scoreWindow,
                teams: angularState.teams,
                partner: angularState.partner,
                players: angularState.players,

                // Для совместимости со старым кодом
                score: angularState.scoreWindow?.gameScore || [0, 0],
                myTeamScore: angularState.teams?.myScore || 0,
                opponentScore: angularState.teams?.opponentScore || 0,
                pointsInKon: 0, // TODO: можно вычислять из истории взяток
                konNumber: 1 // TODO: определять номер кона
            };

            // Проверка конца игры для записи статистики
            this.checkGameEnd();

            // V2.0: Анализ игроков и профилирование
            await this.analyzePlayersAndAdapt();

        } catch (error) {
            console.error('[Козёл Помощник] Ошибка парсинга:', error);
            this.gameState = null;
        }
    }

    /**
     * Проверить конец игры и записать статистику
     */
    async checkGameEnd() {
        if (!this.gameState || !this.gameState.scoreWindow) return;

        const { scoreWindow, teams, partner } = this.gameState;

        // Проверяем если это окно победы и счёт изменился
        if (scoreWindow.win && scoreWindow.visible) {
            const currentGameScore = JSON.stringify(scoreWindow.gameScore);

            // Если это новая игра (счёт изменился)
            if (this.lastGameScore && this.lastGameScore !== currentGameScore) {
                // Записываем результат в статистику
                if (this.statsManager) {
                    await this.statsManager.recordGame({
                        myGames: teams.myGames,
                        opponentGames: teams.opponentGames,
                        myScore: teams.myScore,
                        opponentScore: teams.opponentScore,
                        partner: partner
                    });

                    // Обновляем статистику
                    this.stats = await this.statsManager.getStats();
                }
            }

            this.lastGameScore = currentGameScore;
        }
    }

    /**
     * V2.0: Анализировать игроков и адаптировать стратегию
     */
    async analyzePlayersAndAdapt() {
        if (!this.profiler || !this.gameState) return;

        const { players, partner } = this.gameState;

        // Получаем профили всех игроков
        this.playerProfiles = this.profiler.getGameSummary(players);

        // Добавляем профили в gameState для AI
        this.gameState.playerProfiles = this.playerProfiles;
        this.gameState.partnerProfile = this.playerProfiles.top;  // Партнёр всегда top

        // Определяем профили противников
        this.gameState.opponentProfiles = {
            left: this.playerProfiles.left,
            right: this.playerProfiles.right
        };
    }

    /**
     * V2.0: Детекция и запись ходов
     */
    async detectAndRecordMoves(previousState) {
        if (!this.gameState || !previousState) return;
        if (!this.profiler && !this.moveHistory) return;

        const { tableCards, myCards, players } = this.gameState;
        const prevTableCards = previousState.tableCards || [];

        // Детекция новой карты на столе
        if (tableCards.length > prevTableCards.length) {
            const newCard = tableCards[tableCards.length - 1];
            const { player, card } = newCard;

            console.log(`[Козёл V2.0] Обнаружен ход: ${player} сыграл ${card.toString()}`);

            // Определяем имя игрока
            const playerName = this.getPlayerName(player, players);

            // Определяем кто берет взятку
            const trickWinner = tableCards.length === 4 ? KozelRules.getTrickWinner(tableCards) : null;
            const trickWon = trickWinner === player;

            // Подсчёт очков во взятке
            let trickPoints = 0;
            if (typeof KozelScoring !== 'undefined' && tableCards.length === 4) {
                trickPoints = KozelScoring.evaluateTrickValue(tableCards).points;
            }

            // Записываем в профайлер
            if (this.profiler && playerName) {
                await this.profiler.recordMove(playerName, {
                    card: card,
                    isFirstInTrick: tableCards.length === 1,
                    trickWon: trickWon,
                    trickPoints: trickPoints,
                    tableCards: tableCards,
                    gameScore: {
                        myScore: this.gameState.myTeamScore,
                        opponentScore: this.gameState.opponentScore
                    }
                });

                console.log(`[Козёл V2.0] ✓ Ход записан в профайлер: ${playerName}`);
            }

            // Записываем в историю ходов (только свои ходы)
            if (this.moveHistory && player === 'bottom') {
                const recommendation = this.gameState.recommendation;
                const wasRecommended = recommendation &&
                    card.rank === recommendation.card.rank &&
                    card.suit === recommendation.card.suit;

                await this.moveHistory.recordMove({
                    myCards: previousState.myCards || [],
                    tableCards: prevTableCards,
                    myScore: this.gameState.myTeamScore,
                    opponentScore: this.gameState.opponentScore,
                    playedCard: card,
                    wasRecommended: wasRecommended,
                    aiRecommendation: recommendation?.card || null,
                    trickWon: trickWon,
                    pointsGained: trickWon ? trickPoints : 0,
                    whoWonTrick: trickWinner,
                    myTurn: previousState.myTurn,
                    isFirstInTrick: prevTableCards.length === 0,
                    partner: this.gameState.partner,
                    players: players
                });

                console.log(`[Козёл V2.0] ✓ Свой ход записан в историю`);
            }
        }

        // Детекция окончания взятки (стол очистился)
        if (prevTableCards.length === 4 && tableCards.length === 0) {
            console.log('[Козёл V2.0] Взятка завершена, стол очищен');
        }

        // Детекция окончания игры
        if (previousState.scoreWindow && !previousState.scoreWindow.visible &&
            this.gameState.scoreWindow && this.gameState.scoreWindow.visible) {

            console.log('[Козёл V2.0] Игра завершена');

            // Записываем результат в историю
            if (this.moveHistory) {
                const result = {
                    result: this.gameState.scoreWindow.win ? 'win' : 'loss',
                    finalScore: {
                        myGames: this.gameState.teams.myGames,
                        opponentGames: this.gameState.teams.opponentGames,
                        myScore: this.gameState.teams.myScore,
                        opponentScore: this.gameState.teams.opponentScore
                    },
                    partner: this.gameState.partner
                };

                await this.moveHistory.endGame(result);
                console.log('[Козёл V2.0] ✓ Результат игры записан');
            }

            // Сохраняем профили
            if (this.profiler) {
                await this.profiler.saveProfiles();
                console.log('[Козёл V2.0] ✓ Профили игроков сохранены');
            }

            // V2.0 Phase 3: Обучаем ML модель
            if (this.mlEnabled && this.mlModel) {
                console.log('[Козёл ML] Начинаем обучение после завершения игры...');
                await this.trainMLModel();
            }
        }
    }

    /**
     * V2.0 Phase 3: Обучить ML модель на последних играх
     */
    async trainMLModel() {
        if (!this.mlEnabled || !this.mlModel || !this.moveHistory) {
            console.log('[Козёл ML] ML не активен или отсутствуют зависимости');
            return false;
        }

        try {
            // Получаем обучающие данные из последних 5 игр
            const rawData = await this.moveHistory.getRecentGamesForTraining(5);

            if (!rawData || rawData.length === 0) {
                console.log('[Козёл ML] Нет данных для обучения');
                return false;
            }

            console.log(`[Козёл ML] Подготовка ${rawData.length} обучающих примеров`);

            // Кодируем данные для ML
            const trainingData = [];
            for (const example of rawData) {
                const encodedState = this.mlModel.encoder.encodeGameState(example.state);
                const encodedAction = this.mlModel.encoder.encodeAction(example.action);

                trainingData.push({
                    state: encodedState,
                    action: encodedAction,
                    reward: example.reward
                });
            }

            // Обучаем модель
            const success = await this.mlModel.train(trainingData);

            if (success) {
                // Сохраняем модель
                await this.mlModel.saveModel();

                // Обновляем статистику
                this.mlStats = this.mlModel.getStats();

                console.log('[Козёл ML] ✓ Обучение завершено успешно');
                return true;
            } else {
                console.log('[Козёл ML] ✗ Обучение не удалось');
                return false;
            }

        } catch (error) {
            console.error('[Козёл ML] Ошибка обучения:', error);
            return false;
        }
    }

    /**
     * Получить имя игрока по позиции
     */
    getPlayerName(position, players) {
        if (!players || !players[position]) {
            return `Player_${position}`;
        }
        return players[position].name || players[position].username || `Player_${position}`;
    }

    /**
     * Парсинг карт из Angular данных
     */
    parseCards(angularCards) {
        if (!angularCards || !Array.isArray(angularCards)) {
            return [];
        }

        return angularCards.map(cardData => {
            const cardObj = cardData.card || cardData;

            // Попытка извлечь ранг и масть из различных форматов
            let rank = cardObj.rank || cardObj.value || cardObj.r;
            let suit = cardObj.suit || cardObj.s;

            // Нормализация
            if (rank && suit) {
                return Card.normalize(rank, suit);
            }

            return null;
        }).filter(card => card !== null);
    }

    /**
     * Парсинг карт на столе
     */
    parseTableCards(angularTableCards) {
        if (!angularTableCards || !Array.isArray(angularTableCards)) {
            return [];
        }

        return angularTableCards.map((cardData, index) => {
            const card = this.parseCards([cardData])[0];

            if (!card) return null;

            // Определяем игрока по позиции
            const positions = ['bottom', 'left', 'top', 'right'];
            const player = positions[index % 4];

            return { player, card };
        }).filter(item => item !== null);
    }

    /**
     * Обновить рекомендации
     */
    async updateRecommendations() {
        if (!this.gameState) {
            console.log('[Козёл Помощник] Нет gameState');
            this.clearHighlight();
            this.updateOverlay();
            return;
        }

        if (!this.gameState.myTurn) {
            console.log('[Козёл Помощник] Не мой ход, myTurn:', this.gameState.myTurn);
            this.clearHighlight();
            this.updateOverlay();
            return;
        }

        console.log('[Козёл Помощник] МОЙ ХОД! Карт:', this.gameState.myCards.length);

        try {
            // Получаем рекомендацию от ИИ (с ML если доступен)
            const mlModelToUse = (this.mlEnabled && this.mlModel) ? this.mlModel : null;
            const recommendation = await KozelAI.chooseCard(this.gameState, mlModelToUse);

            console.log('[Козёл Помощник] Рекомендация:', recommendation);

            if (recommendation) {
                this.gameState.recommendation = recommendation;
                this.highlightRecommendedCard(recommendation.cardIndex);
                this.updateOverlay();
                console.log('[Козёл Помощник] ✓ Рекомендация показана');
            }

        } catch (error) {
            console.error('[Козёл Помощник] Ошибка получения рекомендации:', error);
        }
    }

    /**
     * Подсветить рекомендованную карту
     */
    highlightRecommendedCard(cardIndex) {
        this.clearHighlight();

        // Находим карты которые можно кликнуть
        const clickableCards = document.querySelectorAll('game-card[allow-click="true"]');

        if (clickableCards[cardIndex]) {
            const cardElement = clickableCards[cardIndex];
            cardElement.classList.add('ka-highlight');
            this.highlightedCard = cardElement;

            // Добавляем метку
            const label = document.createElement('div');
            label.className = 'ka-card-label';
            label.textContent = '✓';
            cardElement.style.position = 'relative';
            cardElement.appendChild(label);
        }
    }

    /**
     * Убрать подсветку
     */
    clearHighlight() {
        if (this.highlightedCard) {
            this.highlightedCard.classList.remove('ka-highlight');

            const label = this.highlightedCard.querySelector('.ka-card-label');
            if (label) {
                label.remove();
            }

            this.highlightedCard = null;
        }

        // Убираем все подсветки на всякий случай
        document.querySelectorAll('.ka-highlight').forEach(el => {
            el.classList.remove('ka-highlight');
        });

        document.querySelectorAll('.ka-card-label').forEach(el => {
            el.remove();
        });
    }
}

// Запуск помощника
if (typeof KozelAI !== 'undefined' && typeof KozelRules !== 'undefined' && typeof Card !== 'undefined') {
    const assistant = new KozelAssistant();
    console.log('[Козёл Помощник] Помощник загружен и готов!');
} else {
    console.error('[Козёл Помощник] Ошибка: не все модули загружены');
}
