// V2.0 Phase 3.1: ML в offscreen document с WASM backend (Manifest V3 совместимая версия)
// Использует модульный TensorFlow.js: @tensorflow/tfjs-core + @tensorflow/tfjs-backend-wasm
// Не использует eval() - полностью совместимо с CSP Manifest V3

let mlInitialized = false;
let mlModel = null;
let mlEncoder = null;
let initializationPromise = null;

console.log('[ML Offscreen WASM] Документ загружен');

// Ожидаем инициализации WASM backend
async function waitForWasmReady() {
    console.log('[ML Offscreen WASM] Ожидание инициализации WASM...');

    // Ждем готовности WASM (максимум 5 секунд)
    for (let i = 0; i < 50; i++) {
        if (window.tfReady === true) {
            console.log('[ML Offscreen WASM] ✓ WASM backend готов!');
            return true;
        }

        if (window.tfError) {
            console.error('[ML Offscreen WASM] ✗ Ошибка WASM:', window.tfError);
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.error('[ML Offscreen WASM] ✗ Timeout ожидания WASM backend');
    return false;
}

// Инициализация после готовности WASM
(async function init() {
    // Проверяем загрузку TensorFlow.js
    if (typeof tf === 'undefined') {
        console.warn('[ML Offscreen WASM] ⚠️ TensorFlow.js не загружен');
        console.warn('[ML Offscreen WASM] Расширение работает без ML функций');
        console.warn('[ML Offscreen WASM] См. INSTALL_TENSORFLOW_WASM.md для инструкций');
        return;
    }

    // Ждем инициализации WASM
    const wasmReady = await waitForWasmReady();

    if (!wasmReady) {
        console.error('[ML Offscreen WASM] ✗ WASM backend не инициализирован');
        console.warn('[ML Offscreen WASM] ⚠️ ML функции недоступны');
        console.warn('[ML Offscreen WASM] Расширение продолжит работать без ML');
        return;
    }

    try {
        console.log('[ML Offscreen WASM] ✓ TensorFlow.js WASM готов:', window.tfVersion);
        console.log('[ML Offscreen WASM] Backend:', tf.getBackend());

        // Инициализируем ML
        await initializeML();

    } catch (error) {
        console.error('[ML Offscreen WASM] ✗ Ошибка инициализации ML:', error.message);
        console.error('[ML Offscreen WASM] Stack:', error.stack);
        console.warn('[ML Offscreen WASM] ⚠️ ML функции недоступны');
        console.warn('[ML Offscreen WASM] Расширение продолжит работать без ML');
    }
})();
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
