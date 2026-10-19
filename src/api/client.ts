// Один fetch на всё приложение: JSON туда-обратно и понятные ошибки.

export interface FieldProblem {
  where: string; // "profile → terms → 1 → salary"
  message: string;
  type: string;
}

/** Ошибка запроса: код ответа и человекочитаемое описание. */
export class ApiError extends Error {
  readonly status: number;
  readonly problems: FieldProblem[];
  /** Бэкенд недоступен (сеть или прокси Vite без ответа от uvicorn). */
  readonly offline: boolean;

  constructor(status: number, message: string, problems: FieldProblem[] = [], offline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problems = problems;
    this.offline = offline;
  }
}

type Query = Record<string, string | number | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Коды не 2xx, у которых тело — обычный ответ (например, /health отвечает 503 с status=degraded). */
  accept?: number[];
}

const OFFLINE_MESSAGE = 'Бэкенд не отвечает. Запущен ли uvicorn на 127.0.0.1:8000?';
const LOC_SKIP = new Set(['body', 'query', 'path']);

function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** detail от FastAPI: строка (наши 404/422) или список ошибок pydantic. */
function parseDetail(detail: unknown): { message: string; problems: FieldProblem[] } {
  if (typeof detail === 'string') return { message: detail, problems: [] };
  if (Array.isArray(detail)) {
    const problems = detail.map((item: { loc?: unknown[]; msg?: string; type?: string }) => ({
      where:
        (item.loc ?? [])
          .filter((part) => !LOC_SKIP.has(String(part)))
          .join(' → ') || 'запрос целиком',
      message: (item.msg ?? '').replace(/^Value error, /, ''),
      type: item.type ?? '',
    }));
    return { message: 'Данные не прошли проверку', problems };
  }
  return { message: 'Неизвестная ошибка', problems: [] };
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path + toQueryString(options.query), {
      method,
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE, [], true);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const accepted = options.accept?.includes(response.status) && data !== null && typeof data === 'object';
  if (!response.ok && !accepted) {
    // Прокси Vite отвечает 500/502/504 с пустым телом, если бэкенд выключен.
    if (response.status >= 500 && (data === null || typeof data === 'string')) {
      const down = response.status === 502 || response.status === 504 || !text;
      throw new ApiError(
        response.status,
        down ? OFFLINE_MESSAGE : `Ошибка сервера ${response.status}: ${String(data).slice(0, 300)}`,
        [],
        down,
      );
    }
    const { message, problems } = parseDetail((data as { detail?: unknown } | null)?.detail);
    throw new ApiError(response.status, message, problems);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, { body, query }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
};
