# PrintRelay — Upload. Print. Collect.

A multi-shop digital printing order and queue management platform (MERN stack).
Customers upload a PDF, choose print preferences, place an order with a local print shop, track their real queue position, then pay and collect at the counter. Shop owners receive orders, print them on their own printers and manage the queue.

> PrintRelay manages digital orders and queues. It does **not** control physical printers.

## Project status

| Part | Status |
|---|---|
| Backend API (auth, shops, PDF upload, pricing, orders, FIFO queue, payment, pickup, notifications, admin) | **Implemented** |
| Backend unit + HTTP smoke tests | **Passing** (17/17, run locally) |
| Backend end-to-end workflow test (`npm run test:integration`) | Written, **not yet executed** (needs a MongoDB binary) |
| Frontend (React + Vite + Tailwind) | **Not started** — folders scaffolded in `frontend/` |
| Presentation (`docs/presentation/`) | Not started |
| Deployment | Not done |

## Team

| Name | Roll / Registration No. |
|---|---|
| _TODO: Member 1_ | _TODO_ |
| _TODO: Member 2_ | _TODO_ |
| _TODO: Member 3_ | _TODO_ |

## Objectives
- Remove physical waiting at print shops.
- Give every shop an independent, strictly FIFO queue with real positions (no invented wait times).
- Keep customer documents private (GridFS, authenticated access only).

## Tech stack
- **Backend:** Node.js, Express 4, MongoDB (Atlas) + Mongoose, GridFS, JWT in HttpOnly cookies, bcrypt (`bcryptjs`), Multer, Zod, pdf-lib, qrcode, Socket.IO, Helmet, express-rate-limit
- **Frontend (planned):** React, Vite, JavaScript, Tailwind CSS, React Router, Axios, Lucide, PDF.js, Socket.IO client

## Repository layout
```
PrintRelay/
├── backend/        Express API (see backend/README.md for the full API reference)
│   ├── config/ controllers/ middleware/ models/ routes/
│   ├── services/ validators/ sockets/ utils/ scripts/ tests/
├── frontend/       Vite + React app (scaffold only)
├── docs/presentation/
└── README.md
```

## Architecture overview
```
React (Vercel) ──HTTPS + HttpOnly cookie──▶ Express API (Render) ──▶ MongoDB Atlas
        ▲                                      │   ├─ collections: users, shops, orders, orderevents, notifications, counters
        └────────── Socket.IO (live updates) ──┘   └─ GridFS bucket "orderFiles" (private PDFs)
```
Key design decisions
- **Queue:** `Shop.nextQueueSeq` is bumped with an atomic `$inc` when a shop *accepts* an order. Position = number of `ACCEPTED`/`PRINTING` orders at the same shop with a lower sequence, +1. A unique partial index `(shop, queueSequence)` prevents duplicates; a unique partial index on `status: PRINTING` guarantees one printing order per shop at the database level. Starting an order is only allowed for the head of the queue (strict FIFO).
- **State changes** use `findOneAndUpdate` filtered on the previous status, so concurrent requests cannot both win. Every change writes an `OrderEvent` (who, when, from → to).
- **Pricing:** computed only on the server in integer paise: `selectedPages × copies × rate + bindingFee × copies`; a snapshot is stored on the order.
- **Pickup:** token and 6-digit code are HMAC-derived from a server secret, order id and per-order nonce. Only a SHA-256 hash of the token is stored; it is single use and requires `PAID`.
- **Auth:** JWT in an HttpOnly cookie (never localStorage). State-changing requests require an `X-Requested-With: PrintRelay` header (forces a CORS preflight → CSRF defence for cross-site cookies).

## Setup (backend)
Prerequisites: Node.js ≥ 18.18, a MongoDB Atlas cluster (free tier is fine).
```bash
cd backend
cp .env.example .env        # fill in MONGODB_URI and secrets
npm install
npm run seed:admin          # creates the single admin from ADMIN_* env vars
npm run dev                 # http://localhost:5000/api/health
npm test                    # unit + smoke tests
```
Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Environment variables (backend)
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET`, `PICKUP_SECRET` | ≥ 32 random chars, different from each other |
| `CLIENT_ORIGINS` | Exact frontend origin(s), comma-separated (no trailing slash) |
| `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | Optional overrides (`none` + HTTPS is the production default) |
| `MAX_UPLOAD_MB`, `MAX_PDF_PAGES` | Upload limits (10 MB / 500 pages) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `seed:admin` (password ≥ 12 chars) |

### Deployment notes
- **Backend → Render** (Web Service, root `backend`, build `npm install`, start `npm start`). Set all env vars; set `CLIENT_ORIGINS` to the Vercel URL. In Atlas, allow Render's outbound IPs (or `0.0.0.0/0` for a student project).
- **Frontend → Vercel**, with `VITE_API_URL` pointing at the Render URL.
- Cross-site cookies need HTTPS on both sides. Safari/Brave may block third-party cookies; the most robust option is to have Vercel proxy `/api/*` to Render (rewrites) so everything is same-site.
- Render's free tier sleeps after inactivity; first request can be slow.
