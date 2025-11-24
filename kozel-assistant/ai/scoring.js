/**
 * Система подсчёта очков для игры в Козла
 */

class KozelScoring {
    /**
     * Получить очки за карту
     * В Козле очки дают: 10 = 10 очков, Туз = 11 очков, Король = 4 очка
     */
    static getCardPoints(card) {
        const rank = card.rank || card.val;

        switch(rank) {
            case 'A': return 11;  // Туз
            case '10': return 10;  // Десятка
            case 'K': return 4;   // Король
            default: return 0;     // Остальные карты не дают очков
        }
    }

    /**
     * Подсчитать общие очки в массиве карт
     */
    static calculateTrickPoints(cards) {
        return cards.reduce((sum, card) => sum + this.getCardPoints(card), 0);
    }

    /**
     * Проверить является ли карта очковой (дает очки)
     */
    static isPointCard(card) {
        const rank = card.rank || card.val;
        return rank === 'A' || rank === '10' || rank === 'K';
    }

    /**
     * Получить количество очковых карт в наборе
     */
    static countPointCards(cards) {
        return cards.filter(card => this.isPointCard(card)).length;
    }

    /**
     * Получить все очковые карты из набора
     */
    static getPointCards(cards) {
        return cards.filter(card => this.isPointCard(card));
    }

    /**
     * Оценить ценность взятки
     */
    static evaluateTrickValue(cards) {
        const points = this.calculateTrickPoints(cards);
        const pointCards = this.countPointCards(cards);

        return {
            points: points,
            pointCards: pointCards,
            valuable: points >= 10,  // Взятка с 10+ очками считается ценной
            veryValuable: points >= 15  // Взятка с 15+ очками очень ценная
        };
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KozelScoring;
}
