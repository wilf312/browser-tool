import { useCallback, useEffect, useRef, useState } from 'react';

/** Show `保存しました` next to a control, then clear it again. */
export function useStatus(clearAfterMs = 1500): [string, (message: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (next: string) => {
      setMessage(next);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(''), clearAfterMs);
    },
    [clearAfterMs],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return [message, show];
}
