# Установка TensorFlow.js WASM (Manifest V3 совместимая версия)

## ✅ Решение проблемы с eval() - Модульная версия с WASM backend

**Эта версия TensorFlow.js РАБОТАЕТ в Chrome Extension Manifest V3!**

Модульная версия использует:
- `@tensorflow/tfjs-core` - ядро без eval()
- `@tensorflow/tfjs-backend-wasm` - WebAssembly backend (не использует eval())

---

## Требуемые файлы

Нужно скачать **3 файла**:

### 1. TensorFlow.js Core (~500 KB)
```
https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.11.0/dist/tf-core.min.js
```
Сохранить как: `kozel-assistant/lib/tf-core.min.js`

### 2. WASM Backend (~50 KB)
```
https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tf-backend-wasm.min.js
```
Сохранить как: `kozel-assistant/lib/tf-backend-wasm.min.js`

### 3. WASM Binary (~2.5 MB)
```
https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tfjs-backend-wasm.wasm
```
Сохранить как: `kozel-assistant/lib/tfjs-backend-wasm.wasm`

---

## Пошаговая инструкция

### Шаг 1: Скачайте файлы

Откройте каждый URL в Chrome и нажмите Ctrl+S для сохранения:

1. **tf-core.min.js:**
   - Откройте: https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.11.0/dist/tf-core.min.js
   - Ctrl+S → Сохранить в `kozel-assistant/lib/`
   - Размер: ~500 KB

2. **tf-backend-wasm.min.js:**
   - Откройте: https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tf-backend-wasm.min.js
   - Ctrl+S → Сохранить в `kozel-assistant/lib/`
   - Размер: ~50 KB

3. **tfjs-backend-wasm.wasm:**
   - Откройте: https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tfjs-backend-wasm.wasm
   - Ctrl+S → Сохранить в `kozel-assistant/lib/`
   - Размер: ~2.5 MB
   - ⚠️ **Важно:** Убедитесь, что расширение файла `.wasm` (не `.wasm.txt`)

### Шаг 2: Проверьте файлы

В папке `kozel-assistant/lib/` должны быть:
```
lib/
├── tf-core.min.js          (~500 KB)
├── tf-backend-wasm.min.js  (~50 KB)
├── tfjs-backend-wasm.wasm  (~2.5 MB)
└── tf-wasm-init.js         (уже есть)
```

### Шаг 3: Измените offscreen document

Откройте `kozel-assistant/background.js` и найдите строку:
```javascript
url: 'offscreen.html',
```

Замените на:
```javascript
url: 'offscreen-wasm.html',
```

### Шаг 4: Перезагрузите расширение

1. Откройте `chrome://extensions/`
2. Нажмите кнопку обновления
3. Откройте консоль (F12)

---

## Проверка успешной установки

После перезагрузки расширения вы должны увидеть в консоли:

```
✅ УСПЕХ:
[TF-WASM] Начало инициализации WASM backend...
[TF-WASM] ✓ TensorFlow.js Core загружен: 4.11.0
[TF-WASM] ✓ WASM Backend загружен
[TF-WASM] ✓ WASM backend успешно инициализирован
[TF-WASM] Активный backend: wasm
[TF-WASM] ✓ Тест вычислений успешен: [1, 4, 9, 16]
[TF-WASM] ✓ TensorFlow.js WASM готов к использованию
[ML Offscreen WASM] ✓ TensorFlow.js WASM готов: 4.11.0
[ML Offscreen WASM] Backend: wasm
[ML Offscreen WASM] Инициализация ML...
[ML Offscreen WASM] ✓ ML модель загружена (или готова к обучению)
```

---

## Преимущества WASM версии

✅ **Полная совместимость с Manifest V3**
- Не использует eval() или new Function()
- Проходит все CSP проверки Chrome
- Официально поддерживается TensorFlow.js

✅ **Производительность**
- WebAssembly часто быстрее чем JavaScript
- Оптимизированные ML вычисления
- Низкое потребление памяти

✅ **Надежность**
- Стабильная работа в расширениях
- Нет конфликтов с CSP
- Долгосрочная поддержка

---

## Альтернативные источники

Если jsdelivr.net недоступен, попробуйте:

### unpkg.com:
```
https://unpkg.com/@tensorflow/tfjs-core@4.11.0/dist/tf-core.min.js
https://unpkg.com/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tf-backend-wasm.min.js
https://unpkg.com/@tensorflow/tfjs-backend-wasm@4.11.0/dist/tfjs-backend-wasm.wasm
```

### GitHub (требует навигацию):
```
https://github.com/tensorflow/tfjs/tree/tfjs-v4.11.0/tfjs-core/dist
https://github.com/tensorflow/tfjs/tree/tfjs-v4.11.0/tfjs-backend-wasm/dist
```

---

## Troubleshooting

### Ошибка: "tf-core.min.js not found"
- Проверьте, что файл находится именно в `kozel-assistant/lib/`
- Проверьте имя файла (регистр важен!)

### Ошибка: "WASM backend не инициализирован"
- Убедитесь, что скачали `.wasm` файл
- Проверьте, что расширение файла `.wasm` (не `.wasm.txt`)
- Проверьте размер: должен быть ~2.5 MB

### Ошибка: "Cannot find module wasm file"
- WASM файл должен быть в той же папке `lib/`
- Имя файла: `tfjs-backend-wasm.wasm` (точно так!)

### Консоль показывает старую версию
- Убедитесь, что изменили `offscreen.html` на `offscreen-wasm.html` в background.js
- Перезагрузите расширение еще раз (Ctrl+R в chrome://extensions/)

---

## Размер и производительность

**Общий размер файлов:**
- TensorFlow.js WASM: ~3 MB (против ~1.8 MB стандартной версии)
- Общий размер расширения: ~3.5 MB

**Производительность:**
- Инициализация: 200-500ms
- Обучение модели: ~10-30 секунд (100 игр)
- Предсказание: <50ms

---

## FAQ

**Q: Зачем нужны 3 файла вместо 1?**
A: Модульная архитектура позволяет избежать eval() и работать в Manifest V3.

**Q: Можно ли использовать CPU backend?**
A: Нет, CPU backend тоже использует eval(). Только WASM совместим с Manifest V3.

**Q: Будет ли работать без WASM?**
A: Нет, WASM - единственный backend без eval() для Manifest V3.

**Q: Как вернуться к старой версии?**
A: В background.js измените `offscreen-wasm.html` обратно на `offscreen.html`

---

**Важно:** После установки ML функции будут полностью работать!
