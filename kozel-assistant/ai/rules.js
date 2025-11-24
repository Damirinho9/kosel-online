/**
 * Правила игры в Козла
 * Основано на документации из проекта
 */
class KozelRules {
    /**
     * Получить легальные карты для хода
     * @param {Card[]} myCards - карты на руке
     * @param {Array} tableCards - карты на столе [{player, card}]
     * @param {Object} gameState - состояние игры
     */
    static getLegalCards(myCards, tableCards, gameState = {}) {
        if (!myCards || myCards.length === 0) {
            return [];
        }

        // Если стол пустой - первый ход в взятке
        if (!tableCards || tableCards.length === 0) {
            return this._filterFirstMoveRestrictions(myCards, gameState);
        }

        // Определяем масть захода (первая карта на столе)
        const leadCard = tableCards[0].card;
        const leadSuit = leadCard.getSimpleSuit();

        // Если зашли козырем - можно любую карту
        if (leadSuit === null) {
            return myCards;
        }

        // Есть ли у нас простая карта этой масти?
        const simpleCardsOfSuit = myCards.filter(card =>
            card.getSimpleSuit() === leadSuit
        );

        // Если есть карты масти захода - ОБЯЗАТЕЛЬНО подкладываем
        if (simpleCardsOfSuit.length > 0) {
            return simpleCardsOfSuit;
        }

        // Нет простой масти - можно любую карту
        return myCards;
    }

    /**
     * Ограничения на первый ход в коне
     */
    static _filterFirstMoveRestrictions(cards, gameState) {
        const konNumber = gameState.konNumber || 1;
        const tricksInKon = gameState.tricksInKon || 0;
        const myTeamOpenedLastKon = gameState.myTeamOpenedLastKon || false;

        // В первом коне НЕЛЬЗЯ козырять
        if (konNumber === 1) {
            const nonTrumps = cards.filter(card => !card.isTrump());
            // Если есть некозырные карты - только они
            if (nonTrumps.length > 0) {
                return nonTrumps;
            }
            // Если только козыри - придется ходить козырем
            return cards;
        }

        // В последующих конах: команда открывавшая прошлый кон
        // не может козырять в первой взятке
        if (tricksInKon === 0 && myTeamOpenedLastKon) {
            const nonTrumps = cards.filter(card => !card.isTrump());
            if (nonTrumps.length > 0) {
                return nonTrumps;
            }
        }

        return cards;
    }

    /**
     * Определить победителя взятки
     * @param {Array} tableCards - [{player, card}]
     * @returns {string} - player who wins
     */
    static getTrickWinner(tableCards) {
        if (!tableCards || tableCards.length === 0) {
            return null;
        }

        const leadCard = tableCards[0].card;
        const leadSuit = leadCard.getSimpleSuit();

        let winningPlayer = tableCards[0].player;
        let winningCard = leadCard;

        for (let i = 1; i < tableCards.length; i++) {
            const currentCard = tableCards[i].card;

            if (currentCard.compareInTrick(winningCard, leadSuit) > 0) {
                winningCard = currentCard;
                winningPlayer = tableCards[i].player;
            }
        }

        return winningPlayer;
    }

    /**
     * Подсчитать очки во взятке
     */
    static calculateTrickPoints(tableCards, hasQueenClubsCaught = false) {
        let points = 0;

        for (const {card} of tableCards) {
            points += card.getPoints();
        }

        // Бонус за поимку дамы треф
        if (hasQueenClubsCaught) {
            points += 4;
        }

        return points;
    }

    /**
     * Проверить поимку дамы треф
     * По правилам: "если дама треф и 7 треф легли в одну взятку от разных команд,
     * кон немедленно заканчивается, и команда, положившая 7 треф, получает 4 очка"
     *
     * @returns {Object|null} { caught: true, winningTeam: 'team1'/'team2' } или null
     */
    static checkQueenClubsCatch(tableCards) {
        if (!tableCards || tableCards.length < 2) {
            return null;
        }

        let queenClubsPlayer = null;
        let sevenClubsPlayer = null;

        for (const {player, card} of tableCards) {
            if (card.rank === 'Q' && card.suit === 'clubs') {
                queenClubsPlayer = player;
            }

            if (card.rank === '7' && card.suit === 'clubs') {
                sevenClubsPlayer = player;
            }
        }

        // Оба должны быть в взятке
        if (!queenClubsPlayer || !sevenClubsPlayer) {
            return null;
        }

        // Проверяем что они от РАЗНЫХ КОМАНД
        // Команды: bottom-top (team1) vs left-right (team2)
        const queenTeam = (queenClubsPlayer === 'bottom' || queenClubsPlayer === 'top') ? 'team1' : 'team2';
        const sevenTeam = (sevenClubsPlayer === 'bottom' || sevenClubsPlayer === 'top') ? 'team1' : 'team2';

        if (queenTeam === sevenTeam) {
            // Одна команда - поимки нет
            return null;
        }

        // Поимка! Команда с 7♣ получает 4 очка
        return {
            caught: true,
            winningTeam: sevenTeam,
            winningPlayer: sevenClubsPlayer
        };
    }

