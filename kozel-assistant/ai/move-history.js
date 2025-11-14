/**
 * Система сбора и анализа истории ходов
 * Записывает все ходы для обучения и адаптации
 */

class MoveHistory {
    constructor() {
        this.currentGameMoves = [];
        this.storageKey = 'kozel_move_history';
        this.maxHistorySize = 500; // Последние 500 ходов
    }

    /**
     * Записать ход
     */
    async recordMove(moveData) {
        const move = {
            timestamp: Date.now(),
            gameId: this.getCurrentGameId(),

            // Состояние до хода
            myCards: moveData.myCards.map(c => ({rank: c.rank, suit: c.suit})),
            tableCards: moveData.tableCards.map(c => ({rank: c.rank, suit: c.suit})),
            myScore: moveData.myScore,
            opponentScore: moveData.opponentScore,

            // Сделанный ход
            playedCard: {rank: moveData.playedCard.rank, suit: moveData.playedCard.suit},
            wasRecommended: moveData.wasRecommended,  // Следовал ли игрок рекомендации
            aiRecommendation: moveData.aiRecommendation ?
                {rank: moveData.aiRecommendation.rank, suit: moveData.aiRecommendation.suit} : null,

            // Результат хода
            trickWon: moveData.trickWon,
            pointsGained: moveData.pointsGained,
            whoWonTrick: moveData.whoWonTrick,  // 'player', 'partner', 'opponent'

            // Контекст
            myTurn: moveData.myTurn,
            isFirstInTrick: moveData.isFirstInTrick,
            partner: moveData.partner,
            players: moveData.players
        };

        this.currentGameMoves.push(move);

        // Сохраняем в storage периодически
        if (this.currentGameMoves.length % 5 === 0) {
            await this.saveToStorage();
        }

        return move;
    }

    /**
     * Получить ID текущей игры (на основе времени начала)
     */
    getCurrentGameId() {
        if (!this.currentGameId) {
            this.currentGameId = `game_${Date.now()}`;
        }
        return this.currentGameId;
    }

    /**
     * Начать новую игру
     */
    startNewGame() {
        this.currentGameId = null;
        this.currentGameMoves = [];
    }

    /**
     * Завершить игру и записать результат
     */
    async endGame(result) {
        const gameData = {
            gameId: this.getCurrentGameId(),
            startTime: this.currentGameMoves[0]?.timestamp,
            endTime: Date.now(),
            moves: this.currentGameMoves,
            result: result,  // 'win', 'loss', 'draw'
            finalScore: result.finalScore,
            partner: result.partner
        };

        await this.saveGame(gameData);
        this.startNewGame();
    }

    /**
     * Сохранить игру в историю
     */
    async saveGame(gameData) {
        const history = await this.loadHistory();
        history.games.unshift(gameData);

        // Оставляем только последние 50 игр
        if (history.games.length > 50) {
            history.games = history.games.slice(0, 50);
        }

        // Добавляем ходы в общую историю
        history.allMoves.push(...gameData.moves);

        // Ограничиваем размер истории ходов
        if (history.allMoves.length > this.maxHistorySize) {
            history.allMoves = history.allMoves.slice(-this.maxHistorySize);
        }

        await this.saveHistory(history);
    }

    /**
     * Загрузить историю из storage
     */
    async loadHistory() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                resolve(result[this.storageKey] || {
                    games: [],
                    allMoves: []
                });
            });
        });
    }

    /**
     * Сохранить историю в storage
     */
    async saveHistory(history) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: history }, resolve);
        });
    }

    /**
     * Сохранить текущие ходы
     */
    async saveToStorage() {
        // Временное сохранение текущих ходов
        const tempKey = 'kozel_current_game_moves';
        return new Promise((resolve) => {
            chrome.storage.local.set({
                [tempKey]: {
                    gameId: this.currentGameId,
                    moves: this.currentGameMoves
                }
            }, resolve);
        });
    }

    /**
     * Анализ успешности рекомендаций AI
     */
    async analyzeAIPerformance() {
        const history = await this.loadHistory();
        const moves = history.allMoves;

        if (moves.length < 10) {
            return {
                confidence: 0,
                message: 'Недостаточно данных'
            };
        }

        let followedCount = 0;
        let notFollowedCount = 0;
        let followedWins = 0;
        let notFollowedWins = 0;

        for (const move of moves) {
            if (move.aiRecommendation) {
                const followed = move.wasRecommended;
                const won = move.trickWon;

                if (followed) {
                    followedCount++;
                    if (won) followedWins++;
                } else {
                    notFollowedCount++;
                    if (won) notFollowedWins++;
                }
            }
        }

        const followedWinRate = followedCount > 0 ? (followedWins / followedCount) : 0;
        const notFollowedWinRate = notFollowedCount > 0 ? (notFollowedWins / notFollowedCount) : 0;

        return {
            totalMoves: moves.length,
            followedAI: followedCount,
            ignoredAI: notFollowedCount,
            followedWinRate: (followedWinRate * 100).toFixed(1),
            ignoredWinRate: (notFollowedWinRate * 100).toFixed(1),
            aiIsBetter: followedWinRate > notFollowedWinRate,
            confidence: Math.min(followedCount / 50, 1.0)
        };
    }

    /**
     * Найти паттерны успешных ходов
     */
    async findSuccessPatterns() {
        const history = await this.loadHistory();
        const moves = history.allMoves;

        if (moves.length < 20) return null;

        const patterns = {
            bestFirstMoves: {},      // Лучшие карты для первого хода
            bestResponseCards: {},   // Лучшие карты для ответа
            aggressiveSuccess: 0,    // Успех агрессивной игры
            defensiveSuccess: 0      // Успех защитной игры
        };

        for (const move of moves) {
            const cardKey = `${move.playedCard.rank}_${move.playedCard.suit}`;

            if (move.isFirstInTrick) {
                if (!patterns.bestFirstMoves[cardKey]) {
                    patterns.bestFirstMoves[cardKey] = { wins: 0, total: 0 };
                }
                patterns.bestFirstMoves[cardKey].total++;
                if (move.trickWon) {
                    patterns.bestFirstMoves[cardKey].wins++;
                }
            }
        }

        return patterns;
    }

    /**
     * Получить статистику по конкретной карте
     */
    async getCardStatistics(rank, suit) {
        const history = await this.loadHistory();
        const moves = history.allMoves.filter(m =>
            m.playedCard.rank === rank && m.playedCard.suit === suit
        );

        if (moves.length === 0) return null;

        const wins = moves.filter(m => m.trickWon).length;
        const avgPoints = moves.reduce((sum, m) => sum + (m.pointsGained || 0), 0) / moves.length;

        return {
            timesPlayed: moves.length,
            winRate: (wins / moves.length * 100).toFixed(1),
            avgPoints: avgPoints.toFixed(1)
        };
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoveHistory;
}
