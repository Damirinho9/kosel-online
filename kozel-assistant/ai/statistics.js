/**
 * Система статистики игр
 */

class GameStatistics {
    constructor() {
        this.storageKey = 'kozel_assistant_stats';
    }

    /**
     * Получить статистику из storage
     */
    async getStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                const stats = result[this.storageKey] || this.createEmptyStats();
                resolve(stats);
            });
        });
    }

    /**
     * Сохранить статистику в storage
     */
    async saveStats(stats) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: stats }, () => {
                resolve();
            });
        });
    }

    /**
     * Создать пустую статистику
     */
    createEmptyStats() {
        return {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            totalPoints: 0,
            totalOpponentPoints: 0,
            gamesHistory: [],  // Последние 50 игр
            lastPlayed: null,
            bestWin: null,  // Лучшая победа (максимальная разница в очках)
            worstLoss: null  // Худшее поражение
        };
    }

    /**
     * Записать результат игры
     */
    async recordGame(gameData) {
        const stats = await this.getStats();

        stats.totalGames++;
        stats.totalPoints += gameData.myScore;
        stats.totalOpponentPoints += gameData.opponentScore;
        stats.lastPlayed = new Date().toISOString();

        // Определить результат
        if (gameData.myGames > gameData.opponentGames) {
            stats.wins++;
            const margin = gameData.myGames - gameData.opponentGames;
            if (!stats.bestWin || margin > stats.bestWin.margin) {
                stats.bestWin = {
                    margin: margin,
                    score: `${gameData.myGames}:${gameData.opponentGames}`,
                    date: stats.lastPlayed
                };
            }
        } else if (gameData.myGames < gameData.opponentGames) {
            stats.losses++;
            const margin = gameData.opponentGames - gameData.myGames;
            if (!stats.worstLoss || margin > stats.worstLoss.margin) {
                stats.worstLoss = {
                    margin: margin,
                    score: `${gameData.myGames}:${gameData.opponentGames}`,
                    date: stats.lastPlayed
                };
            }
        } else {
            stats.draws++;
        }

        // Добавить в историю (последние 50 игр)
        stats.gamesHistory.unshift({
            date: stats.lastPlayed,
            myGames: gameData.myGames,
            opponentGames: gameData.opponentGames,
            myScore: gameData.myScore,
            opponentScore: gameData.opponentScore,
            partner: gameData.partner,
            result: gameData.myGames > gameData.opponentGames ? 'win' :
                    gameData.myGames < gameData.opponentGames ? 'loss' : 'draw'
        });

        // Оставляем только последние 50 игр
        if (stats.gamesHistory.length > 50) {
            stats.gamesHistory = stats.gamesHistory.slice(0, 50);
        }

        await this.saveStats(stats);
        return stats;
    }

    /**
     * Получить процент побед
     */
    getWinRate(stats) {
        if (stats.totalGames === 0) return 0;
        return ((stats.wins / stats.totalGames) * 100).toFixed(1);
    }

    /**
     * Получить средний счет
     */
    getAverageScore(stats) {
        if (stats.totalGames === 0) return { my: 0, opponent: 0 };
        return {
            my: Math.round(stats.totalPoints / stats.totalGames),
            opponent: Math.round(stats.totalOpponentPoints / stats.totalGames)
        };
    }

    /**
     * Получить серию побед/поражений
     */
    getCurrentStreak(stats) {
        if (stats.gamesHistory.length === 0) return { type: null, count: 0 };

        let streak = 0;
        const firstResult = stats.gamesHistory[0].result;

        for (const game of stats.gamesHistory) {
            if (game.result === firstResult) {
                streak++;
            } else {
                break;
            }
        }

        return {
            type: firstResult,
            count: streak
        };
    }

    /**
     * Сбросить статистику
     */
    async resetStats() {
        const emptyStats = this.createEmptyStats();
        await this.saveStats(emptyStats);
        return emptyStats;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameStatistics;
}
