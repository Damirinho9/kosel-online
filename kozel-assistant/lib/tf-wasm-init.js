/**
 * Инициализация TensorFlow.js WASM Backend
 * Manifest V3 совместимая версия без eval()
 */

(async function initTensorFlowWasm() {
    console.log('[TF-WASM] Начало инициализации WASM backend...');

    try {
        // Проверяем наличие tf
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js Core не загружен');
        }

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

        console.log('[TF-WASM] ✓ TensorFlow.js WASM готов к использованию');

    } catch (error) {
        console.error('[TF-WASM] ✗ Ошибка инициализации:', error);
        console.error('[TF-WASM] Детали:', error.stack);

        // Устанавливаем флаг ошибки
        window.tfReady = false;
        window.tfError = error.message;

        throw error;
    }
})();