    /**
     * Проверить, является ли команда партнером
     * @param {string} myPosition - 'bottom'
     * @param {string} otherPosition - 'top', 'left', 'right'
     */
    static isPartner(myPosition, otherPosition) {
        // В козле играют 4 игрока: bottom-top партнеры, left-right партнеры
        const partners = {
            'bottom': 'top',
            'top': 'bottom',
            'left': 'right',
            'right': 'left'
        };

        return partners[myPosition] === otherPosition;
    }

    /**
     * Проверить, нужно ли играть на >60 или >90
     */
    static analyzeScoreStrategy(myTeamPoints, opponentPoints, pointsInKon) {
        const needProtect60 = pointsInKon >= 55 && pointsInKon < 70;
        const canGoFor90 = pointsInKon >= 70 && pointsInKon < 90;
        const mustWin = myTeamPoints < 0; // Если в минусе - надо брать
        const closeToWin = myTeamPoints >= 100; // Близки к победе

        return {
            needProtect60,
            canGoFor90,
            mustWin,
            closeToWin,
            playAggressive: canGoFor90 || mustWin,
            playDefensive: needProtect60 || closeToWin
        };
    }

    /**
     * Определить приоритет карт для сброса
     * Возвращает массив карт отсортированный по приоритету сброса
     */
    static sortCardsByDiscardPriority(cards) {
        return cards.slice().sort((a, b) => {
            // Приоритет: младшие простые карты > старшие простые > младшие козыри > старшие козыри

            const aIsTrump = a.isTrump();
            const bIsTrump = b.isTrump();

            // Простые карты имеют приоритет для сброса
            if (!aIsTrump && bIsTrump) return -1;
            if (aIsTrump && !bIsTrump) return 1;

            // Если обе простые или обе козыри - младшие первые
            const aPoints = a.getPoints();
            const bPoints = b.getPoints();

            return aPoints - bPoints;
        });
    }

    /**
     * Определить приоритет карт для атаки
     * Возвращает массив карт отсортированный по приоритету атаки
     */
    static sortCardsByAttackPriority(cards) {
        return cards.slice().sort((a, b) => {
            // Приоритет: старшие карты с очками > старшие козыри

            const aIsTrump = a.isTrump();
            const bIsTrump = b.isTrump();
            const aPoints = a.getPoints();
            const bPoints = b.getPoints();

            // Козыри имеют приоритет для атаки
            if (aIsTrump && !bIsTrump) return -1;
            if (!aIsTrump && bIsTrump) return 1;

            // Если обе одинакового типа - старшие первые
            if (aIsTrump && bIsTrump) {
                const aOrder = a.getTrumpOrder();
                const bOrder = b.getTrumpOrder();
                return bOrder - aOrder;
            }

            return bPoints - aPoints;
        });
    }

    /**
     * Найти минимальную карту для взятия взятки
     */
    static findMinimumCardToWin(myCards, tableCards) {
        if (!tableCards || tableCards.length === 0) {
            return myCards[0];
        }

        const leadCard = tableCards[0].card;
        const leadSuit = leadCard.getSimpleSuit();

        // Находим текущую сильнейшую карту на столе
        let strongestCard = leadCard;
        for (let i = 1; i < tableCards.length; i++) {
            const card = tableCards[i].card;
            if (card.compareInTrick(strongestCard, leadSuit) > 0) {
                strongestCard = card;
            }
        }

        // Находим минимальную карту которая может побить сильнейшую
        let minWinningCard = null;
        for (const card of myCards) {
            if (card.compareInTrick(strongestCard, leadSuit) > 0) {
                if (!minWinningCard || card.compareInTrick(minWinningCard, leadSuit) < 0) {
                    minWinningCard = card;
                }
            }
        }

        return minWinningCard;
    }
}
