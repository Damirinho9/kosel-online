/**
 * Popup script для управления расширением
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadGameState();

    // Обновляем каждые 2 секунды
    setInterval(loadGameState, 2000);
});

async function loadGameState() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url?.includes('kozel-online.com')) {
            showNotOnSite();
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getGameState' });

        if (response && response.gameState) {
            renderGameState(response.gameState, response.enabled, response.stats, response.playerProfiles);
        } else {
            showWaiting();
        }

    } catch (error) {
        console.error('Ошибка получения состояния:', error);
        showError();
    }
}

function renderGameState(gameState, enabled, stats, playerProfiles) {
    const { myCards, tableCards, myTurn, teams, partner, scoreWindow, recommendation } = gameState;

    let html = `
        <div class="status">
            <div class="status-item">
                <span class="status-label">Статус:</span>
                <span class="status-value">${enabled ? '✓ Активен' : '✗ Выключен'}</span>
            </div>
    `;

    // Счёт игры
    if (teams) {
        html += `
            <div class="status-item">
                <span class="status-label">Партии:</span>
                <span class="status-value">${teams.myGames} : ${teams.opponentGames}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Раунд:</span>
                <span class="status-value">${teams.myScore} : ${teams.opponentScore}</span>
            </div>
        `;
    }

    // Партнёр
    if (partner) {
        html += `
            <div class="status-item">
                <span class="status-label">Партнёр:</span>
                <span class="status-value">${partner}</span>
            </div>
        `;
    }

    html += `
            <div class="status-item">
                <span class="status-label">Ваш ход:</span>
                <span class="status-value">${myTurn ? '✓ Да' : '✗ Нет'}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Карт на руке:</span>
                <span class="status-value">${myCards?.length || 0}</span>
            </div>
        </div>
    `;

    // Рекомендация
    if (myTurn && recommendation && enabled) {
        html += `
            <div class="recommendation">
                <div class="rec-card">${recommendation.card.toString()}</div>
                <div class="rec-reason">${recommendation.reasoning}</div>
            </div>
        `;
    }

    // Статистика (если есть)
    if (stats && stats.totalGames > 0) {
        const winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
        const avgMyScore = Math.round(stats.totalPoints / stats.totalGames);
        const avgOppScore = Math.round(stats.totalOpponentPoints / stats.totalGames);

        // Текущая серия
        let streak = { type: null, count: 0 };
        if (stats.gamesHistory && stats.gamesHistory.length > 0) {
            const firstResult = stats.gamesHistory[0].result;
            let count = 0;
            for (const game of stats.gamesHistory) {
                if (game.result === firstResult) count++;
                else break;
            }
            streak = { type: firstResult, count };
        }

        html += `
            <div class="status" style="background: rgba(0, 0, 0, 0.4); margin-top: 15px;">
                <div style="font-weight: bold; margin-bottom: 10px; text-align: center;">📊 Статистика</div>
                <div class="status-item">
                    <span class="status-label">Всего игр:</span>
                    <span class="status-value">${stats.totalGames}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Win Rate:</span>
                    <span class="status-value">${winRate}%</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Побед:</span>
                    <span class="status-value">${stats.wins} | Поражений: ${stats.losses}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Средний счёт:</span>
                    <span class="status-value">${avgMyScore} : ${avgOppScore}</span>
                </div>
        `;

        // Серия
        if (streak.count > 1) {
            const streakEmoji = streak.type === 'win' ? '🔥' : '❄️';
            const streakText = streak.type === 'win' ? 'побед' : 'поражений';
            html += `
                <div class="status-item">
                    <span class="status-label">Серия:</span>
                    <span class="status-value">${streakEmoji} ${streak.count} ${streakText}</span>
                </div>
            `;
        }

        html += `</div>`;
    }

    // V2.0: Профили игроков
    if (playerProfiles) {
        const profiles = [
            { name: 'Партнёр', profile: playerProfiles.top, emoji: '🤝' },
            { name: 'Слева', profile: playerProfiles.left, emoji: '👈' },
            { name: 'Справа', profile: playerProfiles.right, emoji: '👉' }
        ];

        const hasProfiles = profiles.some(p => p.profile && p.profile.analysis && p.profile.analysis.confidence > 0.3);

        if (hasProfiles) {
            html += `
                <div class="status" style="background: rgba(0, 0, 0, 0.4); margin-top: 15px;">
                    <div style="font-weight: bold; margin-bottom: 10px; text-align: center;">🎭 Профили игроков</div>
            `;

            for (const { name, profile, emoji } of profiles) {
                if (profile && profile.analysis && profile.analysis.confidence > 0.3) {
                    const styleEmoji = {
                        'aggressive': '⚔️',
                        'defensive': '🛡️',
                        'risky': '🎲',
                        'assertive': '💪',
                        'balanced': '⚖️'
                    };

                    html += `
                        <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                            <div style="font-size: 11px; font-weight: bold; margin-bottom: 3px;">
                                ${emoji} ${profile.name}
                            </div>
                            <div style="font-size: 10px; color: #aaa;">
                                ${styleEmoji[profile.analysis.style] || '⚖️'} ${profile.analysis.description}
                            </div>
                        </div>
                    `;
                }
            }

            html += `</div>`;
        }
    }

    // Кнопки
    html += `
        <button class="btn ${enabled ? 'btn-danger' : 'btn-primary'}" id="toggle-btn">
            ${enabled ? '⏸ Выключить помощника' : '▶ Включить помощника'}
        </button>
        <button class="btn btn-secondary" id="refresh-btn">
            🔄 Обновить
        </button>
    `;

    document.getElementById('content').innerHTML = html;

    // Обработчики кнопок
    document.getElementById('toggle-btn').addEventListener('click', toggleAssistant);
    document.getElementById('refresh-btn').addEventListener('click', loadGameState);
}

function showNotOnSite() {
    document.getElementById('content').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p style="font-size: 48px; margin: 0;">🎴</p>
            <p style="margin-top: 15px;">Откройте kozel-online.com<br>чтобы начать игру</p>
            <button class="btn btn-primary" id="open-site-btn">
                Перейти на сайт
            </button>
        </div>
    `;

    document.getElementById('open-site-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://kozel-online.com/' });
    });
}

function showWaiting() {
    document.getElementById('content').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p style="font-size: 48px; margin: 0;">⏳</p>
            <p style="margin-top: 15px;">Ожидание игры...</p>
            <p style="font-size: 13px; opacity: 0.7;">Начните партию на сайте</p>
        </div>
    `;
}

function showError() {
    document.getElementById('content').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <p style="font-size: 48px; margin: 0;">⚠️</p>
            <p style="margin-top: 15px;">Ошибка подключения</p>
            <p style="font-size: 13px; opacity: 0.7;">Перезагрузите страницу</p>
            <button class="btn btn-primary" id="reload-btn">
                🔄 Перезагрузить страницу
            </button>
        </div>
    `;

    document.getElementById('reload-btn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.reload(tab.id);
        }
    });
}

async function toggleAssistant() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
        await loadGameState();
    } catch (error) {
        console.error('Ошибка переключения:', error);
    }
}
