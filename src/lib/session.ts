// Токен входа: живёт в localStorage этого браузера. Нет токена — показываем страницу входа.

import { useSyncExternalStore } from 'react';

const KEY = 'we-finance.token';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current = read();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getToken(): string | null {
  return current;
}

export function setToken(token: string): void {
  current = token;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // Хранилище недоступно (приватное окно) — токен живёт до перезагрузки страницы.
  }
  emit();
}

export function clearToken(): void {
  current = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // нечего удалять
  }
  emit();
}

/** Есть ли вход: компонент перерисуется, когда токен появится или пропадёт. */
export function useToken(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
