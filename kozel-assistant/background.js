/**
 * Background Service Worker для Козёл Помощник
 */

// V2.0 Phase 3: ML через Offscreen Document API
// Service Worker CSP запрещает eval(), поэтому используем offscreen document
let offscreenReady = false;

/**
 * Создание offscreen document для ML
 */
async function setupOffscreenDocument() {
    // Проверяем, существует ли уже offscreen document
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length > 0) {
        offscreenReady = true;
        return;
    }

    // Создаем offscreen document
    try {
        await chrome.offscreen.createDocument({
            // Стандартная версия (с eval() - НЕ РАБОТАЕТ в Manifest V3):
            // url: 'offscreen.html',

            // WASM версия (без eval() - РАБОТАЕТ в Manifest V3):
            // url: 'offscreen-wasm.html',  // См. INSTALL_TENSORFLOW_WASM.md

            url: 'offscreen.html',  // Измените на offscreen-wasm.html после установки WASM версии
            reasons: ['WORKERS'], // ML computations
            justification: 'TensorFlow.js для ML предсказаний требует выполнения кода (обход CSP Service Worker)'
        });

        offscreenReady = true;
        console.log('[Background] ✓ Offscreen document создан для ML');

    } catch (error) {
        console.error('[Background] ✗ Не удалось создать offscreen document:', error);
        offscreenReady = false;
    }
}

// Установка расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Козёл Помощник] Расширение установлено');

    // Устанавливаем начальные настройки
    chrome.storage.local.set({
        enabled: true,
        version: '2.0.1',
        stats: {
            gamesPlayed: 0,
            recommendationsGiven: 0
        }
    });

    // Offscreen document создается автоматически при запуске Service Worker (см. ниже)
});

// Создаем offscreen document при запуске service worker
setupOffscreenDocument();

// Обработка сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Пропускаем сообщения от offscreen document (они предназначены для content.js)
    if (sender.url && sender.url.includes('offscreen.html')) {
        return;
    }

    if (request.action === 'updateStats') {
        updateStats(request.data);
        sendResponse({ success: true });
    }

    // V2.0 Phase 3: ML запросы → перенаправляем в offscreen document
    else if (request.action === 'mlPredict' || request.action === 'mlTrain' || request.action === 'mlStatus') {
        forwardToOffscreen(request)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Async response
    }

    return true;
});

/**
 * Перенаправление ML запросов в offscreen document
 */
async function forwardToOffscreen(request) {
    try {
        // Убеждаемся, что offscreen document создан
        if (!offscreenReady) {
            await setupOffscreenDocument();
        }

        if (!offscreenReady) {
            return { error: 'Offscreen document недоступен' };
        }

        // Отправляем запрос в offscreen document
        const response = await chrome.runtime.sendMessage(request);
        return response;

    } catch (error) {
        console.error('[Background] Ошибка перенаправления в offscreen:', error);
        return { error: error.message };
    }
}

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

console.log('[Козёл Помощник] Background script загружен');
