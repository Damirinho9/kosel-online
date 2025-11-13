/**
 * Background Service Worker для Козёл Помощник
 */

// Установка расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Козёл Помощник] Расширение установлено');

    // Устанавливаем начальные настройки
    chrome.storage.local.set({
        enabled: true,
        version: '1.0.0',
        stats: {
            gamesPlayed: 0,
            recommendationsGiven: 0
        }
    });
});

// Обработка сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        updateStats(request.data);
    }

    return true;
});

// Обновление статистики
async function updateStats(data) {
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || { gamesPlayed: 0, recommendationsGiven: 0 };

    if (data.gameFinished) {
        stats.gamesPlayed++;
    }

    if (data.recommendationGiven) {
        stats.recommendationsGiven++;
    }

    await chrome.storage.local.set({ stats });
}

// Проверка обновлений
chrome.alarms.create('checkUpdates', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkUpdates') {
        console.log('[Козёл Помощник] Проверка обновлений...');
        // Здесь можно добавить логику проверки обновлений
    }
});

console.log('[Козёл Помощник] Background script загружен');
