/**
 * ИИ стратегии для игры в Козла
 */
class KozelAI {
    /**
     * Выбрать лучшую карту для хода
     * @param {Object} gameState - полное состояние игры
     * @returns {Object} {cardIndex, card, reasoning}
     */
    static chooseCard(gameState) {
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

        // Анализируем ситуацию
        const situation = this._analyzeSituation(gameState);

        // Выбираем стратегию
        let result;

        if (situation.trapQueen) {
            result = this._strategyTrapQueen(gameState, legalCards, situation);
        } else if (situation.playAggressive) {
            result = this._strategyAggressive(gameState, legalCards, situation);
        } else if (situation.playDefensive) {
            result = this._strategyDefensive(gameState, legalCards, situation);
        } else {
            result = this._strategyDefault(gameState, legalCards, situation);
        }

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
