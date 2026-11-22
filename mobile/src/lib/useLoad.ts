import { useEffect, useState } from 'react';

/**
 * 读一份数据。load 要是稳定的函数（模块里的函数，或 useCallback 包过的）。
 * retry 给"点这里重试"用。
 */
export function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: unknown }>({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setState({ data, error: null }),
      (error) => live && setState((s) => ({ data: s.data, error: error ?? 'failed' })),
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);
  const retry = () => {
    setState((s) => ({ ...s, error: null }));
    setAttempt((n) => n + 1);
  };
  return { ...state, retry };
}
