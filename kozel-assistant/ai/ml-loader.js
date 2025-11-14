/**
 * ML Loader - загрузка TensorFlow.js для Chrome Extension
 */

class MLLoader {
    constructor() {
        this.tfLoaded = false;
        this.tfLoadingPromise = null;
    }

    /**
     * Загрузить TensorFlow.js
     */
    async loadTensorFlow() {
        if (this.tfLoaded && typeof tf !== 'undefined') {
            return true;
        }

        if (this.tfLoadingPromise) {
            return this.tfLoadingPromise;
        }

        this.tfLoadingPromise = new Promise((resolve, reject) => {
            // Проверяем доступен ли TensorFlow.js
            if (typeof tf !== 'undefined') {
                this.tfLoaded = true;
                console.log('[ML Loader] ✓ TensorFlow.js уже загружен');
                resolve(true);
                return;
            }

            // Загружаем TensorFlow.js с CDN в контекст страницы
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js';
            script.async = true;
            script.crossOrigin = 'anonymous';

            script.onload = () => {
                // Ждем пока tf станет доступен
                const checkTf = setInterval(() => {
                    if (typeof tf !== 'undefined') {
                        clearInterval(checkTf);
                        this.tfLoaded = true;
                        console.log('[ML Loader] ✓ TensorFlow.js загружен:', tf.version.tfjs);
                        resolve(true);
                    }
                }, 100);

                // Таймаут 10 секунд
                setTimeout(() => {
                    clearInterval(checkTf);
                    if (!this.tfLoaded) {
                        console.error('[ML Loader] ✗ Таймаут загрузки TensorFlow.js');
                        reject(new Error('TensorFlow.js загрузка таймаут'));
                    }
                }, 10000);
            };

            script.onerror = (error) => {
                console.error('[ML Loader] ✗ Ошибка загрузки TensorFlow.js:', error);
                console.error('[ML Loader] Попробуйте проверить интернет соединение');
                reject(error);
            };

            // Добавляем в head страницы
            (document.head || document.documentElement).appendChild(script);
            console.log('[ML Loader] Загрузка TensorFlow.js с CDN...');
        });

        return this.tfLoadingPromise;
    }

    /**
     * Проверить доступность TensorFlow.js
     */
    isTensorFlowAvailable() {
        return this.tfLoaded && typeof tf !== 'undefined';
    }
}

// Глобальный экземпляр
const mlLoader = new MLLoader();

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLLoader;
}
