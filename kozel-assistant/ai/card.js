/**
 * Модель карты для игры в Козла
 */
class Card {
    constructor(rank, suit) {
        this.rank = rank; // '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
        this.suit = suit; // 'clubs', 'spades', 'hearts', 'diamonds'
    }

    /**
     * Получить очки карты
     */
    getPoints() {
        const points = {
            '7': 0, '8': 0, '9': 0,
            'J': 2, 'Q': 3, 'K': 4,
            '10': 10, 'A': 11
        };
        return points[this.rank] || 0;
    }

    /**
     * Проверка: является ли карта козырем
     * Козыри: все валеты (J), все дамы (Q), все трефы (clubs)
     */
    isTrump() {
        return this.rank === 'J' || this.rank === 'Q' || this.suit === 'clubs';
    }

    /**
     * Получить простую масть (или null если козырь)
     */
    getSimpleSuit() {
        if (this.isTrump()) {
            return null;
        }
        return this.suit;
    }

    /**
     * Порядок козыря для сравнения силы
     * Чем больше число - тем старше козырь
     * Возвращает -1 если карта не является козырем
     */
    getTrumpOrder() {
        if (!this.isTrump()) {
            return -1;
        }

        // Иерархия козырей (от младшего к старшему)
        const order = {
            '7_clubs': 0,       // 7♣ - самый младший
            'Q_clubs': 1,       // Q♣
            'Q_spades': 2,      // Q♠
            'Q_hearts': 3,      // Q♥
            'Q_diamonds': 4,    // Q♦
            'J_clubs': 5,       // J♣
            'J_spades': 6,      // J♠
            'J_hearts': 7,      // J♥
            'J_diamonds': 8,    // J♦
            'A_clubs': 9,       // A♣
            '10_clubs': 10,     // 10♣
            'K_clubs': 11,      // K♣
            '9_clubs': 12,      // 9♣
            '8_clubs': 13       // 8♣ - самый старший
        };

        const key = `${this.rank}_${this.suit}`;
        return order[key] !== undefined ? order[key] : -1;
    }

    /**
     * Сравнить с другой картой в контексте взятки
     * @param {Card} otherCard - карта для сравнения
     * @param {string|null} leadSuit - простая масть захода (или null если козырь)
     * @returns {number} 1 если текущая карта старше, -1 если младше, 0 если равны
     */
    compareInTrick(otherCard, leadSuit) {
        const thisIsTrump = this.isTrump();
        const otherIsTrump = otherCard.isTrump();

        // Оба козыри - сравниваем по силе козырей
        if (thisIsTrump && otherIsTrump) {
            const thisOrder = this.getTrumpOrder();
            const otherOrder = otherCard.getTrumpOrder();
            return thisOrder > otherOrder ? 1 : (thisOrder < otherOrder ? -1 : 0);
        }

        // Один козырь, другой нет - козырь старше
        if (thisIsTrump && !otherIsTrump) {
            return 1;
        }
        if (!thisIsTrump && otherIsTrump) {
            return -1;
        }

        // Оба не козыри
        const thisSuit = this.getSimpleSuit();
        const otherSuit = otherCard.getSimpleSuit();

        // Обе карты масти захода - сравниваем по старшинству
        if (thisSuit === leadSuit && otherSuit === leadSuit) {
            return this._compareSimpleRank(otherCard);
        }

        // Одна карта масти захода, другая нет
        if (thisSuit === leadSuit) {
            return 1;
        }
        if (otherSuit === leadSuit) {
            return -1;
        }

        // Обе карты не масти захода - не бьют друг друга
        return 0;
    }

    /**
     * Сравнить простые карты по старшинству
     */
    _compareSimpleRank(otherCard) {
        const rankOrder = {
            '7': 0, '8': 1, '9': 2, 'K': 3, '10': 4, 'A': 5
        };

        const thisRankValue = rankOrder[this.rank] || 0;
        const otherRankValue = rankOrder[otherCard.rank] || 0;

        return thisRankValue > otherRankValue ? 1 : (thisRankValue < otherRankValue ? -1 : 0);
    }

    /**
     * Строковое представление карты
     */
    toString() {
        const suitSymbols = {
            'clubs': '♣',
            'spades': '♠',
            'hearts': '♥',
            'diamonds': '♦'
        };
        return `${this.rank}${suitSymbols[this.suit] || this.suit}`;
    }

    /**
     * Создать карту из объекта
     */
    static fromObject(obj) {
        if (!obj || !obj.rank || !obj.suit) {
            return null;
        }
        return new Card(obj.rank, obj.suit);
    }

    /**
     * Нормализация названий мастей и рангов
     * Преобразует различные форматы в стандартный
     */
    static normalize(rank, suit) {
        // Нормализация ранга
        const rankMap = {
            '7': '7', '8': '8', '9': '9', '10': '10',
            'J': 'J', 'JACK': 'J', 'jack': 'J', 'В': 'J',
            'Q': 'Q', 'QUEEN': 'Q', 'queen': 'Q', 'Д': 'Q',
            'K': 'K', 'KING': 'K', 'king': 'K', 'К': 'K',
            'A': 'A', 'ACE': 'A', 'ace': 'A', 'Т': 'A'
        };

        // Нормализация масти
        const suitMap = {
            'clubs': 'clubs', 'club': 'clubs', 'c': 'clubs', 'трефы': 'clubs', '♣': 'clubs',
            'spades': 'spades', 'spade': 'spades', 's': 'spades', 'пики': 'spades', '♠': 'spades',
            'hearts': 'hearts', 'heart': 'hearts', 'h': 'hearts', 'черви': 'hearts', '♥': 'hearts',
            'diamonds': 'diamonds', 'diamond': 'diamonds', 'd': 'diamonds', 'бубны': 'diamonds', '♦': 'diamonds'
        };

        const normalizedRank = rankMap[rank] || rank;
        const normalizedSuit = suitMap[suit?.toLowerCase()] || suit;

        return new Card(normalizedRank, normalizedSuit);
    }
}
