/**
 * ИИ стратегии для игры в Козла
 */
class KozelAI {
    /**
     * Выбрать лучшую карту для хода
     * @param {Object} gameState - полное состояние игры
     * @param {Object} mlModel - ML модель (опционально)
     * @returns {Object} {cardIndex, card, reasoning}
     */
    static async chooseCard(gameState, mlModel = null) {
        const { myCards, tableCards, myTeamScore, opponentScore, pointsInKon } = gameState;

        // Получаем легальные карты
        const legalCards = KozelRules.getLegalCards(myCards, tableCards, gameState);

        if (legalCards.length === 0) {
            return null;
        }

        if (legalCards.length === 1) {
            return {
                cardIndex: myCards.indexOf(legalCards[0]),
                card: legalCards[0],
                reasoning: 'Единственная легальная карта'
            };
        }

        // V2.0 Phase 3: Попытка ML предсказания
        let mlPrediction = null;
        if (mlModel && mlModel.modelLoaded) {
            try {
                mlPrediction = await mlModel.predictBestCard(gameState, legalCards);

                if (mlPrediction && mlPrediction.card && mlPrediction.confidence > 0.6) {
                    console.log(`[AI ML] 🧠 ML рекомендует: ${mlPrediction.card.toString()} (${(mlPrediction.confidence * 100).toFixed(1)}%)`);

                    // Высокая уверенность - используем ML
                    if (mlPrediction.confidence > 0.8) {
                        return {
                            cardIndex: myCards.indexOf(mlPrediction.card),
                            card: mlPrediction.card,
                            reasoning: `🧠 ML: ${(mlPrediction.confidence * 100).toFixed(0)}% уверенности`
                        };
                    }
                }
            } catch (error) {
                console.error('[AI ML] Ошибка ML предсказания:', error);
            }
        }

        // Анализируем ситуацию
        const situation = this._analyzeSituation(gameState);

        console.log('[AI V2.0] Базовая ситуация:', {
            playAggressive: typeof situation.playAggressive === 'number' ? situation.playAggressive.toFixed(2) : situation.playAggressive,
            playDefensive: typeof situation.playDefensive === 'number' ? situation.playDefensive.toFixed(2) : situation.playDefensive,
            partnerWinning: situation.partnerWinning,
            opponentWinning: situation.opponentWinning
        });

        // V2.0: Адаптация на основе профилей игроков
        const beforeAdapt = {
            aggressive: situation.playAggressive,
            defensive: situation.playDefensive
        };
        this._adaptStrategyToPlayers(situation, gameState);

        // Логирование адаптации
        if (beforeAdapt.aggressive !== situation.playAggressive ||
            beforeAdapt.defensive !== situation.playDefensive) {
            const formatValue = (val) => typeof val === 'number' ? val.toFixed(2) : val;
            console.log('[AI V2.0] ⚙️ Адаптация стратегии:', {
                before: { agg: formatValue(beforeAdapt.aggressive), def: formatValue(beforeAdapt.defensive) },
                after: { agg: formatValue(situation.playAggressive), def: formatValue(situation.playDefensive) }
            });
        }

        // Выбираем стратегию
        let result;
        let strategyUsed = 'default';

        if (situation.trapQueen) {
            result = this._strategyTrapQueen(gameState, legalCards, situation);
            strategyUsed = 'trapQueen';
        } else if (situation.playAggressive) {
            result = this._strategyAggressive(gameState, legalCards, situation);
            strategyUsed = 'aggressive';
        } else if (situation.playDefensive) {
            result = this._strategyDefensive(gameState, legalCards, situation);
            strategyUsed = 'defensive';
        } else {
            result = this._strategyDefault(gameState, legalCards, situation);
            strategyUsed = 'default';
        }

        console.log(`[AI V2.0] ✓ Выбрана стратегия: ${strategyUsed} → ${result.card.toString()}`);

        // Находим индекс в оригинальном массиве
        result.cardIndex = myCards.indexOf(result.card);
        return result;
    }

