import { useApp } from '../lib/store';

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={`toast${toast.tone === 'success' ? ' toast--success' : toast.tone === 'error' ? ' toast--error' : ''}`}
          onClick={() => dismissToast(toast.id)}
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
