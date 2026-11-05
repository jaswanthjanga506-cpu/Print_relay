import { createContext, useCallback, useContext, useState } from 'react';
import { Check, CircleAlert, X } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const toast = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(({ id, message, type }) => (
          <div className={`toast toast--${type}`} key={id} role="status">
            {type === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}
            <span>{message}</span>
            <button className="icon-button" aria-label="Dismiss notification" onClick={() => dismiss(id)}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
