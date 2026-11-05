export const money = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100);

export const dateTime = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

export const dateOnly = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
  : '—';

export const bytes = (value) => {
  if (!Number.isFinite(value)) return '—';
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
};

export const location = (address = {}) => [address.locality, address.city].filter(Boolean).join(', ');
export const humanize = (value = '') => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const queryString = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null)).toString();
