# PrintRelay frontend (to be built)

Folder scaffold only. Planned: React + Vite + JavaScript + Tailwind, React Router, Axios, Lucide, PDF.js, Socket.IO client.

Integration contract (see `../backend/README.md`):
- Axios instance: `baseURL = import.meta.env.VITE_API_URL + '/api'`, `withCredentials: true`,
  default header `X-Requested-With: PrintRelay` (required on POST/PATCH/DELETE).
- Success body: `{ data, pagination? }`. Error body: `{ error: { message, details?, code? } }`.
- Socket.IO: `io(VITE_API_URL, { withCredentials: true })`; events `notification` and `order:updated`.
  Always refetch from the API after (re)connecting — the database is the source of truth.
- Prices are integer **paise**; divide by 100 for display.
