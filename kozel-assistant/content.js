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

        console.log('[Козёл Помощник] Инициализация...');
        this.init();
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
                sendResponse({ gameState: this.gameState, enabled: this.enabled });
            } else if (msg.action === 'toggle') {
                this.enabled = !this.enabled;
                this.updateOverlay();
                sendResponse({ enabled: this.enabled });
            }
        });
    }

    /**
     * Внедряем хелперы для доступа к Angular scope
     */
    injectAngularHelpers() {
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                window.__kozelGetGameState = function() {
                    const gameTable = document.querySelector('game-table');
                    if (!gameTable) return null;

                    try {
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
                            myTurn: scope.bottomCards?.some(c => c.allowClick) || false
                        };
                    } catch(e) {
                        console.error('[Козёл Помощник] Ошибка получения scope:', e);
                        return null;
                    }
                };

                // Делаем доступным глобально
                window.addEventListener('message', function(event) {
                    if (event.data.type === 'GET_GAME_STATE') {
                        const state = window.__kozelGetGameState();
                        window.postMessage({ type: 'GAME_STATE_RESPONSE', state: state }, '*');
                    }
                });
            })();
        `;
        document.head.appendChild(script);
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

        const { myCards, tableCards, myTurn, score, recommendation } = this.gameState;

        let html = `
            <div class="ka-score">
                <div>Счёт: <strong>${score[1]}</strong> : ${score[0]}</div>
            </div>
        `;

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

            await this.parseGameState();
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
                score: angularState.score,
                players: angularState.players,
                myTeamScore: angularState.score[1],
                opponentScore: angularState.score[0],
                pointsInKon: 0, // TODO: можно вычислять из истории взяток
                konNumber: 1 // TODO: определять номер кона
            };

        } catch (error) {
            console.error('[Козёл Помощник] Ошибка парсинга:', error);
            this.gameState = null;
        }
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
    updateRecommendations() {
        if (!this.gameState || !this.gameState.myTurn) {
            this.clearHighlight();
            this.updateOverlay();
            return;
        }

        try {
            // Получаем рекомендацию от ИИ
            const recommendation = KozelAI.chooseCard(this.gameState);

            if (recommendation) {
                this.gameState.recommendation = recommendation;
                this.highlightRecommendedCard(recommendation.cardIndex);
                this.updateOverlay();
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
