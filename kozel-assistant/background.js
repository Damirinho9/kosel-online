/**
 * Background Service Worker для Козёл Помощник
 */

// V2.0 Phase 3: ML в background service worker
let mlInitialized = false;
let mlModel = null;
let mlEncoder = null;

// Загружаем TensorFlow.js и ML модули
try {
    // Импортируем TensorFlow.js из локального файла
    importScripts('lib/tf.min.js');

    // Импортируем ML модули
    importScripts('ai/card.js');
    importScripts('ai/ml-encoder.js');
    importScripts('ai/ml-model.js');

    console.log('[Background ML] ✓ TensorFlow.js загружен:', typeof tf !== 'undefined' ? tf.version.tfjs : 'error');

    // Инициализируем ML
    initializeML();
} catch (error) {
    console.warn('[Background ML] ⚠️ ML недоступен:', error.message);
    console.log('[Background ML] Расширение продолжит работу без ML');
}

/**
 * Инициализация ML модели
 */
async function initializeML() {
    try {
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js не загружен');
        }

        if (typeof MLStateEncoder === 'undefined' || typeof KozelML === 'undefined') {
            throw new Error('ML модули не загружены');
        }

        mlEncoder = new MLStateEncoder();
        mlModel = new KozelML();

        // Загружаем сохранённую модель
        const loaded = await mlModel.loadModel();

        mlInitialized = loaded;

        if (loaded) {
            console.log('[Background ML] ✓ ML модель инициализирована');
        } else {
            console.log('[Background ML] ML модель создана, требует обучения');
        }

    } catch (error) {
        console.error('[Background ML] Ошибка инициализации:', error);
        mlInitialized = false;
    }
}

// Установка расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Козёл Помощник] Расширение установлено');

    // Устанавливаем начальные настройки
    chrome.storage.local.set({
        enabled: true,
        version: '2.0.0',
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
        sendResponse({ success: true });
    }

    // V2.0 Phase 3: ML предсказания
    else if (request.action === 'mlPredict') {
        handleMLPredict(request.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Async response
    }

    else if (request.action === 'mlTrain') {
        handleMLTrain(request.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Async response
    }

    else if (request.action === 'mlStatus') {
        sendResponse({
            initialized: mlInitialized,
            available: typeof tf !== 'undefined',
            stats: mlModel ? mlModel.getStats() : null
        });
    }

    return true;
});

/**
 * ML предсказание лучшей карты
 */
async function handleMLPredict(data) {
    try {
        if (!mlInitialized || !mlModel) {
            return { error: 'ML не инициализирован' };
        }

        const { gameState, legalCards } = data;

        // Делаем предсказание
        const prediction = await mlModel.predictBestCard(gameState, legalCards);

        return {
            success: true,
            prediction: prediction
        };

    } catch (error) {
        console.error('[Background ML] Ошибка предсказания:', error);
        return { error: error.message };
    }
}

/**
 * ML обучение
 */
async function handleMLTrain(data) {
    try {
        if (!mlInitialized || !mlModel || !mlEncoder) {
            return { error: 'ML не инициализирован' };
        }

        const { trainingData } = data;

        if (!trainingData || trainingData.length === 0) {
            return { error: 'Нет данных для обучения' };
        }

        // Кодируем данные
        const encodedData = [];
        for (const example of trainingData) {
            const encodedState = mlEncoder.encodeGameState(example.state);
            const encodedAction = mlEncoder.encodeAction(example.action);

            encodedData.push({
                state: encodedState,
                action: encodedAction,
                reward: example.reward
            });
        }

        // Обучаем
        const success = await mlModel.train(encodedData);

        if (success) {
            // Сохраняем модель
            await mlModel.saveModel();

            return {
                success: true,
                stats: mlModel.getStats()
            };
        } else {
            return { error: 'Обучение не удалось' };
        }

    } catch (error) {
        console.error('[Background ML] Ошибка обучения:', error);
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
