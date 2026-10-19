# We Finance — фронтенд

Простой интерфейс, чтобы «потрогать кликом» всё API бэкенда: зарплату, кредиты, калькулятор кредита и служебные эндпоинты.
React + TypeScript + Vite + [Mantine](https://mantine.dev). Вид — по референсу «Vertix Dashboard»: оранжевый акцент, светлая и тёмная темы.

## Что есть

| Вкладка | Разделы (иконки слева) | Эндпоинты |
|---|---|---|
| **Зарплата** | Профиль и расчёт · Отчёт за год · Отсутствие · Что если | `POST /salary/calculate`, `GET`/`PUT /salary/profile`, `POST /salary/absences`, `GET /salary/{year}`, `POST /salary/{year}/what-if` |
| **Кредиты** | Мои кредиты (→ карточка, ЧДП) · Новый кредит | `GET`/`POST /loans`, `GET /loans/{id}`, `POST /loans/{id}/prepayments/preview`, `POST /loans/{id}/prepayments` |
| **Калькулятор** | График и полный расчёт с ЧДП | `POST /calculator/schedule`, `POST /calculator/calculate` |
| **Сервис** | Состояние, версия, округление | `GET /health`, `GET /version`, `GET /money/round` |
| **Бэкапы** | Копии перед записью, восстановление профиля | — |

Формы заполнены **учебными примерами** из требований: можно сразу жать кнопки.

## Безопасность данных

Записывают на бэкенд: сохранение профиля, отсутствие, новый кредит, ЧДП. Перед каждой из них:

1. **окно подтверждения** (для ЧДП — красное: отменить нельзя);
2. **бэкап**: текущее состояние читается с бэкенда, скачивается JSON-файлом в «Загрузки» (`we-finance.*.backup.json`) и сохраняется во вкладке «Бэкапы» (последние 10, в этом браузере);
3. если бэкап снять не удалось — **запись не выполняется**.

Профиль зарплаты восстанавливается из «Бэкапов» одной кнопкой. Кредиты и ЧДП через API не откатить — копия нужна, чтобы поправить файл вручную.

## Запуск

Нужно два терминала: бэкенд и фронт. Фронт ходит на бэкенд через прокси Vite (`/api`, `/health`, `/version` → `127.0.0.1:8000`), CORS не нужен.

**Терминал 1 — бэкенд** (ветка с зарплатой):

```powershell
cd D:\Code\we_finance\we_finance-backend
git switch feat/salary
.venv\Scripts\activate
uvicorn we_finance.api:app --reload --env-file .env
```

**Терминал 2 — фронт:**

```powershell
cd D:\Code\we_finance\we_finance-frontend
npm install        # первый раз и после смены зависимостей
npm run dev
```

Открыть **http://127.0.0.1:5173**. Справа в шапке — статус бэкенда: зелёный «Бэкенд работает», жёлтый «API работает, БД: unavailable» (это нормально без Postgres: зарплата и кредиты в JSON-файлах), красный «Бэкенд не отвечает» — не запущен uvicorn.

### Песочница: играть, не трогая свои данные

`--env-file .env` указывает на твои `data/*.local.json`. Чтобы кликать по учебным копиям, в **терминале 1** перед `uvicorn`:

```powershell
Copy-Item data\salary.example.json data\salary.play.local.json
Copy-Item data\credit.example.json data\credit.play.local.json
$env:SALARY_DATA_PATH = "data/salary.play.local.json"
$env:CREDIT_DATA_PATH = "data/credit.play.local.json"
uvicorn we_finance.api:app --reload --env-file .env
```

Переменные из терминала главнее `.env`. Файлы `*.local.json` в `.gitignore`. Вернуться к своим данным — закрыть терминал (или `Remove-Item Env:SALARY_DATA_PATH, Env:CREDIT_DATA_PATH`) и запустить `uvicorn` заново.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | дев-сервер на 127.0.0.1:5173 с прокси на бэкенд |
| `npm run typecheck` | проверка типов TypeScript |
| `npm run build` | типы + сборка в `dist/` |
| `BACKEND_URL=http://127.0.0.1:8001 npm run dev` | бэкенд на другом адресе (в PowerShell: `$env:BACKEND_URL = "..."`) |

## Устройство

```
src/
  api/          client.ts — fetch и понятные ошибки; endpoints.ts — все эндпоинты; types.ts — типы по OpenAPI
  lib/          backup.ts — бэкапы; examples.ts — учебные примеры; format.ts — деньги и даты; confirm.tsx
  components/   Shell (шапка, вкладки, колонка иконок), Cards (KPI, панели), ErrorAlert, salary/*, loans/*
  pages/        SalaryPage, LoansPage, CalculatorPage, ServicePage, BackupsPage
  navigation.tsx  вкладки и разделы; адрес #вкладка/раздел — работают «назад» и ссылки
```

Деньги приходят строками (`"1458106.20"`) и форматируются как строки — без float и потери копеек.
