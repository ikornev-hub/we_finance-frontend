import { useCallback, useState } from 'react';

/** Состояние одной операции: идёт ли, чем кончилась, ошибка. */
export function useAction<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [data, setData] = useState<T | null>(null);

  const run = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
      return result;
    } catch (caught) {
      setError(caught);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { loading, error, data, setData, run, reset };
}
