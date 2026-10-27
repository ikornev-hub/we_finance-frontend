// Пока backend не умеет эндпоинт (404/405), экран показывает пример — с плашкой, чтобы его не спутать с настоящими деньгами.

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';

export interface Loaded<T> {
  data: T | null;
  /** true — сервер этого ещё не умеет, показан пример. */
  sample: boolean;
  error: unknown;
  loading: boolean;
}

export function notImplemented(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}

/** Загрузить с сервера; эндпоинта нет — вернуть пример. */
export async function orSample<T>(call: () => Promise<T>, sample: T): Promise<{ data: T; sample: boolean }> {
  try {
    return { data: await call(), sample: false };
  } catch (error) {
    if (notImplemented(error)) return { data: sample, sample: true };
    throw error;
  }
}

/** То же как хук: загрузка при изменении ключа и ручная перезагрузка. */
export function useOrSample<T>(call: () => Promise<T>, sample: T, key: string): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: null, sample: false, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    orSample(call, sample)
      .then((result) => alive && setState({ data: result.data, sample: result.sample, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, sample: false, error, loading: false }));
    return () => {
      alive = false;
    };
    // call и sample — новые объекты на каждой отрисовке; перезагрузка — по ключу и reload.
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { ...state, reload };
}
