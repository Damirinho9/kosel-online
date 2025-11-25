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
        // Используем window.tf явно
        const tf = window.tf;

        // Проверяем, что tf загружен (проверяем наличие базовых функций вместо version)
        if (!tf || typeof tf.tensor === 'undefined' || typeof tf.wasm === 'undefined') {
            throw new Error('TensorFlow.js Core или WASM backend не загружены');
        }

        console.log('[TF-WASM] ✓ TensorFlow.js Core загружен (keys:', Object.keys(tf).length, ')');
        console.log('[TF-WASM] ✓ WASM Backend загружен');

        // Проверяем наличие setWasmPaths
        if (typeof tf.wasm.setWasmPaths === 'undefined') {
            throw new Error('TensorFlow.js WASM backend не имеет метода setWasmPaths');
        }

        // Устанавливаем путь к WASM файлам (используем только базовую версию)
        // ВАЖНО: Single-threaded режим для избежания Web Workers (blob: URLs заблокированы в Manifest V3)
        tf.wasm.setWasmPaths({
            'tfjs-backend-wasm.wasm': 'lib/tfjs-backend-wasm.wasm',
            'tfjs-backend-wasm-simd.wasm': 'lib/tfjs-backend-wasm.wasm',
            'tfjs-backend-wasm-threaded-simd.wasm': 'lib/tfjs-backend-wasm.wasm'
        });

        console.log('[TF-WASM] Устанавливаем WASM backend (single-threaded режим)...');

        // Регистрируем WASM backend с numThreads: 1 (отключаем Web Workers)
        await tf.setBackend('wasm');

        // Отключаем threading явно
        if (tf.env && tf.env().set) {
            tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);
            tf.env().set('WASM_HAS_SIMD_SUPPORT', false);
        }

        // Ждем полной инициализации
        await tf.ready();

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
        window.tfVersion = tf.version?.tfjs || 'unknown (modular build)';
        window.tf = tf; // Убеждаемся, что tf доступен глобально

        console.log('[TF-WASM] ✓ TensorFlow.js WASM готов к использованию');
        console.log('[TF-WASM] Version:', window.tfVersion);

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