    /**
     * Анализ игровой ситуации
     */
    static _analyzeSituation(gameState) {
        const { myCards, tableCards, myTeamScore, opponentScore, pointsInKon, partner } = gameState;

        // Определяем кто берет взятку
        const isFirstInTrick = !tableCards || tableCards.length === 0;
        let partnerWinning = false;
        let opponentWinning = false;
        let weAreWinning = false;

        if (!isFirstInTrick) {
            const winner = KozelRules.getTrickWinner(tableCards);
            const isPartner = KozelRules.isPartner('bottom', winner);

            if (winner === 'bottom') {
                weAreWinning = true;
            } else if (isPartner) {
                partnerWinning = true;
            } else {
                opponentWinning = true;
            }
        }

        // Анализ очков на столе (используем KozelScoring если доступен)
        let trickPoints = 0;
        let trickHasValuableCards = false;

        if (tableCards && tableCards.length > 0 && typeof KozelScoring !== 'undefined') {
            const trickValue = KozelScoring.evaluateTrickValue(tableCards);
            trickPoints = trickValue.points;
            trickHasValuableCards = trickValue.valuable;
        }

        // Анализ счета
        const strategy = KozelRules.analyzeScoreStrategy(
            myTeamScore || 0,
            opponentScore || 0,
            pointsInKon || 0
        );

        // Проверка возможности поимки дамы треф
        const hasSevenClubs = myCards.some(c => c.rank === '7' && c.suit === 'clubs');
        const queenClubsOnTable = tableCards?.some(({card}) =>
            card.rank === 'Q' && card.suit === 'clubs'
        );

        return {
            isFirstInTrick,
            partnerWinning,
            opponentWinning,
            weAreWinning,
            trickPoints,
            trickHasValuableCards,
            partner: partner || null,
            ...strategy,
            trapQueen: hasSevenClubs && queenClubsOnTable
        };
    }

    /**
     * Стратегия: поимка дамы треф
     */
    static _strategyTrapQueen(gameState, legalCards, situation) {
        const sevenClubs = legalCards.find(c => c.rank === '7' && c.suit === 'clubs');

        if (sevenClubs) {
            return {
                card: sevenClubs,
                reasoning: '🎯 ПОЙМАЛИ ДАМУ ТРЕФ! +4 очка бонус'
            };
        }

        // Если не можем поймать - играем по умолчанию
        return this._strategyDefault(gameState, legalCards, situation);
    }

    /**
     * Стратегия: агрессивная игра (идем на >90)
     */
    static _strategyAggressive(gameState, legalCards, situation) {
        const { tableCards } = gameState;

        // Если партнер берет - помогаем ему очковыми картами
        if (situation.partnerWinning) {
            // Ищем очковые карты в руке
            const pointCards = typeof KozelScoring !== 'undefined' ?
                legalCards.filter(c => KozelScoring.isPointCard(c)) : [];

            if (pointCards.length > 0) {
                // Подбрасываем очковую карту партнёру
                const sortedPoints = pointCards.sort((a, b) =>
                    (KozelScoring.getCardPoints(b) - KozelScoring.getCardPoints(a))
                );
                return {
                    card: sortedPoints[0],
                    reasoning: `⚔️ Отдаем ${KozelScoring.getCardPoints(sortedPoints[0])} очков партнёру`
                };
            }

            // Нет очковых - даем высокую карту
            const highCards = KozelRules.sortCardsByAttackPriority(legalCards);
            return {
                card: highCards[0],
                reasoning: '⚔️ Поддерживаем партнера'
            };
        }

        // Если противник берет - пытаемся перебить (особенно если очки на столе)
        if (situation.opponentWinning) {
            const shouldFight = situation.trickHasValuableCards || situation.trickPoints >= 10;

            if (shouldFight) {
                const minWinCard = KozelRules.findMinimumCardToWin(legalCards, tableCards);

                if (minWinCard) {
                    return {
                        card: minWinCard,
                        reasoning: `⚔️ Забираем ${situation.trickPoints} очков!`
                    };
                }
            }

            // Не можем перебить - сбрасываем мусор
            const discardCards = KozelRules.sortCardsByDiscardPriority(legalCards);
            return {
                card: discardCards[0],
                reasoning: '🗑️ Сброс: противник берет'
            };
        }

        // Первый ход - играем сильную карту
        if (situation.isFirstInTrick) {
            const attackCards = KozelRules.sortCardsByAttackPriority(legalCards);
            return {
                card: attackCards[0],
                reasoning: '⚔️ Агрессивный заход'
            };
        }

        // По умолчанию
        return this._strategyDefault(gameState, legalCards, situation);
    }

