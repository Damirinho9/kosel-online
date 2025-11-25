// V2.0 Phase 3: ML в offscreen document (обход CSP ограничений Service Worker)
// Offscreen Document API позволяет загружать TensorFlow.js без 'unsafe-eval' ограничений

let mlInitialized = false;
let mlModel = null;
let mlEncoder = null;
let initializationPromise = null;

console.log('[ML Offscreen] Документ загружен');

// Проверяем загрузку TensorFlow.js
if (typeof tf === 'undefined') {
    console.warn('[ML Offscreen] ⚠️ TensorFlow.js не загружен');
    console.warn('[ML Offscreen] Расширение работает без ML функций');
    console.warn('[ML Offscreen] См. INSTALL_TENSORFLOW.md для инструкций');
} else {
    try {
        // Проверяем, может ли TensorFlow.js работать в этом окружении
        console.log('[ML Offscreen] ✓ TensorFlow.js загружен:', tf.version.tfjs);

        // Инициализируем ML
        initializeML();
    } catch (error) {
        // TensorFlow.js может не работать из-за CSP ограничений Manifest V3
        console.error('[ML Offscreen] ✗ TensorFlow.js несовместим с Manifest V3 CSP:', error.message);
        console.warn('[ML Offscreen] ⚠️ ML функции недоступны из-за ограничений Chrome Extension');
        console.warn('[ML Offscreen] Расширение продолжит работать без ML предсказаний');
        console.info('[ML Offscreen] Подробнее: https://github.com/tensorflow/tfjs/issues/5429');
    }
}

/**
 * Инициализация ML модели
 */
async function initializeML() {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log('[ML Offscreen] Инициализация ML...');

            // Создаем энкодер
            mlEncoder = new MLEncoder();

            // Создаем модель
            mlModel = new MLModel(mlEncoder);

            // Пытаемся загрузить сохраненную модель
            const loaded = await mlModel.load();

            if (loaded) {
                mlInitialized = true;
                console.log('[ML Offscreen] ✓ ML модель загружена из хранилища');
            } else {
                console.log('[ML Offscreen] ℹ️ ML готов к обучению (модель не найдена)');
            }

            return true;
        } catch (error) {
            console.error('[ML Offscreen] ✗ Ошибка инициализации:', error);
            throw error;
        }
    })();

    return initializationPromise;
}

/**
 * Обработка предсказания
 */
async function handlePredict(data) {
    try {
        await initializeML();

        if (!mlInitialized || !mlModel) {
            return { error: 'ML модель не обучена' };
        }

        const { gameState, legalCards } = data;

        // Получаем предсказание
        const prediction = await mlModel.predict(gameState, legalCards);

        return { success: true, prediction };

    } catch (error) {
        console.error('[ML Offscreen] ✗ Ошибка предсказания:', error);
        return { error: error.message };
    }
}

/**
 * Обработка обучения
 */
async function handleTrain(data) {
    try {
        await initializeML();

        if (!mlModel) {
            return { error: 'ML не инициализирован' };
        }

        const { trainingData } = data;

        if (!trainingData || trainingData.length === 0) {
            return { error: 'Нет данных для обучения' };
        }

        console.log(`[ML Offscreen] Начинаем обучение на ${trainingData.length} играх...`);

        // Обучаем модель
        const result = await mlModel.train(trainingData);

        if (result.success) {
            mlInitialized = true;
            console.log('[ML Offscreen] ✓ Обучение завершено успешно');

            // Сохраняем модель
            await mlModel.save();

            return {
                success: true,
                stats: mlModel.getStats()
            };
        } else {
            return { error: result.error || 'Обучение не удалось' };
        }

    } catch (error) {
        console.error('[ML Offscreen] ✗ Ошибка обучения:', error);
        return { error: error.message };
    }
}

/**
 * Получение статуса ML
 */
async function handleStatus() {
    try {
        await initializeML();

        return {
            initialized: mlInitialized,
            available: typeof tf !== 'undefined' && mlModel !== null,
            stats: mlModel ? mlModel.getStats() : null,
            tfVersion: typeof tf !== 'undefined' ? tf.version.tfjs : null
        };

    } catch (error) {
        return {
            initialized: false,
            available: false,
            error: error.message
        };
    }
}

// Слушаем сообщения от background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[ML Offscreen] Получено сообщение:', request.action);

    if (request.action === 'mlPredict') {
        handlePredict(request.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Асинхронный ответ
    }
    else if (request.action === 'mlTrain') {
        handleTrain(request.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Асинхронный ответ
    }
    else if (request.action === 'mlStatus') {
        handleStatus()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Асинхронный ответ
    }
});

console.log('[ML Offscreen] ✓ Готов к обработке ML запросов');
