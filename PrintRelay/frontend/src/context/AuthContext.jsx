import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, payload } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { user: nextUser, shop: nextShop = null } = payload(await api.get('/auth/me'));
      setUser(nextUser);
      setShop(nextShop);
      setInitError('');
      return nextUser;
    } catch (error) {
      setUser(null);
      setShop(null);
      if (error.response && error.response.status !== 401) {
        setInitError(error.response.data?.error?.message || 'Unable to verify your session.');
      } else {
        setInitError('');
      }
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const expireSession = (event) => {
      setUser(null);
      setShop(null);
      setInitError(event.detail?.message || 'Your session has expired. Please sign in again.');
    };
    window.addEventListener('printrelay:session-expired', expireSession);
    return () => window.removeEventListener('printrelay:session-expired', expireSession);
  }, []);

  const acceptSession = useCallback((data) => {
    setUser(data.user);
    setShop(data.shop || null);
    setInitError('');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      setShop(null);
    } catch (error) {
      throw new Error(error.response?.data?.error?.message || 'Unable to sign out. Please try again.');
    }
  }, []);

  const value = useMemo(() => ({
    user, shop, ready, initError, refresh, setUser, setShop, acceptSession, signOut,
  }), [user, shop, ready, initError, refresh, acceptSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
