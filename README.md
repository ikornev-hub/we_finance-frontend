# We Finance — фронтенд

Простой интерфейс, чтобы «потрогать кликом» всё API бэкенда: зарплату, кредиты, калькулятор кредита и служебные эндпоинты.
React + TypeScript + Vite + [Mantine](https://mantine.dev). Вид — по референсу «Vertix Dashboard»: оранжевый акцент, светлая и тёмная темы.

## Что есть

Экраны построены от пользовательских сценариев — [docs/user-scenarios.md](docs/user-scenarios.md).

| Вкладка | Что внутри | Эндпоинты |
|---|---|---|
| **Главная** | этот месяц: доход, платежи по кредитам, что останется; лента ближайших событий; кредиты коротко | `GET /salary/{year}`, `GET /loans`, `GET /loans/{id}` |
| **Доходы** | Отчёт (главная раздела), «Отпуск или больничный», «Что если»; «Мои данные» — по кнопке «Актуализировать данные» | `GET /salary/{year}`, `GET`/`PUT /salary/profile`, `POST /salary/absences`, `POST /salary/{year}/what-if` |
| **Кредиты** | Мои кредиты (→ карточка, ЧДП, удалить / в завершённые) · Архив (завершённые, удалённые → восстановить) · Новый кредит | `GET`/`POST /loans`, `GET /loans/{id}`, `POST /loans/{id}/prepayments/preview`, `POST /loans/{id}/prepayments`, `POST /loans/{id}/delete\|complete\|restore`, `GET /loans?status=` |
| **Калькулятор** | график и полный расчёт с ЧДП | `POST /calculator/schedule`, `POST /calculator/calculate` |
| ⚙ **Система** (шестерёнка в шапке) | состояние, версия, округление | `GET /health`, `GET /version`, `GET /money/round` |

Формы заполнены **учебными примерами** из требований: можно сразу жать кнопки.

## Безопасность данных

Все данные — кредиты и доходы — хранятся в Postgres на сервере. Копии базы делает сервер (`pg_dump` в `we_finance-infra`), а не браузер. Перед каждой записью — окно подтверждения; кредит и ЧДП после записи не меняются и не удаляются.

## Запуск

Два терминала **Git Bash**: бэкенд и фронт. Фронт ходит на бэкенд через прокси Vite (`/api`, `/health`, `/version`), CORS не нужен.
Порт 8000 обычно занят стендом qa, поэтому бэкенд для фронта — на **8010**.

**Терминал 1 — бэкенд** (ветка `feat/salary`: зарплаты в `main` пока нет, кредиты одинаковые):

```bash
cd /d/Code/we_finance/we_finance-backend
git switch feat/salary
cp data/credit.local.json data/credit.real-play.local.json   # копия реальных данных: пиши в неё сколько хочешь
CREDIT_DATA_PATH=data/credit.real-play.local.json .venv/Scripts/uvicorn.exe we_finance.api:app --reload --env-file .env --port 8010
```

Переменная перед командой главнее `.env`. Без неё бэкенд пишет в настоящий `data/credit.local.json`. Файлы `data/*.local.json` в `.gitignore`.
Начать заново — снова `cp`. Зарплату так же: `SALARY_DATA_PATH=data/salary.real-play.local.json`.

**Терминал 2 — фронт:**

```bash
cd /d/Code/we_finance/we_finance-frontend
npm install                                       # первый раз и после смены зависимостей
BACKEND_URL=http://127.0.0.1:8010 npm run dev
```

Открыть **http://127.0.0.1:5173**. Справа в шапке — статус бэкенда: жёлтый «API работает, БД: unavailable» — нормально без Postgres (кредиты и зарплата в JSON-файлах); красный «Бэкенд не отвечает» — не запущен uvicorn или не тот `BACKEND_URL`.

Остановить — `Ctrl+C` в обоих терминалах.

## Образ (для compose всего приложения)

```bash
docker build -t we-finance-frontend .
```

Внутри: сборка Vite → nginx. nginx отдаёт статику и проксирует `/api`, `/health`, `/version` на `BACKEND_URL` (по умолчанию `http://backend:8000` — имя сервиса в compose). Порт контейнера — 80.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | дев-сервер на 127.0.0.1:5173 с прокси на бэкенд |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run build` | типы + сборка в `dist/` |
| `BACKEND_URL=http://127.0.0.1:8010 npm run dev` | бэкенд на другом адресе (по умолчанию 8000) |

## Устройство

```
src/
  api/          client.ts — fetch и понятные ошибки; endpoints.ts — все эндпоинты; types.ts — типы по OpenAPI
  lib/          examples.ts — учебные примеры; format.ts — деньги и даты; confirm.tsx
  components/   Shell (шапка, вкладки, колонка иконок), Cards (KPI, панели), ErrorAlert, salary/*, loans/*
  pages/        HomePage, IncomePage, LoansPage, CalculatorPage, ServicePage
  navigation.tsx  вкладки и разделы; адрес #вкладка/раздел — работают «назад» и ссылки
```

Деньги приходят строками (`"1458106.20"`) и форматируются как строки — без float и потери копеек.