    /**
     * Стратегия: защитная игра (защищаем >60)
     */
    static _strategyDefensive(gameState, legalCards, situation) {
        const { tableCards } = gameState;

        // Если партнер берет - сбрасываем мусор (НЕ очковые карты)
        if (situation.partnerWinning) {
            // Ищем карты без очков
            const nonPointCards = typeof KozelScoring !== 'undefined' ?
                legalCards.filter(c => !KozelScoring.isPointCard(c)) : legalCards;

            if (nonPointCards.length > 0) {
                const discardCards = KozelRules.sortCardsByDiscardPriority(nonPointCards);
                return {
                    card: discardCards[0],
                    reasoning: '🛡️ Сброс мусора: партнер берет'
                };
            }

            // Только очковые - отдаем самую дешевую
            const sortedByPoints = legalCards.slice().sort((a, b) => {
                const aPoints = typeof KozelScoring !== 'undefined' ? KozelScoring.getCardPoints(a) : 0;
                const bPoints = typeof KozelScoring !== 'undefined' ? KozelScoring.getCardPoints(b) : 0;
                return aPoints - bPoints;
            });
            return {
                card: sortedByPoints[0],
                reasoning: '🛡️ Минимальные очки партнёру'
            };
        }

        // Если противник берет - минимизируем урон (не даем очков)
        if (situation.opponentWinning) {
            // Ищем карту с минимальным количеством очков
            const sortedByPoints = legalCards.slice().sort((a, b) => {
                const aPoints = typeof KozelScoring !== 'undefined' ? KozelScoring.getCardPoints(a) : 0;
                const bPoints = typeof KozelScoring !== 'undefined' ? KozelScoring.getCardPoints(b) : 0;
                return aPoints - bPoints;
            });
            return {
                card: sortedByPoints[0],
                reasoning: '🛡️ Минимизируем очки противнику'
            };
        }

        // Первый ход - играем безопасно (без очковых карт)
        if (situation.isFirstInTrick) {
            const nonPointCards = typeof KozelScoring !== 'undefined' ?
                legalCards.filter(c => !KozelScoring.isPointCard(c)) : legalCards;

            if (nonPointCards.length > 0) {
                const middleIndex = Math.floor(nonPointCards.length / 2);
                return {
                    card: nonPointCards[middleIndex],
                    reasoning: '🛡️ Безопасный заход'
                };
            }

            // Только очковые - средняя
            const middleIndex = Math.floor(legalCards.length / 2);
            return {
                card: legalCards[middleIndex],
                reasoning: '🛡️ Осторожный заход'
            };
        }

        // По умолчанию
        return this._strategyDefault(gameState, legalCards, situation);
    }

    /**
     * Стратегия по умолчанию (балансированная игра)
     */
    static _strategyDefault(gameState, legalCards, situation) {
        const { tableCards } = gameState;

        // Если партнер берет - поддерживаем
        if (situation.partnerWinning) {
            // Подкладываем среднюю карту
            const middleIndex = Math.floor(legalCards.length / 2);
            return {
                card: legalCards[middleIndex],
                reasoning: '🤝 Поддержка партнера'
            };
        }

        // Если противник берет - минимизируем потери
        if (situation.opponentWinning) {
            const discardCards = KozelRules.sortCardsByDiscardPriority(legalCards);
            return {
                card: discardCards[0],
                reasoning: '🗑️ Сброс: противник берет'
            };
        }

        // Мы берем взятку - играем разумно
        if (situation.weAreWinning) {
            const attackCards = KozelRules.sortCardsByAttackPriority(legalCards);
            return {
                card: attackCards[0],
                reasoning: '💪 Забираем взятку'
            };
        }

        // Первый ход - играем средней силы карту
        if (situation.isFirstInTrick) {
            // Не ходим козырями без необходимости
            const nonTrumps = legalCards.filter(c => !c.isTrump());

            if (nonTrumps.length > 0) {
                // Играем среднюю по силе некозырную карту
                const middleIndex = Math.floor(nonTrumps.length / 2);
                return {
                    card: nonTrumps[middleIndex],
                    reasoning: '🎯 Стандартный заход'
                };
            }

            // Только козыри - играем младшего
            const sortedTrumps = legalCards.slice().sort((a, b) =>
                a.getTrumpOrder() - b.getTrumpOrder()
            );

            return {
                card: sortedTrumps[0],
                reasoning: '🎯 Минимальный козырь'
            };
        }

        // Попытка взять взятку
        const minWinCard = KozelRules.findMinimumCardToWin(legalCards, tableCards);

        if (minWinCard) {
            const trickPoints = KozelRules.calculateTrickPoints(tableCards);

            if (trickPoints >= 10) {
                return {
                    card: minWinCard,
                    reasoning: `💰 Берем взятку (${trickPoints} очков)`
                };
            }
        }

        // По умолчанию - сбрасываем младшую карту
        const discardCards = KozelRules.sortCardsByDiscardPriority(legalCards);
        return {
            card: discardCards[0],
            reasoning: '🎴 Стандартный ход'
        };
    }

