/**
 * KozelML - нейронная сеть для игры в Козла
 */

class KozelML {
    constructor() {
        this.model = null;
        this.encoder = new MLStateEncoder();
        this.modelLoaded = false;
        this.isTraining = false;

        // Параметры обучения
        this.learningRate = 0.001;
        this.batchSize = 32;
        this.epochs = 10;

        // Статистика
        this.stats = {
            predictions: 0,
            trainingSessions: 0,
            lastLoss: null,
            modelVersion: '1.0'
        };
    }

    /**
     * Создать архитектуру нейронной сети
     */
    createModel() {
        if (!mlLoader.isTensorFlowAvailable()) {
            console.error('[KozelML] TensorFlow.js не загружен');
            return false;
        }

        const inputSize = this.encoder.getInputSize();
        const outputSize = this.encoder.getOutputSize();

        console.log(`[KozelML] Создание модели: ${inputSize} → ${outputSize}`);

        // Создаём последовательную модель
        this.model = tf.sequential({
            layers: [
                // Входной слой
                tf.layers.dense({
                    inputShape: [inputSize],
                    units: 128,
                    activation: 'relu',
                    kernelInitializer: 'heNormal',
                    name: 'input_layer'
                }),

                // Dropout для регуляризации
                tf.layers.dropout({
                    rate: 0.2,
                    name: 'dropout_1'
                }),

                // Скрытый слой 1
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelInitializer: 'heNormal',
                    name: 'hidden_1'
                }),

                // Dropout
                tf.layers.dropout({
                    rate: 0.2,
                    name: 'dropout_2'
                }),

                // Скрытый слой 2
                tf.layers.dense({
                    units: 32,
                    activation: 'relu',
                    kernelInitializer: 'heNormal',
                    name: 'hidden_2'
                }),

                // Выходной слой (вероятности для каждой карты)
                tf.layers.dense({
                    units: outputSize,
                    activation: 'softmax',  // Вероятности
                    name: 'output_layer'
                })
            ]
        });

        // Компилируем модель
        this.model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('[KozelML] ✓ Модель создана');
        this.model.summary();

        this.modelLoaded = true;
        return true;
    }

    /**
     * Предсказать лучшую карту
     */
    async predictBestCard(gameState, legalCards) {
        if (!this.modelLoaded || !this.model) {
            return null;
        }

        try {
            // Кодируем состояние
            const stateVector = this.encoder.encodeGameState(gameState);

            // Предсказание
            const inputTensor = tf.tensor2d([stateVector]);
            const prediction = this.model.predict(inputTensor);
            const probabilities = await prediction.data();

            // Очищаем тензоры
            inputTensor.dispose();
            prediction.dispose();

            // Находим лучшую легальную карту
            let bestCard = null;
            let bestProb = -1;

            for (const card of legalCards) {
                const cardIndex = this.encoder.encodeAction(card);
                if (cardIndex >= 0 && cardIndex < probabilities.length) {
                    const prob = probabilities[cardIndex];
                    if (prob > bestProb) {
                        bestProb = prob;
                        bestCard = card;
                    }
                }
            }

            this.stats.predictions++;

            console.log(`[KozelML] Предсказание: ${bestCard?.toString()} (prob: ${(bestProb * 100).toFixed(1)}%)`);

            return {
                card: bestCard,
                confidence: bestProb,
                probabilities: probabilities
            };

        } catch (error) {
            console.error('[KozelML] Ошибка предсказания:', error);
            return null;
        }
    }

    /**
     * Обучить модель на данных
     */
    async train(trainingData) {
        if (!this.modelLoaded || !this.model) {
            console.error('[KozelML] Модель не загружена');
            return false;
        }

        if (!trainingData || trainingData.length === 0) {
            console.warn('[KozelML] Нет данных для обучения');
            return false;
        }

        this.isTraining = true;

        try {
            console.log(`[KozelML] Начало обучения на ${trainingData.length} примерах`);

            // Подготавливаем данные
            const states = [];
            const labels = [];

            for (const example of trainingData) {
                states.push(example.state);

                // Создаём one-hot метку для действия
                const label = new Array(this.encoder.getOutputSize()).fill(0);
                if (example.action >= 0 && example.action < label.length) {
                    // Взвешиваем метку наградой (0-1)
                    label[example.action] = Math.max(0, Math.min(1, example.reward));
                }
                labels.push(label);
            }

            // Создаём тензоры
            const xTrain = tf.tensor2d(states);
            const yTrain = tf.tensor2d(labels);

            // Обучаем
            const history = await this.model.fit(xTrain, yTrain, {
                epochs: this.epochs,
                batchSize: this.batchSize,
                validationSplit: 0.2,
                shuffle: true,
                verbose: 0,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`[KozelML] Epoch ${epoch + 1}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`);
                    }
                }
            });

            // Сохраняем статистику
            const finalLoss = history.history.loss[history.history.loss.length - 1];
            this.stats.lastLoss = finalLoss;
            this.stats.trainingSessions++;

            // Очищаем тензоры
            xTrain.dispose();
            yTrain.dispose();

            console.log(`[KozelML] ✓ Обучение завершено. Финальная loss: ${finalLoss.toFixed(4)}`);

            this.isTraining = false;
            return true;

        } catch (error) {
            console.error('[KozelML] Ошибка обучения:', error);
            this.isTraining = false;
            return false;
        }
    }

    /**
     * Сохранить модель
     */
    async saveModel() {
        if (!this.modelLoaded || !this.model) {
            return false;
        }

        try {
            // Сохраняем в IndexedDB через TensorFlow.js
            await this.model.save('indexeddb://kozel-ml-model');

            // Сохраняем статистику
            await this._saveStats();

            console.log('[KozelML] ✓ Модель сохранена');
            return true;

        } catch (error) {
            console.error('[KozelML] Ошибка сохранения модели:', error);
            return false;
        }
    }

    /**
     * Загрузить модель
     */
    async loadModel() {
        if (!mlLoader.isTensorFlowAvailable()) {
            console.error('[KozelML] TensorFlow.js не загружен');
            return false;
        }

        try {
            // Пытаемся загрузить из IndexedDB
            this.model = await tf.loadLayersModel('indexeddb://kozel-ml-model');

            // Загружаем статистику
            await this._loadStats();

            this.modelLoaded = true;
            console.log('[KozelML] ✓ Модель загружена из IndexedDB');
            return true;

        } catch (error) {
            console.log('[KozelML] Модель не найдена, создаём новую');
            return this.createModel();
        }
    }

    /**
     * Сохранить статистику
     */
    async _saveStats() {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                'kozel_ml_stats': this.stats
            }, resolve);
        });
    }

    /**
     * Загрузить статистику
     */
    async _loadStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['kozel_ml_stats'], (result) => {
                if (result.kozel_ml_stats) {
                    this.stats = result.kozel_ml_stats;
                }
                resolve();
            });
        });
    }

    /**
     * Получить статистику
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Сбросить модель
     */
    async resetModel() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }

        this.modelLoaded = false;
        this.stats = {
            predictions: 0,
            trainingSessions: 0,
            lastLoss: null,
            modelVersion: '1.0'
        };

        // Удаляем из IndexedDB
        try {
            await tf.io.removeModel('indexeddb://kozel-ml-model');
            console.log('[KozelML] ✓ Модель сброшена');
        } catch (error) {
            console.warn('[KozelML] Модель не найдена для удаления');
        }

        return this.createModel();
    }
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KozelML;
}
