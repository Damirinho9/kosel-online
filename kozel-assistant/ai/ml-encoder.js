/**
 * ML State Encoder - кодирование состояния игры для нейронной сети
 */

class MLStateEncoder {
    constructor() {
        // Маппинг мастей и рангов на индексы
        this.suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        this.ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        // Размерности
        this.CARDS_IN_DECK = 36;
        this.MAX_HAND_SIZE = 9;
        this.MAX_TABLE_SIZE = 4;

        // Размер входного вектора
        this.INPUT_SIZE = this._calculateInputSize();
    }

    /**
     * Рассчитать размер входного вектора
     */
    _calculateInputSize() {
        return (
            this.CARDS_IN_DECK +      // Карты на руке (one-hot)
            this.CARDS_IN_DECK +      // Карты на столе (one-hot)
            4 +                        // Позиция игрока (one-hot: bottom, left, top, right)
            2 +                        // Счёт (нормализованный)
            1 +                        // Мой ход (boolean)
            3 +                        // Кто выигрывает взятку (one-hot: nobody, partner, opponent)
            10                         // Дополнительные признаки
        );
    }

    /**
     * Получить индекс карты в колоде (0-35)
     */
    getCardIndex(card) {
        const suitIndex = this.suits.indexOf(card.suit);
        const rankIndex = this.ranks.indexOf(card.rank);

        if (suitIndex === -1 || rankIndex === -1) {
            return -1;
        }

        return suitIndex * this.ranks.length + rankIndex;
    }

    /**
     * Закодировать карты в one-hot вектор
     */
    encodeCards(cards, vectorSize) {
        const vector = new Array(vectorSize).fill(0);

        if (!cards || !Array.isArray(cards)) {
            return vector;
        }

        for (const card of cards) {
            const index = this.getCardIndex(card);
            if (index >= 0 && index < vectorSize) {
                vector[index] = 1;
            }
        }

        return vector;
    }

    /**
     * Закодировать состояние игры
     */
    encodeGameState(gameState) {
        const features = [];

        // 1. Карты на руке (36 признаков)
        const myCards = gameState.myCards || [];
        const handVector = this.encodeCards(myCards, this.CARDS_IN_DECK);
        features.push(...handVector);

        // 2. Карты на столе (36 признаков)
        const tableCardsFlat = (gameState.tableCards || []).map(tc => tc.card);
        const tableVector = this.encodeCards(tableCardsFlat, this.CARDS_IN_DECK);
        features.push(...tableVector);

        // 3. Позиция игрока (4 признака: bottom=1,0,0,0)
        features.push(1, 0, 0, 0);  // Всегда bottom для нас

        // 4. Счёт (2 признака, нормализованный)
        const myScore = (gameState.myTeamScore || 0) / 120;  // Нормализация к [0,1]
        const oppScore = (gameState.opponentScore || 0) / 120;
        features.push(myScore, oppScore);

        // 5. Мой ход (1 признак)
        features.push(gameState.myTurn ? 1 : 0);

        // 6. Кто выигрывает взятку (3 признака)
        const tableCards = gameState.tableCards || [];
        let trickWinner = [1, 0, 0];  // nobody, partner, opponent

        if (tableCards.length > 0 && typeof KozelRules !== 'undefined') {
            const winner = KozelRules.getTrickWinner(tableCards);
            if (winner === 'bottom') {
                trickWinner = [0, 1, 0];  // we/partner winning
            } else if (winner === 'top') {
                trickWinner = [0, 1, 0];  // partner winning
            } else {
                trickWinner = [0, 0, 1];  // opponent winning
            }
        }
        features.push(...trickWinner);

        // 7. Дополнительные признаки (10 признаков)
        features.push(
            myCards.length / 9,                           // Карт на руке (нормализовано)
            tableCards.length / 4,                        // Карт на столе (нормализовано)
            (gameState.teams?.myGames || 0) / 3,         // Выигранных партий (нормализовано)
            (gameState.teams?.opponentGames || 0) / 3,   // Проигранных партий
            0,  // Резерв
            0,  // Резерв
            0,  // Резерв
            0,  // Резерв
            0,  // Резерв
            0   // Резерв
        );

        return features;
    }

    /**
     * Закодировать действие (карту)
     */
    encodeAction(card) {
        return this.getCardIndex(card);
    }

    /**
     * Декодировать действие (индекс в карту)
     */
    decodeAction(actionIndex, allCards) {
        if (actionIndex < 0 || actionIndex >= this.CARDS_IN_DECK) {
            return null;
        }

        const suitIndex = Math.floor(actionIndex / this.ranks.length);
        const rankIndex = actionIndex % this.ranks.length;

        const suit = this.suits[suitIndex];
        const rank = this.ranks[rankIndex];

        // Находим карту в списке всех карт
        return allCards.find(c => c.suit === suit && c.rank === rank);
    }

    /**
     * Создать обучающий пример
     */
    createTrainingExample(gameState, playedCard, reward) {
        const state = this.encodeGameState(gameState);
        const action = this.encodeAction(playedCard);

        return {
            state: state,
            action: action,
            reward: reward
        };
    }

    /**
     * Получить размер входного вектора
     */
    getInputSize() {
        return this.INPUT_SIZE;
    }

    /**
     * Получить размер выходного вектора (количество возможных действий)
     */
    getOutputSize() {
        return this.CARDS_IN_DECK;
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLStateEncoder;
}
