import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { humanize } from '../utils/format';

export function Logo({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand--light' : ''}`} aria-label="PrintRelay home">
    <img src="/printrelay-mark.svg" alt="" /><span>printrelay</span>
  </Link>;
}

export function Button({ children, variant = 'primary', className = '', loading = false, ...props }) {
  return <button className={`button button--${variant} ${className}`} disabled={props.disabled || loading} {...props}>
    {loading && <LoaderCircle className="spin" size={16} />}{children}
  </button>;
}

export function StatusBadge({ value }) {
  const tone = ['APPROVED', 'ACTIVE', 'PAID', 'COLLECTED'].includes(value) ? 'good'
    : ['PENDING', 'UNPAID', 'PRINTING', 'ACCEPTED'].includes(value) ? 'wait'
      : ['REJECTED', 'CANCELLED', 'SUSPENDED'].includes(value) ? 'bad' : 'neutral';
  return <span className={`status status--${tone}`}><span className="status-dot" />{humanize(value || 'Unknown')}</span>;
}

export function Loader({ label = 'Loading' }) {
  return <div className="state state--loading"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="state state--error"><AlertCircle size={22} /><div><strong>We couldn’t load this.</strong><p>{message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw size={15} /> Try again</Button>}</div></div>;
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return <div className="empty-state">{Icon && <div className="empty-icon"><Icon size={22} /></div>}<h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function PageTitle({ eyebrow, title, description, actions }) {
  return <div className="page-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function BackLink({ to = -1, children = 'Back' }) {
  return <Link className="back-link" to={to}><ArrowLeft size={15} />{children}</Link>;
}

export function Pagination({ page = 1, totalPages = 1, onChange }) {
  return <div className="pagination">
    <span>Page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
    <div><button className="icon-button" disabled={page <= 1} aria-label="Previous page" onClick={() => onChange(page - 1)}><ChevronLeft size={18} /></button><button className="icon-button" disabled={page >= totalPages} aria-label="Next page" onClick={() => onChange(page + 1)}><ChevronRight size={18} /></button></div>
  </div>;
}

export function ConfirmDialog({ title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try { await onConfirm(); onClose(); }
    catch (e) { setError(e.message || 'The action could not be completed.'); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button className="modal-close icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button>
      <span className={`modal-symbol ${danger ? 'modal-symbol--danger' : ''}`}>{danger ? <AlertCircle size={20} /> : <Check size={20} />}</span>
      <h2 id="modal-title">{title}</h2><p>{description}</p>{children}{error && <div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={submit}>{confirmLabel}<ArrowRight size={15} /></Button></div>
    </section>
  </div>;
}

export function Field({ label, hint, error, className = '', as, ...props }) {
  const id = props.id || props.name;
  return <label className={`field ${className}`} htmlFor={id}>
    <span className="field-label">{label}</span>
    {as === 'textarea'
      ? <textarea {...props} id={id} aria-invalid={Boolean(error)} />
      : as === 'select'
        ? <select {...props} id={id} aria-invalid={Boolean(error)} />
        : <input {...props} id={id} aria-invalid={Boolean(error)} />}
    {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
  </label>;
}
