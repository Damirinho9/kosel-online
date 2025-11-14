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

    /**
     * ML: Подготовить обучающие данные из истории
     */
    async prepareMLTrainingData() {
        const history = await this.loadHistory();

        if (!history.games || history.games.length === 0) {
            return [];
        }

        const trainingData = [];

        // Используем только завершённые игры
        for (const game of history.games) {
            if (!game.moves || game.moves.length === 0) continue;

            // Определяем награду за игру
            const gameReward = game.result === 'win' ? 1.0 : 0.0;

            // Каждый ход - это обучающий пример
            for (let i = 0; i < game.moves.length; i++) {
                const move = game.moves[i];

                // Рассчитываем награду для хода
                let reward = 0.5;  // Базовая награда

                // Бонусы/штрафы
                if (move.trickWon) {
                    reward += 0.2;  // Взяли взятку
                    if (move.pointsGained > 0) {
                        reward += Math.min(0.3, move.pointsGained / 30);  // Очки
                    }
                }

                // Учитываем результат игры
                reward = reward * 0.7 + gameReward * 0.3;

                // Следовал ли игрок рекомендации AI
                const followedAI = move.wasRecommended;

                trainingData.push({
                    gameId: game.gameId,
                    moveIndex: i,
                    state: move,  // Состояние до хода
                    action: move.playedCard,
                    reward: reward,
                    followedAI: followedAI,
                    gameResult: game.result
                });
            }
        }

        console.log(`[MoveHistory ML] Подготовлено ${trainingData.length} обучающих примеров из ${history.games.length} игр`);

        return trainingData;
    }

    /**
     * ML: Экспортировать данные для анализа
     */
    async exportMLData() {
        const history = await this.loadHistory();
        const trainingData = await this.prepareMLTrainingData();

        return {
            metadata: {
                totalGames: history.games?.length || 0,
                totalMoves: history.allMoves?.length || 0,
                trainingExamples: trainingData.length,
                exportDate: new Date().toISOString()
            },
            games: history.games || [],
            trainingData: trainingData
        };
    }

    /**
     * ML: Получить последние N игр для обучения
     */
    async getRecentGamesForTraining(count = 10) {
        const history = await this.loadHistory();

        if (!history.games || history.games.length === 0) {
            return [];
        }

        // Берём последние N игр
        const recentGames = history.games.slice(0, count);

        // Подготавливаем обучающие данные
        const trainingData = [];

        for (const game of recentGames) {
            if (!game.moves || game.moves.length === 0) continue;

            const gameReward = game.result === 'win' ? 1.0 : 0.0;

            for (const move of game.moves) {
                let reward = 0.5;

                if (move.trickWon) {
                    reward += 0.2;
                    if (move.pointsGained > 0) {
                        reward += Math.min(0.3, move.pointsGained / 30);
                    }
                }

                reward = reward * 0.7 + gameReward * 0.3;

                trainingData.push({
                    state: move,
                    action: move.playedCard,
                    reward: reward
                });
            }
        }

        return trainingData;
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoveHistory;
}
