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
            renderGameState(response.gameState, response.enabled);
        } else {
            showWaiting();
        }

    } catch (error) {
        console.error('Ошибка получения состояния:', error);
        showError();
    }
}

function renderGameState(gameState, enabled) {
    const { myCards, tableCards, myTurn, score, recommendation } = gameState;

    let html = `
        <div class="status">
            <div class="status-item">
                <span class="status-label">Статус:</span>
                <span class="status-value">${enabled ? '✓ Активен' : '✗ Выключен'}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Счёт:</span>
                <span class="status-value">${score[1]} : ${score[0]}</span>
            </div>
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

    if (myTurn && recommendation && enabled) {
        html += `
            <div class="recommendation">
                <div class="rec-card">${recommendation.card.toString()}</div>
                <div class="rec-reason">${recommendation.reasoning}</div>
            </div>
        `;
    }

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
