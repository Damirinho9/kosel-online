/**
 * Инициализация TensorFlow.js WASM Backend
 * Manifest V3 совместимая версия без eval()
 */

(async function initTensorFlowWasm() {
    console.log('[TF-WASM] Начало инициализации WASM backend...');
    console.log('[TF-WASM] DEBUG: typeof tf =', typeof tf);
    console.log('[TF-WASM] DEBUG: typeof window.tf =', typeof window.tf);
    console.log('[TF-WASM] DEBUG: typeof globalThis.tf =', typeof globalThis.tf);

    if (typeof window.tf === 'object') {
        console.log('[TF-WASM] DEBUG: window.tf keys:', Object.keys(window.tf));
        console.log('[TF-WASM] DEBUG: window.tf.version =', window.tf.version);
        console.log('[TF-WASM] DEBUG: window.tf.wasm =', typeof window.tf.wasm);
    }

    try {
        // Ждем загрузки TensorFlow.js (до 5 секунд)
        let tfLoaded = false;
        for (let i = 0; i < 50; i++) {
            if (typeof window.tf !== 'undefined' && window.tf.version && window.tf.version.tfjs) {
                console.log('[TF-WASM] DEBUG: Итерация', i, '- TF загружен!');
                tfLoaded = true;
                break;
            }
            if (i % 10 === 0) {
                console.log('[TF-WASM] DEBUG: Итерация', i, '- ожидание tf.version.tfjs...');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!tfLoaded) {
            console.error('[TF-WASM] DEBUG: После ожидания window.tf =', window.tf);
            console.error('[TF-WASM] DEBUG: После ожидания window.tf.version =', window.tf?.version);
            throw new Error('TensorFlow.js Core не загружен после ожидания');
        }

        // Используем window.tf явно
        const tf = window.tf;

        // Проверяем наличие WASM backend
        if (typeof tf.wasm === 'undefined' || typeof tf.wasm.setWasmPaths === 'undefined') {
            throw new Error('TensorFlow.js WASM backend не загружен');
        }

        console.log('[TF-WASM] ✓ TensorFlow.js Core загружен:', tf.version.tfjs);
        console.log('[TF-WASM] ✓ WASM Backend загружен');

        // Устанавливаем путь к WASM файлам
        tf.wasm.setWasmPaths('lib/');

        // Регистрируем WASM backend
        await tf.setBackend('wasm');

        console.log('[TF-WASM] ✓ WASM backend успешно инициализирован');
        console.log('[TF-WASM] Активный backend:', tf.getBackend());

        // Проверяем работоспособность
        const test = tf.tensor([1, 2, 3, 4]);
        const result = test.square();
        console.log('[TF-WASM] ✓ Тест вычислений успешен:', await result.data());
        test.dispose();
        result.dispose();

        // Устанавливаем флаг готовности
        window.tfReady = true;
        window.tfVersion = tf.version.tfjs;
        window.tf = tf; // Убеждаемся, что tf доступен глобально

        console.log('[TF-WASM] ✓ TensorFlow.js WASM готов к использованию');

    } catch (error) {
        console.error('[TF-WASM] ✗ Ошибка инициализации:', error);
        console.error('[TF-WASM] Детали:', error);
        if (error.stack) {
            console.error('[TF-WASM] Stack:', error.stack);
        }

        // Устанавливаем флаг ошибки
        window.tfReady = false;
        window.tfError = error.message;

        throw error;
    }
})();
