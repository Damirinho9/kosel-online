/**
 * Система профилирования игроков
 * Анализирует стиль игры и адаптирует стратегию
 */

class PlayerProfiler {
    constructor() {
        this.profiles = {}; // {playerName: profile}
        this.storageKey = 'kozel_player_profiles';
    }

    /**
     * Получить профили из storage
     */
    async loadProfiles() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.storageKey], (result) => {
                this.profiles = result[this.storageKey] || {};
                resolve(this.profiles);
            });
        });
    }

    /**
     * Сохранить профили в storage
     */
    async saveProfiles() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.storageKey]: this.profiles }, resolve);
        });
    }

    /**
     * Получить или создать профиль игрока
     */
    getProfile(playerName) {
        if (!playerName) return null;

        if (!this.profiles[playerName]) {
            this.profiles[playerName] = this.createEmptyProfile(playerName);
        }

        return this.profiles[playerName];
    }

    /**
     * Создать пустой профиль
     */
    createEmptyProfile(playerName) {
        return {
            name: playerName,
            gamesPlayed: 0,

            // Стиль игры
            aggressiveness: 0.5,  // 0-1: осторожный - агрессивный
            riskTaking: 0.5,      // 0-1: консервативный - рискованный

            // Статистика ходов
            moves: {
                totalMoves: 0,
                tricksTaken: 0,        // Взяток взято
                tricksAbandoned: 0,    // Взяток отдано
                averageCardValue: 0,   // Средняя ценность карты
                pointCardsMoved: 0,    // Очковых карт сыграно
                trumpsUsed: 0          // Козырей использовано
            },

            // Поведенческие паттерны
            patterns: {
                takesRiskyTricks: 0,      // Берёт рискованные взятки
                savesHighCards: 0,         // Сберегает сильные карты
                helpsPartner: 0,           // Помогает партнёру
                bluffs: 0,                 // Блефует
                playsDefensively: 0        // Играет защитно
            },

            // История последних игр
            recentBehavior: [],  // Последние 20 ходов

            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Записать ход игрока
     */
    async recordMove(playerName, moveData) {
        const profile = this.getProfile(playerName);
        if (!profile) return;

        profile.moves.totalMoves++;
        profile.gamesPlayed++;

        // Анализ хода
        const { card, trickWon, isRisky, pointsInTrick, wasAggressive } = moveData;

        // Обновляем статистику
        if (trickWon) {
            profile.moves.tricksTaken++;
        } else {
            profile.moves.tricksAbandoned++;
        }

        // Определяем агрессивность
        if (wasAggressive) {
            profile.aggressiveness = this.updateWeight(profile.aggressiveness, 1.0, 0.1);
        } else {
            profile.aggressiveness = this.updateWeight(profile.aggressiveness, 0.0, 0.05);
        }

        // Определяем склонность к риску
        if (isRisky) {
            profile.riskTaking = this.updateWeight(profile.riskTaking, 1.0, 0.1);
            profile.patterns.takesRiskyTricks++;
        } else {
            profile.riskTaking = this.updateWeight(profile.riskTaking, 0.0, 0.05);
        }

        // Сохраняем последнее поведение
        profile.recentBehavior.unshift({
            card: `${card.rank}${card.suit}`,
            trickWon,
            isRisky,
            pointsInTrick,
            timestamp: Date.now()
        });

        // Оставляем только последние 20 ходов
        if (profile.recentBehavior.length > 20) {
            profile.recentBehavior = profile.recentBehavior.slice(0, 20);
        }

        profile.lastUpdated = new Date().toISOString();

        await this.saveProfiles();
    }

    /**
     * Обновить вес (скользящее среднее)
     */
    updateWeight(current, target, learningRate) {
        return current + learningRate * (target - current);
    }

    /**
     * Анализировать стиль игрока
     */
    analyzePlayerStyle(playerName) {
        const profile = this.getProfile(playerName);
        if (!profile || profile.moves.totalMoves < 5) {
            return {
                style: 'unknown',
                confidence: 0,
                description: 'Недостаточно данных'
            };
        }

        const { aggressiveness, riskTaking, moves } = profile;
        const winRate = moves.tricksTaken / (moves.tricksTaken + moves.tricksAbandoned);

        // Определяем стиль
        let style = 'balanced';
        let description = '';

        if (aggressiveness > 0.7 && riskTaking > 0.6) {
            style = 'aggressive';
            description = 'Агрессивный игрок, берёт рискованные взятки';
        } else if (aggressiveness < 0.3 && riskTaking < 0.4) {
            style = 'defensive';
            description = 'Осторожный игрок, играет защитно';
        } else if (riskTaking > 0.7) {
            style = 'risky';
            description = 'Рискованный игрок, любит блефовать';
        } else if (aggressiveness > 0.6) {
            style = 'assertive';
            description = 'Уверенный игрок, активно берёт взятки';
        } else {
            description = 'Сбалансированный стиль игры';
        }

        return {
            style,
            confidence: Math.min(profile.moves.totalMoves / 20, 1.0),
            description,
            aggressiveness,
            riskTaking,
            winRate
        };
    }

    /**
     * Получить рекомендацию как играть против игрока
     */
    getCounterStrategy(playerName) {
        const analysis = this.analyzePlayerStyle(playerName);

        if (analysis.confidence < 0.3) {
            return {
                strategy: 'default',
                advice: 'Играйте стандартно, пока не накопится больше данных'
            };
        }

        switch (analysis.style) {
            case 'aggressive':
                return {
                    strategy: 'defensive',
                    advice: 'Играйте защитно, не давайте очковые карты'
                };

            case 'defensive':
                return {
                    strategy: 'aggressive',
                    advice: 'Играйте агрессивно, берите больше взяток'
                };

            case 'risky':
                return {
                    strategy: 'cautious',
                    advice: 'Будьте осторожны, игрок склонен к блефу'
                };

            case 'assertive':
                return {
                    strategy: 'competitive',
                    advice: 'Активно соревнуйтесь за взятки'
                };

            default:
                return {
                    strategy: 'balanced',
                    advice: 'Сбалансированная игра'
                };
        }
    }

    /**
     * Получить сводку по всем игрокам в текущей игре
     */
    getGameSummary(players) {
        const summary = {};

        for (const [position, name] of Object.entries(players)) {
            if (name) {
                const analysis = this.analyzePlayerStyle(name);
                const counter = this.getCounterStrategy(name);

                summary[position] = {
                    name,
                    analysis,
                    counter
                };
            }
        }

        return summary;
    }

    /**
     * Очистить старые профили (старше 30 дней)
     */
    async cleanOldProfiles() {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        for (const [name, profile] of Object.entries(this.profiles)) {
            const lastUpdate = new Date(profile.lastUpdated).getTime();
            if (lastUpdate < thirtyDaysAgo) {
                delete this.profiles[name];
            }
        }

        await this.saveProfiles();
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerProfiler;
}