    /**
     * V2.0: Адаптировать стратегию на основе профилей игроков
     */
    static _adaptStrategyToPlayers(situation, gameState) {
        const { partnerProfile, opponentProfiles } = gameState;

        if (!partnerProfile && !opponentProfiles) return;

        // Анализ партнёра
        if (partnerProfile && partnerProfile.analysis) {
            const partnerStyle = partnerProfile.analysis.style;
            const confidence = partnerProfile.analysis.confidence;

            console.log(`[AI V2.0] Профиль партнёра: ${partnerProfile.name} - ${partnerStyle} (${(confidence * 100).toFixed(0)}%)`);

            // Если достаточно уверенности в профиле
            if (confidence > 0.3) {
                switch (partnerStyle) {
                    case 'aggressive':
                        // Партнёр агрессивный - даём ему больше очков
                        console.log('[AI V2.0] → Партнёр агрессивный: +0.2 агрессия');
                        situation.partnerIsAggressive = true;
                        situation.playAggressive = Math.min(situation.playAggressive + 0.2, 1.0);
                        break;

                    case 'defensive':
                        // Партнёр осторожный - играем более агрессивно
                        console.log('[AI V2.0] → Партнёр осторожный: +0.1 агрессия');
                        situation.partnerIsDefensive = true;
                        situation.playAggressive = Math.min(situation.playAggressive + 0.1, 1.0);
                        break;

                    case 'risky':
                        // Партнёр рискует - будем осторожнее
                        console.log('[AI V2.0] → Партнёр рискует: +0.1 защита');
                        situation.playDefensive = Math.min(situation.playDefensive + 0.1, 1.0);
                        break;
                }
            }
        }

        // Анализ противников
        if (opponentProfiles) {
            let aggressiveOpponents = 0;
            let defensiveOpponents = 0;

            for (const [position, profile] of Object.entries(opponentProfiles)) {
                if (profile && profile.analysis && profile.analysis.confidence > 0.3) {
                    const style = profile.analysis.style;
                    console.log(`[AI V2.0] Противник ${position}: ${profile.name} - ${style}`);

                    if (style === 'aggressive' || style === 'risky') {
                        aggressiveOpponents++;
                        situation.opponentsAreAggressive = true;
                    } else if (style === 'defensive') {
                        defensiveOpponents++;
                        situation.opponentsAreDefensive = true;
                    }
                }
            }

            // Адаптация против агрессивных противников
            if (aggressiveOpponents >= 1) {
                // Играем более защитно против агрессии
                console.log(`[AI V2.0] → ${aggressiveOpponents} агрессивных противников: +0.15 защита`);
                situation.playDefensive = Math.min(situation.playDefensive + 0.15, 1.0);
            }

            // Адаптация против защитных противников
            if (defensiveOpponents >= 1) {
                // Можем играть более агрессивно
                console.log(`[AI V2.0] → ${defensiveOpponents} защитных противников: +0.15 агрессия`);
                situation.playAggressive = Math.min(situation.playAggressive + 0.15, 1.0);
            }
        }
    }

    /**
     * Получить рекомендацию в виде текста
     */
    static getRecommendationText(recommendation) {
        if (!recommendation) {
            return 'Не удалось определить рекомендацию';
        }

        const { card, reasoning } = recommendation;
        return `Рекомендуется: ${card.toString()}\n${reasoning}`;
    }
}
