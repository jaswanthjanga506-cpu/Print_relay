import { useEffect } from 'react';

export function useRealtimeRefresh(refresh, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = () => refresh();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 45000);
    window.addEventListener('printrelay:refresh', handler);
    return () => { window.clearInterval(poll); window.removeEventListener('printrelay:refresh', handler); };
  }, [refresh, enabled]);
}
