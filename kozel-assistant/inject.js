/**
 * Скрипт внедрения для доступа к Angular scope
 * Выполняется в контексте страницы (world: MAIN)
 */

(function() {
    console.log('[Inject] Внедрение в контекст страницы...');

    window.__kozelGetGameState = function() {
        const gameTable = document.querySelector('game-table');
        if (!gameTable) return null;

        try {
            // Ищем div.game-table внутри game-table - у него правильный scope
            const gameTableDiv = gameTable.querySelector('.game-table');
            if (!gameTableDiv) return null;

            const scope = angular.element(gameTableDiv).scope();
            if (!scope) return null;

            // Функция для сериализации карты (только данные, без функций)
            const serializeCard = (cardData) => {
                if (!cardData || !cardData.card) return null;
                const card = cardData.card;

                // Извлекаем значения напрямую и проверяем что они не undefined
                const rank = card.val || card.rank || card.value || card.r || '';
                const suit = card.suit || card.s || '';

                // Создаем простой объект с примитивными значениями
                const result = {
                    rank: rank,
                    suit: suit,
                    allowClick: Boolean(cardData.allowClick)
                };

                return result;
            };

            // Определяем команды (классический Козёл 2х2)
            const myTeamIndex = 0;  // Мы с игроком напротив (top)
            const opponentTeamIndex = 1;  // Игроки слева и справа

            return {
                myCards: (scope.bottomCards || []).map(serializeCard).filter(c => c !== null),
                tableCards: (scope.centreCards || []).map(serializeCard).filter(c => c !== null),
                topCards: (scope.topCards || []).length,
                leftCards: (scope.leftCards || []).length,
                rightCards: (scope.rightCards || []).length,

                // Игроки и партнёр
                players: {
                    top: scope.topPlayerName || '',
                    left: scope.leftPlayerName || '',
                    right: scope.rightPlayerName || '',
                    bottom: 'Вы'
                },
                partner: scope.topPlayerName || '',  // Партнёр всегда напротив (top)

                // Счёт
                scoreWindow: scope.scoreWindow ? {
                    roundScore: scope.scoreWindow.roundScore || 0,  // Очки текущего раунда
                    gameScore: scope.scoreWindow.gameScore || [0, 0],  // Счёт партий [команда1, команда2]
                    score: scope.scoreWindow.score || [0, 0],  // Очки в раунде [команда1, команда2]
                    win: scope.scoreWindow.win || false,  // Окно победы
                    visible: scope.scoreWindow.visible || false
                } : null,

                // Команды
                teams: {
                    myTeam: myTeamIndex,
                    opponentTeam: opponentTeamIndex,
                    myScore: (scope.scoreWindow?.score || [0, 0])[myTeamIndex],
                    opponentScore: (scope.scoreWindow?.score || [0, 0])[opponentTeamIndex],
                    myGames: (scope.scoreWindow?.gameScore || [0, 0])[myTeamIndex],
                    opponentGames: (scope.scoreWindow?.gameScore || [0, 0])[opponentTeamIndex]
                },

                myTurn: scope.currentMove === 'bottom'  // Определяем ход по currentMove
            };
        } catch(e) {
            console.error('[Козёл Помощник] Ошибка получения scope:', e);
            return null;
        }
    };

    // Обработчик сообщений для content script
    window.addEventListener('message', function(event) {
        if (event.data.type === 'GET_GAME_STATE') {
            const state = window.__kozelGetGameState();
            // Глубокое клонирование через JSON для удаления всех функций
            const cleanState = JSON.parse(JSON.stringify(state));
            window.postMessage({ type: 'GAME_STATE_RESPONSE', state: cleanState }, '*');
        }
    });

    console.log('[Inject] ✓ Функции доступа к игре созданы');
})();
