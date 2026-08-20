# VoiceForge — Озвучивание текста на 15 языках

![Version](https://img.shields.io/badge/version-2.0.0-purple)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/license-MIT-green)

Бесплатный онлайн-сервис синтеза речи на основе Next.js 16, поддерживающий **3 движка TTS** и **15 языков** в основном интерфейсе, с расширенным каталогом **298 голосов на 57 языках** от freetts.ru.

## 🆕 Что нового в v2.0

- 🎵 **Анимация waveform** — визуализация воспроизведения в реальном времени
- 🎭 **Пресеты голоса** — 8 готовых шаблонов (Аудиокнига, Новости, Подкаст, Учеба, Объявление, Сказка, Быстро, По умолчанию)
- 📊 **Статистика текста** — счётчик слов, символов, предложений и оценочная длительность
- 🌗 **3 темы** — Светлая / Тёмная / Системная в выпадающем меню
- 🏷️ **SSML-теги** — паузы, эмфаза, шёпот, громкость, скорость (7 тегов)
- 🔍 **SEO** — structured data (JSON-LD), sitemap.xml, robots.txt, расширенные meta-теги

## ✨ Возможности

### 3 движка TTS в одном интерфейсе

| Движок | Описание | Лимит текста | Скачивание | Качество |
|--------|----------|--------------|------------|----------|
| **Web Speech API** | Мгновенно в браузере, все 15 языков | 5000 символов | ❌ | Системные голоса |
| **FreeTTS.ru** | 298 нейроголосов на 57 языках | 1024 символа | ✅ MP3 | Высокое |
| **Z.ai SDK** | Серверный движок, 7 голосов | 1024 символа | ✅ WAV | Высокое |

### Поддерживаемые языки (15 в интерфейсе)

🇷🇺 Русский · 🇺🇸 English (US) · 🇬🇧 English (UK) · 🇨🇳 中文 · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch · 🇮🇹 Italiano · 🇧🇷 Português (BR) · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇸🇦 العربية · 🇮🇳 हिन्दी · 🇹🇷 Türkçe · 🇳🇱 Nederlands

### Ключевые функции

- **15 языков** в основном интерфейсе с образцами текста
- **298 нейроголосов** freetts.ru (148 мужских + 150 женских)
- **Поиск по голосам** с фильтром по полу (Все/Муж/Жен/Избранные)
- **Избранные голоса** — сохраняются в localStorage между сессиями
- **8 пресетов голоса** — Аудиокнига, Новости, Подкаст, Учеба, Объявление, Сказка, Быстро
- **SSML-теги** — `<pause>`, `<emphasis>`, `<soft>`, `<loud>`, `<whisper>`, `<slow>`, `<fast>`
- **Анимация waveform** во время воспроизведения
- **Статистика текста** — слова, символы, предложения, оценка времени
- **Регулировка параметров**: скорость (0.5–2.0×), тон (0–2), громкость (0–100%)
- **Управление воспроизведением**: Play / Pause / Resume / Stop
- **Скачивание аудио** через любой серверный движок (MP3/WAV)
- **История** последних 20 озвучиваний с экспортом в JSON/CSV
- **3 темы** — Светлая / Тёмная / Системная
- **Сравнение движков** — озвучить один текст тремя движками параллельно
- **Drag & Drop** текстовых файлов (.txt, .md, .csv, .json)
- **Горячие клавиши**: `Space` — озвучить, `Esc` — стоп, `⇧S` — скачать
- **Полная адаптивность** (mobile-first дизайн)

## 🛠 Технологический стек

- **Framework**: Next.js 16 с App Router и Turbopack
- **Language**: TypeScript 5 (строгая типизация)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Animation**: Framer Motion
- **Theme**: next-themes (тёмная/светлая)
- **Icons**: Lucide React
- **TTS Engines**:
  - Web Speech API (браузерный)
  - z-ai-web-dev-sdk (серверный)
  - freetts.ru (через Playwright mini-service или прокси)
- **Database**: Prisma ORM с SQLite (доступен, но не используется в текущей версии)

## 📁 Структура проекта

```
voiceforge/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Корневой layout с ThemeProvider
│   │   ├── page.tsx                # Главная страница с UI
│   │   ├── globals.css             # Брендовая тема + анимации waveform
│   │   ├── robots.ts               # robots.txt (SEO)
│   │   ├── sitemap.ts              # sitemap.xml (SEO)
│   │   └── api/
│   │       ├── tts/route.ts        # Z.ai SDK endpoint
│   │       └── freetts/
│   │           ├── voices/route.ts # Каталог 298 голосов
│   │           └── synthesize/route.ts # Синтез через freetts.ru
│   │
│   ├── components/
│   │   ├── engine-selector.tsx     # Переключатель 3 движков
│   │   ├── language-selector.tsx   # Сетка выбора 15 языков
│   │   ├── voice-selector.tsx      # Выбор голоса браузера
│   │   ├── freetts-voice-picker.tsx # Пикер 298 голосов freetts + поиск + избранное
│   │   ├── compare-engines-dialog.tsx # Диалог сравнения движков
│   │   ├── audio-waveform.tsx      # Анимация воспроизведения (новое v2.0)
│   │   ├── preset-selector.tsx     # 8 пресетов голоса (новое v2.0)
│   │   ├── text-stats.tsx          # Статистика текста (новое v2.0)
│   │   ├── ssml-helper.tsx         # SSML-теги UI (новое v2.0)
│   │   ├── history-panel.tsx       # История с экспортом JSON/CSV
│   │   ├── theme-provider.tsx      # ThemeProvider
│   │   ├── theme-toggle.tsx        # 3 темы: light/dark/system
│   │   └── ui/                     # shadcn/ui компоненты
│   │
│   ├── hooks/
│   │   ├── use-speech-synthesis.ts # Хук Web Speech API + SSML-сегменты
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   │
│   └── lib/
│       ├── languages.ts            # 15 языков с метаданными
│       ├── freetts-voices.ts       # 298 голосов freetts.ru (статичный каталог)
│       ├── ssml.ts                 # SSML-парсер тегов (новое v2.0)
│       ├── utils.ts                # Утилиты (cn)
│       └── db.ts                   # Prisma client
│
├── mini-services/
│   └── freetts-scraper/            # Playwright mini-service для обхода WAF
│       ├── index.ts                # HTTP-сервер на порту 3004
│       ├── freetts_scraper.py      # Python Playwright скрипт
│       └── package.json
│
├── prisma/
│   └── schema.prisma               # Prisma схема (SQLite)
│
├── public/                         # Статические ассеты
├── download/                       # Скриншоты и демо-файлы
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── Caddyfile                       # Конфиг Caddy gateway
└── README.md                       # Этот файл
```

## 🚀 Запуск проекта

### Установка зависимостей

```bash
bun install
```

### Запуск dev-сервера

```bash
bun run dev
```

Сервер запустится на `http://localhost:3000`.

### Запуск mini-service для обхода WAF freetts.ru (опционально)

Mini-service использует Playwright (Python) для запуска реального Chromium браузера, который обходит WAF freetts.ru. Запускается отдельно:

```bash
cd mini-services/freetts-scraper
bun run dev
```

Сервис запустится на порту 3004. Главный Next.js API автоматически использует его как стратегию 0 при синтезе через freetts.ru.

**Требования**:
- Python 3.10+
- Playwright Python: `pip install playwright && playwright install chromium`
- Xvfb (для headed mode): `apt install xvfb`

### Запуск lint

```bash
bun run lint
```

### Сборка production

```bash
bun run build
bun run start
```

## 🎯 Использование

### Базовый сценарий

1. Выберите язык (15 вариантов с флагами)
2. Введите текст или нажмите «Образец» для вставки демо-текста
3. Выберите движок TTS:
   - **Web Speech** — мгновенно, без скачивания
   - **FreeTTS.ru** — выбор из 298 голосов, скачивание MP3
   - **Z.ai SDK** — серверный синтез, скачивание WAV
4. Настройте параметры (скорость, тон, громкость — только для Web Speech)
5. Нажмите «Озвучить» или «Синтезировать»
6. Скачайте аудио кнопкой «Скачать аудио»

### Сравнение движков

Нажмите кнопку «Сравнить движки» — откроется диалог, где один и тот же текст озвучивается всеми 3 движками параллельно. Можно послушать каждый и скачать для сравнения качества.

### Drag & Drop файлов

Перетащите текстовый файл (.txt, .md, .csv, .json) в любое место страницы — его содержимое загрузится в текстовое поле (до 100 КБ).

### SSML-теги для выразительности

Только для движка **Web Speech API**. Нажмите на раскрывающуюся панель «SSML-теги для выразительности» под текстовым полем и кликните на тег, чтобы вставить его в текст.

| Тег | Описание | Пример |
|-----|----------|--------|
| `<pause ms='500' />` | Пауза 500мс | `Привет <pause ms='300'/> мир` |
| `<emphasis>...</emphasis>` | Акцент (выше тон) | `Это <emphasis>важно</emphasis>` |
| `<soft>...</soft>` | Мягко (ниже тон) | `<soft>Тихо говорю</soft>` |
| `<loud>...</loud>` | Громко | `<loud>Внимание!</loud>` |
| `<whisper>...</whisper>` | Шёпот | `<whisper>Секрет</whisper>` |
| `<slow>...</slow>` | Медленно (0.7×) | `<slow>Очень медленно</slow>` |
| `<fast>...</fast>` | Быстро (1.4×) | `<fast>Очень быстро</fast>` |

Пример: `Привет <pause ms='500'/> мир! Это <emphasis>очень важно</emphasis>.`

### Пресеты голоса

8 готовых шаблонов настроек (только для Web Speech):

| Пресет | Скорость | Тон | Описание |
|--------|----------|-----|----------|
| По умолчанию | 1.0× | 1.0 | Сбалансированные настройки |
| Аудиокнига | 0.9× | 0.95 | Спокойный темп, мягкий тон |
| Новости | 1.0× | 1.0 | Чёткая дикторская речь |
| Подкаст | 1.05× | 1.1 | Дружелюбный темп, выше тон |
| Учеба | 0.8× | 1.0 | Медленный темп для запоминания |
| Объявление | 1.1× | 1.05 | Громко, уверенный тон |
| Сказка | 0.85× | 0.85 | Тихо, низкий тон |
| Быстро | 1.5× | 1.0 | Ускоренный темп |

### Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Space` | Озвучить / Пауза / Продолжить |
| `Esc` | Стоп |
| `⇧S` | Скачать аудио |

### История и экспорт

Все озвученные тексты сохраняются в истории (последние 20). Можно:
- **Воспроизвести снова** — клик на ▶
- **Удалить** отдельные записи
- **Экспортировать в JSON** — полная структура с метаданными
- **Экспортировать в CSV** — для открытия в Excel/Google Sheets
- **Очистить** всю историю

## 🔧 API Endpoints

### `POST /api/tts`
Синтез через Z.ai SDK.

```json
// Request
{
  "text": "Привет, мир!",
  "voice": "tongtong",
  "speed": 1.0,
  "format": "wav"
}

// Response: audio/wav binary
```

### `GET /api/freetts/voices?lang=ru`
Каталог 298 голосов freetts.ru.

```json
{
  "language": { "code": "ru", "name": "Русский" },
  "voices": [
    { "code": "ru-RU001", "name": "Ермилов", "gender": "m" },
    { "code": "ru-RU002", "name": "Николай", "gender": "m" }
  ],
  "total": 23
}
```

### `POST /api/freetts/synthesize`
Синтез через freetts.ru с 5 стратегиями обхода WAF:
1. Playwright mini-service (порт 3004) — реальный Chromium
2. Direct fetch с браузерными headers
3. Allorigins CORS proxy
4. corsproxy.io
5. codetabs proxy
6. **Auto-fallback на Z.ai SDK** если все стратегии провалились

```json
// Request
{
  "text": "Привет!",
  "voice": "ru-RU066"
}

// Response: audio/mpeg binary (или audio/wav при fallback)
// Headers:
//   X-Engine: freetts.ru | z-ai-sdk
//   X-Strategy: playwright | direct | allorigins | ... | freetts-unavailable-fallback
```

## ⚠️ Известные ограничения

### WAF freetts.ru

Сайт freetts.ru защищён строгим WAF, который блокирует:
- Все серверные fetch-запросы (403 Forbidden)
- Public CORS прокси (403/522)
- Headless Chromium (403)
- Headed Chromium через Xvfb (403) — в текущем окружении

**Решение в production**: использовать residential proxy или реальный VPS в России. Каталог 298 голосов работает полностью (статичный файл), синтез — зависит от окружения.

### Z.ai SDK форматы

SDK поддерживает только `wav` и `pcm`. Формат `mp3` был удалён в новых версиях SDK.

### Web Speech API

Браузерный API не позволяет сохранить аудио в файл — это ограничение безопасности браузеров. Для скачивания используйте freetts.ru или Z.ai SDK.

### Китайский язык в freetts

В каталоге freetts.ru нет китайских голосов. Для китайского используйте Web Speech API или Z.ai SDK.

## 🎨 Дизайн

- **Цветовая схема**: фиолетовый градиент (oklch 0.55 0.24 295 → 0.55 0.2 195)
- **Тёмная тема** по умолчанию
- **Адаптивность**: mobile-first, breakpoints sm/md/lg/xl
- **Анимации**: Framer Motion (fade-in, slide-up)
- **Эффекты**: glow-primary, bg-grid, brand-gradient-text
- **Скроллбары**: кастомные тонкие с фиолетовым акцентом

## 📊 Статистика

- **298 голосов** freetts.ru (148 мужских + 150 женских)
- **57 языков** в каталоге freetts
- **15 языков** в основном интерфейсе
- **3 движка** TTS
- **1024 символа** лимит для скачивания
- **5000 символов** лимит для Web Speech

## 📝 Лицензия

MIT — используйте свободно.

## 🤝 Благодарности

- [freetts.ru](https://freetts.ru) — за вдохновение и каталог голосов
- [Z.ai](https://z.ai) — за TTS SDK
- [shadcn/ui](https://ui.shadcn.com) — за UI-компоненты
- [Next.js](https://nextjs.org) — за фреймворк
- [Tailwind CSS](https://tailwindcss.com) — за стилизацию
